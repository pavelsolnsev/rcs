import { nextPowerOfTwo, seedOrder } from '../bracket'
import { roundLabel } from './single'
import { newRow, type BracketRow } from './types'
import type { Standing } from '#shared/utils/standings'

export interface GroupsOpts {
  groupSize?: number // размер группы (по умолчанию 4)
  groupCount?: number // количество групп (если нужно принудительно)
  qualifiers?: number // сколько выходит из группы (по умолчанию 2)
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function splitByGroupCount<T>(arr: T[], groupCount: number): T[][] {
  const groups = Array.from({ length: groupCount }, () => [] as T[])
  for (const item of arr) {
    let minIdx = 0
    for (let i = 1; i < groups.length; i++) {
      if (groups[i]!.length < groups[minIdx]!.length) minIdx = i
    }
    groups[minIdx]!.push(item)
  }
  return groups.filter((g) => g.length > 0)
}

/**
 * Round-robin расписание по методу "circle":
 * в каждом туре команда играет не более одного матча, поэтому не получается
 * последовательных матчей подряд для одной и той же команды.
 */
function roundRobinPairs(teamIds: number[]): Array<[number, number]> {
  if (teamIds.length < 2) return []
  const odd = teamIds.length % 2 === 1
  const list = odd ? [...teamIds, -1] : [...teamIds]
  const rounds = list.length - 1
  const half = list.length / 2
  const pairs: Array<[number, number]> = []

  for (let round = 0; round < rounds; round++) {
    const used = new Set<number>()
    for (let i = 0; i < half; i++) {
      const a = list[i]!
      const b = list[list.length - 1 - i]!
      if (a === -1 || b === -1) continue
      if (used.has(a) || used.has(b)) continue
      used.add(a)
      used.add(b)
      pairs.push(round % 2 === 0 ? [a, b] : [b, a])
    }
    // фиксируем первый элемент, остальные ротируем
    const fixed = list[0]!
    const rest = list.slice(1)
    rest.unshift(rest.pop()!)
    list.splice(0, list.length, fixed, ...rest)
  }
  return pairs
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
    for (const [a, b] of roundRobinPairs(gTeams)) {
      const m = newRow(allocId, 'group', 1, pos++, { groupLabel: label })
      m.teamAId = a
      m.teamBId = b
      rows.push(m)
    }
  })
  return rows
}

export function buildGroups(
  teamIds: number[],
  allocId: () => number,
  opts: GroupsOpts = {},
): BracketRow[] {
  const groupSize = Math.max(2, Number(opts.groupSize) || 4)
  const requestedGroupCount = Math.max(0, Number(opts.groupCount) || 0)
  const groups =
    requestedGroupCount > 0
      ? splitByGroupCount(teamIds, requestedGroupCount)
      : chunk(teamIds, groupSize)

  if (!groups.length) return []
  if (groups.some((g) => g.length < 2)) {
    throw createError({ statusCode: 400, statusMessage: 'В каждой группе должно быть минимум 2 команды' })
  }
  if (opts.qualifiers) {
    const qualifiers = Number(opts.qualifiers)
    const minGroupSize = Math.min(...groups.map((g) => g.length))
    if (!Number.isInteger(qualifiers) || qualifiers < 1 || qualifiers > minGroupSize) {
      throw createError({
        statusCode: 400,
        statusMessage: `Количество выходящих из группы должно быть от 1 до ${minGroupSize}`,
      })
    }
  }
  return buildGroupMatches(groups, allocId)
}

// ---------- Турнирная таблица ----------
// Расчёт таблицы — в общем модуле shared/, чтобы отображение и посев совпадали.
export { computeStandings } from '#shared/utils/standings'

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
