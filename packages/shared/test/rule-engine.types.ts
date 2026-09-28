import {
  assertChallengeRule,
  evaluateChallengeRules,
  type ChallengeRule,
  type NormalizedPlayerMatch,
} from '../src'

const rules: readonly ChallengeRule[] = [
  { metric: 'win', operator: 'EQ', value: false },
  { metric: 'kills', operator: 'GTE', value: 10 },
  { metric: 'duration', operator: 'LTE', value: 1800 },
  { metric: 'heroId', operator: 'EQ', value: 1 },
]
const match: NormalizedPlayerMatch = { win: false, kills: 0, duration: undefined, heroId: null }
evaluateChallengeRules(rules, match)

// @ts-expect-error Boolean ordering is forbidden.
const booleanOrdering: ChallengeRule = { metric: 'win', operator: 'GTE', value: true }
// @ts-expect-error Numeric values cannot be used with a boolean metric.
const numericWin: ChallengeRule = { metric: 'win', operator: 'EQ', value: 1 }
// @ts-expect-error Numeric metrics cannot compare booleans.
const booleanKills: ChallengeRule = { metric: 'kills', operator: 'EQ', value: false }
// @ts-expect-error Hero ids identify a hero and only support equality.
const orderedHeroId: ChallengeRule = { metric: 'heroId', operator: 'GTE', value: 1 }
// @ts-expect-error New metrics require an explicit contract change.
const unknownMetric: ChallengeRule = { metric: 'gold', operator: 'EQ', value: 0 }
// @ts-expect-error Operators are closed.
const unknownOperator: ChallengeRule = { metric: 'kills', operator: 'GT', value: 0 }
// @ts-expect-error Normalized values preserve the metric's type.
const invalidMatch: NormalizedPlayerMatch = { win: 1 }
void [booleanOrdering, numericWin, booleanKills, orderedHeroId, unknownMetric, unknownOperator, invalidMatch]

const externalRule: unknown = { metric: 'win', operator: 'EQ', value: true }
assertChallengeRule(externalRule)
evaluateChallengeRules([externalRule], {})
