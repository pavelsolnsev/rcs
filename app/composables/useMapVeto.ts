import { vetoSequence, type VetoStep, type VetoTeam } from '~/utils/veto'

export interface VetoLogEntry {
  map: string
  step: VetoStep
}

/**
 * Реактивная машина состояний пик/бана карт.
 * Хранит хронологию действий; последовательность и «оставшиеся» карты
 * пересчитываются автоматически.
 */
export function useMapVeto(
  bestOf: MaybeRefOrGetter<number>,
  pool: MaybeRefOrGetter<string[]>,
  firstTeam: MaybeRefOrGetter<VetoTeam>,
) {
  const log = ref<VetoLogEntry[]>([])

  const sequence = computed(() =>
    vetoSequence(toValue(bestOf), toValue(pool).length, toValue(firstTeam)),
  )
  const currentStep = computed<VetoStep | null>(() => sequence.value[log.value.length] ?? null)
  const finished = computed(() => log.value.length >= sequence.value.length)

  const used = computed(() => new Set(log.value.map((l) => l.map)))
  const remaining = computed(() => toValue(pool).filter((m) => !used.value.has(m)))
  // Когда все действия сделаны, ровно одна карта остаётся — она решающая.
  const decider = computed(() => (finished.value ? (remaining.value[0] ?? null) : null))

  /** Запись действия по карте (или null, если карта ещё доступна). */
  function recordOf(map: string): VetoLogEntry | null {
    return log.value.find((l) => l.map === map) ?? null
  }
  const isDecider = (map: string) => decider.value === map

  function act(map: string) {
    const step = currentStep.value
    if (!step || finished.value || used.value.has(map)) return
    log.value.push({ map, step })
  }
  function undo() {
    log.value.pop()
  }
  function reset() {
    log.value = []
  }

  /** Порядок карт для матча: пики в порядке выбора + решающая в конце. */
  const resultMaps = computed(() => {
    const picks = log.value.filter((l) => l.step.action === 'pick').map((l) => l.map)
    return decider.value ? [...picks, decider.value] : picks
  })

  return {
    log,
    sequence,
    currentStep,
    finished,
    remaining,
    decider,
    recordOf,
    isDecider,
    act,
    undo,
    reset,
    resultMaps,
  }
}
