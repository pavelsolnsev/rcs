import { nextPowerOfTwo, seedOrder } from '../bracket'
import { roundLabel } from './single'
import { newRow, type BracketRow } from './types'

export interface GroupsOpts {
  groupSize?: number // размер группы (по умолчанию 4)
  qualifiers?: number // сколько выходит из группы (по умолчанию 2)
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

/** Пустая single-elim сетка без команд (для плей-офф — заполняется после групп). */
export function buildEmptyElim(slots: number, allocId: () => number, bracket = 'playoff') {
  const size = nextPowerOfTwo(slots)
  const rounds = Math.log2(size)
  const grid: BracketRow[][] = []
  let count = size / 2
  for (let r = 1; r <= rounds; r++) {
    const arr: BracketRow[] = []
    for (let i = 0; i < count; i++) {
      arr.push(newRow(allocId, bracket, r, i, { label: roundLabel(rounds - r) }))
    }
    grid.push(arr)
    count /= 2
  }
  for (let r = 0; r < grid.length - 1; r++) {
    const next = grid[r + 1]!
    grid[r]!.forEach((m, i) => {
      m.nextMatchId = next[Math.floor(i / 2)]!.id
      m.nextSlot = i % 2 === 0 ? 'a' : 'b'
    })
  }
  return grid.flat()
}

/**
 * Групповой этап (round-robin в каждой группе).
 * Сетка плей-офф создаётся позже — по итогам групп (endpoint /seed-playoff),
 * чтобы её размер соответствовал числу проходящих команд.
 */
/** Round-robin матчи для заданного состава групп ([[t1,t2,...], [t3,t4,...]] → A, B, ...). */
export function buildGroupMatches(groups: number[][], allocId: () => number): BracketRow[] {
  const rows: BracketRow[] = []
  groups.forEach((gTeams, gi) => {
    const label = String.fromCharCode(65 + gi) // A, B, C, ...
    let pos = 0
    for (let a = 0; a < gTeams.length; a++) {
      for (let b = a + 1; b < gTeams.length; b++) {
        const m = newRow(allocId, 'group', 1, pos++, { groupLabel: label })
        m.teamAId = gTeams[a]!
        m.teamBId = gTeams[b]!
        rows.push(m)
      }
    }
  })
  return rows
}

export function buildGroups(
  teamIds: number[],
  allocId: () => number,
  opts: GroupsOpts = {},
): BracketRow[] {
  return buildGroupMatches(chunk(teamIds, opts.groupSize ?? 4), allocId)
}

// ---------- Турнирная таблица ----------
export interface Standing {
  teamId: number
  played: number
  wins: number
  draws: number
  losses: number
  roundsWon: number
  roundsLost: number
  points: number
}

/** Считает таблицу по завершённым групповым матчам. Возвращает { 'A': [...], 'B': [...] }. */
export function computeStandings(
  teams: { id: number; groupHint?: string | null }[],
  matches: {
    groupLabel: string | null
    teamAId: number | null
    teamBId: number | null
    scoreA: number
    scoreB: number
    status: string
    bracket: string
  }[],
): Record<string, Standing[]> {
  const groupMatches = matches.filter((m) => m.bracket === 'group')
  const stats = new Map<number, Standing>()
  const teamGroup = new Map<number, string>()

  const ensure = (id: number): Standing => {
    if (!stats.has(id))
      stats.set(id, {
        teamId: id,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        roundsWon: 0,
        roundsLost: 0,
        points: 0,
      })
    return stats.get(id)!
  }

  for (const m of groupMatches) {
    if (m.teamAId) teamGroup.set(m.teamAId, m.groupLabel!)
    if (m.teamBId) teamGroup.set(m.teamBId, m.groupLabel!)
    if (m.status !== 'finished' || !m.teamAId || !m.teamBId) continue
    const a = ensure(m.teamAId)
    const b = ensure(m.teamBId)
    a.played++, b.played++
    a.roundsWon += m.scoreA
    a.roundsLost += m.scoreB
    b.roundsWon += m.scoreB
    b.roundsLost += m.scoreA
    if (m.scoreA > m.scoreB) {
      a.wins++, b.losses++, (a.points += 3)
    } else if (m.scoreB > m.scoreA) {
      b.wins++, a.losses++, (b.points += 3)
    } else {
      // Ничья — по одному очку каждой команде
      a.draws++, b.draws++, (a.points += 1), (b.points += 1)
    }
  }

  const byGroup: Record<string, Standing[]> = {}
  for (const [id, s] of stats) {
    const g = teamGroup.get(id) ?? '?'
    ;(byGroup[g] ??= []).push(s)
  }
  for (const list of Object.values(byGroup)) {
    list.sort(
      (x, y) =>
        y.points - x.points ||
        y.roundsWon - y.roundsLost - (x.roundsWon - x.roundsLost) ||
        y.roundsWon - x.roundsWon,
    )
  }
  return byGroup
}

/**
 * Возвращает id команд в порядке слотов сетки плей-офф.
 * Отбор: сначала все первые места групп, затем вторые и т.д. (посев 1..N),
 * далее применяется стандартный посев сетки (seedOrder) — это даёт кросс-посев
 * (A1 против B2 и т.п.) и корректно работает при любом числе групп, включая одну.
 */
export function seedPlayoffOrder(
  standings: Record<string, Standing[]>,
  qualifiers: number,
): (number | null)[] {
  const labels = Object.keys(standings).sort()
  const qualified: (number | null)[] = []
  for (let q = 0; q < qualifiers; q++) {
    for (const l of labels) qualified.push(standings[l]?.[q]?.teamId ?? null)
  }
  const size = nextPowerOfTwo(qualified.length)
  return seedOrder(size).map((i) => qualified[i - 1] ?? null)
}
