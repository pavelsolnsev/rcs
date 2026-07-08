import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { eq, and, asc, desc, inArray } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import * as schema from '../db/schema'
import { tournaments, teams, matches, media } from '../db/schema'
import {
  buildBracket,
  persistRows,
  progression,
  championOf,
  grandFinalResetPlacements,
  autoAdvanceByes,
  applyBestOf,
  type BracketRow,
  type BuildOpts,
} from './formats'
import { computeStandings, seedPlayoffOrder, buildEmptyElim, buildGroupMatches } from './formats/groups'
import { deleteUploadByUrl, getTournamentMediaUsage } from './uploads'

/** Кэш времени начала live-матча (серверный процесс). */
const liveStartedAtCache = new Map<number, string>()

// ---------- Общие типы ----------
export interface CreateTournamentInput {
  name: string
  description?: string | null
  format: string
  teamSize: string
  teamNames: string[]
  teamRosters?: { nickname: string; role?: 'captain' | 'player'; steamId?: string | null }[][]
  groupSize?: number
  qualifiers?: number
  boGroups?: number
  boMain?: number
  boFinal?: number
}
export interface MatchPatch {
  scoreA: number
  scoreB: number
  status: 'pending' | 'live' | 'finished'
  bestOf?: number
  maps?: { map: string | null; scoreA: number; scoreB: number }[]
}
export interface TeamPlayerInput {
  nickname?: string
  role?: 'captain' | 'player'
  steamId?: string | null
}
export interface AddTeamInput {
  name: string
  logoUrl?: string | null
  roster?: TeamPlayerInput[]
}
export interface UpdateTeamInput {
  name?: string
  logoUrl?: string | null
  roster?: TeamPlayerInput[]
}
export interface AddMediaInput {
  type: 'photo' | 'video'
  url: string
  thumbUrl?: string | null
  caption?: string | null
}
export interface AddMatchInput {
  bracket?: string
  round?: number
  label?: string | null
  bestOf?: number
  teamAId?: number | null
  teamBId?: number | null
}
export interface Repo {
  readonly kind: 'mysql' | 'memory'
  listTournaments(): Promise<any[]>
  getTournament(
    id: number,
  ): Promise<{ tournament: any; teams: any[]; matches: any[]; media?: any[]; mediaUsage?: any } | null>
  createTournament(input: CreateTournamentInput): Promise<{ id: number }>
  deleteTournament(id: number): Promise<void>
  finishTournament(id: number): Promise<{ championTeamId: number | null }>
  updateMatch(id: number, patch: MatchPatch): Promise<{ winnerTeamId: number | null }>
  addMatch(tournamentId: number, input: AddMatchInput): Promise<{ id: number }>
  deleteMatch(id: number): Promise<void>
  seedPlayoff(id: number, qualifiers: number): Promise<{ seeded: number }>
  swapGroupTeams(id: number, teamAId: number, teamBId: number): Promise<void>
  addTeam(tournamentId: number, input: AddTeamInput): Promise<{ id: number }>
  removeTeam(teamId: number): Promise<void>
  updateTeam(teamId: number, patch: UpdateTeamInput): Promise<{ id: number }>
  addMedia(tournamentId: number, input: AddMediaInput): Promise<{ id: number }>
  removeMedia(mediaId: number): Promise<void>
  verifyAdmin(username: string, password: string): Promise<{ id: number; username: string } | null>
}

/** Нормализует состав одной команды под нужный размер (переиспользует общую логику). */
function normalizeOneRoster(teamName: string, roster: TeamPlayerInput[] | undefined, expected: number) {
  return buildNormalizedRosters([teamName], roster ? [roster as any] : undefined, expected)[0]!
}

/** Опции пересборки сетки: best-of из турнира, размер группы восстанавливаем из текущих групп. */
function rebuildOpts(
  t: { boGroups: number; boMain: number; boFinal: number },
  existing: { bracket: string; groupLabel: string | null; teamAId: number | null; teamBId: number | null }[],
): BuildOpts {
  const bestOf = { groups: t.boGroups, main: t.boMain, final: t.boFinal }
  const perGroup = new Map<string, Set<number>>()
  for (const m of existing) {
    if (m.bracket !== 'group' || !m.groupLabel) continue
    const set = perGroup.get(m.groupLabel) ?? new Set<number>()
    if (m.teamAId) set.add(m.teamAId)
    if (m.teamBId) set.add(m.teamBId)
    perGroup.set(m.groupLabel, set)
  }
  const groupSize = perGroup.size ? Math.max(...[...perGroup.values()].map((s) => s.size)) : 4
  return { groupSize, bestOf }
}

/**
 * Пересобирает состав групп из существующих матчей, сохраняя распределение:
 * удалённые команды выбывают, новые (ещё не в группах) попадают в наименьшую группу.
 * Возвращает [] если групп ещё нет (тогда используется обычная сборка чанками).
 */
function groupsMembership(
  existing: { bracket: string; groupLabel: string | null; teamAId: number | null; teamBId: number | null }[],
  orderedTeamIds: number[],
): number[][] {
  const byLabel = new Map<string, number[]>()
  const seen = new Set<number>()
  const add = (label: string, id: number | null) => {
    if (!id || seen.has(id)) return
    seen.add(id)
    ;(byLabel.get(label) ?? byLabel.set(label, []).get(label)!).push(id)
  }
  for (const m of existing) {
    if (m.bracket !== 'group' || !m.groupLabel) continue
    add(m.groupLabel, m.teamAId)
    add(m.groupLabel, m.teamBId)
  }
  const valid = new Set(orderedTeamIds)
  // Группы по меткам, без удалённых команд
  const groups = [...byLabel.keys()]
    .sort()
    .map((l) => byLabel.get(l)!.filter((id) => valid.has(id)))
  if (!groups.length) return []

  // Новые команды — в наименьшую группу
  const placed = new Set(groups.flat())
  for (const id of orderedTeamIds) {
    if (placed.has(id)) continue
    let min = 0
    for (let i = 1; i < groups.length; i++) if (groups[i]!.length < groups[min]!.length) min = i
    groups[min]!.push(id)
    placed.add(id)
  }
  return groups.filter((g) => g.length > 0)
}

