export interface MediaItem {
  id: number
  type: 'photo' | 'video'
  url: string
  thumbUrl?: string | null
  caption?: string | null
}

/** id ролика YouTube из разных форматов ссылок. */
export function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i,
  )
  return m?.[1] ?? null
}

/**
 * oid/id/hash видео VK. Понимает:
 *  - обычные ссылки: vk.com/video-123_456, vkvideo.ru/video-123_456, vk.com/clip-123_456
 *  - код для вставки: ...video_ext.php?oid=-123&id=456&hash=abc (и внутри <iframe>)
 * hash обязателен для встраивания — VK без него отдаёт ошибку.
 */
export function vkVideo(url: string): { oid: string; id: string; hash?: string } | null {
  // Формат встраивания (в т.ч. из <iframe src="...">)
  const ext = url.match(/video_ext\.php\?([^"'\s]+)/i)
  if (ext) {
    const q = new URLSearchParams(ext[1]!.replace(/&amp;/g, '&'))
    const oid = q.get('oid')
    const id = q.get('id')
    if (oid && id) return { oid, id, hash: q.get('hash') || undefined }
  }
  // Обычная ссылка на видео/клип
  const m = url.match(/(?:video|clip)(-?\d+)_(\d+)/i)
  if (m) {
    const hash = url.match(/[?&]hash=([\w-]+)/i)?.[1]
    return { oid: m[1]!, id: m[2]!, hash }
  }
  return null
}

export interface VideoEmbed {
  kind: 'youtube' | 'vk' | 'iframe' | 'file'
  src: string
}

/** Данные для встраивания видео: iframe для YouTube/VK/сторонних, video — для файлов. */
export function videoEmbed(url: string): VideoEmbed {
  const yt = youtubeId(url)
  if (yt) return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${yt}?rel=0` }
  const vk = vkVideo(url)
  if (vk) {
    let src = `https://vk.com/video_ext.php?oid=${vk.oid}&id=${vk.id}&hd=2`
    if (vk.hash) src += `&hash=${vk.hash}`
    return { kind: 'vk', src }
  }
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)) return { kind: 'file', src: url }
  return { kind: 'iframe', src: url }
}

/** Превью-картинка для видео (пока только YouTube); иначе null → рисуем заглушку. */
export function videoThumb(url: string): string | null {
  const yt = youtubeId(url)
  if (yt) return `https://img.youtube.com/vi/${yt}/hqdefault.jpg`
  return null
}

/** Похоже ли на ссылку-видео (для авто-выбора типа в форме). */
export function looksLikeVideo(url: string): boolean {
  return Boolean(youtubeId(url) || vkVideo(url) || /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url))
}
