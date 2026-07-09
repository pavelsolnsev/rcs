interface ReorderBody {
  matchId?: number
  order?: number
}

/** Изменить номер матча в порядке группы (остальные сдвигаются). Только админ. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<ReorderBody>(event)
  const matchId = Number(body?.matchId)
  const order = Number(body?.order)
  if (!Number.isInteger(matchId) || !Number.isInteger(order) || order < 1) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный номер матча или порядок' })
  }

  const repo = await useRepo()
  await repo.moveMatchOrder(matchId, order)
  return { ok: true }
})
