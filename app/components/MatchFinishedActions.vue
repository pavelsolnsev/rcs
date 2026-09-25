<script setup lang="ts">
// Действия с уже завершённым матчем: сохранить правку, вернуть в Live, полностью сбросить
defineProps<{
  /** Можно ли сохранить текущий счёт (нет запрещённой ничьей) */
  canSave: boolean
  /** Показать подсказку про ничью */
  drawHint: boolean
}>()

const emit = defineEmits<{ save: []; resume: []; reset: []; cancel: [] }>()

const { confirm } = useConfirm()
async function reset() {
  const ok = await confirm({
    title: 'Сбросить результат?',
    message:
      'Счёт и карты очистятся, матч вернётся в ожидание, а команды уберутся из следующих матчей.',
    confirmText: 'Сбросить',
    tone: 'danger',
  })
  if (ok) emit('reset')
}
</script>

<template>
  <div class="space-y-2">
    <button
      type="button"
      class="w-full cursor-pointer rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      :disabled="!canSave"
      @click="emit('save')"
    >
      Сохранить
    </button>
    <p v-if="drawHint" class="text-center text-xs text-amber-300">
      Ничьей в сетке быть не может — нужен победитель
    </p>
    <div class="grid grid-cols-2 gap-2">
      <button
        type="button"
        class="cursor-pointer rounded-lg border border-border px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-500 hover:text-white"
        @click="emit('resume')"
      >
        Вернуть в Live
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg border border-amber-400/40 px-3 py-2 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-400/10"
        @click="reset"
      >
        Сбросить результат
      </button>
    </div>
    <button
      type="button"
      class="w-full cursor-pointer rounded-lg border border-border px-3 py-2 text-sm text-slate-400 transition-colors hover:border-slate-500 hover:text-white"
      @click="emit('cancel')"
    >
      Отмена
    </button>
  </div>
</template>
