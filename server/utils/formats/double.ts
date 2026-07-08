import { nextPowerOfTwo, seedOrder } from '../bracket'
import { newRow, autoAdvanceByes, type BracketRow, type Slot } from './types'

/**
 * Double Elimination: сетка победителей (WB) + сетка проигравших (LB) + гранд-финал.
 * Проигравший в WB опускается в LB; проигравший в LB выбывает.
 * Гранд-финал — без «сброса сетки» (bracket reset) для простоты.
 */
export function buildDoubleElimination(
  teamIds: (number | null)[],
  allocId: () => number,
): BracketRow[] {
  const size = nextPowerOfTwo(teamIds.filter(Boolean).length || teamIds.length)
  const W = Math.log2(size) // число раундов WB
  const order = seedOrder(size)
  const seeded = order.map((i) => teamIds[i - 1] ?? null)

  // --- Сетка победителей (WB) ---
  const wb: BracketRow[][] = []
  let count = size / 2
  for (let r = 1; r <= W; r++) {
    const arr: BracketRow[] = []
    const label = r === W ? 'Финал WB' : r === W - 1 ? 'Полуфинал WB' : `WB Раунд ${r}`
    for (let i = 0; i < count; i++) arr.push(newRow(allocId, 'winners', r, i, { label }))
    wb.push(arr)
    count /= 2
  }
  wb[0]!.forEach((m, i) => {
    m.teamAId = seeded[i * 2] ?? null
    m.teamBId = seeded[i * 2 + 1] ?? null
  })
  // связи победителей внутри WB
  for (let r = 0; r < W - 1; r++) {
    const next = wb[r + 1]!
    wb[r]!.forEach((m, i) => {
      m.nextMatchId = next[Math.floor(i / 2)]!.id
      m.nextSlot = i % 2 === 0 ? 'a' : 'b'
    })
  }

  // --- Сетка проигравших (LB) ---
  const lbRounds = 2 * (W - 1)
  const gamesInLb = (j: number) => size / 2 ** (Math.ceil(j / 2) + 1)
  const lb: BracketRow[][] = []
  for (let j = 1; j <= lbRounds; j++) {
    const arr: BracketRow[] = []
    for (let i = 0; i < gamesInLb(j); i++) {
      arr.push(newRow(allocId, 'losers', j, i, { label: `LB Раунд ${j}` }))
    }
    lb.push(arr)
  }
  // связи внутри LB
  for (let j = 0; j < lbRounds - 1; j++) {
    const cur = lb[j]!
    const nxt = lb[j + 1]!
    const halving = nxt.length === cur.length / 2
    cur.forEach((m, i) => {
      if (halving) {
        m.nextMatchId = nxt[Math.floor(i / 2)]!.id
        m.nextSlot = i % 2 === 0 ? 'a' : 'b'
      } else {
        m.nextMatchId = nxt[i]!.id
        m.nextSlot = 'a'
      }
    })
  }

  // --- Гранд-финал (+ матч-ресет) ---
  const grandFinal = newRow(allocId, 'grand_final', 1, 0, { label: 'Гранд-финал' })
  // Ресет играется, только если победитель LB выигрывает GF1 (у обоих по поражению).
  const grandFinalReset = newRow(allocId, 'grand_final_reset', 2, 0, {
    label: 'Гранд-финал (ресет)',
  })

  // Победитель финала WB → гранд-финал (слот A)
  const wbFinal = wb[W - 1]![0]!
  wbFinal.nextMatchId = grandFinal.id
  wbFinal.nextSlot = 'a'
  // Победитель финала LB → гранд-финал (слот B)
  if (lbRounds > 0) {
    const lbFinal = lb[lbRounds - 1]![0]!
    lbFinal.nextMatchId = grandFinal.id
    lbFinal.nextSlot = 'b'
  }

  // --- Маршрутизация проигравших WB → LB ---
  // WB R1: проигравшие game i → LB R1 game floor(i/2), слот по чётности
  wb[0]!.forEach((m, i) => {
    m.loserNextMatchId = lb[0]![Math.floor(i / 2)]!.id
    m.loserNextSlot = (i % 2 === 0 ? 'a' : 'b') as Slot
  })
  // WB раунд m (m>=2): проигравший game i → LB раунд 2(m-1), слот 'b'
  for (let m = 2; m <= W; m++) {
    const lbRound = lb[2 * (m - 1) - 1]! // индекс = 2(m-1)-1
    wb[m - 1]!.forEach((match, i) => {
      match.loserNextMatchId = lbRound[i]!.id
      match.loserNextSlot = 'b'
    })
  }

  const rows = [...wb.flat(), ...lb.flat(), grandFinal, grandFinalReset]
  autoAdvanceByes(rows)
  return rows
}
