<script setup lang="ts">
import { videoThumb, type MediaItem } from '~/utils/media'

const props = defineProps<{ item: MediaItem; editable?: boolean }>()
const emit = defineEmits<{ open: []; remove: [] }>()

const thumb = computed(() =>
  props.item.type === 'video'
    ? videoThumb(props.item.url) || props.item.thumbUrl || null
    : props.item.thumbUrl || props.item.url,
)
const broken = ref(false)
</script>

<template>
  <div class="group relative aspect-square overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border">
    <button
      type="button"
      class="block h-full w-full cursor-pointer"
      :aria-label="item.caption || (item.type === 'video' ? 'Открыть видео' : 'Открыть фото')"
      @click="emit('open')"
    >
      <img
        v-if="thumb && !broken"
        :src="thumb"
        alt=""
        loading="lazy"
        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        @error="broken = true"
      />
      <!-- Заглушка: нет превью или ссылка не является медиа -->
      <div
        v-else
        class="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-surface-2 to-bg px-2 text-center text-slate-500"
      >
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="M2 8h20M7 4v4M17 4v4M7 16v4M17 16v4" />
        </svg>
        <span v-if="broken" class="text-[10px] leading-tight">Ссылка не открывается</span>
      </div>

      <!-- Значок видео -->
      <div
        v-if="item.type === 'video'"
        class="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <span
          class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950/55 text-white ring-1 ring-white/30 backdrop-blur-sm transition-transform duration-300 group-hover:scale-110"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </div>

      <!-- Подпись -->
      <div
        v-if="item.caption"
        class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 to-transparent p-2 pt-7"
      >
        <p class="truncate text-left text-xs font-medium text-slate-100">{{ item.caption }}</p>
      </div>
    </button>

    <!-- Удалить (админ). На тач-устройствах видно всегда, на десктопе — по наведению. -->
    <button
      v-if="editable"
      type="button"
      class="absolute right-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-slate-950/70 text-slate-200 opacity-100 ring-1 ring-white/15 backdrop-blur transition hover:bg-red-600 hover:text-white focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
      aria-label="Удалить"
      @click.stop="emit('remove')"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  </div>
</template>
