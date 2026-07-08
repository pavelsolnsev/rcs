/**
 * Наполнение БД демо-данными.
 * Запуск: npm run db:seed  (перед этим: npm run db:push)
 */
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { useDb } from '../utils/db'
import { buildBracket, persistRows, progression, championOf } from '../utils/formats'
import { adminUsers, tournaments, teams, matches } from './schema'

const db = useDb()

async function seedAdmin() {
  const existing = await db.select().from(adminUsers).where(eq(adminUsers.username, 'admin'))
  if (existing.length) {
    console.log('• admin уже существует, пропускаю')
    return
  }
  const passwordHash = await bcrypt.hash('admin123', 10)
  await db.insert(adminUsers).values({ username: 'admin', passwordHash })
  console.log('• создан админ: admin / admin123')
}

async function seedTournament(opts: {
  name: string
  status: 'draft' | 'ongoing' | 'finished'
  format: string
  teamNames: string[]
}) {
  const [{ id: tId }] = await db
    .insert(tournaments)
    .values({ name: opts.name, format: opts.format as any, teamSize: '5x5', status: opts.status })
    .$returningId()

  let seed = 1
  for (const name of opts.teamNames) {
    await db.insert(teams).values({
      tournamentId: tId,
      name,
      roster: defaultRoster(name, '5x5'),
      seed: seed++,
    })
  }
  const inserted = await db.select().from(teams).where(eq(teams.tournamentId, tId))
  inserted.sort((a, b) => (a.seed ?? 0) - (b.seed ?? 0))

  let local = 0
  const rows = buildBracket(opts.format, inserted.map((t) => t.id), () => ++local)
  await persistRows(db, tId, rows)
  console.log(`• турнир "${opts.name}" (${opts.status}, ${opts.format}) — команд: ${inserted.length}`)
  return tId
}

function defaultRoster(teamName: string, teamSize: '1x1' | '2x2' | '5x5') {
  const size = teamSize === '1x1' ? 1 : teamSize === '2x2' ? 2 : 5
  return Array.from({ length: size }, (_, idx) => ({
    nickname: size === 1 ? teamName : `${teamName}-${idx + 1}`,
    role: idx === 0 ? 'captain' : 'player',
    steamId: null,
  }))
}

/** Доигрывает турнир: заполняет счёт, продвигает победителей/проигравших, ставит чемпиона. */
async function playOut(tournamentId: number) {
  const rows = await db.select().from(matches).where(eq(matches.tournamentId, tournamentId))
  rows.sort((a, b) => a.round - b.round || a.position - b.position)

  for (const m of rows) {
    if (!m.teamAId || !m.teamBId) continue
    m.scoreA = 16
    m.scoreB = 8 + ((m.position + m.round) % 6)
    m.status = 'finished'
    m.winnerTeamId = m.teamAId
    await db
      .update(matches)
      .set({ scoreA: m.scoreA, scoreB: m.scoreB, status: 'finished', winnerTeamId: m.teamAId })
      .where(eq(matches.id, m.id))
    for (const p of progression(m, true)) {
      const t = rows.find((x) => x.id === p.matchId)
      if (t) p.slot === 'a' ? (t.teamAId = p.teamId) : (t.teamBId = p.teamId)
      const set = p.slot === 'a' ? { teamAId: p.teamId } : { teamBId: p.teamId }
      await db.update(matches).set(set).where(eq(matches.id, p.matchId))
    }
  }

  await db
    .update(tournaments)
    .set({ status: 'finished', championTeamId: championOf(rows), finishedAt: new Date() })
    .where(eq(tournaments.id, tournamentId))
}

async function main() {
  await seedAdmin()

  // Очищаем турнирные данные, чтобы seed можно было запускать повторно без дублей.
  await db.delete(matches)
  await db.delete(teams)
  await db.delete(tournaments)
  console.log('• старые турнирные данные очищены')

  await seedTournament({
    name: 'CS2 Weekly Cup #14',
    status: 'ongoing',
    format: 'single_elimination',
    teamNames: ['Navi', 'Vitality', 'FaZe', 'G2', 'Spirit', 'MOUZ', 'Astralis', 'Heroic'],
  })

  await seedTournament({
    name: 'CS2 Masters (Double)',
    status: 'ongoing',
    format: 'double_elimination',
    teamNames: ['Navi', 'Vitality', 'FaZe', 'G2', 'Spirit', 'MOUZ', 'Astralis', 'Heroic'],
  })

  const archiveId = await seedTournament({
    name: 'CS2 Spring Open 2026',
    status: 'finished',
    format: 'single_elimination',
    teamNames: ['Falcons', 'Complexity', 'Liquid', 'Cloud9'],
  })
  await playOut(archiveId)

  console.log('\n✔ Seed завершён.')
  process.exit(0)
}

main().catch((err) => {
  console.error('Ошибка seed:', err)
  process.exit(1)
})
