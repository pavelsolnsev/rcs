import { MATCH_STATUS, type MapResult } from '../../db/schema'

interface PatchBody {
  scoreA?: number
  scoreB?: number
  status?: (typeof MATCH_STATUS)[number]
  bestOf?: number
  maps?: MapResult[]
}

/**
 * Обновить счёт/статус матча. Только админ.
 * При статусе 'finished' победитель определяется по счёту и продвигается дальше.
 */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id' })
  }

  const body = await readBody<PatchBody>(event)
  const scoreA = Number(body.scoreA) || 0
  const scoreB = Number(body.scoreB) || 0
  const status = MATCH_STATUS.includes(body.status as any) ? body.status! : 'live'
  const bestOf = [1, 3, 5].includes(Number(body.bestOf)) ? Number(body.bestOf) : undefined

  // Нормализуем результаты по картам
  const maps = Array.isArray(body.maps)
    ? body.maps.map((m) => ({
        map: typeof m?.map === 'string' ? m.map : null,
        scoreA: Number(m?.scoreA) || 0,
        scoreB: Number(m?.scoreB) || 0,
      }))
    : undefined

  const repo = await useRepo()
  return repo.updateMatch(id, { scoreA, scoreB, status, bestOf, maps })
})
