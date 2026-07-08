import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { join, extname, basename } from 'node:path'

const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
}

function parseByteRange(
  rangeHeader: string | undefined,
  size: number,
): { start: number; end: number } | null {
  if (!rangeHeader) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
  if (!m) return null

  const rawStart = m[1]
  const rawEnd = m[2]
  if (!rawStart && !rawEnd) return null

  // Формат bytes=-N: последние N байт.
  if (!rawStart && rawEnd) {
    const suffix = Number(rawEnd)
    if (!Number.isFinite(suffix) || suffix <= 0) return null
    const start = Math.max(0, size - suffix)
    return { start, end: size - 1 }
  }

  const start = Number(rawStart)
  if (!Number.isFinite(start) || start < 0 || start >= size) return null

  let end = rawEnd ? Number(rawEnd) : size - 1
  if (!Number.isFinite(end) || end < start) return null
  if (end >= size) end = size - 1
  return { start, end }
}

/** Отдаёт загруженные медиа-файлы из data/uploads с поддержкой Range (перемотка видео). */
export default defineEventHandler(async (event) => {
  // basename защищает от выхода за пределы папки (path traversal)
  const name = basename(getRouterParam(event, 'file') || '')
  const type = TYPES[extname(name).toLowerCase()]
  if (!type) throw createError({ statusCode: 404, statusMessage: 'Не найдено' })

  const path = join(uploadsDir(), name)
  let size: number
  try {
    size = (await stat(path)).size
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Не найдено' })
  }

  setHeader(event, 'Content-Type', type)
  setHeader(event, 'Accept-Ranges', 'bytes')
  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')

  const range = getRequestHeader(event, 'range')
  const parsedRange = parseByteRange(range, size)
  if (range && !parsedRange) {
    setResponseStatus(event, 416)
    setHeader(event, 'Content-Range', `bytes */${size}`)
    return ''
  }
  if (parsedRange) {
    const { start, end } = parsedRange
    setResponseStatus(event, 206)
    setHeader(event, 'Content-Range', `bytes ${start}-${end}/${size}`)
    setHeader(event, 'Content-Length', String(end - start + 1))
    return Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream
  }

  setHeader(event, 'Content-Length', String(size))
  return Readable.toWeb(createReadStream(path)) as ReadableStream
})
