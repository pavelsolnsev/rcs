<script setup lang="ts">
// Поле счёта: 0 показываем как пустое поле с плейсхолдером,
// чтобы не стирать ноль вручную, а сразу вводить нужные цифры.
const model = defineModel<number>({ default: 0 })

defineProps<{ label?: string }>()

const text = computed(() => (Number(model.value) ? String(model.value) : ''))

function onInput(e: Event) {
  const el = e.target as HTMLInputElement
  const raw = el.value.replace(/\D/g, '').slice(0, 3)
  el.value = raw
  model.value = raw ? Number(raw) : 0
}
</script>

<template>
  <input
    :value="text"
    type="text"
    inputmode="numeric"
    pattern="[0-9]*"
    placeholder="0"
    :aria-label="label"
    class="w-full min-w-0 rounded-lg border border-border bg-bg px-2 py-2.5 text-center text-2xl font-bold tabular-nums outline-none transition-colors placeholder:text-slate-600 focus:border-brand"
    @input="onInput"
    @focus="($event.target as HTMLInputElement).select()"
  />
</template>
