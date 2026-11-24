// Приоритет — 5 уровней (D-008, D-056)
export const PRIORITY_LABELS = ['Можно и без', 'Было бы неплохо', 'Хочу', 'Очень хочу', 'Мечта']

export function priorityLabel(level: number): string {
  return PRIORITY_LABELS[Math.min(5, Math.max(1, level)) - 1]!
}
