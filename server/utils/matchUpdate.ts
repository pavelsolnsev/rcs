import { syncBracket, type BracketRow, type MatchStatus } from './formats'

export interface MatchResultPatch {
  scoreA: number
  scoreB: number
  status: MatchStatus
}

/** Поля, которые пересчитывает синхронизация сетки. */
const SYNC_FIELDS = ['teamAId', 'teamBId', 'status', 'winnerTeamId', 'scoreA', 'scoreB'] as const
export type SyncFields = Pick<BracketRow, (typeof SYNC_FIELDS)[number]>

/**
 * Считает, как изменится сетка после нового результата матча (без записи в хранилище).
 * Бросает ошибку, если результат нарушит уже начатые/сыгранные матчи дальше по сетке
 * или если в матче на выбывание пытаются зафиксировать ничью.
 * Возвращает победителя и список изменённых матчей (включая сам матч).
 */
export function planMatchUpdate<T extends BracketRow>(
  all: T[],
  id: number,
  patch: MatchResultPatch,
): { winnerTeamId: number | null; changes: { id: number; set: SyncFields }[] } {
  const rows = all.map((r) => ({ ...r }))
  const m = rows.find((r) => r.id === id)
  if (!m) throw createError({ statusCode: 404, statusMessage: 'Матч не найден' })

  const finished = patch.status === 'finished'
  if (finished && patch.scoreA === patch.scoreB && m.bracket !== 'group') {
    throw createError({
      statusCode: 400,
      statusMessage: 'В сетке на выбывание ничьей быть не может — нужен победитель',
    })
  }
  // При равном счёте (ничья, только в группах) победителя нет
  const winnerTeamId =
    finished && patch.scoreA !== patch.scoreB
      ? patch.scoreA > patch.scoreB
        ? m.teamAId
        : m.teamBId
      : null

  // Конфликты, которые были и до правки (старые данные), не мешают сохранению
  const before = new Set(syncBracket(all.map((r) => ({ ...r }))).map((c) => c.matchId))
  Object.assign(m, { scoreA: patch.scoreA, scoreB: patch.scoreB, status: patch.status, winnerTeamId })
  const conflicts = syncBracket(rows).filter((c) => c.matchId !== id && !before.has(c.matchId))
  if (conflicts.length) {
    const names = conflicts.map((c) => `«${c.label || `матч #${c.matchId}`}»`).join(', ')
    throw createError({
      statusCode: 409,
      statusMessage: `Нельзя изменить результат: дальше по сетке уже начаты/сыграны ${names}. Сначала верните их в ожидание.`,
    })
  }

  const orig = new Map(all.map((r) => [r.id, r]))
  const changes: { id: number; set: SyncFields }[] = []
  for (const r of rows) {
    const o = orig.get(r.id)!
    if (r.id !== id && SYNC_FIELDS.every((k) => o[k] === r[k])) continue
    const set = {} as SyncFields
    for (const k of SYNC_FIELDS) (set as any)[k] = r[k]
    changes.push({ id: r.id, set })
  }
  return { winnerTeamId, changes }
}
