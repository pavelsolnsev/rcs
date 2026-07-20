/** Логика пик/бана карт (как в профессиональных лигах CS2). */

export type VetoAction = 'ban' | 'pick'
export type VetoTeam = 'a' | 'b'
export interface VetoStep {
  team: VetoTeam
  action: VetoAction
}

/**
 * Последовательность действий пикбана для формата матча.
 *
 * Схема (пул из 7 карт — как в про-лигах):
 *  - BO1: 6 банов по очереди → остаётся 1 карта.
 *  - BO3: бан, бан, пик, пик, бан, бан → 3 карты (2 пика + решающая).
 *  - BO5: бан, бан, пик, пик, пик, пик → 5 карт (4 пика + решающая).
 *
 * Для пула другого размера действует та же схема: 2 стартовых бана,
 * затем нужные пики, затем оставшиеся баны, последняя карта — решающая.
 */
export function vetoSequence(bestOf: number, poolSize: number, firstTeam: VetoTeam = 'a'): VetoStep[] {
  const bo = [1, 3, 5].includes(bestOf) ? bestOf : 1
  const bans = Math.max(0, poolSize - bo)
  const picks = bo - 1

  let actions: VetoAction[]
  if (bo === 1) {
    actions = Array<VetoAction>(bans).fill('ban')
  } else {
    const openBans = Math.min(2, bans)
    actions = [
      ...Array<VetoAction>(openBans).fill('ban'),
      ...Array<VetoAction>(picks).fill('pick'),
      ...Array<VetoAction>(bans - openBans).fill('ban'),
    ]
  }

  const other: VetoTeam = firstTeam === 'a' ? 'b' : 'a'
  return actions.map((action, i) => ({ team: i % 2 === 0 ? firstTeam : other, action }))
}