/**
 * Решает, куда именно вставить матч, добавленный вручную (для дозаполнения
 * сетки задним числом — например, несыгранного финала или бонусного матча).
 * Если раздел/раунд не заданы — подставляет продолжение существующей сетки.
 */
function resolveNewMatchPlacement(
  existing: { bracket: string; round: number }[],
  input: AddMatchInput,
  defaultBestOf: number,
) {
  const bracket =
    input.bracket && existing.some((m) => m.bracket === input.bracket)
      ? input.bracket
      : (existing[0]?.bracket ?? 'winners')
  const sameBracket = existing.filter((m) => m.bracket === bracket)
  const round =
    Number(input.round) > 0
      ? Number(input.round)
      : sameBracket.reduce((mx, m) => Math.max(mx, m.round), 0) + 1
  const position = sameBracket.filter((m) => m.round === round).length
  const bestOf = [1, 3, 5].includes(Number(input.bestOf)) ? Number(input.bestOf) : defaultBestOf
  return { bracket, round, position, bestOf }
}

/** Меняет две команды местами в наборе групповых матчей и сбрасывает затронутые результаты. */
function applyGroupSwap<T extends {
  bracket: string
  teamAId: number | null
  teamBId: number | null
}>(groupMatches: T[], teamAId: number, teamBId: number): T[] {
  const swap = (x: number | null) => (x === teamAId ? teamBId : x === teamBId ? teamAId : x)
  const changed: T[] = []
  for (const m of groupMatches) {
    const a = swap(m.teamAId)
    const b = swap(m.teamBId)
    if (a === m.teamAId && b === m.teamBId) continue
    m.teamAId = a
    m.teamBId = b
    changed.push(m)
  }
  return changed
}

// ======================================================
//  MySQL-реализация (хостинг / когда БД доступна)
// ======================================================
class MysqlRepo implements Repo {
  readonly kind = 'mysql' as const
  constructor(private db: MySql2Database<typeof schema>) {}

