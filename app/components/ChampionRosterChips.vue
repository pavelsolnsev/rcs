<script setup lang="ts">
// Состав команды-чемпиона чипами (капитан — со звёздочкой и первым)
const props = defineProps<{
  roster?: { nickname: string; role?: string }[]
  /** Поверх фото — полупрозрачный фон */
  onPhoto?: boolean
}>()

const players = computed(() =>
  [...(props.roster ?? [])].sort((a, b) => Number(b.role === 'captain') - Number(a.role === 'captain')),
)
</script>

<template>
  <div v-if="players.length" class="flex flex-wrap gap-1">
    <span
      v-for="p in players"
      :key="p.nickname"
      class="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-semibold"
      :class="onPhoto ? 'bg-slate-950/60 text-slate-100 backdrop-blur-sm' : 'bg-slate-950/40 text-slate-200'"
    >
      <span v-if="p.role === 'captain'" class="text-amber-300" title="Капитан">★</span>
      {{ p.nickname }}
    </span>
  </div>
</template>
