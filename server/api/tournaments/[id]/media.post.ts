import { MEDIA_TYPES } from '../../../db/schema'

/** Добавляет фото/видео к турниру. Только админ. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id' })
  }
  const body = await readBody<{
    type?: string
    url?: string
    thumbUrl?: string | null
    caption?: string | null
  }>(event)

  const type = body?.type
  if (type !== 'photo' && type !== 'video') {
    throw createError({ statusCode: 400, statusMessage: 'Тип должен быть photo или video' })
  }
  const url = String(body?.url ?? '').trim()
  if (!/^https?:\/\//i.test(url)) {
    throw createError({ statusCode: 400, statusMessage: 'Укажите корректную ссылку (http/https)' })
  }
  const thumbUrl = String(body?.thumbUrl ?? '').trim()
  if (thumbUrl && !/^https?:\/\//i.test(thumbUrl)) {
    throw createError({ statusCode: 400, statusMessage: 'Ссылка на превью должна быть http/https' })
  }
  const caption = typeof body?.caption === 'string' ? body.caption.trim().slice(0, 200) || null : null

  const repo = await useRepo()
  return repo.addMedia(id, {
    type: type as (typeof MEDIA_TYPES)[number],
    url,
    thumbUrl: thumbUrl || null,
    caption,
  })
})
