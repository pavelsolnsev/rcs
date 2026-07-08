<script setup lang="ts">
interface Player {
  nickname: string
  steamId?: string | null
}

const props = defineProps<{
  teamSize: string
  title: string
  submitLabel: string
  initialName?: string
  initialRoster?: { nickname: string; role?: 'captain' | 'player'; steamId?: string | null }[]
  busy?: boolean
}>()

const emit = defineEmits<{
  submit: [p: { name: string; roster: Player[] }]
  cancel: []
}>()

const size = computed(() => (props.teamSize === '1x1' ? 1 : props.teamSize === '2x2' ? 2 : 5))

const name = ref(props.initialName ?? '')
const rows = ref<Player[]>(
  Array.from({ length: size.value }, (_, i) => ({
    nickname: props.initialRoster?.[i]?.nickname ?? '',
    steamId: props.initialRoster?.[i]?.steamId ?? null,
  })),
)

const canSubmit = computed(() => name.value.trim().length > 0 && !props.busy)

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    name: name.value.trim(),
    roster: rows.value.map((r) => ({ nickname: r.nickname.trim(), steamId: r.steamId || null })),
  })
}
</script>

<template>
  <div class="card space-y-3 border-brand/40 p-4">
    <h3 class="text-base font-bold text-white">{{ title }}</h3>

    <label class="block space-y-1">
      <span class="text-xs font-medium text-slate-400">Название команды</span>
      <input
        v-model="name"
        type="text"
        placeholder="Например, Navi"
        class="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-brand"
        @keydown.enter="submit"
      />
    </label>

    <div class="space-y-1.5">
      <span class="text-xs font-medium text-slate-400">Состав ({{ teamSize }})</span>
      <div v-for="(row, i) in rows" :key="i" class="flex items-center gap-2">
        <span class="w-16 shrink-0 text-[11px] text-slate-500">
          {{ i === 0 ? 'Капитан' : `Игрок ${i + 1}` }}
        </span>
        <input
          v-model="row.nickname"
          type="text"
          :placeholder="`Ник игрока ${i + 1}`"
          class="w-full min-w-0 rounded-lg border border-border bg-bg px-3 py-2 text-sm outline-none transition-colors focus:border-brand"
          @keydown.enter="submit"
        />
      </div>
    </div>

    <div class="flex gap-2 pt-1">
      <button
        type="button"
        :disabled="!canSubmit"
        class="flex-1 cursor-pointer rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        @click="submit"
      >
        {{ submitLabel }}
      </button>
      <button
        type="button"
        class="cursor-pointer rounded-lg border border-border px-3 py-2 text-sm text-slate-400 transition-colors hover:border-slate-500 hover:text-white"
        @click="emit('cancel')"
      >
        Отмена
      </button>
    </div>
  </div>
</template>
