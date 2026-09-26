import type { ChampionPhoto } from './repo'

/** Ставит (или убирает) фото чемпиона и удаляет файлы прежнего фото с диска. */
export async function replaceChampionPhoto(tournamentId: number, photo: ChampionPhoto | null) {
  const repo = await useRepo()
  const prev = await repo.setChampionPhoto(tournamentId, photo)
  if (prev && prev.url !== photo?.url) {
    await deleteUploadByUrl(prev.url)
    await deleteUploadByUrl(prev.thumbUrl)
  }
  return photo
}

/** Подпись к фото: обрезаем пробелы и длину, пустая → null. */
export const normalizeCaption = (v: unknown) =>
  typeof v === 'string' ? v.trim().slice(0, 200) || null : null
