<script setup lang="ts">
interface FilterState {
  search: string
}

const props = defineProps<{
  modelValue: FilterState
}>()

const emit = defineEmits<{
  'update:modelValue': [value: FilterState]
}>()

function patchFilters(patch: Partial<FilterState>) {
  emit('update:modelValue', {
    ...props.modelValue,
    ...patch,
  })
}

function resetFilters() {
  emit('update:modelValue', {
    search: '',
  })
}
</script>

<template>
  <section class="card p-3 sm:p-4">
    <div class="flex flex-col gap-2 sm:flex-row">
      <input
        :value="modelValue.search"
        type="text"
        placeholder="Поиск по названию"
        class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-brand sm:flex-1"
        @input="patchFilters({ search: ($event.target as HTMLInputElement).value })"
      />

      <button
        type="button"
        class="cursor-pointer rounded-lg border border-border px-3 py-2 text-sm text-slate-300 transition-colors hover:border-brand hover:text-white sm:shrink-0"
        @click="resetFilters"
      >
        Сбросить
      </button>
    </div>
  </section>
</template>
