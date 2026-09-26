<script setup lang="ts">
import type { MediaItem } from '~/utils/media'

// Карточка чемпиона турнира: большое фото (если есть), название команды, подпись и состав
const props = defineProps<{
  tournamentId: number
  team: {
    name: string
    logoUrl?: string | null
    roster?: { nickname: string; role?: 'captain' | 'player' }[]
  }
  photo?: { url: string; thumbUrl?: string | null; caption?: string | null } | null
  canManage?: boolean
}>()
const emit = defineEmits<{ changed: [] }>()

const players = computed(() => (props.team.roster ?? []).filter((p) => p.nickname?.trim()))
const lightbox = ref<number | null>(null)
const lightboxItems = computed<MediaItem[]>(() =>
  props.photo ? [{ id: 0, type: 'photo', url: props.photo.url, caption: props.photo.caption }] : [],
)
</script>

<template>
  <section class="card relative overflow-hidden">
    <!-- С фото: фото на всю ширину, текст поверх нижней части -->
    <button
      v-if="photo"
      type="button"
      class="group relative block aspect-[4/3] w-full cursor-zoom-in overflow-hidden sm:aspect-[21/9]"
      aria-label="Открыть фото чемпиона"
      @click="lightbox = 0"
    >
      <img
        :src="photo.url"
        alt=""
        class="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
      />
      <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
      <div class="absolute inset-x-0 bottom-0 p-4 text-left sm:p-6">
        <ChampionInfo :team="team" :players="players" :caption="photo.caption" large />
      </div>
    </button>

    <!-- Без фото: компактная плашка -->
    <div v-else class="relative p-4 sm:p-5">
      <div class="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-400/15 blur-3xl" />
      <ChampionInfo class="relative" :team="team" :players="players" />
    </div>

    <div v-if="canManage" class="border-t border-border p-3 sm:px-5">
      <ChampionPhotoControls :tournament-id="tournamentId" :has-photo="!!photo" @changed="emit('changed')" />
    </div>

    <MediaLightbox
      v-if="lightbox !== null"
      :items="lightboxItems"
      :index="lightbox"
      @update:index="lightbox = $event"
      @close="lightbox = null"
    />
  </section>
</template>
