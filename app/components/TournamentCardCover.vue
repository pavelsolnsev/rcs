<script setup lang="ts">
import { placeholderMapBackground } from '~/utils/maps'

// Обложка карточки турнира: фото чемпиона, а если его нет — турнирная заглушка
// (фон карты CS2 + логотип). Одна высота у всех карточек. Поверх — чемпион и состав.
const props = defineProps<{
  tournamentId: number
  champion?: {
    name: string
    logoUrl?: string | null
    roster?: { nickname: string; role?: string }[]
  } | null
  photoUrl?: string | null
}>()

const placeholderBg = computed(() => placeholderMapBackground(props.tournamentId))
</script>

<template>
  <div class="relative -mx-4 -mt-4 aspect-[16/9] overflow-hidden bg-surface-2">
    <!-- Фото чемпиона -->
    <img
      v-if="photoUrl"
      :src="photoUrl"
      alt=""
      loading="lazy"
      class="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
    />

    <!-- Заглушка: затемнённый фон карты + логотип -->
    <template v-else>
      <img
        :src="placeholderBg"
        alt=""
        loading="lazy"
        class="absolute inset-0 h-full w-full object-cover opacity-60 blur-[1px] saturate-50 transition duration-500 group-hover:scale-[1.04]"
      />
      <div class="absolute inset-0 bg-gradient-to-br from-brand/25 via-slate-950/60 to-slate-950/90" />
      <div class="absolute inset-0 flex items-center justify-center" :class="champion ? 'pb-16' : ''">
        <img
          src="/logo-mark.webp"
          alt=""
          class="h-20 w-20 object-contain opacity-90 drop-shadow-[0_0_18px_rgba(74,222,128,0.35)] sm:h-24 sm:w-24"
        />
      </div>
    </template>

    <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

    <!-- Чемпион и состав -->
    <div v-if="champion" class="absolute inset-x-0 bottom-0 space-y-2 p-3">
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
</template>
