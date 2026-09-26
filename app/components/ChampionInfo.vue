<script setup lang="ts">
// Текстовая часть карточки чемпиона: метка, логотип и название, подпись, состав
defineProps<{
  team: { name: string; logoUrl?: string | null }
  players: { nickname: string; role?: 'captain' | 'player' }[]
  caption?: string | null
  /** Крупный вариант — поверх фото */
  large?: boolean
}>()
</script>

<template>
  <div class="space-y-2">
    <span
      class="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-amber-300 ring-1 ring-amber-400/40 backdrop-blur-sm"
    >
      🏆 Чемпион турнира
    </span>

    <div class="flex items-center gap-3">
      <img
        v-if="team.logoUrl"
        :src="team.logoUrl"
        alt=""
        class="shrink-0 rounded-lg bg-slate-950/40 object-contain ring-1 ring-white/15"
        :class="large ? 'h-12 w-12 sm:h-14 sm:w-14' : 'h-10 w-10'"
      />
      <h2
        class="min-w-0 font-extrabold leading-tight text-white"
        :class="large ? 'text-2xl drop-shadow-lg sm:text-4xl' : 'text-xl sm:text-2xl'"
      >
        {{ team.name }}
      </h2>
    </div>

    <p
      v-if="caption"
      class="max-w-2xl text-sm leading-relaxed"
      :class="large ? 'text-slate-200 drop-shadow' : 'text-slate-300'"
    >
      {{ caption }}
    </p>

    <div v-if="players.length" class="flex flex-wrap gap-1.5">
      <span
        v-for="p in players"
        :key="p.nickname"
        class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ring-1"
        :class="
          large
            ? 'bg-slate-950/50 text-slate-100 ring-white/15 backdrop-blur-sm'
            : 'bg-surface-2 text-slate-200 ring-border'
        "
      >
        <span v-if="p.role === 'captain'" class="text-amber-300" title="Капитан">★</span>
        {{ p.nickname }}
      </span>
    </div>
  </div>
</template>
