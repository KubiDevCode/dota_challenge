// Idempotently publishes the initial daily, weekly, and permanent challenge catalog.
// Requires the production/local DATABASE_URL in the ignored root .env file.
process.loadEnvFile('.env')

const { PrismaClient } = require('../apps/api/dist/database/generated/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { assertChallengeRule } = require('../packages/shared/dist/rule-engine/evaluate.js')

const challenge = (category, title, description, difficulty, mode, xpReward, rules) => ({
  category, title, description, difficulty, mode, xpReward,
  seasonPointsReward: Math.max(5, Math.round(xpReward / 10)),
  allowedMatchModes: [1, 22],
  publicationStatus: 'PUBLISHED',
  availableFrom: null,
  rules: rules.map(([metric, operator, value]) => {
    const rule = { metric, operator, value }
    assertChallengeRule(rule)
    return rule
  }),
})

const daily = 'Ежедневные'
const weekly = 'Еженедельные'
const permanent = 'Постоянные'

const challenges = [
  challenge(daily, 'Ежедневная победа', 'Заверши матч победой.', 'EASY', 'SINGLE_MATCH', 60, [['win', 'EQ', true]]),
  challenge(daily, 'Первый вклад', 'Соверши не меньше 3 убийств за матч.', 'EASY', 'SINGLE_MATCH', 50, [['kills', 'GTE', 3]]),
  challenge(daily, 'Надёжный союзник', 'Набери не меньше 8 помощей за матч.', 'EASY', 'PERSISTENT', 70, [['assists', 'GTE', 8]]),
  challenge(daily, 'Осторожная игра', 'Заверши матч, умерев не больше 4 раз.', 'EASY', 'PERSISTENT', 60, [['deaths', 'LTE', 4]]),
  challenge(daily, 'Урон по героям', 'Нанеси героям не меньше 18 000 урона за матч.', 'MEDIUM', 'PERSISTENT', 90, [['heroDamage', 'GTE', 18000]]),
  challenge(daily, 'Под давлением', 'Нанеси строениям не меньше 1 200 урона за матч.', 'EASY', 'SINGLE_MATCH', 60, [['towerDamage', 'GTE', 1200]]),
  challenge(daily, 'Фермерский темп', 'Соверши не меньше 180 добиваний за матч.', 'MEDIUM', 'PERSISTENT', 90, [['lastHits', 'GTE', 180]]),
  challenge(daily, 'Обзор на карте', 'Установи не меньше 2 вардов за матч.', 'EASY', 'SINGLE_MATCH', 50, [['wardsPlaced', 'GTE', 2]]),
  challenge(daily, 'Участник каждой драки', 'Добейся участия минимум в 55% убийств своей команды.', 'MEDIUM', 'PERSISTENT', 100, [['killParticipation', 'GTE', 0.55]]),
  challenge(daily, 'Быстрое решение', 'Заверши матч продолжительностью не больше 35 минут.', 'MEDIUM', 'SINGLE_MATCH', 80, [['duration', 'LTE', 2100]]),

  challenge(weekly, 'Убедительная победа', 'Победи и соверши не меньше 5 убийств в одном матче.', 'MEDIUM', 'SINGLE_MATCH', 130, [['win', 'EQ', true], ['kills', 'GTE', 5]]),
  challenge(weekly, 'Осада', 'Нанеси строениям не меньше 3 500 урона за матч.', 'MEDIUM', 'PERSISTENT', 140, [['towerDamage', 'GTE', 3500]]),
  challenge(weekly, 'Глубокий обзор', 'Установи не меньше 5 вардов за матч.', 'MEDIUM', 'PERSISTENT', 120, [['wardsPlaced', 'GTE', 5]]),
  challenge(weekly, 'Большой урожай', 'Соверши не меньше 300 добиваний за матч.', 'HARD', 'PERSISTENT', 180, [['lastHits', 'GTE', 300]]),
  challenge(weekly, 'Голос команды', 'Набери не меньше 18 помощей за матч.', 'HARD', 'PERSISTENT', 170, [['assists', 'GTE', 18]]),
  challenge(weekly, 'Без права на ошибку', 'Победи, умерев не больше 3 раз.', 'HARD', 'SINGLE_MATCH', 180, [['win', 'EQ', true], ['deaths', 'LTE', 3]]),
  challenge(weekly, 'Мастер урона', 'Нанеси героям не меньше 35 000 урона за матч.', 'HARD', 'PERSISTENT', 180, [['heroDamage', 'GTE', 35000]]),
  challenge(weekly, 'В центре событий', 'Добейся участия минимум в 75% убийств своей команды.', 'HARD', 'PERSISTENT', 200, [['killParticipation', 'GTE', 0.75]]),
  challenge(weekly, 'Долгая осада', 'Сыграй матч продолжительностью не меньше 50 минут.', 'MEDIUM', 'SINGLE_MATCH', 140, [['duration', 'GTE', 3000]]),
  challenge(weekly, 'Опора команды', 'Победи и набери не меньше 12 помощей за матч.', 'MEDIUM', 'PERSISTENT', 160, [['win', 'EQ', true], ['assists', 'GTE', 12]]),

  challenge(permanent, 'Серия победителя', 'Победи, совершив не меньше 8 убийств за матч.', 'HARD', 'PERSISTENT', 220, [['win', 'EQ', true], ['kills', 'GTE', 8]]),
  challenge(permanent, 'Несокрушимый', 'Заверши победный матч, умерев не больше 2 раз.', 'HARD', 'PERSISTENT', 220, [['win', 'EQ', true], ['deaths', 'LTE', 2]]),
  challenge(permanent, 'Легенда фарма', 'Соверши не меньше 400 добиваний за матч.', 'HARD', 'PERSISTENT', 220, [['lastHits', 'GTE', 400]]),
  challenge(permanent, 'Разрушитель крепостей', 'Нанеси строениям не меньше 6 000 урона за матч.', 'HARD', 'PERSISTENT', 230, [['towerDamage', 'GTE', 6000]]),
  challenge(permanent, 'Главный дамагер', 'Нанеси героям не меньше 50 000 урона за матч.', 'HARD', 'PERSISTENT', 240, [['heroDamage', 'GTE', 50000]]),
  challenge(permanent, 'Командный двигатель', 'Набери не меньше 25 помощей в одном матче.', 'HARD', 'PERSISTENT', 220, [['assists', 'GTE', 25]]),
  challenge(permanent, 'Идеальный вклад', 'Добейся участия минимум в 90% убийств своей команды.', 'HARD', 'PERSISTENT', 250, [['killParticipation', 'GTE', 0.9]]),
  challenge(permanent, 'Длинная дистанция', 'Сыграй матч продолжительностью не меньше 60 минут.', 'HARD', 'PERSISTENT', 200, [['duration', 'GTE', 3600]]),
  challenge(permanent, 'Убийца строений', 'Победи и нанеси строениям не меньше 3 000 урона.', 'HARD', 'PERSISTENT', 240, [['win', 'EQ', true], ['towerDamage', 'GTE', 3000]]),
  challenge(permanent, 'Гроза поля боя', 'Соверши не меньше 12 убийств и набери 10 помощей за матч.', 'HARD', 'SINGLE_MATCH', 250, [['kills', 'GTE', 12], ['assists', 'GTE', 10]]),
]

if (challenges.length !== 30) throw new Error(`Expected 30 challenges, got ${challenges.length}`)
if (new Set(challenges.map(({ title }) => title)).size !== challenges.length) throw new Error('Challenge titles must be unique')

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000 }),
})

async function main() {
  const titles = challenges.map(({ title }) => title)
  const existing = await db.challenge.findMany({ where: { title: { in: titles } }, select: { title: true } })
  const existingTitles = new Set(existing.map(({ title }) => title))
  const missing = challenges.filter(({ title }) => !existingTitles.has(title))

  await db.$transaction(missing.map(({ rules, ...data }) => db.challenge.create({
    data: { ...data, rules: { create: rules.map(({ metric, operator, value }) => ({
      metric,
      operator,
      numberValue: metric === 'win' ? null : value,
      booleanValue: metric === 'win' ? value : null,
    })) } },
  })), { maxWait: 15000, timeout: 60000 })

  const summary = await db.challenge.groupBy({
    by: ['category', 'mode', 'publicationStatus'],
    where: { title: { in: titles } },
    _count: { _all: true },
  })
  console.log(JSON.stringify({ created: missing.length, alreadyPresent: existing.length, catalog: summary }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
}).finally(() => db.$disconnect())
