import type { H3Event } from 'h3'

/**
 * Требует авторизованного администратора.
 * Бросает 401, если сессии нет. Использует nuxt-auth-utils.
 */
export async function requireAdmin(event: H3Event) {
  const session = await requireUserSession(event)
  if (!session.user || (session.user as any).role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Доступ только для администраторов' })
  }
  return session.user
}