  async listTournaments() {
    const list = await this.db.select().from(tournaments).orderBy(desc(tournaments.createdAt))
    if (!list.length) return list

    const tIds = list.map((t) => t.id)
    const liveRows = await this.db
      .select({
        id: matches.id,
        tournamentId: matches.tournamentId,
        bracket: matches.bracket,
        groupLabel: matches.groupLabel,
        teamAId: matches.teamAId,
        teamBId: matches.teamBId,
        scoreA: matches.scoreA,
        scoreB: matches.scoreB,
        bestOf: matches.bestOf,
        label: matches.label,
        maps: matches.maps,
        round: matches.round,
        position: matches.position,
      })
      .from(matches)
      .where(and(inArray(matches.tournamentId, tIds), eq(matches.status, 'live')))
      .orderBy(asc(matches.round), asc(matches.position))

    if (!liveRows.length) return list.map((t) => ({ ...t, liveMatches: [] }))

    const teamIds = Array.from(
      new Set(
        liveRows.flatMap((m) => [m.teamAId, m.teamBId]).filter((x): x is number => x != null),
      ),
    )
    const teamRows = teamIds.length
      ? await this.db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, teamIds))
      : []
    const nameById = new Map(teamRows.map((t) => [t.id, t.name] as const))

    const byTournament = new Map<number, any[]>()
    for (const m of liveRows) {
      const arr = byTournament.get(m.tournamentId) ?? []
      arr.push({
        id: m.id,
        label: m.label ?? null,
        meta: liveMatchMeta(m.label, m.bracket, m.groupLabel, m.position, m.id),
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        bestOf: m.bestOf ?? 1,
        teamAName: m.teamAId ? (nameById.get(m.teamAId) ?? 'Ожидается') : 'Ожидается',
        teamBName: m.teamBId ? (nameById.get(m.teamBId) ?? 'Ожидается') : 'Ожидается',
        maps: extractLiveMatchMaps(m.maps),
        liveStartedAt: getOrSetLiveStartedAt(m.id),
      })
      byTournament.set(m.tournamentId, arr)
    }

    return list.map((t) => ({
      ...t,
      liveMatches: byTournament.get(t.id) ?? [],
    }))
  }

  async getTournament(id: number) {
    const [tournament] = await this.db.select().from(tournaments).where(eq(tournaments.id, id))
    if (!tournament) return null
    const teamRows = await this.db.select().from(teams).where(eq(teams.tournamentId, id))
    const matchRows = await this.db
      .select()
      .from(matches)
      .where(eq(matches.tournamentId, id))
      .orderBy(asc(matches.round), asc(matches.position))
    // Таблица media могла ещё не быть создана (до `npm run db:push`) — не роняем страницу.
    let mediaRows: (typeof media.$inferSelect)[] = []
    try {
      mediaRows = await this.db
        .select()
        .from(media)
        .where(eq(media.tournamentId, id))
        .orderBy(asc(media.sortOrder), asc(media.id))
    } catch {
      mediaRows = []
    }
    const mediaUsage = await getTournamentMediaUsage(mediaRows)
    return { tournament, teams: teamRows, matches: matchRows, media: mediaRows, mediaUsage }
  }

  async createTournament(input: CreateTournamentInput) {
    const bo = normalizeBestOf(input)
    const expectedRoster = expectedRosterSize(input.teamSize)
    const normalizedRosters = buildNormalizedRosters(input.teamNames, input.teamRosters, expectedRoster)
    const [created] = await this.db
      .insert(tournaments)
      .values({
        name: input.name,
        description: input.description ?? null,
        format: input.format as any,
        teamSize: input.teamSize as any,
        status: 'ongoing',
        boGroups: bo.groups,
        boMain: bo.main,
        boFinal: bo.final,
      })
      .$returningId()
    if (!created) throw createError({ statusCode: 500, statusMessage: 'Не удалось создать турнир' })
    const tId = created.id

    let seed = 1
    for (const [idx, name] of input.teamNames.entries()) {
      await this.db.insert(teams).values({
        tournamentId: tId,
        name,
        roster: normalizedRosters[idx] ?? [],
        seed: seed++,
      })
    }
    const inserted = await this.db.select().from(teams).where(eq(teams.tournamentId, tId))
    inserted.sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0))

    let local = 0
    const rows = buildBracket(input.format, inserted.map((t) => t.id), () => ++local, {
      groupSize: input.groupSize,
      qualifiers: input.qualifiers,
      bestOf: bo,
    })
    await persistRows(this.db, tId, rows)
    return { id: tId }
  }

  async deleteTournament(id: number) {
    await this.db.delete(media).where(eq(media.tournamentId, id))
    await this.db.delete(matches).where(eq(matches.tournamentId, id))
    await this.db.delete(teams).where(eq(teams.tournamentId, id))
    await this.db.delete(tournaments).where(eq(tournaments.id, id))
  }

  async finishTournament(id: number) {
    const all = await this.db.select().from(matches).where(eq(matches.tournamentId, id))
    const championTeamId = championOf(all)
    await this.db
      .update(tournaments)
      .set({ status: 'finished', championTeamId, finishedAt: new Date() })
      .where(eq(tournaments.id, id))
    return { championTeamId }
  }

  async updateMatch(id: number, patch: MatchPatch) {
    const [m] = await this.db.select().from(matches).where(eq(matches.id, id))
    if (!m) throw createError({ statusCode: 404, statusMessage: 'Матч не найден' })

    const finished = patch.status === 'finished'
    // При равном счёте (ничья) победителя нет
    const winnerTeamId =
      finished && patch.scoreA !== patch.scoreB
        ? patch.scoreA > patch.scoreB
          ? m.teamAId
          : m.teamBId
        : null

    await this.db
      .update(matches)
      .set({
        scoreA: patch.scoreA,
        scoreB: patch.scoreB,
        status: patch.status,
        winnerTeamId,
        ...(patch.bestOf ? { bestOf: patch.bestOf } : {}),
        ...(patch.status === 'pending' ? { maps: null } : {}),
        ...(hasNamedMap(patch.maps) ? { maps: patch.maps } : {}),
      })
      .where(eq(matches.id, id))

    if (patch.status === 'live' && m.status !== 'live') {
      liveStartedAtCache.set(id, new Date().toISOString())
    } else if (patch.status !== 'live') {
      liveStartedAtCache.delete(id)
    }

    for (const p of progression({ ...m, winnerTeamId }, finished)) {
      const set = p.slot === 'a' ? { teamAId: p.teamId } : { teamBId: p.teamId }
      await this.db.update(matches).set(set).where(eq(matches.id, p.matchId))
    }

    // Гранд-финал: активируем/очищаем матч-ресет по итогу GF1
    if (m.bracket === 'grand_final') {
      const [reset] = await this.db
        .select()
        .from(matches)
        .where(and(eq(matches.tournamentId, m.tournamentId), eq(matches.bracket, 'grand_final_reset')))
      if (reset) {
        const [a, b] = grandFinalResetPlacements({ ...m, winnerTeamId }, reset.id, finished)
        const cleared = a.teamId == null
        await this.db
          .update(matches)
          .set({
            teamAId: a.teamId,
            teamBId: b.teamId,
            ...(cleared ? { scoreA: 0, scoreB: 0, status: 'pending', winnerTeamId: null } : {}),
          })
          .where(eq(matches.id, reset.id))
      }
    }

    // Если правим уже завершённый турнир — пересчитываем чемпиона в архиве.
    const [t] = await this.db.select().from(tournaments).where(eq(tournaments.id, m.tournamentId))
    if (t?.status === 'finished') {
      const all = await this.db.select().from(matches).where(eq(matches.tournamentId, m.tournamentId))
      await this.db
        .update(tournaments)
        .set({ championTeamId: championOf(all) })
        .where(eq(tournaments.id, m.tournamentId))
    }
    return { winnerTeamId }
  }

  async addMatch(tournamentId: number, input: AddMatchInput) {
    const [t] = await this.db.select().from(tournaments).where(eq(tournaments.id, tournamentId))
    if (!t) throw createError({ statusCode: 404, statusMessage: 'Турнир не найден' })
    const existing = await this.db.select().from(matches).where(eq(matches.tournamentId, tournamentId))
    const { bracket, round, position, bestOf } = resolveNewMatchPlacement(existing, input, t.boFinal)

    const teamRows = await this.db.select().from(teams).where(eq(teams.tournamentId, tournamentId))
    const teamIds = new Set(teamRows.map((x) => x.id))
    const teamAId = input.teamAId && teamIds.has(input.teamAId) ? input.teamAId : null
    const teamBId = input.teamBId && teamIds.has(input.teamBId) ? input.teamBId : null

    const [created] = await this.db
      .insert(matches)
      .values({
        tournamentId,
        bracket,
        round,
        position,
        teamAId,
        teamBId,
        bestOf,
        status: 'pending',
        label: input.label?.trim() || null,
      })
      .$returningId()
    return { id: created!.id }
  }

  async deleteMatch(id: number) {
    const [m] = await this.db.select().from(matches).where(eq(matches.id, id))
    if (!m) throw createError({ statusCode: 404, statusMessage: 'Матч не найден' })

    // Разрываем продвижение вперёд (как при откате в pending).
    for (const p of progression(m, false)) {
      const set = p.slot === 'a' ? { teamAId: p.teamId } : { teamBId: p.teamId }
      await this.db.update(matches).set(set).where(eq(matches.id, p.matchId))
    }
    // Разрываем ссылки других матчей на удаляемый (иначе будут вести в никуда).
    await this.db
      .update(matches)
      .set({ nextMatchId: null, nextSlot: null })
      .where(eq(matches.nextMatchId, id))
    await this.db
      .update(matches)
      .set({ loserNextMatchId: null, loserNextSlot: null })
      .where(eq(matches.loserNextMatchId, id))

    await this.db.delete(matches).where(eq(matches.id, id))

    // Если турнир уже в архиве — пересчитываем чемпиона (финал мог исчезнуть).
    const [t] = await this.db.select().from(tournaments).where(eq(tournaments.id, m.tournamentId))
    if (t?.status === 'finished') {
      const all = await this.db.select().from(matches).where(eq(matches.tournamentId, m.tournamentId))
      await this.db
        .update(tournaments)
        .set({ championTeamId: championOf(all) })
        .where(eq(tournaments.id, m.tournamentId))
    }
  }

  async seedPlayoff(id: number, qualifiers: number) {
    const teamRows = await this.db.select().from(teams).where(eq(teams.tournamentId, id))
    const all = await this.db.select().from(matches).where(eq(matches.tournamentId, id))
    const [t] = await this.db.select().from(tournaments).where(eq(tournaments.id, id))
    const order = computeSeedOrder(teamRows, all, qualifiers)

    // Пересоздаём сетку плей-офф под число проходящих команд
    await this.db
      .delete(matches)
      .where(and(eq(matches.tournamentId, id), eq(matches.bracket, 'playoff')))
    let local = 0
    const rows = buildSeededPlayoff(order, () => ++local)
    applyBestOf(rows, { main: t?.boMain ?? 1, final: t?.boFinal ?? 1 })
    await persistRows(this.db, id, rows)
    return { seeded: order.filter(Boolean).length }
  }

  async swapGroupTeams(id: number, teamAId: number, teamBId: number) {
    const groupMatches = await this.db
      .select()
      .from(matches)
      .where(and(eq(matches.tournamentId, id), eq(matches.bracket, 'group')))
    for (const m of applyGroupSwap(groupMatches, teamAId, teamBId)) {
      // Соперники поменялись — прежний результат неактуален, сбрасываем матч.
      await this.db
        .update(matches)
        .set({
          teamAId: m.teamAId,
          teamBId: m.teamBId,
          scoreA: 0,
          scoreB: 0,
          status: 'pending',
          winnerTeamId: null,
          maps: null,
        })
        .where(eq(matches.id, m.id))
    }
  }

  // Пересобирает матчи турнира под текущий список команд (после добавления/удаления).
  // Счёт сыгранных матчей сбрасывается, чемпион очищается.
  private async rebuildBracket(tournamentId: number) {
    const [t] = await this.db.select().from(tournaments).where(eq(tournaments.id, tournamentId))
    if (!t) throw createError({ statusCode: 404, statusMessage: 'Турнир не найден' })
    const existing = await this.db.select().from(matches).where(eq(matches.tournamentId, tournamentId))
    const teamRows = await this.db.select().from(teams).where(eq(teams.tournamentId, tournamentId))
    teamRows.sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0))

    await this.db.delete(matches).where(eq(matches.tournamentId, tournamentId))
    const ids = teamRows.map((x) => x.id)
    let local = 0
    const alloc = () => ++local
    // Для групп сохраняем распределение команд, новую — в наименьшую группу.
    const membership = groupsMembership(existing, ids)
    let rows: BracketRow[]
    if (t.format === 'groups_playoff' && membership.length) {
      rows = buildGroupMatches(membership, alloc)
      applyBestOf(rows, { groups: t.boGroups, main: t.boMain, final: t.boFinal })
    } else {
      rows = buildBracket(t.format, ids, alloc, rebuildOpts(t, existing))
    }
    await persistRows(this.db, tournamentId, rows)
    await this.db
      .update(tournaments)
      .set({ championTeamId: null })
      .where(eq(tournaments.id, tournamentId))
  }

  async addTeam(tournamentId: number, input: AddTeamInput) {
    const [t] = await this.db.select().from(tournaments).where(eq(tournaments.id, tournamentId))
    if (!t) throw createError({ statusCode: 404, statusMessage: 'Турнир не найден' })
    const existing = await this.db.select().from(teams).where(eq(teams.tournamentId, tournamentId))
    const maxSeed = existing.reduce((mx, x) => Math.max(mx, x.seed ?? 0), 0)
    const [created] = await this.db
      .insert(teams)
      .values({
        tournamentId,
        name: input.name,
        logoUrl: input.logoUrl ?? null,
        roster: normalizeOneRoster(input.name, input.roster, expectedRosterSize(t.teamSize)),
        seed: maxSeed + 1,
      })
      .$returningId()
    await this.rebuildBracket(tournamentId)
    return { id: created!.id }
  }

  async removeTeam(teamId: number) {
    const [team] = await this.db.select().from(teams).where(eq(teams.id, teamId))
    if (!team) throw createError({ statusCode: 404, statusMessage: 'Команда не найдена' })
    const rest = await this.db.select().from(teams).where(eq(teams.tournamentId, team.tournamentId))
    if (rest.length <= 2) {
      throw createError({ statusCode: 400, statusMessage: 'В турнире должно остаться минимум 2 команды' })
    }
    await this.db.delete(teams).where(eq(teams.id, teamId))
    await this.rebuildBracket(team.tournamentId)
  }

  async updateTeam(teamId: number, patch: UpdateTeamInput) {
    const [team] = await this.db.select().from(teams).where(eq(teams.id, teamId))
    if (!team) throw createError({ statusCode: 404, statusMessage: 'Команда не найдена' })
    const set: Record<string, unknown> = {}
    if (typeof patch.name === 'string' && patch.name.trim()) set.name = patch.name.trim()
    if (patch.logoUrl !== undefined) set.logoUrl = patch.logoUrl || null
    if (patch.roster !== undefined) {
      const [t] = await this.db
        .select()
        .from(tournaments)
        .where(eq(tournaments.id, team.tournamentId))
      set.roster = normalizeOneRoster(
        (typeof patch.name === 'string' && patch.name.trim()) || team.name,
        patch.roster,
        expectedRosterSize(t?.teamSize ?? '5x5'),
      )
    }
    if (Object.keys(set).length) await this.db.update(teams).set(set).where(eq(teams.id, teamId))
    return { id: teamId }
  }

  async addMedia(tournamentId: number, input: AddMediaInput) {
    const existing = await this.db.select().from(media).where(eq(media.tournamentId, tournamentId))
    const [created] = await this.db
      .insert(media)
      .values({
        tournamentId,
        type: input.type,
        url: input.url,
        thumbUrl: input.thumbUrl ?? null,
        caption: input.caption ?? null,
        sortOrder: existing.length,
      })
      .$returningId()
    return { id: created!.id }
  }

  async removeMedia(mediaId: number) {
    const [row] = await this.db.select().from(media).where(eq(media.id, mediaId))
    if (row) {
      await deleteUploadByUrl(row.url)
      await deleteUploadByUrl(row.thumbUrl)
    }
    await this.db.delete(media).where(eq(media.id, mediaId))
  }

  async verifyAdmin(username: string, password: string) {
    const [user] = await this.db
      .select()
      .from(schema.adminUsers)
      .where(eq(schema.adminUsers.username, username))
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null
    return { id: user.id, username: user.username }
  }
}

