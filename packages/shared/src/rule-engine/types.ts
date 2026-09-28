/** Values for one player in one match, after provider normalization. */
export interface MatchMetricValues {
  win: boolean
  kills: number
  deaths: number
  assists: number
  /** Fraction in [0, 1], supplied by the normalizer; never a percentage. */
  killParticipation: number
  lastHits: number
  heroDamage: number
  towerDamage: number
  /** Total observer + sentry wards placed by this player. */
  wardsPlaced: number
  /** Total match duration in seconds (fractional seconds are allowed). */
  duration: number
  heroId: number
}

export type ChallengeMetric = keyof MatchMetricValues
export type RuleOperator = 'EQ' | 'GTE' | 'LTE'

/** Adding a metric requires updating MatchMetricValues and its runtime validator. */
export type ChallengeRule = {
  [Metric in ChallengeMetric]: Readonly<{
    metric: Metric
    operator: Metric extends 'win' | 'heroId' ? 'EQ' : RuleOperator
    value: MatchMetricValues[Metric]
  }>
}[ChallengeMetric]

/** null, undefined and absent properties all mean unavailable provider data. */
export type NormalizedPlayerMatch = {
  readonly [Metric in ChallengeMetric]?: MatchMetricValues[Metric] | null
}

export type EvaluationStatus = 'PASS' | 'FAIL' | 'PENDING'

export type RuleEvaluation = Readonly<{
  /** Position in the supplied rules; duplicates remain separate evaluations. */
  ruleIndex: number
  /** Snapshot includes metric, operator and expected value. */
  rule: ChallengeRule
}> & (
  | Readonly<{ status: 'PASS'; reason: 'COMPARISON_PASSED'; actual: number | boolean }>
  | Readonly<{ status: 'FAIL'; reason: 'COMPARISON_FAILED'; actual: number | boolean }>
  | Readonly<{ status: 'PENDING'; reason: 'MISSING_METRIC'; actual: null }>
)

export type ChallengeEvaluationResult = Readonly<{
  rules: readonly RuleEvaluation[]
}> & (
  | Readonly<{ status: 'PASS'; reason: 'ALL_RULES_PASSED' }>
  | Readonly<{ status: 'FAIL'; reason: 'RULES_FAILED' }>
  | Readonly<{ status: 'PENDING'; reason: 'MISSING_METRICS' }>
)
