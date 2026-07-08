import { mkdir, writeFile, readFile, stat, unlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import sharp from 'sharp'

/** Папка для загруженных медиа (рядом с проектом, вне сборки). */
const UPLOADS_DIR = resolve(process.cwd(), 'data', 'uploads')
export const TOURNAMENT_UPLOAD_CAP_BYTES = 1024 * 1024 * 1024 // 1 ГБ

export function uploadsDir() {
  return UPLOADS_DIR
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

export function extForMime(mime: string): string | null {
  return EXT_BY_MIME[mime] ?? null
}

export interface OptimizedImageUpload {
  main: Buffer
  thumb: Buffer
  mainMime: 'image/webp'
  thumbMime: 'image/webp'
}

/**
 * Серверная оптимизация фото: уменьшаем оригинал и генерируем превью для галереи.
 * Храним обе версии в WebP для экономии места и быстрого открытия.
 */
export async function optimizeImageUpload(data: Buffer | Uint8Array): Promise<OptimizedImageUpload> {
  const input = Buffer.isBuffer(data) ? data : Buffer.from(data)
  try {
    // rotate() учитывает EXIF-ориентацию, чтобы фото не было "боком".
    const base = sharp(input, { failOn: 'none' }).rotate()
    const main = await base
      .clone()
      .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer()
    const thumb = await base
      .clone()
      .resize({ width: 720, height: 720, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 70, effort: 4 })
      .toBuffer()
    if (!main.length || !thumb.length) {
      throw new Error('empty-output')
    }
    return { main, thumb, mainMime: 'image/webp', thumbMime: 'image/webp' }
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Не удалось обработать изображение. Проверьте формат файла.',
    })
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { windowsHide: true }, (error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

/**
 * Генерирует превью для видео через ffmpeg.
 * Возвращает WebP-буфер или null, если кадр извлечь не удалось.
 */
export async function makeVideoThumb(
  data: Buffer | Uint8Array,
  mime: string,
): Promise<{ thumb: Buffer; thumbMime: 'image/webp' } | null> {
  const ext = extForMime(mime)
  if (!ext || !mime.startsWith('video/')) return null

  await mkdir(UPLOADS_DIR, { recursive: true })
  const id = randomUUID()
  const inputPath = join(UPLOADS_DIR, `${id}-src.${ext}`)
  const outputPath = join(UPLOADS_DIR, `${id}-thumb.webp`)

  try {
    await writeFile(inputPath, data)
    await runFfmpeg([
      '-y',
      '-i',
      inputPath,
      '-vf',
      'thumbnail,scale=960:-2:force_original_aspect_ratio=decrease',
      '-frames:v',
      '1',
      outputPath,
    ])
    const thumb = await readFile(outputPath)
    if (!thumb.length) return null
    return { thumb, thumbMime: 'image/webp' }
  } catch {
    return null
  } finally {
    await unlink(inputPath).catch(() => {})
    await unlink(outputPath).catch(() => {})
  }
}

export interface TournamentMediaUsage {
  usedBytes: number
  capBytes: number
  leftBytes: number
  usedPercent: number
}

/**
 * Считает объём локально загруженных медиа-файлов турнира.
 * Внешние ссылки (YouTube/HTTP) в квоту не входят.
 */
export async function getTournamentMediaUsage(
  items: Array<{ url?: string | null; thumbUrl?: string | null }>,
): Promise<TournamentMediaUsage> {
  let usedBytes = 0
  for (const item of items) {
    const fileName = uploadedName(item.url)
    if (fileName) usedBytes += await uploadSize(fileName)
    const thumbName = uploadedName(item.thumbUrl)
    if (thumbName) usedBytes += await uploadSize(thumbName)
  }
  const capBytes = TOURNAMENT_UPLOAD_CAP_BYTES
  const leftBytes = Math.max(0, capBytes - usedBytes)
  const usedPercent = capBytes > 0 ? Math.min(100, Math.round((usedBytes / capBytes) * 100)) : 0
  return { usedBytes, capBytes, leftBytes, usedPercent }
}

/** Сохраняет файл на диск, возвращает имя файла. */
export async function saveUpload(data: Buffer | Uint8Array, mime: string): Promise<string> {
  const ext = extForMime(mime)
  if (!ext) throw createError({ statusCode: 400, statusMessage: 'Неподдерживаемый формат файла' })
  await mkdir(UPLOADS_DIR, { recursive: true })
  const name = `${randomUUID()}.${ext}`
  await writeFile(join(UPLOADS_DIR, name), data)
  return name
}

/** Имя загруженного файла из URL вида /uploads/xxx.jpg (или null для внешних ссылок). */
export function uploadedName(url: string | null | undefined): string | null {
  const m = /^\/uploads\/([\w.-]+)$/.exec(url ?? '')
  return m ? m[1]! : null
}

/** Размер файла в байтах (0, если файла нет). */
export async function uploadSize(name: string): Promise<number> {
  try {
    return (await stat(join(UPLOADS_DIR, name))).size
  } catch {
    return 0
  }
}

/** Удаляет файл, если это загруженный медиа-файл (внешние ссылки игнорирует). */
export async function deleteUploadByUrl(url: string | null | undefined): Promise<void> {
  const name = uploadedName(url)
  if (!name) return
  try {
    await unlink(join(UPLOADS_DIR, name))
  } catch {
    // файла уже нет — не критично
  }
}
