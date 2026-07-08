import { nextPowerOfTwo, seedOrder } from '../bracket'
import { newRow, autoAdvanceByes, type BracketRow } from './types'

/** Метка раунда по «расстоянию до финала». */
export function roundLabel(fromEnd: number): string | null {
  if (fromEnd === 0) return 'Финал'
  if (fromEnd === 1) return 'Полуфинал'
  if (fromEnd === 2) return '1/4 финала'
  if (fromEnd === 3) return '1/8 финала'
  return null
}

/**
 * Single Elimination: сетка на выбывание с посевом и авто-обработкой bye.
 * @param bracket имя ветки ('winners' по умолчанию; 'playoff' для группового этапа)
 */
export function buildSingleElimination(
  teamIds: (number | null)[],
  allocId: () => number,
  bracket = 'winners',
): BracketRow[] {
  const size = nextPowerOfTwo(teamIds.filter(Boolean).length || teamIds.length)
  const rounds = Math.log2(size)
  const order = seedOrder(size)
  const seeded = order.map((i) => teamIds[i - 1] ?? null)

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

  // Команды первого раунда
  grid[0]!.forEach((m, i) => {
    m.teamAId = seeded[i * 2] ?? null
    m.teamBId = seeded[i * 2 + 1] ?? null
  })

  // Связи победителей
  for (let r = 0; r < grid.length - 1; r++) {
    const nextRound = grid[r + 1]!
    grid[r]!.forEach((m, i) => {
      const next = nextRound[Math.floor(i / 2)]!
      m.nextMatchId = next.id
      m.nextSlot = i % 2 === 0 ? 'a' : 'b'
    })
  }

  const rows = grid.flat()
  autoAdvanceByes(rows)
  return rows
}
