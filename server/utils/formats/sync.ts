import { loserOf, type BracketRow, type Slot } from './types'

/** Матч уже идёт или сыгран двумя реальными командами — менять его состав нельзя. */
const isLocked = (m: BracketRow) =>
  m.status !== 'pending' && m.teamAId != null && m.teamBId != null
/** Авто-проход (bye): матч «завершён», но одной из команд нет. */
const isBye = (m: BracketRow) =>
  m.status === 'finished' && (m.teamAId == null || m.teamBId == null)

const getSlot = (m: BracketRow, s: Slot) => (s === 'a' ? m.teamAId : m.teamBId)
function setSlot(m: BracketRow, s: Slot, v: number | null) {
  if (s === 'a') m.teamAId = v
  else m.teamBId = v
}

export interface SyncConflict {
  matchId: number
  label: string | null
}

/**
 * Приводит сетку в согласованное состояние: каждый слот, у которого есть
 * «источник» (победитель/проигравший другого матча), заново выводится из его
 * результата. Авто-проходы (bye) ставятся только когда соперник точно не появится,
 * и снимаются, если соперник всё-таки может появиться (например, после отката
 * результата). Уже начатые/сыгранные матчи не перезаписываются — такие случаи
 * возвращаются как конфликты.
 */
export function syncBracket(rows: BracketRow[]): SyncConflict[] {
  const byId = new Map(rows.map((r) => [r.id, r]))
  type Feeder = { from: BracketRow; kind: 'winner' | 'loser' | 'reset' }
  const feeders = new Map<string, Feeder>()
  const key = (id: number, s: Slot) => `${id}:${s}`
  for (const f of rows) {
    if (f.nextMatchId && f.nextSlot && byId.has(f.nextMatchId))
      feeders.set(key(f.nextMatchId, f.nextSlot), { from: f, kind: 'winner' })
    if (f.loserNextMatchId && f.loserNextSlot && byId.has(f.loserNextMatchId))
      feeders.set(key(f.loserNextMatchId, f.loserNextSlot), { from: f, kind: 'loser' })
  }
  // Матч-ресет гранд-финала: обе команды GF1, только если его выиграла сторона LB.
  const gf = rows.find((r) => r.bracket === 'grand_final')
  const reset = rows.find((r) => r.bracket === 'grand_final_reset')
  if (gf && reset) {
    feeders.set(key(reset.id, 'a'), { from: gf, kind: 'reset' })
    feeders.set(key(reset.id, 'b'), { from: gf, kind: 'reset' })
  }

  // Какую команду источник отдаёт в слот (null — пока никого / никого не будет)
  function expected(m: BracketRow, s: Slot): number | null {
    const f = feeders.get(key(m.id, s))!
    const src = f.from
    if (src.status !== 'finished') return null
    if (f.kind === 'winner') return src.winnerTeamId
    if (f.kind === 'loser') return loserOf(src)
    const lbWon = src.winnerTeamId != null && src.winnerTeamId === src.teamBId
    return lbWon ? (s === 'a' ? src.teamAId : src.teamBId) : null
  }
  // Слот пуст навсегда: источника нет или он уже завершён (и никого не отдал)
  const slotDead = (m: BracketRow, s: Slot) => {
    if (getSlot(m, s) != null) return false
    const f = feeders.get(key(m.id, s))
    return !f || f.from.status === 'finished'
  }

  const conflicts = new Map<number, SyncConflict>()
  let changed = true
  let guard = rows.length * 8 + 16
  while (changed && guard-- > 0) {
    changed = false
    for (const m of rows) {
      // Групповые матчи ни от кого не зависят
      if (m.bracket === 'group') continue
      // 1. Слоты из источников
      for (const s of ['a', 'b'] as const) {
        if (!feeders.has(key(m.id, s))) continue
        const exp = expected(m, s)
        if (getSlot(m, s) === exp) continue
        if (isLocked(m)) {
          conflicts.set(m.id, { matchId: m.id, label: m.label })
          continue
        }
        setSlot(m, s, exp)
        changed = true
      }
      if (m.bracket === 'grand_final_reset') continue

      // 2. Авто-проход, который больше не действителен, — снимаем
      if (isBye(m)) {
        const lone = m.teamAId ?? m.teamBId
        const valid =
          (m.teamAId != null || slotDead(m, 'a')) && (m.teamBId != null || slotDead(m, 'b'))
        if (!valid) {
          m.status = 'pending'
          m.winnerTeamId = null
          changed = true
        } else if (m.winnerTeamId !== lone) {
          m.winnerTeamId = lone
          changed = true
        }
        continue
      }

      // 3. Новый авто-проход: соперник точно не появится
      if (m.status !== 'pending') continue
      if (m.teamAId != null && m.teamBId != null) continue
      const aOk = m.teamAId != null || slotDead(m, 'a')
      const bOk = m.teamBId != null || slotDead(m, 'b')
      if (!aOk || !bOk) continue
      m.status = 'finished'
      m.winnerTeamId = m.teamAId ?? m.teamBId
      m.scoreA = 0
      m.scoreB = 0
      changed = true
    }
  }
  return [...conflicts.values()]
}
