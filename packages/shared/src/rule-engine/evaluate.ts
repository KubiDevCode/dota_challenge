import type {
  ChallengeEvaluationResult,
  ChallengeMetric,
  ChallengeRule,
  NormalizedPlayerMatch,
  RuleEvaluation,
} from './types'

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function isCount(value: unknown): value is number {
  return isNonNegativeNumber(value) && Number.isSafeInteger(value)
}

// An exhaustive registry: new metrics cannot silently bypass validation.
const metricValidators = {
  win: (value: unknown) => typeof value === 'boolean',
  kills: isCount,
  deaths: isCount,
  assists: isCount,
  killParticipation: (value: unknown) => isNonNegativeNumber(value) && value <= 1,
  lastHits: isCount,
  heroDamage: isNonNegativeNumber,
  towerDamage: isNonNegativeNumber,
  wardsPlaced: isCount,
  duration: isNonNegativeNumber,
  heroId: (value: unknown) => isCount(value) && value > 0,
} satisfies Record<ChallengeMetric, (value: unknown) => boolean>

function isMetric(value: unknown): value is ChallengeMetric {
  return typeof value === 'string' && Object.hasOwn(metricValidators, value)
}

/** Throws TypeError for invalid configuration; does not coerce external values. */
export function assertChallengeRule(rule: unknown): asserts rule is ChallengeRule {
  if (typeof rule !== 'object' || rule === null || Array.isArray(rule)
    || !Object.hasOwn(rule, 'metric')
    || !Object.hasOwn(rule, 'operator')
    || !Object.hasOwn(rule, 'value')
    || !('metric' in rule) || !isMetric(rule.metric)
    || !('operator' in rule) || !('value' in rule)) {
    throw new TypeError('Invalid challenge rule: expected metric, operator and value')
  }

  const validOperator = rule.operator === 'EQ'
    || (rule.metric !== 'win' && rule.metric !== 'heroId'
      && (rule.operator === 'GTE' || rule.operator === 'LTE'))
  if (!validOperator || !metricValidators[rule.metric](rule.value)) {
    throw new TypeError(`Invalid challenge rule for ${rule.metric}: incompatible operator or value`)
  }
}

function evaluateRule(
  rule: ChallengeRule,
  match: NormalizedPlayerMatch,
  ruleIndex: number,
): RuleEvaluation {
  const explanation = { ruleIndex, rule: { ...rule } }
  const actual = Object.hasOwn(match, rule.metric) ? match[rule.metric] : undefined
  if (actual === undefined || actual === null) {
    return { ...explanation, actual: null, status: 'PENDING', reason: 'MISSING_METRIC' }
  }
  if (!metricValidators[rule.metric](actual)) {
    throw new TypeError(`Invalid normalized match value for ${rule.metric}`)
  }

  let passed: boolean
  switch (rule.operator) {
    case 'EQ':
      passed = actual === rule.value
      break
    case 'GTE':
      passed = typeof actual === 'number' && actual >= rule.value
      break
    case 'LTE':
      passed = typeof actual === 'number' && actual <= rule.value
      break
  }
  return passed
    ? { ...explanation, actual, status: 'PASS', reason: 'COMPARISON_PASSED' }
    : { ...explanation, actual, status: 'FAIL', reason: 'COMPARISON_FAILED' }
}

/**
 * Pure AND evaluation, with all rules explained in input order.
 * Missing required data takes precedence over a failed comparison.
 * Empty rules pass (the identity of AND). Invalid input throws TypeError.
 */
export function evaluateChallengeRules(
  rules: readonly ChallengeRule[],
  match: NormalizedPlayerMatch,
): ChallengeEvaluationResult {
  if (!Array.isArray(rules)) throw new TypeError('Challenge rules must be an array')
  if (typeof match !== 'object' || match === null || Array.isArray(match)) {
    throw new TypeError('Normalized player match must be an object')
  }
  // Validate every rule before evaluating; a missing metric cannot hide bad config.
  for (const rule of rules) assertChallengeRule(rule)
  const evaluations = rules.map((rule, index) => evaluateRule(rule, match, index))
  if (evaluations.some((rule) => rule.status === 'PENDING')) {
    return { status: 'PENDING', reason: 'MISSING_METRICS', rules: evaluations }
  }
  if (evaluations.some((rule) => rule.status === 'FAIL')) {
    return { status: 'FAIL', reason: 'RULES_FAILED', rules: evaluations }
  }
  return { status: 'PASS', reason: 'ALL_RULES_PASSED', rules: evaluations }
}
