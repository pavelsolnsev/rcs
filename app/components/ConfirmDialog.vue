<script setup lang="ts">
const { confirmState, resolveConfirm } = useConfirm()

function onKey(e: KeyboardEvent) {
  if (!confirmState.open) return
  if (e.key === 'Escape') resolveConfirm(false)
  else if (e.key === 'Enter') resolveConfirm(true)
}

onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <!-- Затемнение -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="confirmState.open"
        class="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm"
        @click="resolveConfirm(false)"
      />
    </Transition>

    <!-- Окно -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="confirmState.open"
        class="pointer-events-none fixed inset-0 z-[201] flex items-center justify-center p-4"
      >
        <div
          class="card pointer-events-auto w-full max-w-sm p-5 shadow-2xl shadow-black/60"
          role="alertdialog"
          aria-modal="true"
        >
          <div class="flex items-start gap-3.5">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1"
              :class="
                confirmState.tone === 'danger'
                  ? 'bg-red-500/15 text-red-400 ring-red-500/30'
                  : 'bg-brand/15 text-brand ring-brand/30'
              "
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
            </div>
            <div class="min-w-0 flex-1 pt-0.5">
              <h3 v-if="confirmState.title" class="text-base font-bold text-white">
                {{ confirmState.title }}
              </h3>
              <p class="mt-1 text-sm leading-relaxed text-slate-300">{{ confirmState.message }}</p>
            </div>
          </div>

          <div class="mt-5 flex justify-end gap-2">
            <button
              type="button"
              class="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:border-slate-500 hover:text-white"
              @click="resolveConfirm(false)"
            >
              {{ confirmState.cancelText }}
            </button>
            <button
              type="button"
              class="cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              :class="confirmState.tone === 'danger' ? 'bg-red-600' : 'bg-brand'"
              @click="resolveConfirm(true)"
            >
              {{ confirmState.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
