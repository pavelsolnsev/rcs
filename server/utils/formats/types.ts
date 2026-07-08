/** Общие типы и helper'ы для генерации турнирных сеток. */

export type Slot = 'a' | 'b'
export type MatchStatus = 'pending' | 'live' | 'finished'

export interface BracketRow {
  id: number
  bracket: string // 'winners' | 'losers' | 'grand_final' | 'group' | 'playoff'
  round: number
  position: number
  teamAId: number | null
  teamBId: number | null
  scoreA: number
  scoreB: number
  bestOf: number
  status: MatchStatus
  winnerTeamId: number | null
  nextMatchId: number | null
  nextSlot: Slot | null
  loserNextMatchId: number | null
  loserNextSlot: Slot | null
  groupLabel: string | null
  label: string | null
  maps?: { map: string | null; scoreA: number; scoreB: number }[] | null
}

/** Создаёт «пустую» строку матча с id от аллокатора. */
export function newRow(
  allocId: () => number,
  bracket: string,
  round: number,
  position: number,
  extra: Partial<BracketRow> = {},
): BracketRow {
  return {
    id: allocId(),
    bracket,
    round,
    position,
    teamAId: null,
    teamBId: null,
    scoreA: 0,
    scoreB: 0,
    bestOf: 1,
    status: 'pending',
    winnerTeamId: null,
    nextMatchId: null,
    nextSlot: null,
    loserNextMatchId: null,
    loserNextSlot: null,
    groupLabel: null,
    label: null,
    ...extra,
  }
}

/** Ставит команду в нужный слот матча. */
export function setSlot(row: BracketRow, slot: Slot, teamId: number | null) {
  if (slot === 'a') row.teamAId = teamId
  else row.teamBId = teamId
}

/** Проигравший в матче (при известном победителе). */
export function loserOf(row: BracketRow): number | null {
  if (!row.winnerTeamId) return null
  return row.winnerTeamId === row.teamAId ? row.teamBId : row.teamAId
}

/**
 * Разрешает «bye» (пустые слоты) по всей сетке: если у матча не может появиться
 * вторая команда (нет незавершённого фидера в пустой слот) — одинокая команда
 * автоматически проходит дальше. Работает каскадно для winners и losers сеток.
 */
export function autoAdvanceByes(rows: BracketRow[]) {
  const byId = new Map(rows.map((r) => [r.id, r]))

  // Для каждого слота — есть ли незавершённый фидер, который его заполнит
  const hasPendingFeeder = (matchId: number, slot: Slot) =>
    rows.some(
      (f) =>
        f.status !== 'finished' &&
        ((f.nextMatchId === matchId && f.nextSlot === slot) ||
          (f.loserNextMatchId === matchId && f.loserNextSlot === slot)),
    )

  let changed = true
  while (changed) {
    changed = false
    for (const m of rows) {
      if (m.status === 'finished') continue
      // Матч-ресет гранд-финала активируется вручную (по итогу GF1), не через bye.
      if (m.bracket === 'grand_final_reset') continue
      const aResolved = m.teamAId != null || !hasPendingFeeder(m.id, 'a')
      const bResolved = m.teamBId != null || !hasPendingFeeder(m.id, 'b')
      if (!aResolved || !bResolved) continue
      // Оба слота «решены». Если обе команды на месте — это реальный матч, ждём.
      if (m.teamAId != null && m.teamBId != null) continue

      const lone = m.teamAId ?? m.teamBId
      m.status = 'finished'
      m.winnerTeamId = lone
      // Продвигаем победителя (может быть null — тогда просто «схлопываем» ветку)
      if (m.nextMatchId && m.nextSlot) setSlot(byId.get(m.nextMatchId)!, m.nextSlot, lone)
      if (m.loserNextMatchId && m.loserNextSlot)
        setSlot(byId.get(m.loserNextMatchId)!, m.loserNextSlot, null)
      changed = true
    }
  }
}
