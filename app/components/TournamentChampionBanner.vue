<script setup lang="ts">
// Чемпион на карточке турнира в списке: фото-баннер (если есть) или золотая плашка
defineProps<{
  champion: {
    name: string
    logoUrl?: string | null
    roster?: { nickname: string; role?: string }[]
  }
  photoUrl?: string | null
}>()
</script>

<template>
  <!-- С фото: баннер на всю ширину карточки -->
  <div v-if="photoUrl" class="relative -mx-4 -mt-4 aspect-[16/9] overflow-hidden">
    <img
      :src="photoUrl"
      alt=""
      loading="lazy"
      class="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
    />
    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
    <div class="absolute inset-x-0 bottom-0 space-y-2 p-3">
      <div class="flex items-center gap-2.5">
        <img
          v-if="champion.logoUrl"
          :src="champion.logoUrl"
          alt=""
          class="h-9 w-9 shrink-0 rounded-md bg-slate-950/50 object-contain ring-1 ring-white/15"
        />
        <div class="min-w-0">
          <div class="text-[10px] font-bold uppercase tracking-widest text-amber-300 drop-shadow">
            🏆 Чемпион
          </div>
          <div class="truncate text-lg font-extrabold leading-tight text-white drop-shadow-lg">
            {{ champion.name }}
          </div>
        </div>
      </div>
      <ChampionRosterChips :roster="champion.roster" on-photo />
    </div>
  </div>

  <!-- Без фото: компактная плашка -->
  <div v-else class="space-y-2 rounded-lg bg-amber-400/10 px-3 py-2 ring-1 ring-amber-400/30">
    <div class="flex items-center gap-2.5">
      <img
        v-if="champion.logoUrl"
        :src="champion.logoUrl"
        alt=""
        class="h-7 w-7 shrink-0 rounded object-contain"
      />
      <span v-else class="text-lg leading-none">🏆</span>
      <div class="min-w-0">
        <div class="text-[10px] font-bold uppercase tracking-widest text-amber-300">Чемпион</div>
        <div class="truncate text-sm font-bold text-white">{{ champion.name }}</div>
      </div>
    </div>
    <ChampionRosterChips :roster="champion.roster" />
  </div>
</template>