// ======================================================
//  In-memory демо-реализация (локально без БД)
// ======================================================
type MemMatch = BracketRow & { tournamentId: number }

class MemoryRepo implements Repo {
  readonly kind = 'memory' as const
  private tournaments: any[] = []
  private teams: any[] = []
  private matches: MemMatch[] = []
  private mediaItems: any[] = []
  private seq = 1
  private id = () => this.seq++

  constructor() {
    this.seedDemo('CS2 Weekly Cup #14', 'ongoing', 'single_elimination', [
      'Navi', 'Vitality', 'FaZe', 'G2', 'Spirit', 'MOUZ', 'Astralis', 'Heroic',
    ])
    const archiveId = this.seedDemo('CS2 Spring Open 2026', 'finished', 'single_elimination', [
      'Falcons', 'Complexity', 'Liquid', 'Cloud9',
    ])
    this.playOut(archiveId)
  }

  private addRows(
    tournamentId: number,
    format: string,
    teamNames: string[],
    rosters: { nickname: string; role?: 'captain' | 'player'; steamId?: string | null }[][] = [],
    opts: any = {},
  ) {
    let seed = 1
    const teamIds: number[] = []
    for (const [idx, name] of teamNames.entries()) {
      const id = this.id()
      this.teams.push({
        id,
        tournamentId,
        name,
        logoUrl: null,
        roster: rosters[idx] ?? [],
        seed: seed++,
      })
      teamIds.push(id)
    }
    const rows = buildBracket(format, teamIds, this.id, opts)
    for (const r of rows) this.matches.push({ ...r, tournamentId })
    return teamIds
  }

