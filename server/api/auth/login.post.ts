export default defineEventHandler(async (event) => {
  const body = await readBody<{ username?: string; password?: string }>(event)
  const username = body?.username?.trim()
  const password = body?.password ?? ''

  if (!username || !password) {
    throw createError({ statusCode: 400, statusMessage: 'Введите логин и пароль' })
  }

  const repo = await useRepo()
  const user = await repo.verifyAdmin(username, password)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Неверный логин или пароль' })
  }

  await setUserSession(event, { user: { id: user.id, username: user.username, role: 'admin' } })
  return { ok: true, user }
})
