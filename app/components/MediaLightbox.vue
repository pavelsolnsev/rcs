<script setup lang="ts">
import { videoEmbed, type MediaItem } from '~/utils/media'

const props = defineProps<{ items: MediaItem[]; index: number }>()
const emit = defineEmits<{ close: []; 'update:index': [n: number] }>()

const current = computed(() => props.items[props.index] ?? null)
const embed = computed(() =>
  current.value?.type === 'video' ? videoEmbed(current.value.url) : null,
)
const canPrev = computed(() => props.index > 0)
const canNext = computed(() => props.index < props.items.length - 1)

function prev() {
  if (canPrev.value) emit('update:index', props.index - 1)
}
function next() {
  if (canNext.value) emit('update:index', props.index + 1)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'ArrowLeft') prev()
  else if (e.key === 'ArrowRight') next()
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))

// Свайпы на мобильных
const touchX = ref<number | null>(null)
function onTouchStart(e: TouchEvent) {
  touchX.value = e.changedTouches[0]?.clientX ?? null
}
function onTouchEnd(e: TouchEvent) {
  const start = touchX.value
  touchX.value = null
  const end = e.changedTouches[0]?.clientX
  if (start == null || end == null) return
  const dx = end - start
  if (Math.abs(dx) > 50) (dx > 0 ? prev : next)()
}

const btn =
  'flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 backdrop-blur transition hover:bg-white/20'
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[220] flex flex-col bg-slate-950/95 backdrop-blur-sm">
      <!-- Верхняя панель -->
      <div class="flex shrink-0 items-center justify-between gap-3 p-3">
        <span class="text-sm tabular-nums text-slate-400">{{ index + 1 }} / {{ items.length }}</span>
        <div class="flex items-center gap-2">
          <a
            v-if="current"
            :href="current.url"
            target="_blank"
            rel="noopener"
            :class="btn"
            aria-label="Открыть источник"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            </svg>
          </a>
          <button type="button" :class="btn" aria-label="Закрыть" @click="emit('close')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Контент -->
      <div
        class="relative flex flex-1 items-center justify-center overflow-hidden px-2 pb-2"
        @touchstart.passive="onTouchStart"
        @touchend="onTouchEnd"
        @click.self="emit('close')"
      >
        <template v-if="current">
          <img
            v-if="current.type === 'photo'"
            :src="current.url"
            alt=""
            class="max-h-full max-w-full rounded-lg object-contain shadow-2xl shadow-black/60"
          />
          <div v-else class="aspect-video w-full max-w-5xl">
            <video
              v-if="embed?.kind === 'file'"
              :src="embed.src"
              controls
              autoplay
              class="h-full w-full rounded-lg bg-black"
            />
            <iframe
              v-else
              :src="embed?.src"
              class="h-full w-full rounded-lg bg-black"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowfullscreen
            />
          </div>
        </template>

        <!-- Навигация -->
        <button
          v-if="canPrev"
          type="button"
          class="absolute left-2 top-1/2 -translate-y-1/2 sm:left-4"
          :class="btn"
          aria-label="Предыдущее"
          @click.stop="prev"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button
          v-if="canNext"
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 sm:right-4"
          :class="btn"
          aria-label="Следующее"
          @click.stop="next"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>

      <!-- Подпись -->
      <div v-if="current?.caption" class="shrink-0 px-4 pb-4 pt-1 text-center text-sm text-slate-300">
        {{ current.caption }}
      </div>
    </div>
  </Teleport>
</template>
