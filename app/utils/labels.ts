export const FORMAT_LABELS: Record<string, string> = {
  single_elimination: 'Single Elimination',
  double_elimination: 'Double Elimination',
  groups_playoff: 'Группы → Плей-офф',
}

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  ongoing: 'Идёт',
  finished: 'Завершён',
}

export const MATCH_STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидается',
  live: 'В игре',
  finished: 'Завершён',
}

export function formatLabel(v?: string) {
  return (v && FORMAT_LABELS[v]) || v || '—'
}
export function statusLabel(v?: string) {
  return (v && STATUS_LABELS[v]) || v || '—'
}