  private seedDemo(name: string, status: string, format: string, teamNames: string[]) {
    const id = this.id()
    this.tournaments.push({
      id, name, description: null, format, teamSize: '5x5', status,
      championTeamId: null, boGroups: 1, boMain: 1, boFinal: 1,
      createdAt: new Date().toISOString(), finishedAt: null,
    })
    this.addRows(id, format, teamNames, buildNormalizedRosters(teamNames, undefined, 5))
    return id
  }

  private playOut(tournamentId: number) {
    const rows = this.matches
      .filter((m) => m.tournamentId === tournamentId)
      .sort((a, b) => a.round - b.round || a.position - b.position)
    for (const m of rows) {
      if (!m.teamAId || !m.teamBId) continue
      m.scoreA = 16
      m.scoreB = 8 + ((m.position + m.round) % 6)
      m.status = 'finished'
      m.winnerTeamId = m.teamAId
      for (const p of progression(m, true)) {
        const t = this.matches.find((x) => x.id === p.matchId)
        if (t) (p.slot === 'a' ? (t.teamAId = p.teamId) : (t.teamBId = p.teamId))
      }
    }
    const t = this.tournaments.find((x) => x.id === tournamentId)
    if (t) {
      t.championTeamId = championOf(rows)
      t.finishedAt = new Date().toISOString()
    }
  }

  async listTournaments() {
    const list = [...this.tournaments].sort((a, b) => b.id - a.id)
    const nameById = new Map(this.teams.map((t) => [t.id, t.name] as const))

    const byTournament = new Map<number, any[]>()
    const liveRows = this.matches
      .filter((m) => m.status === 'live')
      .sort((a, b) => a.round - b.round || a.position - b.position)
    for (const m of liveRows) {
      const arr = byTournament.get(m.tournamentId) ?? []
      arr.push({
        id: m.id,
        label: m.label ?? null,
        meta: liveMatchMeta(m.label, m.bracket, m.groupLabel, m.position, m.id),
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        bestOf: m.bestOf ?? 1,
        teamAName: m.teamAId ? (nameById.get(m.teamAId) ?? 'Ожидается') : 'Ожидается',
        teamBName: m.teamBId ? (nameById.get(m.teamBId) ?? 'Ожидается') : 'Ожидается',
        maps: extractLiveMatchMaps(m.maps),
        liveStartedAt: getOrSetLiveStartedAt(m.id),
      })
      byTournament.set(m.tournamentId, arr)
    }

    return list.map((t) => ({
      ...t,
      liveMatches: byTournament.get(t.id) ?? [],
    }))
  }

