<script setup lang="ts">
import type { MediaItem } from '~/utils/media'

const props = defineProps<{
  tournamentId: number | string
  items: MediaItem[]
  usage?: {
    usedBytes: number
    capBytes: number
    leftBytes: number
    usedPercent: number
  } | null
  editable?: boolean
}>()

const emit = defineEmits<{ changed: [] }>()

const { confirm } = useConfirm()
const { error } = useToast()

const lightboxIndex = ref<number | null>(null)
function openAt(item: MediaItem) {
  const i = props.items.findIndex((m) => m.id === item.id)
  if (i !== -1) lightboxIndex.value = i
}

const adding = ref(false)
const busy = ref(false)

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} ГБ`
}

const usageLabel = computed(() => {
  if (!props.usage) return null
  return `Использовано ${formatBytes(props.usage.usedBytes)} из ${formatBytes(props.usage.capBytes)}`
})

const filledSegments = computed(() => {
  const p = props.usage?.usedPercent ?? 0
  return Math.max(0, Math.min(20, Math.round(p / 5)))
})

async function onAdd(p: { type: 'photo' | 'video'; url: string; thumbUrl: string; caption: string }) {
  busy.value = true
  try {
    await $fetch(`/api/tournaments/${props.tournamentId}/media`, { method: 'POST', body: p })
    adding.value = false
    emit('changed')
  } catch (e: any) {
    error(e?.data?.statusMessage || 'Не удалось добавить медиа')
  } finally {
    busy.value = false
  }
}

async function onUpload(p: { file: File; caption: string }) {
  busy.value = true
  try {
    const fd = new FormData()
    fd.append('file', p.file, p.file.name)
    if (p.caption) fd.append('caption', p.caption)
    await $fetch(`/api/tournaments/${props.tournamentId}/media/upload`, { method: 'POST', body: fd })
    adding.value = false
    emit('changed')
  } catch (e: any) {
    error(e?.data?.statusMessage || 'Не удалось загрузить файл')
  } finally {
    busy.value = false
  }
}

async function onRemove(item: MediaItem) {
  const ok = await confirm({
    title: 'Удалить медиа?',
    message: 'Это фото или видео будет удалено из галереи турнира.',
    confirmText: 'Удалить',
    tone: 'danger',
  })
  if (!ok) return
  try {
    await $fetch(`/api/media/${item.id}`, { method: 'DELETE' })
    if (lightboxIndex.value !== null) lightboxIndex.value = null
    emit('changed')
  } catch (e: any) {
    error(e?.data?.statusMessage || 'Не удалось удалить медиа')
  }
}
</script>

<template>
  <section>
    <div class="mb-4 space-y-2.5">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-lg font-bold">
          Фото и видео
          <span v-if="items.length" class="ml-1 text-sm font-medium text-slate-500">
            {{ items.length }}
          </span>
        </h2>
        <button
          v-if="editable && !adding"
          type="button"
          class="shrink-0 cursor-pointer rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          @click="adding = true"
        >
          + Добавить
        </button>
      </div>

      <div v-if="editable && usage" class="rounded-lg border border-border bg-surface-2/50 p-2.5">
        <div class="mb-1 flex items-center justify-between gap-2 text-xs">
          <p class="font-medium text-slate-300">{{ usageLabel }}</p>
          <p class="tabular-nums text-slate-500">{{ usage.usedPercent }}%</p>
        </div>
        <div class="grid grid-cols-[repeat(20,minmax(0,1fr))] gap-0.5">
          <div
            v-for="i in 20"
            :key="i"
            class="h-1.5 rounded-full transition-colors duration-300"
            :class="
              i <= filledSegments
                ? usage.usedPercent >= 90
                  ? 'bg-red-500'
                  : 'bg-brand'
                : 'bg-bg'
            "
          />
        </div>
      </div>
    </div>

    <div v-if="adding" class="mb-4 max-w-lg">
      <MediaAddForm :busy="busy" @submit="onAdd" @upload="onUpload" @cancel="adding = false" />
    </div>

    <div
      v-if="items.length"
      class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4"
    >
      <MediaTile
        v-for="item in items"
        :key="item.id"
        :item="item"
        :editable="editable"
        @open="openAt(item)"
        @remove="onRemove(item)"
      />
    </div>

    <div
      v-else
      class="card flex flex-col items-center justify-center gap-3 p-10 text-center"
    >
      <span class="text-4xl">📷</span>
      <p class="max-w-xs text-sm text-slate-400">
        {{
          editable
            ? 'Пока нет медиа. Добавьте фото и видео с турнира — они появятся здесь красивой галереей.'
            : 'Медиа с турнира скоро появятся здесь.'
        }}
      </p>
    </div>

    <MediaLightbox
      v-if="lightboxIndex !== null"
      :items="items"
      :index="lightboxIndex"
      @update:index="lightboxIndex = $event"
      @close="lightboxIndex = null"
    />
  </section>
</template>
