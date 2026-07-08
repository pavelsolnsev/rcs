/** Загрузка фото/видео файлом с устройства. Только админ. */
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

  const mime = file.type || ''
  const isImage = mime.startsWith('image/')
  const isVideo = mime.startsWith('video/')
  if (!isImage && !isVideo) {
    throw createError({ statusCode: 400, statusMessage: 'Можно загружать только изображения или видео' })
  }

  const maxMb = isVideo ? 100 : 15
  if (file.data.length > maxMb * 1024 * 1024) {
    throw createError({ statusCode: 413, statusMessage: `Файл слишком большой (макс ${maxMb} МБ)` })
  }

  const thumbPart = parts?.find((p) => p.name === 'thumb' && p.filename)
  const captionPart = parts?.find((p) => p.name === 'caption' && !p.filename)
  const caption = captionPart ? captionPart.data.toString('utf8').trim().slice(0, 200) || null : null

  const repo = await useRepo()
  const data = await repo.getTournament(id)
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Турнир не найден' })

  // Проверяем суммарный объём уже загруженных файлов турнира
  const usage = await getTournamentMediaUsage(data.media ?? [])
  let mainData: Buffer | Uint8Array = file.data
  let mainMime = mime
  let thumbData: Buffer | Uint8Array | null = null
  let thumbMime: string | null = null

  if (isImage) {
    const optimized = await optimizeImageUpload(file.data)
    mainData = optimized.main
    mainMime = optimized.mainMime
    thumbData = optimized.thumb
    thumbMime = optimized.thumbMime
  } else {
    // Для локально загруженных видео делаем превью автоматически на сервере.
    const generated = await makeVideoThumb(file.data, mime)
    if (generated) {
      thumbData = generated.thumb
      thumbMime = generated.thumbMime
    } else if (thumbPart?.data?.length) {
      // Фолбэк: если клиент всё же прислал превью вручную.
      thumbData = thumbPart.data
      thumbMime = thumbPart.type || 'image/jpeg'
    }
  }

  const incoming = mainData.length + (thumbData?.length ?? 0)
  if (usage.usedBytes + incoming > usage.capBytes) {
    throw createError({
      statusCode: 413,
      statusMessage: 'Достигнут лимит загрузок турнира (1 ГБ). Удалите лишнее или используйте ссылки.',
    })
  }

  const name = await saveUpload(mainData, mainMime)
  let thumbUrl: string | null = null
  if (thumbData?.length && thumbMime) {
    const tname = await saveUpload(thumbData, thumbMime)
    thumbUrl = `/uploads/${tname}`
  }

  return repo.addMedia(id, {
    type: isImage ? 'photo' : 'video',
    url: `/uploads/${name}`,
    thumbUrl,
    caption,
  })
})
