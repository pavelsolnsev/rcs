export interface Standing {
  teamId: number
  played: number
  wins: number
  draws: number
  losses: number
  diff: number
  points: number
}

interface M {
  bracket: string
  groupLabel: string | null
  teamAId: number | null
  teamBId: number | null
  scoreA: number
  scoreB: number
  status: string
}

/** Считает таблицы по группам из завершённых групповых матчей. */
export function computeStandings(matches: M[]): Record<string, Standing[]> {
  const groupMatches = matches.filter((m) => m.bracket === 'group')
  const stats = new Map<number, Standing>()
  const teamGroup = new Map<number, string>()

  const ensure = (id: number) => {
    if (!stats.has(id))
      stats.set(id, { teamId: id, played: 0, wins: 0, draws: 0, losses: 0, diff: 0, points: 0 })
    return stats.get(id)!
  }

  for (const m of groupMatches) {
    // Регистрируем всех участников групп сразу (даже без сыгранных матчей)
    if (m.teamAId) (teamGroup.set(m.teamAId, m.groupLabel!), ensure(m.teamAId))
    if (m.teamBId) (teamGroup.set(m.teamBId, m.groupLabel!), ensure(m.teamBId))
    if (m.status !== 'finished' || !m.teamAId || !m.teamBId) continue
    const a = ensure(m.teamAId)
    const b = ensure(m.teamBId)
    a.played++
    b.played++
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
  for (const list of Object.values(byGroup)) {
    list.sort((x, y) => y.points - x.points || y.diff - x.diff)
  }
  return byGroup
}
