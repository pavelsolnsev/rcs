// Скрипт генерирует splash-экраны для всех популярных iPhone.
// Каждый файл — тёмный фон #0a0b0f (--color-bg) + логотип РКС по центру.
// Лого обрезаем по кругу: исходник — круглая эмблема на белом квадрате,
// без маски на тёмном фоне торчал бы белый квадрат (в интерфейсе то же делает
// AppLogo.vue через rounded-full).
//
// Запуск: npm run splash:generate

import sharp from 'sharp'
import { resolve, dirname } from 'path'
import { mkdir } from 'fs/promises'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const logo = resolve(root, 'public/logo.webp')
const out = resolve(root, 'public/splash')

// Все популярные экраны iPhone (portrait). Список уникален по разрешению:
// iOS выбирает картинку по media-запросу (CSS-размер + dpr), поэтому модели
// с одинаковым экраном (15/16 = 14 Pro, 15 Plus = 14 Pro Max) отдельных файлов
// не требуют. Значения media для nuxt.config: cssW = w / dpr, cssH = h / dpr.
const SCREENS = [
  { name: 'iphone-se', w: 640, h: 1136, dpr: 2, logo: 200 }, // SE 1st/2nd/3rd
  { name: 'iphone-8', w: 750, h: 1334, dpr: 2, logo: 220 }, // 6/7/8
  { name: 'iphone-8plus', w: 1242, h: 2208, dpr: 3, logo: 300 }, // 6+/7+/8+
  { name: 'iphone-x', w: 1125, h: 2436, dpr: 3, logo: 280 }, // X/XS/11 Pro
  { name: 'iphone-xr', w: 828, h: 1792, dpr: 2, logo: 240 }, // XR/11
  { name: 'iphone-xs-max', w: 1242, h: 2688, dpr: 3, logo: 300 }, // XS Max/11 Pro Max
  { name: 'iphone-12-mini', w: 1080, h: 2340, dpr: 3, logo: 270 }, // 12 mini/13 mini
  { name: 'iphone-12', w: 1170, h: 2532, dpr: 3, logo: 280 }, // 12/13/14
  { name: 'iphone-12-pro-max', w: 1284, h: 2778, dpr: 3, logo: 310 }, // 12/13 Pro Max
  { name: 'iphone-14-pro', w: 1179, h: 2556, dpr: 3, logo: 280 }, // 14/15/16 Pro
  { name: 'iphone-14-pro-max', w: 1290, h: 2796, dpr: 3, logo: 320 }, // 14 Pro Max/15 Plus
  { name: 'iphone-16-pro', w: 1206, h: 2622, dpr: 3, logo: 290 }, // 16 Pro
  { name: 'iphone-16-pro-max', w: 1320, h: 2868, dpr: 3, logo: 330 }, // 16 Pro Max
]

const BG = { r: 10, g: 11, b: 15 } // #0a0b0f — --color-bg

/** Круглая маска нужного размера: белый круг = видимая часть. */
function circleMask(size) {
  const r = size / 2
  return Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`,
  )
}

await mkdir(out, { recursive: true })

for (const s of SCREENS) {
  const size = s.logo
  const left = Math.round((s.w - size) / 2)
  const top = Math.round((s.h - size) / 2) - Math.round(s.h * 0.04) // чуть выше центра

  // Масштабируем лого и вырезаем круг (dest-in оставляет пиксели только под маской).
  const logoBuffer = await sharp(logo)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .composite([{ input: circleMask(size), blend: 'dest-in' }])
    .png()
    .toBuffer()

  await sharp({
    create: { width: s.w, height: s.h, channels: 4, background: { ...BG, alpha: 255 } },
  })
    .composite([{ input: logoBuffer, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(`${out}/${s.name}.png`)

  // Печатаем и media-запрос — чтобы было с чем сверить список в nuxt.config.ts.
  const media = `(device-width:${s.w / s.dpr}px) and (device-height:${s.h / s.dpr}px) and (-webkit-device-pixel-ratio:${s.dpr})`
  console.log(`✓ ${s.name.padEnd(18)} ${s.w}×${s.h}  ${media}`)
}

console.log('\nВсе splash-экраны готовы!')
