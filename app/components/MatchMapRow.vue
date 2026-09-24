<script setup lang="ts">
interface MapRow {
  map: string | null
  scoreA: number
  scoreB: number
}

// Слот одной карты: выбор карты + счёт команд
defineProps<{
  options: { value: string; label: string }[]
  placeholder: string
  teamAName?: string
  teamBName?: string
}>()

const row = defineModel<MapRow>({ required: true })
</script>

<template>
  <div class="space-y-2 rounded-xl bg-bg/60 p-3">
    <AppSelect v-model="row.map" :options="options" :placeholder="placeholder" />
    <div class="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
      <label class="min-w-0 space-y-1">
        <span class="block truncate text-center text-xs font-semibold text-slate-400">
          {{ teamAName || 'Команда A' }}
        </span>
        <ScoreInput v-model="row.scoreA" label="Счёт первой команды" />
      </label>
      <span class="pb-3 text-xl font-bold text-slate-500">:</span>
      <label class="min-w-0 space-y-1">
        <span class="block truncate text-center text-xs font-semibold text-slate-400">
          {{ teamBName || 'Команда B' }}
        </span>
        <ScoreInput v-model="row.scoreB" label="Счёт второй команды" />
      </label>
    </div>
  </div>
</template>
