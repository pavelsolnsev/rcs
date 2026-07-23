import { eq } from 'drizzle-orm'
import { matches } from '../../db/schema'
import { buildSingleElimination } from './single'
import { buildDoubleElimination } from './double'
import { buildGroups, type GroupsOpts } from './groups'
import { type BracketRow, type Slot } from './types'

export * from './types'

export interface BestOfConfig {
  groups?: number
  main?: number
  final?: number
}

export interface BuildOpts extends GroupsOpts {
  bestOf?: BestOfConfig
}

/**
 * Проставляет best-of по стадиям: группы → groups, остальное → main,
 * а финалу (гранд-финал/последний раунд плей-офф или winners) → final.
 * Работает и на полном наборе матчей, и на отдельном плей-офф (при сева).
 */
export function applyBestOf(rows: BracketRow[], cfg: BestOfConfig = {}) {
  const main = cfg.main ?? 1
  const groups = cfg.groups ?? main
  const final = cfg.final ?? main
  for (const r of rows) r.bestOf = r.bracket === 'group' ? groups : main

  const gf = rows.filter((r) => r.bracket === 'grand_final' || r.bracket === 'grand_final_reset')
  if (gf.length) {
    gf.forEach((r) => (r.bestOf = final))
    return
  }
  const elim = rows.filter((r) => r.bracket === 'playoff' || r.bracket === 'winners')
  if (elim.length) {
    const maxRound = Math.max(...elim.map((r) => r.round))
    elim.filter((r) => r.round === maxRound).forEach((r) => (r.bestOf = final))
  }
}

/**
 * Строит матчи для турнира по формату. Возвращает строки со связями по локальным id
 * (id выдаёт allocId). Для in-memory репозитория allocId = глобальный счётчик;
 * для MySQL — локальный, затем persistRows() перепривязывает к реальным id.
 */
export function buildBracket(
  format: string,
  teamIds: number[],
  allocId: () => number,
  opts: BuildOpts = {},
): BracketRow[] {
  let rows: BracketRow[]
  switch (format) {
    case 'double_elimination':
      rows = buildDoubleElimination(teamIds, allocId)
      break
    case 'groups_playoff':
      rows = buildGroups(teamIds, allocId, opts)
      break
    case 'single_elimination':
    default:
      rows = buildSingleElimination(teamIds, allocId)
  }
  applyBestOf(rows, opts.bestOf)
  return rows
}

type Db = any // drizzle mysql2 instance

/** Сохраняет строки сетки в MySQL, перепривязывая локальные id к реальным. */
export async function persistRows(db: Db, tournamentId: number, rows: BracketRow[]) {
  const idMap = new Map<number, number>()

  for (const r of rows) {
    const [{ id }] = await db
      .insert(matches)
      .values({
        tournamentId,
        bracket: r.bracket,
        round: r.round,
        position: r.position,
        teamAId: r.teamAId,
        teamBId: r.teamBId,
        scoreA: r.scoreA,
        scoreB: r.scoreB,
        bestOf: r.bestOf,
        status: r.status,
        winnerTeamId: r.winnerTeamId,
        groupLabel: r.groupLabel,
        label: r.label,
      })
      .$returningId()
    idMap.set(r.id, id)
  }

  for (const r of rows) {
    const patch: Record<string, unknown> = {}
    if (r.nextMatchId) {
      patch.nextMatchId = idMap.get(r.nextMatchId)
      patch.nextSlot = r.nextSlot
    }
    if (r.loserNextMatchId) {
      patch.loserNextMatchId = idMap.get(r.loserNextMatchId)
      patch.loserNextSlot = r.loserNextSlot
    }
    if (Object.keys(patch).length) {
      await db.update(matches).set(patch).where(eq(matches.id, idMap.get(r.id)!))
    }
  }
}

/** Определяет чемпиона турнира по завершённым матчам (для любого формата). */
export function championOf(
  ms: { bracket: string; round: number; winnerTeamId: number | null }[],
): number | null {
  // Финал — это ровно один матч на верхнем раунде. Если их несколько (финал
  // удалили или он ещё не сыгран, а на бой вышло несколько полуфиналов) —
  // чемпион не определён, а не выбирается случайно.
  const pick = (arr: typeof ms) => {
    if (!arr.length) return null
    const maxRound = Math.max(...arr.map((m) => m.round))
    const top = arr.filter((m) => m.round === maxRound)
    if (top.length !== 1) return null
    return top[0]!.winnerTeamId ?? null
  }
  // Если игрался ресет-матч и в нём есть победитель — он и чемпион.
  const reset = ms.filter((m) => m.bracket === 'grand_final_reset' && m.winnerTeamId)
  if (reset.length) return pick(reset)
  const gf = ms.filter((m) => m.bracket === 'grand_final')
  if (gf.length) return pick(gf)
  const playoff = ms.filter((m) => m.bracket === 'playoff')
  if (playoff.length) return pick(playoff)
  return pick(ms.filter((m) => m.bracket === 'winners'))
}

