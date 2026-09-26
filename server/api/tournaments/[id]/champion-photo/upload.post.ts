/** Фото чемпиона файлом с устройства. Только админ. */
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректный id' })
  }

  const parts = await readMultipartFormData(event)
  const file = parts?.find((p) => p.name === 'file' && p.filename)
  if (!file || !file.data?.length) {
    throw createError({ statusCode: 400, statusMessage: 'Файл не выбран' })
  }
  if (!(file.type || '').startsWith('image/')) {
    throw createError({ statusCode: 400, statusMessage: 'Можно загрузить только изображение' })
  }
  if (file.data.length > 15 * 1024 * 1024) {
    throw createError({ statusCode: 413, statusMessage: 'Файл слишком большой (макс 15 МБ)' })
  }
  const captionPart = parts?.find((p) => p.name === 'caption' && !p.filename)

  const repo = await useRepo()
  const data = await repo.getTournament(id)
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Турнир не найден' })

  const optimized = await optimizeImageUpload(file.data)
  // Квота турнира общая с медиа (текущее фото чемпиона всё равно будет заменено)
  const incoming = optimized.main.length + optimized.thumb.length
  if (data.mediaUsage.usedBytes + incoming > data.mediaUsage.capBytes) {
    throw createError({
      statusCode: 413,
      statusMessage: 'Достигнут лимит загрузок турнира (1 ГБ). Удалите лишнее или используйте ссылку.',
    })
  }

  const name = await saveUpload(optimized.main, optimized.mainMime)
  const thumb = await saveUpload(optimized.thumb, optimized.thumbMime)
  return replaceChampionPhoto(id, {
    url: `/uploads/${name}`,
    thumbUrl: `/uploads/${thumb}`,
    caption: normalizeCaption(captionPart?.data.toString('utf8')),
  })
})