  async getTournament(id: number) {
    const tournament = this.tournaments.find((t) => t.id === id)
    if (!tournament) return null
    const mediaRows = this.mediaItems
      .filter((m) => m.tournamentId === id)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    const mediaUsage = await getTournamentMediaUsage(mediaRows)
    return {
      tournament,
      teams: this.teams.filter((t) => t.tournamentId === id),
      matches: this.matches
        .filter((m) => m.tournamentId === id)
        .sort((a, b) => a.round - b.round || a.position - b.position),
      media: mediaRows,
      mediaUsage,
    }
  }

  async createTournament(input: CreateTournamentInput) {
    const id = this.id()
    const bo = normalizeBestOf(input)
    const expectedRoster = expectedRosterSize(input.teamSize)
    const normalizedRosters = buildNormalizedRosters(input.teamNames, input.teamRosters, expectedRoster)
    this.tournaments.push({
      id, name: input.name, description: input.description ?? null,
      format: input.format, teamSize: input.teamSize, status: 'ongoing',
      championTeamId: null, boGroups: bo.groups, boMain: bo.main, boFinal: bo.final,
      createdAt: new Date().toISOString(), finishedAt: null,
    })
    this.addRows(id, input.format, input.teamNames, normalizedRosters, {
      groupSize: input.groupSize,
      qualifiers: input.qualifiers,
      bestOf: bo,
    })
    return { id }
  }

  async deleteTournament(id: number) {
    this.tournaments = this.tournaments.filter((t) => t.id !== id)
    this.teams = this.teams.filter((t) => t.tournamentId !== id)
    this.matches = this.matches.filter((m) => m.tournamentId !== id)
    this.mediaItems = this.mediaItems.filter((m) => m.tournamentId !== id)
  }

  async finishTournament(id: number) {
    const ms = this.matches.filter((m) => m.tournamentId === id)
    const championTeamId = championOf(ms)
    const t = this.tournaments.find((x) => x.id === id)
    if (t) {
      t.status = 'finished'
      t.championTeamId = championTeamId
      t.finishedAt = new Date().toISOString()
    }
    return { championTeamId }
  }

  async updateMatch(id: number, patch: MatchPatch) {
    const m = this.matches.find((x) => x.id === id)
    if (!m) throw createError({ statusCode: 404, statusMessage: 'Матч не найден' })
    const prevStatus = m.status
    const finished = patch.status === 'finished'
    m.scoreA = patch.scoreA
    m.scoreB = patch.scoreB
    if (patch.bestOf) m.bestOf = patch.bestOf
    if (patch.status === 'pending') m.maps = null
    else if (hasNamedMap(patch.maps)) m.maps = patch.maps
    m.status = patch.status
    if (patch.status === 'live' && prevStatus !== 'live') {
      liveStartedAtCache.set(id, new Date().toISOString())
    } else if (patch.status !== 'live') {
      liveStartedAtCache.delete(id)
    }
    // При равном счёте (ничья) победителя нет
    m.winnerTeamId =
      finished && patch.scoreA !== patch.scoreB
        ? patch.scoreA > patch.scoreB
          ? m.teamAId
          : m.teamBId
        : null
    for (const p of progression(m, finished)) {
      const t = this.matches.find((x) => x.id === p.matchId)
      if (t) (p.slot === 'a' ? (t.teamAId = p.teamId) : (t.teamBId = p.teamId))
    }

    // Гранд-финал: активируем/очищаем матч-ресет
    if (m.bracket === 'grand_final') {
      const reset = this.matches.find(
        (x) => x.tournamentId === m.tournamentId && x.bracket === 'grand_final_reset',
      )
      if (reset) {
        const [a, b] = grandFinalResetPlacements(m, reset.id, finished)
        reset.teamAId = a.teamId
        reset.teamBId = b.teamId
        if (a.teamId == null) {
          reset.scoreA = 0
          reset.scoreB = 0
          reset.status = 'pending'
          reset.winnerTeamId = null
        }
      }
    }

    // Пересчёт чемпиона при правке архивного турнира.
    const tourney = this.tournaments.find((x) => x.id === m.tournamentId)
    if (tourney?.status === 'finished') {
      tourney.championTeamId = championOf(
        this.matches.filter((x) => x.tournamentId === m.tournamentId),
      )
    }
    return { winnerTeamId: m.winnerTeamId }
  }

  async addMatch(tournamentId: number, input: AddMatchInput) {
    const t = this.tournaments.find((x) => x.id === tournamentId)
    if (!t) throw createError({ statusCode: 404, statusMessage: 'Турнир не найден' })
    const existing = this.matches.filter((m) => m.tournamentId === tournamentId)
    const { bracket, round, position, bestOf } = resolveNewMatchPlacement(existing, input, t.boFinal)

    const teamIds = new Set(this.teams.filter((x) => x.tournamentId === tournamentId).map((x) => x.id))
    const teamAId = input.teamAId && teamIds.has(input.teamAId) ? input.teamAId : null
    const teamBId = input.teamBId && teamIds.has(input.teamBId) ? input.teamBId : null

    const id = this.id()
    this.matches.push({
      id,
      tournamentId,
      bracket,
      round,
      position,
      teamAId,
      teamBId,
      scoreA: 0,
      scoreB: 0,
      bestOf,
      status: 'pending',
      winnerTeamId: null,
      nextMatchId: null,
      nextSlot: null,
      loserNextMatchId: null,
      loserNextSlot: null,
      groupLabel: null,
      label: input.label?.trim() || null,
      maps: null,
    } as MemMatch)
    return { id }
  }

