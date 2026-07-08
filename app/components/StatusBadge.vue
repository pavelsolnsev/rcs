<script setup lang="ts">
const props = defineProps<{
  status: string
  kind?: 'tournament' | 'match'
  /** sm — компактный вариант для карточек матчей */
  size?: 'sm' | 'md'
}>()

const map: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Черновик', cls: 'bg-slate-500/15 text-slate-300 ring-slate-500/30' },
  ongoing: { label: 'Идёт', cls: 'bg-brand/15 text-brand ring-brand/30' },
  finished: { label: 'Завершён', cls: 'bg-teal-500/15 text-teal-300 ring-teal-500/30' },
  pending: { label: 'Ожидается', cls: 'bg-slate-500/15 text-slate-300 ring-slate-500/30' },
  live: { label: 'В игре', cls: 'bg-red-500/15 text-red-400 ring-red-500/30' },
}

const info = computed(() => map[props.status] ?? { label: props.status, cls: 'bg-slate-500/15 text-slate-300 ring-slate-500/30' })
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap ring-1 ring-inset"
    :class="[info.cls, size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs']"
  >
    <span v-if="status === 'live'" class="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
    {{ info.label }}
  </span>
</template>
