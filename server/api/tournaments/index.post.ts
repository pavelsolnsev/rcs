import { BRACKET_FORMATS, TEAM_SIZES } from '../../db/schema'

interface CreateBody {
  name: string
  description?: string
  format?: string
  teamSize?: string
  teamNames: string[]
  teamRosters?: { nickname: string; role?: 'captain' | 'player'; steamId?: string | null }[][]
  groupSize?: number
  qualifiers?: number
  boGroups?: number
  boMain?: number
  boFinal?: number
}

/** Создать турнир и сгенерировать сетку. Только админ. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<CreateBody>(event)

  const name = body?.name?.trim()
  const teamNames = (body?.teamNames ?? []).map((n) => n.trim()).filter(Boolean)

  if (!name) throw createError({ statusCode: 400, statusMessage: 'Укажите название турнира' })
  if (teamNames.length < 2)
    throw createError({ statusCode: 400, statusMessage: 'Нужно минимум 2 команды' })

  const format = BRACKET_FORMATS.includes(body.format as any) ? body.format! : 'single_elimination'
  const teamSize = TEAM_SIZES.includes(body.teamSize as any) ? body.teamSize! : '5x5'

  const repo = await useRepo()
  return repo.createTournament({
    name,
    description: body.description ?? null,
    format,
    teamSize,
    teamNames,
    teamRosters: Array.isArray(body.teamRosters) ? body.teamRosters : undefined,
    groupSize: Number(body.groupSize) || undefined,
    qualifiers: Number(body.qualifiers) || undefined,
    boGroups: Number(body.boGroups) || undefined,
    boMain: Number(body.boMain) || undefined,
    boFinal: Number(body.boFinal) || undefined,
  })
})
