const assert = require('node:assert/strict')
const { test } = require('node:test')
const { assertChallengeRule, evaluateChallengeRules } = require('@aegis-trials/shared')

const numericMetrics = {
  kills: 10,
  deaths: 2,
  assists: 18,
  killParticipation: 0.7,
  lastHits: 250,
  heroDamage: 20000,
  towerDamage: 3000,
  wardsPlaced: 12,
  duration: 1800,
  heroId: 2,
}

for (const [metric, value] of Object.entries(numericMetrics)) {
  const step = metric === 'killParticipation' ? 0.1 : 1
  for (const operator of metric === 'heroId' ? ['EQ'] : ['EQ', 'GTE', 'LTE']) {
    test(`${metric} ${operator}: exact boundary and both sides`, () => {
      const rule = { metric, operator, value }
      for (const [actual, expected] of [
        [value, 'PASS'],
        [value - step, operator === 'LTE' ? 'PASS' : 'FAIL'],
        [value + step, operator === 'GTE' ? 'PASS' : 'FAIL'],
      ]) {
        const result = evaluateChallengeRules([rule], { [metric]: actual })
        assert.equal(result.status, expected)
        assert.equal(result.rules[0].status, expected)
        assert.equal(result.rules[0].actual, actual)
      }
    })
  }
}

for (const [metric, value] of Object.entries({ win: true, ...numericMetrics })) {
  test(`${metric}: absent, undefined and null are pending`, () => {
    const rule = { metric, operator: 'EQ', value }
    for (const match of [{}, { [metric]: undefined }, { [metric]: null }]) {
      assert.deepEqual(evaluateChallengeRules([rule], match), {
        status: 'PENDING',
        reason: 'MISSING_METRICS',
        rules: [{ ruleIndex: 0, rule, actual: null, status: 'PENDING', reason: 'MISSING_METRIC' }],
      })
    }
  })
}

for (const metric of Object.keys(numericMetrics).filter((metric) => metric !== 'heroId')) {
  test(`${metric}: zero is a present value`, () => {
    for (const operator of ['EQ', 'GTE', 'LTE']) {
      const result = evaluateChallengeRules([{ metric, operator, value: 0 }], { [metric]: 0 })
      assert.equal(result.status, 'PASS')
      assert.equal(result.rules[0].actual, 0)
    }
    assert.equal(evaluateChallengeRules(
      [{ metric, operator: 'GTE', value: numericMetrics[metric] }], { [metric]: 0 },
    ).status, 'FAIL')
  })
}

test('win EQ compares booleans strictly, including false', () => {
  for (const value of [true, false]) {
    for (const actual of [true, false]) {
      const result = evaluateChallengeRules([{ metric: 'win', operator: 'EQ', value }], { win: actual })
      assert.equal(result.status, actual === value ? 'PASS' : 'FAIL')
      assert.equal(result.rules[0].actual, actual)
    }
  }
})

test('AND explains every rule, in order, with expected and actual values', () => {
  const rules = [
    { metric: 'win', operator: 'EQ', value: true },
    { metric: 'kills', operator: 'GTE', value: 10 },
    { metric: 'deaths', operator: 'LTE', value: 2 },
  ]
  const match = { win: true, kills: 10, deaths: 2 }
  const pass = evaluateChallengeRules(rules, match)
  assert.equal(pass.status, 'PASS')
  assert.equal(pass.reason, 'ALL_RULES_PASSED')
  assert.deepEqual(pass.rules, rules.map((rule, ruleIndex) => ({
    ruleIndex, rule, actual: match[rule.metric], status: 'PASS', reason: 'COMPARISON_PASSED',
  })))
  const fail = evaluateChallengeRules(rules, { ...match, kills: 9 })
  assert.equal(fail.status, 'FAIL')
  assert.equal(fail.reason, 'RULES_FAILED')
  assert.deepEqual(fail.rules.map((rule) => rule.status), ['PASS', 'FAIL', 'PASS'])
  assert.equal(fail.rules[1].reason, 'COMPARISON_FAILED')
})

test('PENDING takes precedence over FAIL, regardless of rule order', () => {
  const rules = [
    { metric: 'kills', operator: 'GTE', value: 10 },
    { metric: 'towerDamage', operator: 'GTE', value: 100 },
  ]
  for (const ordered of [rules, [...rules].reverse()]) {
    const result = evaluateChallengeRules(ordered, { kills: 0 })
    assert.equal(result.status, 'PENDING')
    assert.equal(result.reason, 'MISSING_METRICS')
    assert.equal(result.rules.find((item) => item.rule.metric === 'kills').status, 'FAIL')
    assert.equal(result.rules.find((item) => item.rule.metric === 'towerDamage').status, 'PENDING')
    assert.equal(evaluateChallengeRules(ordered, { kills: 0, towerDamage: 100 }).status, 'FAIL')
    assert.equal(evaluateChallengeRules(ordered, { kills: 10, towerDamage: 100 }).status, 'PASS')
  }
})

test('only referenced metrics are required; empty AND passes', () => {
  assert.equal(evaluateChallengeRules([{ metric: 'heroId', operator: 'EQ', value: 1 }], { heroId: 1 }).status, 'PASS')
  assert.deepEqual(evaluateChallengeRules([], {}), { status: 'PASS', reason: 'ALL_RULES_PASSED', rules: [] })
  assert.equal(evaluateChallengeRules(
    [{ metric: 'kills', operator: 'EQ', value: 0 }], Object.create({ kills: 0 }),
  ).status, 'PENDING')
})

