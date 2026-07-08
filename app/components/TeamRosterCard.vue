<script setup lang="ts">
defineProps<{
  team: {
    id: number
    name: string
    logoUrl?: string | null
    roster?: { nickname: string; role?: 'captain' | 'player'; steamId?: string | null }[]
  }
  teamSize: string
  editable?: boolean
}>()

const emit = defineEmits<{ edit: []; remove: [] }>()
</script>

<template>
  <article class="card p-4">
    <div class="mb-3 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="truncate text-base font-bold text-white">{{ team.name }}</h3>
        <p class="text-xs text-slate-500">Состав {{ teamSize }}</p>
      </div>
      <img
        v-if="team.logoUrl"
        :src="team.logoUrl"
        alt=""
        class="h-10 w-10 shrink-0 rounded-lg bg-surface-2 object-contain p-1"
      />
    </div>

    <div v-if="team.roster?.length" class="space-y-1.5">
      <div
        v-for="(player, idx) in team.roster"
        :key="`${team.id}-${idx}-${player.nickname}`"
        class="flex items-center justify-between gap-2 rounded-md bg-surface-2 px-2.5 py-1.5"
      >
        <span class="truncate text-sm text-slate-100">{{ player.nickname }}</span>
        <span
          v-if="player.role === 'captain'"
          class="shrink-0 rounded bg-brand/20 px-1.5 py-0.5 text-[10px] font-semibold text-brand"
        >
          Капитан
        </span>
      </div>
    </div>

    <p v-else class="text-sm text-slate-500">Состав пока не заполнен.</p>

    <div v-if="editable" class="mt-3 flex gap-2 border-t border-border pt-3">
      <button
        type="button"
        class="flex-1 cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-brand hover:text-white"
        @click="emit('edit')"
      >
        ✎ Изменить
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-slate-400 transition-colors hover:border-red-500/60 hover:text-red-300"
        @click="emit('remove')"
      >
        Удалить
      </button>
    </div>
  </article>
</template>