  async deleteMatch(id: number) {
    const m = this.matches.find((x) => x.id === id)
    if (!m) throw createError({ statusCode: 404, statusMessage: 'Матч не найден' })

    for (const p of progression(m, false)) {
      const t = this.matches.find((x) => x.id === p.matchId)
      if (t) (p.slot === 'a' ? (t.teamAId = p.teamId) : (t.teamBId = p.teamId))
    }
    for (const other of this.matches) {
      if (other.nextMatchId === id) {
        other.nextMatchId = null
        other.nextSlot = null
      }
      if (other.loserNextMatchId === id) {
        other.loserNextMatchId = null
        other.loserNextSlot = null
      }
    }
    this.matches = this.matches.filter((x) => x.id !== id)

    const tourney = this.tournaments.find((x) => x.id === m.tournamentId)
    if (tourney?.status === 'finished') {
      tourney.championTeamId = championOf(this.matches.filter((x) => x.tournamentId === m.tournamentId))
    }
  }

  async seedPlayoff(id: number, qualifiers: number) {
    const teamRows = this.teams.filter((t) => t.tournamentId === id)
    const all = this.matches.filter((m) => m.tournamentId === id)
    const order = computeSeedOrder(teamRows, all, qualifiers)

    this.matches = this.matches.filter((m) => !(m.tournamentId === id && m.bracket === 'playoff'))
    const rows = buildSeededPlayoff(order, this.id)
    const t = this.tournaments.find((x) => x.id === id)
    applyBestOf(rows, { main: t?.boMain ?? 1, final: t?.boFinal ?? 1 })
    for (const r of rows) this.matches.push({ ...r, tournamentId: id })
    return { seeded: order.filter(Boolean).length }
  }

  async swapGroupTeams(id: number, teamAId: number, teamBId: number) {
    const groupMatches = this.matches.filter((m) => m.tournamentId === id && m.bracket === 'group')
    for (const m of applyGroupSwap(groupMatches, teamAId, teamBId)) {
      // Соперники поменялись — прежний результат неактуален, сбрасываем матч.
      m.scoreA = 0
      m.scoreB = 0
      m.status = 'pending'
      m.winnerTeamId = null
      m.maps = null
    }
  }

  private rebuildBracket(tournamentId: number) {
    const t = this.tournaments.find((x) => x.id === tournamentId)
    if (!t) throw createError({ statusCode: 404, statusMessage: 'Турнир не найден' })
    const existing = this.matches.filter((m) => m.tournamentId === tournamentId)
    const teamIds = this.teams
      .filter((x) => x.tournamentId === tournamentId)
      .sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0))
      .map((x) => x.id)
    this.matches = this.matches.filter((m) => m.tournamentId !== tournamentId)
    const membership = groupsMembership(existing, teamIds)
    let rows: BracketRow[]
    if (t.format === 'groups_playoff' && membership.length) {
      rows = buildGroupMatches(membership, this.id)
      applyBestOf(rows, { groups: t.boGroups, main: t.boMain, final: t.boFinal })
    } else {
      rows = buildBracket(t.format, teamIds, this.id, rebuildOpts(t, existing))
    }
    for (const r of rows) this.matches.push({ ...r, tournamentId })
    t.championTeamId = null
  }

  async addTeam(tournamentId: number, input: AddTeamInput) {
    const t = this.tournaments.find((x) => x.id === tournamentId)
    if (!t) throw createError({ statusCode: 404, statusMessage: 'Турнир не найден' })
    const teamsOf = this.teams.filter((x) => x.tournamentId === tournamentId)
    const maxSeed = teamsOf.reduce((mx, x) => Math.max(mx, x.seed ?? 0), 0)
    const id = this.id()
    this.teams.push({
      id,
      tournamentId,
      name: input.name,
      logoUrl: input.logoUrl ?? null,
      roster: normalizeOneRoster(input.name, input.roster, expectedRosterSize(t.teamSize)),
      seed: maxSeed + 1,
    })
    this.rebuildBracket(tournamentId)
    return { id }
  }

  async removeTeam(teamId: number) {
    const team = this.teams.find((x) => x.id === teamId)
    if (!team) throw createError({ statusCode: 404, statusMessage: 'Команда не найдена' })
    const rest = this.teams.filter((x) => x.tournamentId === team.tournamentId)
    if (rest.length <= 2) {
      throw createError({ statusCode: 400, statusMessage: 'В турнире должно остаться минимум 2 команды' })
    }
    this.teams = this.teams.filter((x) => x.id !== teamId)
    this.rebuildBracket(team.tournamentId)
  }

  async updateTeam(teamId: number, patch: UpdateTeamInput) {
    const team = this.teams.find((x) => x.id === teamId)
    if (!team) throw createError({ statusCode: 404, statusMessage: 'Команда не найдена' })
    if (typeof patch.name === 'string' && patch.name.trim()) team.name = patch.name.trim()
    if (patch.logoUrl !== undefined) team.logoUrl = patch.logoUrl || null
    if (patch.roster !== undefined) {
      const t = this.tournaments.find((x) => x.id === team.tournamentId)
      team.roster = normalizeOneRoster(team.name, patch.roster, expectedRosterSize(t?.teamSize ?? '5x5'))
    }
    return { id: teamId }
  }

  async addMedia(tournamentId: number, input: AddMediaInput) {
    const id = this.id()
    const count = this.mediaItems.filter((m) => m.tournamentId === tournamentId).length
    this.mediaItems.push({
      id,
      tournamentId,
      type: input.type,
      url: input.url,
      thumbUrl: input.thumbUrl ?? null,
      caption: input.caption ?? null,
      sortOrder: count,
      createdAt: new Date().toISOString(),
    })
    return { id }
  }

  async removeMedia(mediaId: number) {
    const row = this.mediaItems.find((m) => m.id === mediaId)
    if (row) {
      await deleteUploadByUrl(row.url)
      await deleteUploadByUrl(row.thumbUrl)
    }
    this.mediaItems = this.mediaItems.filter((m) => m.id !== mediaId)
  }

  async verifyAdmin(username: string, password: string) {
    if (username === 'admin' && password === 'admin123') return { id: 1, username: 'admin' }
    return null
  }
}

