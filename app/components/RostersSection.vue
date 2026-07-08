<script setup lang="ts">
interface Player { nickname: string; role?: 'captain' | 'player'; steamId?: string | null }
interface Team { id: number; name: string; logoUrl?: string | null; roster?: Player[] }

const props = defineProps<{
  tournamentId: number | string
  teams: Team[]
  teamSize: string
  editable?: boolean
}>()

const emit = defineEmits<{ changed: [] }>()

const { confirm } = useConfirm()
const { error } = useToast()

const adding = ref(false)
const editingTeam = ref<Team | null>(null)
const busy = ref(false)

function startAdd() {
  editingTeam.value = null
  adding.value = true
}
function startEdit(team: Team) {
  adding.value = false
  editingTeam.value = team
}
function closeForm() {
  adding.value = false
  editingTeam.value = null
}

async function onAdd(p: { name: string; roster: Player[] }) {
  const ok = await confirm({
    title: 'Добавить команду?',
    message: 'Сетка/группы будут перестроены — счёт уже сыгранных матчей сбросится.',
    confirmText: 'Добавить',
    tone: 'danger',
  })
  if (!ok) return
  busy.value = true
  try {
    await $fetch(`/api/tournaments/${props.tournamentId}/teams`, { method: 'POST', body: p })
    closeForm()
    emit('changed')
  } catch (e: any) {
    error(e?.data?.statusMessage || 'Не удалось добавить команду')
  } finally {
    busy.value = false
  }
}

async function onEdit(p: { name: string; roster: Player[] }) {
  if (!editingTeam.value) return
  busy.value = true
  try {
    await $fetch(`/api/teams/${editingTeam.value.id}`, { method: 'PATCH', body: p })
    closeForm()
    emit('changed')
  } catch (e: any) {
    error(e?.data?.statusMessage || 'Не удалось сохранить команду')
  } finally {
    busy.value = false
  }
}

async function onRemove(team: Team) {
  const ok = await confirm({
    title: `Удалить «${team.name}»?`,
    message: 'Сетка/группы будут перестроены, счёт сыгранных матчей сбросится.',
    confirmText: 'Удалить',
    tone: 'danger',
  })
  if (!ok) return
  busy.value = true
  try {
    await $fetch(`/api/teams/${team.id}`, { method: 'DELETE' })
    emit('changed')
  } catch (e: any) {
    error(e?.data?.statusMessage || 'Не удалось удалить команду')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section>
    <div class="mb-4 flex items-center justify-between gap-3">
      <h2 class="text-lg font-bold">Составы команд</h2>
      <button
        v-if="editable && !adding && !editingTeam"
        type="button"
        class="shrink-0 cursor-pointer rounded-lg bg-brand px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        @click="startAdd"
      >
        + Добавить команду
      </button>
    </div>

    <!-- Форма добавления / редактирования -->
    <div v-if="adding" class="mb-4">
      <TeamEditor
        key="add"
        :team-size="teamSize"
        title="Новая команда"
        submit-label="Добавить"
        :busy="busy"
        @submit="onAdd"
        @cancel="closeForm"
      />
    </div>
    <div v-else-if="editingTeam" class="mb-4">
      <TeamEditor
        :key="`edit-${editingTeam.id}`"
        :team-size="teamSize"
        title="Изменить команду"
        submit-label="Сохранить"
        :initial-name="editingTeam.name"
        :initial-roster="editingTeam.roster"
        :busy="busy"
        @submit="onEdit"
        @cancel="closeForm"
      />
    </div>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      <TeamRosterCard
        v-for="team in teams"
        :key="team.id"
        :team="team"
        :team-size="teamSize"
        :editable="editable"
        @edit="startEdit(team)"
        @remove="onRemove(team)"
      />
    </div>
  </section>
</template>
