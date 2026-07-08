interface RosterPlayer {
  nickname?: string
  role?: 'captain' | 'player'
  steamId?: string | null
}

/** Добавляет команду в турнир и перестраивает сетку. Только админ. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id' })
  }
  const body = await readBody<{ name?: string; logoUrl?: string | null; roster?: RosterPlayer[] }>(event)
  const name = String(body?.name ?? '').trim()
  if (!name) {
    throw createError({ statusCode: 400, statusMessage: 'Укажите название команды' })
  }

  const repo = await useRepo()
  return repo.addTeam(id, {
    name,
    logoUrl: typeof body?.logoUrl === 'string' ? body.logoUrl.trim() || null : null,
    roster: Array.isArray(body?.roster) ? body.roster : undefined,
  })
})
