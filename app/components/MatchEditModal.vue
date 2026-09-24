<script setup lang="ts">
// Попап редактирования матча — окно по центру экрана.
// z-index ниже выпадающего списка AppSelect (100) и диалога подтверждения (200).
defineProps<{
  title: string
  teamAName?: string
  teamBName?: string
}>()

const emit = defineEmits<{ close: [] }>()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKey)
  document.documentElement.style.overflow = 'hidden'
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  document.documentElement.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-4">
      <div
        class="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-2xl border border-border bg-surface shadow-2xl shadow-black/60"
        role="dialog"
        aria-modal="true"
        @click.stop
      >
        <!-- Шапка -->
        <header class="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div class="min-w-0">
            <p class="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">{{ title }}</p>
            <p class="flex items-center gap-2 text-base font-bold">
              <span class="truncate">{{ teamAName || 'Команда A' }}</span>
              <span class="shrink-0 text-slate-500">vs</span>
              <span class="truncate">{{ teamBName || 'Команда B' }}</span>
            </p>
          </div>
          <button
            type="button"
            class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            aria-label="Закрыть"
            @click="emit('close')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div class="min-h-0 flex-1 overflow-y-auto p-4">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>
