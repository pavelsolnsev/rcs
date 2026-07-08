<script setup lang="ts">
const { toasts, dismiss } = useToast()

const styles: Record<string, { cls: string; icon: string }> = {
  error: {
    cls: 'bg-red-500/15 text-red-200 ring-red-500/30',
    icon: 'M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z',
  },
  success: {
    cls: 'bg-teal-500/15 text-teal-200 ring-teal-500/30',
    icon: 'M20 6 9 17l-5-5',
  },
  info: {
    cls: 'bg-slate-500/15 text-slate-200 ring-slate-500/30',
    icon: 'M12 16v-4M12 8h.01M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
  },
}
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 top-0 z-[210] flex flex-col items-center gap-2 px-4 py-4 [padding-top:calc(1rem+env(safe-area-inset-top))]"
    >
      <TransitionGroup
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 -translate-y-3"
        leave-active-class="transition duration-150 ease-in absolute"
        leave-to-class="opacity-0 -translate-y-2"
        move-class="transition duration-200"
      >
        <button
          v-for="t in toasts"
          :key="t.id"
          type="button"
          class="pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-border bg-surface px-3.5 py-3 text-left text-sm shadow-2xl shadow-black/50 ring-1 backdrop-blur"
          :class="styles[t.type]?.cls"
          @click="dismiss(t.id)"
        >
          <svg class="shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path :d="styles[t.type]?.icon" />
          </svg>
          <span class="min-w-0 flex-1 font-medium">{{ t.message }}</span>
        </button>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
