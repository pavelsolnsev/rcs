/**
 * Единый расчёт турнирной таблицы групп — используется и на клиенте (отображение),
 * и на сервере (посев плей-офф), чтобы порядок команд везде совпадал.
 */
export interface Standing {
  teamId: number
  played: number
  wins: number
  draws: number
  losses: number
  roundsWon: number
  roundsLost: number
  /** Разница раундов по всем матчам группы (roundsWon − roundsLost). */
  diff: number
  points: number
}

interface StandingMatch {
  bracket: string
  groupLabel: string | null
  teamAId: number | null
  teamBId: number | null
  scoreA: number
  scoreB: number
  status: string
}

/**
 * Личные встречи внутри группы команд с равными очками («мини-турнир»):
 * очки и разница раундов только в матчах между самими этими командами.
 */
interface Head2Head {
  points: number
  diff: number
}

/**
 * Считает мини-таблицу личных встреч для каждой команды.
 * Сравниваем только команды, у которых равны очки в общей таблице: для них берём
 * их матчи между собой и складываем очки/разницу раундов «внутри клуба».
 */
function headToHead(list: Standing[], finished: StandingMatch[]): Map<number, Head2Head> {
  const h2h = new Map<number, Head2Head>()
  for (const s of list) h2h.set(s.teamId, { points: 0, diff: 0 })

  // Кластеры команд с одинаковым числом очков.
  const clusters = new Map<number, Standing[]>()
  for (const s of list) {
    const arr = clusters.get(s.points)
    if (arr) arr.push(s)
    else clusters.set(s.points, [s])
  }

  for (const cluster of clusters.values()) {
    if (cluster.length < 2) continue
    const ids = new Set(cluster.map((s) => s.teamId))
    for (const m of finished) {
      if (m.teamAId == null || m.teamBId == null) continue
      if (!ids.has(m.teamAId) || !ids.has(m.teamBId)) continue
      const a = h2h.get(m.teamAId)!
      const b = h2h.get(m.teamBId)!
      a.diff += m.scoreA - m.scoreB
      b.diff += m.scoreB - m.scoreA
      if (m.scoreA > m.scoreB) a.points += 3
      else if (m.scoreB > m.scoreA) b.points += 3
      else (a.points += 1), (b.points += 1)
    }
  }
  return h2h
}

/**
 * Порядок команд в группе. Критерии по убыванию приоритета:
 *   1. очки;
 *   2. личные встречи между равными по очкам — очки в мини-турнире;
 *   3. личные встречи — разница раундов в мини-турнире;
 *   4. общая разница раундов;
 *   5. всего выигранных раундов.
 */
function sortGroup(list: Standing[], finished: StandingMatch[]) {
  const h2h = headToHead(list, finished)
  list.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points
    const hx = h2h.get(x.teamId)!
    const hy = h2h.get(y.teamId)!
    if (hy.points !== hx.points) return hy.points - hx.points
    if (hy.diff !== hx.diff) return hy.diff - hx.diff
    if (y.diff !== x.diff) return y.diff - x.diff
    return y.roundsWon - x.roundsWon
  })
}

/** Считает таблицы по группам из групповых матчей. Возвращает { 'A': [...], 'B': [...] }. */
export function computeStandings(matches: StandingMatch[]): Record<string, Standing[]> {
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
        diff: 0,
        points: 0,
      })
    return stats.get(id)!
  }

  for (const m of groupMatches) {
    // Регистрируем всех участников групп сразу (даже без сыгранных матчей).
    if (m.teamAId) (teamGroup.set(m.teamAId, m.groupLabel!), ensure(m.teamAId))
    if (m.teamBId) (teamGroup.set(m.teamBId, m.groupLabel!), ensure(m.teamBId))
    if (m.status !== 'finished' || !m.teamAId || !m.teamBId) continue
    const a = ensure(m.teamAId)
    const b = ensure(m.teamBId)
    a.played++, b.played++
    a.roundsWon += m.scoreA
    a.roundsLost += m.scoreB
    b.roundsWon += m.scoreB
    b.roundsLost += m.scoreA
    a.diff += m.scoreA - m.scoreB
    b.diff += m.scoreB - m.scoreA
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

  const finishedByGroup = new Map<string, StandingMatch[]>()
  for (const m of groupMatches) {
    if (m.status !== 'finished') continue
    const g = m.groupLabel ?? '?'
    const arr = finishedByGroup.get(g)
    if (arr) arr.push(m)
    else finishedByGroup.set(g, [m])
  }

  for (const [label, list] of Object.entries(byGroup)) {
    sortGroup(list, finishedByGroup.get(label) ?? [])
  }
  return byGroup
}