/** План матча за 3-е место: финальная ветка + два полуфинала, чьи проигравшие в него идут. */
export interface ThirdPlacePlan {
  finalRound: number
  semiIds: number[] // ровно два, в порядке слотов (a, b)
}

/**
 * Проверяет, можно ли добавить матч за 3-е место, и находит два полуфинала.
 * Работает для одиночной сетки на выбывание (single elimination и плей-офф групп);
 * для double elimination не поддерживается. Чистая функция — не бросает h3-ошибок.
 */
export function planThirdPlace(
  ms: {
    id: number
    bracket: string
    round: number
    position: number
    nextMatchId: number | null
  }[],
): { ok: true; plan: ThirdPlacePlan } | { ok: false; message: string } {
  if (ms.some((m) => m.bracket === 'grand_final' || m.bracket === 'losers'))
    return { ok: false, message: 'Матч за 3-е место доступен только для одиночной сетки на выбывание' }
  if (ms.some((m) => m.bracket === 'third_place'))
    return { ok: false, message: 'Матч за 3-е место уже добавлен' }

  // Финал живёт в ветке 'playoff' (группы→плей-офф) или 'winners' (single elimination).
  const bracket = ms.some((m) => m.bracket === 'playoff') ? 'playoff' : 'winners'
  const inBracket = ms.filter((m) => m.bracket === bracket)
  if (!inBracket.length) return { ok: false, message: 'Сначала сформируйте плей-офф' }

  const maxRound = Math.max(...inBracket.map((m) => m.round))
  const finals = inBracket.filter((m) => m.round === maxRound)
  if (finals.length !== 1) return { ok: false, message: 'Не удалось однозначно определить финал' }

  const semis = inBracket
    .filter((m) => m.nextMatchId === finals[0]!.id)
    .sort((a, b) => a.position - b.position)
  if (semis.length !== 2)
    return { ok: false, message: 'Для матча за 3-е место нужны два полуфинала' }

  return { ok: true, plan: { finalRound: finals[0]!.round, semiIds: semis.map((s) => s.id) } }
}

/**
 * Что записать в матч-ресет при завершении гранд-финала (GF1).
 * Ресет активируется (обе команды), только если победил игрок из слота B (сторона LB);
 * иначе слоты очищаются (чемпион определён в GF1).
 */
export function grandFinalResetPlacements(
  gf1: { teamAId: number | null; teamBId: number | null; winnerTeamId: number | null },
  resetMatchId: number,
  finished: boolean,
): [Placement, Placement] {
  const lbWon = finished && gf1.winnerTeamId != null && gf1.winnerTeamId === gf1.teamBId
  if (lbWon) {
    return [
      { matchId: resetMatchId, slot: 'a', teamId: gf1.teamAId },
      { matchId: resetMatchId, slot: 'b', teamId: gf1.teamBId },
    ]
  }
  return [
    { matchId: resetMatchId, slot: 'a', teamId: null },
    { matchId: resetMatchId, slot: 'b', teamId: null },
  ]
}

// ---------- Рантайм-прогрессия (общая логика для репозиториев) ----------
export interface RuntimeMatch {
  id: number
  teamAId: number | null
  teamBId: number | null
  winnerTeamId: number | null
  nextMatchId: number | null
  nextSlot: string | null
  loserNextMatchId: number | null
  loserNextSlot: string | null
}

/** Куда и что нужно записать при завершении/сбросе матча. */
export interface Placement {
  matchId: number
  slot: Slot
  teamId: number | null
}

/**
 * Возвращает список изменений соседних матчей при завершении матча:
 * победитель → nextMatch, проигравший → loserNextMatch.
 * При finished=false очищает оба слота (сброс результата).
 */
export function progression(m: RuntimeMatch, finished: boolean): Placement[] {
  const out: Placement[] = []
  if (finished && m.winnerTeamId) {
    const loser = m.winnerTeamId === m.teamAId ? m.teamBId : m.teamAId
    if (m.nextMatchId && m.nextSlot)
      out.push({ matchId: m.nextMatchId, slot: m.nextSlot as Slot, teamId: m.winnerTeamId })
    if (m.loserNextMatchId && m.loserNextSlot)
      out.push({ matchId: m.loserNextMatchId, slot: m.loserNextSlot as Slot, teamId: loser })
  } else {
    if (m.nextMatchId && m.nextSlot)
      out.push({ matchId: m.nextMatchId, slot: m.nextSlot as Slot, teamId: null })
    if (m.loserNextMatchId && m.loserNextSlot)
      out.push({ matchId: m.loserNextMatchId, slot: m.loserNextSlot as Slot, teamId: null })
  }
  return out
}
