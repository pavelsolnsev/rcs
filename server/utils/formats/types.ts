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