test('kill participation uses the supplied fraction, including 0 and 1', () => {
  for (const value of [0, 0.7, 1]) {
    assert.equal(evaluateChallengeRules(
      [{ metric: 'killParticipation', operator: 'EQ', value }],
      { kills: 0, assists: 0, killParticipation: value },
    ).status, 'PASS')
  }
  assert.equal(evaluateChallengeRules(
    [{ metric: 'killParticipation', operator: 'GTE', value: 0.7 }], { kills: 10, assists: 20 },
  ).status, 'PENDING')
})

test('duration is total seconds; no minute conversion or rounding', () => {
  const rules = [{ metric: 'duration', operator: 'LTE', value: 1800 }]
  for (const [duration, expected] of [[1799.9, 'PASS'], [1800, 'PASS'], [1800.1, 'FAIL']]) {
    assert.equal(evaluateChallengeRules(rules, { duration }).status, expected)
  }
  assert.equal(evaluateChallengeRules(
    [{ metric: 'duration', operator: 'EQ', value: 30 }], { duration: 1800 },
  ).status, 'FAIL')
})

test('numeric EQ is exact and does not round fractions', () => {
  assert.equal(evaluateChallengeRules(
    [{ metric: 'killParticipation', operator: 'EQ', value: 0.7 }], { killParticipation: 0.7000000001 },
  ).status, 'FAIL')
})

const invalidRules = [
  null, undefined, [], {},
  Object.create({ metric: 'kills', operator: 'EQ', value: 0 }),
  { metric: 'unknown', operator: 'EQ', value: 1 },
  { metric: 'toString', operator: 'EQ', value: 1 },
  { metric: '__proto__', operator: 'EQ', value: 1 },
  { metric: 'win', operator: 'GTE', value: true },
  { metric: 'win', operator: 'LTE', value: false },
  { metric: 'win', operator: 'EQ', value: 1 },
  { metric: 'win', operator: 'EQ', value: 'true' },
  { metric: 'heroId', operator: 'GTE', value: 1 },
  { metric: 'heroId', operator: 'LTE', value: 1 },
  { metric: 'kills', operator: 'GT', value: 10 },
  { metric: 'kills', value: 10 },
  { metric: 'kills', operator: 'EQ' },
]

for (const [index, rule] of invalidRules.entries()) {
  test(`invalid rule shape or combination #${index} throws`, () => {
    assert.throws(() => assertChallengeRule(rule), TypeError)
    assert.throws(() => evaluateChallengeRules([rule], {}), TypeError)
  })
}

for (const metric of Object.keys(numericMetrics)) {
  test(`${metric}: rejects invalid expected and actual numeric values`, () => {
    const invalid = [true, false, '0', NaN, Infinity, -Infinity, -1]
    if (['kills', 'deaths', 'assists', 'lastHits', 'wardsPlaced', 'heroId'].includes(metric)) {
      invalid.push(1.5, Number.MAX_SAFE_INTEGER + 1)
    }
    if (metric === 'killParticipation') invalid.push(1.01, 70)
    if (metric === 'heroId') invalid.push(0)
    for (const value of invalid) {
      assert.throws(() => evaluateChallengeRules([{ metric, operator: 'EQ', value }], {}), TypeError)
      assert.throws(() => evaluateChallengeRules(
        [{ metric, operator: 'EQ', value: numericMetrics[metric] }], { [metric]: value },
      ), TypeError)
    }
    for (const value of [null, undefined]) {
      assert.throws(() => assertChallengeRule({ metric, operator: 'EQ', value }), TypeError)
    }
  })
}

test('invalid win data is rejected, never coerced or treated as pending', () => {
  for (const win of [0, 1, 'false', {}, []]) {
    assert.throws(() => evaluateChallengeRules([{ metric: 'win', operator: 'EQ', value: false }], { win }), TypeError)
  }
})

test('invalid containers and sparse rules arrays are rejected', () => {
  for (const rules of [undefined, null, {}, 'rules', Array(1)]) {
    assert.throws(() => evaluateChallengeRules(rules, {}), TypeError)
  }
  for (const match of [undefined, null, [], false, 0, 'match']) {
    assert.throws(() => evaluateChallengeRules([], match), TypeError)
  }
})

test('invalid input cannot be hidden by a pending or failed rule', () => {
  const missing = { metric: 'towerDamage', operator: 'EQ', value: 0 }
  const invalid = { metric: 'win', operator: 'GTE', value: true }
  assert.throws(() => evaluateChallengeRules([missing, invalid], {}), TypeError)
  assert.throws(() => evaluateChallengeRules([
    missing, { metric: 'kills', operator: 'EQ', value: 10 },
  ], { kills: '10' }), TypeError)
})

test('evaluation is deterministic, accepts frozen input and snapshots rules', () => {
  const rule = { metric: 'kills', operator: 'GTE', value: 10 }
  const rules = Object.freeze([Object.freeze(rule), rule])
  const match = Object.freeze({ kills: 12 })
  const result = evaluateChallengeRules(rules, match)
  assert.deepEqual(result, evaluateChallengeRules(rules, match))
  assert.notEqual(result.rules[0].rule, rule)
  assert.deepEqual(result.rules.map((item) => item.ruleIndex), [0, 1])
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
  const pending = evaluateChallengeRules(rules, {})
  assert.deepEqual(JSON.parse(JSON.stringify(pending)), pending)
})

test('assertChallengeRule accepts valid external rules', () => {
  assert.doesNotThrow(() => assertChallengeRule({ metric: 'win', operator: 'EQ', value: false }))
  assert.doesNotThrow(() => assertChallengeRule({ metric: 'kills', operator: 'GTE', value: 10 }))
})