// ---------- Общие helper'ы ----------
/** Нормализует best-of: допустимы только 1/3/5, по умолчанию 1; финал/группы наследуют main. */
function normalizeBestOf(input: CreateTournamentInput) {
  const clamp = (v: number | undefined, fallback: number) =>
    [1, 3, 5].includes(Number(v)) ? Number(v) : fallback
  const main = clamp(input.boMain, 1)
  return { main, groups: clamp(input.boGroups, main), final: clamp(input.boFinal, main) }
}

function expectedRosterSize(teamSize: string) {
  if (teamSize === '1x1') return 1
  if (teamSize === '2x2') return 2
  return 5
}

function buildNormalizedRosters(
  teamNames: string[],
  teamRosters: CreateTournamentInput['teamRosters'] | undefined,
  expectedRoster: number,
) {
  return teamNames.map((teamName, idx) => {
    const input = teamRosters?.[idx]
    const normalized = Array.isArray(input)
      ? input
          .map((p, playerIdx) => ({
            nickname: String(p?.nickname ?? '').trim(),
            role: p?.role === 'captain' || playerIdx === 0 ? ('captain' as const) : ('player' as const),
            steamId: typeof p?.steamId === 'string' ? p.steamId.trim() : null,
          }))
          .filter((p) => p.nickname)
      : []

    if (normalized.length === expectedRoster) return normalized

    return Array.from({ length: expectedRoster }, (_, playerIdx) => ({
      nickname:
        expectedRoster === 1
          ? teamName
          : normalized[playerIdx]?.nickname || `${teamName}-${playerIdx + 1}`,
      role: playerIdx === 0 ? ('captain' as const) : ('player' as const),
      steamId: normalized[playerIdx]?.steamId ?? null,
    }))
  })
}

function hasNamedMap(maps?: { map: string | null; scoreA: number; scoreB: number }[]) {
  return Array.isArray(maps) && maps.some((m) => typeof m?.map === 'string' && Boolean(m.map))
}

// ---------- Общие helper'ы сева плей-офф ----------
function computeSeedOrder(teamRows: any[], all: any[], qualifiers: number): (number | null)[] {
  const groupMatches = all.filter((m) => m.bracket === 'group')
  if (groupMatches.some((m) => m.status !== 'finished')) {
    throw createError({ statusCode: 400, statusMessage: 'Сначала доиграйте все матчи групп' })
  }
  const standings = computeStandings(teamRows, all)
  const labels = Object.keys(standings)
  // Если группа одна — в плей-офф выходят все её команды (посев 1-4, 2-3 и т.д.).
  const eff = labels.length === 1 ? standings[labels[0]!]?.length ?? qualifiers : qualifiers
  return seedPlayoffOrder(standings, eff)
}

/** Строит засеянную сетку плей-офф под уже определённый порядок слотов. */
function buildSeededPlayoff(order: (number | null)[], allocId: () => number): BracketRow[] {
  const rows = buildEmptyElim(order.length, allocId, 'playoff')
  rows
    .filter((r) => r.round === 1)
    .sort((a, b) => a.position - b.position)
    .forEach((m, i) => {
      m.teamAId = order[i * 2] ?? null
      m.teamBId = order[i * 2 + 1] ?? null
    })
  autoAdvanceByes(rows)
  return rows
}

function extractLiveMatchMaps(
  maps: unknown,
): { map: string; scoreA: number; scoreB: number }[] {
  if (!Array.isArray(maps)) return []
  const result: { map: string; scoreA: number; scoreB: number }[] = []
  for (const row of maps) {
    if (!row || typeof row !== 'object') continue
    const map = (row as { map?: unknown }).map
    const scoreA = Number((row as { scoreA?: unknown }).scoreA) || 0
    const scoreB = Number((row as { scoreB?: unknown }).scoreB) || 0
    if (typeof map === 'string' && map) result.push({ map, scoreA, scoreB })
  }
  return result
}

function liveMatchMeta(
  label: string | null | undefined,
  bracket: string | null | undefined,
  groupLabel: string | null | undefined,
  position: number | null | undefined,
  id: number,
): string {
  if (bracket === 'group' && groupLabel) {
    return `Группа ${groupLabel} · Матч ${(position ?? 0) + 1}`
  }
  if (label) return label
  return `Матч #${id}`
}

function getOrSetLiveStartedAt(matchId: number): string {
  const existing = liveStartedAtCache.get(matchId)
  if (existing) return existing
  const now = new Date().toISOString()
  liveStartedAtCache.set(matchId, now)
  return now
}

// ======================================================
//  Выбор реализации (кэшируется на процесс)
// ======================================================
let repoPromise: Promise<Repo> | null = null

export function useRepo(): Promise<Repo> {
  if (!repoPromise) repoPromise = initRepo()
  return repoPromise
}

async function initRepo(): Promise<Repo> {
  try {
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 8000,
    })
    const conn = await pool.getConnection()
    await conn.ping()
    conn.release()
    console.log('[repo] Подключение к MySQL установлено')
    return new MysqlRepo(drizzle(pool, { schema, mode: 'default' }))
  } catch (e: any) {
    console.warn(
      `[repo] MySQL недоступен (${e?.code || e?.message}). Использую in-memory демо-хранилище.`,
    )
    return new MemoryRepo()
  }
}
