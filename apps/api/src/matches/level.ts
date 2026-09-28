export interface LevelThresholdValue {
  readonly level: number
  readonly requiredTotalXp: number
  readonly rankName: string
}

/** The highest configured threshold reached; null means no level is unlocked. */
export function levelForXp(totalXp: number, thresholds: readonly LevelThresholdValue[]): LevelThresholdValue | null {
  if (!Number.isSafeInteger(totalXp) || totalXp < 0) throw new RangeError('Invalid total XP')
  let current: LevelThresholdValue | null = null
  for (const threshold of thresholds) {
    if (threshold.requiredTotalXp <= totalXp &&
      (current === null || threshold.requiredTotalXp > current.requiredTotalXp)) current = threshold
  }
  return current
}
