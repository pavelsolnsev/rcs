<script setup lang="ts">
import { looksLikeVideo } from '~/utils/media'

const props = defineProps<{ busy?: boolean }>()
const emit = defineEmits<{
  submit: [p: { type: 'photo' | 'video'; url: string; thumbUrl: string; caption: string }]
  upload: [p: { file: File; caption: string }]
  cancel: []
}>()

const mode = ref<'device' | 'link'>('device')

// Общая подпись
const caption = ref('')

// Режим «Ссылка»
const type = ref<'photo' | 'video'>('photo')
const url = ref('')
const thumbUrl = ref('')
const typeTouched = ref(false)
watch(url, (v) => {
  if (!typeTouched.value && v.trim()) type.value = looksLikeVideo(v) ? 'video' : 'photo'
})

// Режим «С устройства»
const file = ref<File | null>(null)
const previewUrl = ref<string | null>(null)
function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  file.value = f
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = f && f.type.startsWith('image/') ? URL.createObjectURL(f) : null
}
onBeforeUnmount(() => {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})

const fileSizeLabel = computed(() =>
  file.value ? `${(file.value.size / 1024 / 1024).toFixed(1)} МБ` : '',
)

const canSubmitLink = computed(() => /^https?:\/\//i.test(url.value.trim()) && !props.busy)
const canSubmitFile = computed(() => !!file.value && !props.busy)
const canSubmit = computed(() => (mode.value === 'link' ? canSubmitLink.value : canSubmitFile.value))

function setType(t: 'photo' | 'video') {
  type.value = t
  typeTouched.value = true
}

function submit() {
  if (mode.value === 'link') {
    if (!canSubmitLink.value) return
    emit('submit', {
      type: type.value,
      url: url.value.trim(),
      thumbUrl: thumbUrl.value.trim(),
      caption: caption.value.trim(),
    })
  } else {
    if (!canSubmitFile.value || !file.value) return
    emit('upload', { file: file.value, caption: caption.value.trim() })
  }
}
</script>

<template>
  <div class="card space-y-3 border-brand/40 p-4">
    <h3 class="text-base font-bold text-white">Добавить медиа</h3>

    <!-- Способ -->
    <div class="flex gap-1.5">
      <button
        v-for="opt in (['device', 'link'] as const)"
        :key="opt"
        type="button"
        class="flex-1 cursor-pointer rounded-lg border px-3 py-2 text-sm font-semibold transition-colors"
        :class="
          mode === opt
            ? 'border-brand bg-brand/15 text-brand'
            : 'border-border text-slate-400 hover:border-slate-500 hover:text-white'
        "
        @click="mode = opt"
      >
        {{ opt === 'device' ? 'С устройства' : 'По ссылке' }}
      </button>
    </div>

    <!-- С устройства -->
    <template v-if="mode === 'device'">
      <label
        class="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-bg/50 px-4 py-6 text-center transition-colors hover:border-brand/60"
      >
        <img
          v-if="previewUrl"
          :src="previewUrl"
          alt=""
          class="max-h-40 rounded-lg object-contain"
        />
        <template v-else>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="text-slate-500" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          <span class="text-sm font-medium text-slate-300">Выбрать фото или видео</span>
          <span class="text-[11px] text-slate-500">JPG, PNG, WebP · MP4, WebM</span>
        </template>
        <input type="file" accept="image/*,video/*" class="hidden" @change="onFile" />
      </label>
      <p v-if="file" class="truncate text-xs text-slate-400">
        {{ file.name }} <span class="text-slate-600">· {{ fileSizeLabel }}</span>
      </p>
    </template>

    <!-- По ссылке -->
    <template v-else>
      <div class="flex gap-1.5">
        <button
          v-for="opt in (['photo', 'video'] as const)"
          :key="opt"
          type="button"
          class="flex-1 cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors"
          :class="
            type === opt
              ? 'border-brand bg-brand/15 text-brand'
              : 'border-border text-slate-400 hover:border-slate-500 hover:text-white'
          "
          @click="setType(opt)"
        >
          {{ opt === 'photo' ? 'Фото' : 'Видео' }}
        </button>
      </div>
      <input
        v-model="url"
        type="url"
        :placeholder="type === 'video' ? 'YouTube / VK / ссылка на .mp4' : 'Прямая ссылка на изображение'"
        class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-brand"
        @keydown.enter="submit"
      />
      <input
        v-if="type === 'video'"
        v-model="thumbUrl"
        type="url"
        placeholder="Превью (ссылка на картинку, необязательно) — для YouTube подставится само"
        class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-brand"
        @keydown.enter="submit"
      />
    </template>

    <!-- Подпись -->
    <input
      v-model="caption"
      type="text"
      placeholder="Подпись (необязательно)"
      class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-brand"
      @keydown.enter="submit"
    />

    <div class="flex gap-2 pt-1">
      <button
        type="button"
        :disabled="!canSubmit"
        class="flex-1 cursor-pointer rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        @click="submit"
      >
        {{ props.busy ? 'Загрузка…' : 'Добавить' }}
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg border border-border px-3 py-2 text-sm text-slate-400 transition-colors hover:border-slate-500 hover:text-white"
        @click="emit('cancel')"
      >
        Отмена
      </button>
    </div>

    <p v-if="mode === 'link'" class="text-[11px] leading-relaxed text-slate-500">
      Видео — ссылка на YouTube или VK. Фото — прямая ссылка на изображение (…/фото.jpg).
    </p>
    <p v-else class="text-[11px] leading-relaxed text-slate-500">
      Фото до 15 МБ, видео до 100 МБ. Длинные видео лучше добавлять ссылкой на YouTube/VK.
    </p>
  </div>
</template>
