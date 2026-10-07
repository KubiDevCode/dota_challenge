// Idempotently publishes the initial daily, weekly, and permanent challenge catalog.
// Requires the production/local DATABASE_URL in the ignored root .env file.
process.loadEnvFile('.env')

const { PrismaClient } = require('../apps/api/dist/database/generated/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { assertChallengeRule } = require('../packages/shared/dist/rule-engine/evaluate.js')

const challenge = (category, title, description, difficulty, mode, xpReward, rules, build = {}) => ({
  category, title, description, difficulty, mode, xpReward,
  period: category === 'Ежедневные' ? 'DAILY' : category === 'Еженедельные' ? 'WEEKLY' : 'PERMANENT',
  requiredHeroId: build.heroId ?? null,
  requiredItemIds: build.itemIds ?? [],
  seasonPointsReward: Math.max(5, Math.round(xpReward / 10)),
  allowedMatchModes: [1, 22],
  publicationStatus: 'PUBLISHED',
  availableFrom: null,
  availableUntil: null,
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
  challenge(daily, 'Трон или смерть', 'Победи, совершив не меньше 8 убийств и умерев не больше 5 раз.', 'HARD', 'SINGLE_MATCH', 150, [['win', 'EQ', true], ['kills', 'GTE', 8], ['deaths', 'LTE', 5]]),
  challenge(daily, 'Владыка линии', 'Добей не меньше 280 крипов и нанеси героям 20 000 урона за матч.', 'MEDIUM', 'SINGLE_MATCH', 120, [['lastHits', 'GTE', 280], ['heroDamage', 'GTE', 20000]]),
  challenge(daily, 'Вижу всё', 'Установи 4 варда и набери не меньше 12 помощей.', 'MEDIUM', 'PERSISTENT', 130, [['wardsPlaced', 'GTE', 4], ['assists', 'GTE', 12]]),
  challenge(daily, 'Без права на фид', 'Победи, умерев не больше 2 раз.', 'HARD', 'PERSISTENT', 160, [['win', 'EQ', true], ['deaths', 'LTE', 2]]),
  challenge(daily, 'Снежный ком', 'Соверши 10 убийств и участвуй минимум в 65% убийств команды.', 'HARD', 'SINGLE_MATCH', 170, [['kills', 'GTE', 10], ['killParticipation', 'GTE', 0.65]]),
  challenge(daily, 'Осадная машина', 'Победи и нанеси строениям не меньше 3 000 урона.', 'MEDIUM', 'SINGLE_MATCH', 130, [['win', 'EQ', true], ['towerDamage', 'GTE', 3000]]),
  challenge(daily, 'Ферма до рассвета', 'Добей не меньше 320 крипов за матч.', 'HARD', 'PERSISTENT', 150, [['lastHits', 'GTE', 320]]),
  challenge(daily, 'Четыре глаза', 'Установи 4 варда и набери 10 помощей за один матч.', 'MEDIUM', 'SINGLE_MATCH', 120, [['wardsPlaced', 'GTE', 4], ['assists', 'GTE', 10]]),
  challenge(daily, 'В центре мясорубки', 'Участвуй минимум в 80% убийств команды и набери 15 помощей.', 'HARD', 'PERSISTENT', 170, [['killParticipation', 'GTE', 0.8], ['assists', 'GTE', 15]]),
  challenge(daily, 'Закрой до лейта', 'Победи в матче короче 35 минут.', 'HARD', 'SINGLE_MATCH', 150, [['win', 'EQ', true], ['duration', 'LTE', 2100]]),

  challenge(weekly, 'Разнос линии', 'Победи с 12 убийствами и не более чем 4 смертями.', 'HARD', 'SINGLE_MATCH', 260, [['win', 'EQ', true], ['kills', 'GTE', 12], ['deaths', 'LTE', 4]]),
  challenge(weekly, 'Крип-магнит', 'Добей 450 крипов и закончи матч победой.', 'HARD', 'PERSISTENT', 280, [['lastHits', 'GTE', 450], ['win', 'EQ', true]]),
  challenge(weekly, 'Плеймейкер недели', 'Набери 25 помощей и участвуй минимум в 75% убийств команды.', 'HARD', 'PERSISTENT', 300, [['assists', 'GTE', 25], ['killParticipation', 'GTE', 0.75]]),
  challenge(weekly, 'Сноси трон', 'Победи, нанеся строениям не меньше 7 000 урона.', 'HARD', 'SINGLE_MATCH', 300, [['win', 'EQ', true], ['towerDamage', 'GTE', 7000]]),
  challenge(weekly, 'Король драки', 'Соверши 10 убийств и участвуй минимум в 90% убийств команды.', 'HARD', 'PERSISTENT', 320, [['kills', 'GTE', 10], ['killParticipation', 'GTE', 0.9]]),
  challenge(weekly, 'Чистая статистика', 'Победи, умерев не больше одного раза.', 'HARD', 'SINGLE_MATCH', 280, [['win', 'EQ', true], ['deaths', 'LTE', 1]]),
  challenge(weekly, 'Урон без пощады', 'Нанеси героям 55 000 урона и набери 12 помощей.', 'HARD', 'PERSISTENT', 320, [['heroDamage', 'GTE', 55000], ['assists', 'GTE', 12]]),
  challenge(weekly, 'Марафон победы', 'Победи в матче продолжительностью не меньше 60 минут.', 'HARD', 'PERSISTENT', 300, [['duration', 'GTE', 3600], ['win', 'EQ', true]]),
  challenge(weekly, 'Вардовая империя', 'Установи 8 вардов и набери 20 помощей за матч.', 'HARD', 'PERSISTENT', 300, [['wardsPlaced', 'GTE', 8], ['assists', 'GTE', 20]]),
  challenge(weekly, 'Крепкий керри', 'Нанеси 40 000 урона героям, совершив 8 убийств и умерев не больше 3 раз.', 'HARD', 'SINGLE_MATCH', 330, [['heroDamage', 'GTE', 40000], ['kills', 'GTE', 8], ['deaths', 'LTE', 3]]),

  challenge(permanent, 'Ни одной ошибки', 'Победи, совершив 10 убийств и умерев не больше одного раза.', 'HARD', 'PERSISTENT', 450, [['win', 'EQ', true], ['kills', 'GTE', 10], ['deaths', 'LTE', 1]]),
  challenge(permanent, 'Доминатор', 'Соверши 15 убийств и участвуй минимум в 80% убийств команды.', 'HARD', 'PERSISTENT', 500, [['kills', 'GTE', 15], ['killParticipation', 'GTE', 0.8]]),
  challenge(permanent, 'Снос базы', 'Победи и нанеси строениям не меньше 10 000 урона.', 'HARD', 'PERSISTENT', 500, [['win', 'EQ', true], ['towerDamage', 'GTE', 10000]]),
  challenge(permanent, 'Бесконечный фарм', 'Добей 600 крипов и закончи матч победой.', 'HARD', 'PERSISTENT', 500, [['lastHits', 'GTE', 600], ['win', 'EQ', true]]),
  challenge(permanent, 'Армагеддон', 'Нанеси героям 70 000 урона и соверши 12 убийств за матч.', 'HARD', 'PERSISTENT', 550, [['heroDamage', 'GTE', 70000], ['kills', 'GTE', 12]]),
  challenge(permanent, 'Неуловимый', 'Победи, не умерев ни разу, и нанеси не меньше 25 000 урона героям.', 'HARD', 'SINGLE_MATCH', 550, [['win', 'EQ', true], ['deaths', 'LTE', 0], ['heroDamage', 'GTE', 25000]]),
  challenge(permanent, 'Связующее звено', 'Набери 30 помощей и участвуй минимум в 85% убийств команды.', 'HARD', 'PERSISTENT', 500, [['assists', 'GTE', 30], ['killParticipation', 'GTE', 0.85]]),
  challenge(permanent, 'Битва до последнего', 'Победи в матче продолжительностью не меньше 75 минут.', 'HARD', 'SINGLE_MATCH', 500, [['duration', 'GTE', 4500], ['win', 'EQ', true]]),
  challenge(permanent, 'Тотальный контроль', 'Участвуй минимум в 95% убийств команды и соверши 12 убийств.', 'HARD', 'PERSISTENT', 600, [['killParticipation', 'GTE', 0.95], ['kills', 'GTE', 12]]),
  challenge(permanent, 'Мастер на все руки', 'Победи, нанеся 40 000 урона героям и 5 000 урона строениям.', 'HARD', 'PERSISTENT', 600, [['win', 'EQ', true], ['heroDamage', 'GTE', 40000], ['towerDamage', 'GTE', 5000]]),

  challenge(weekly, 'Клинок мести', 'Победи на Juggernaut с Battle Fury и Black King Bar.', 'HARD', 'SINGLE_MATCH', 360, [['win', 'EQ', true]], { heroId: 8, itemIds: [145, 116] }),
  challenge(weekly, 'Неудержимый рывок', 'Победи на Axe с Blink Dagger и Blade Mail.', 'HARD', 'SINGLE_MATCH', 360, [['win', 'EQ', true]], { heroId: 2, itemIds: [1, 127] }),
  challenge(weekly, 'Критический удар', 'Победи на Phantom Assassin с Battle Fury и Desolator.', 'HARD', 'SINGLE_MATCH', 360, [['win', 'EQ', true]], { heroId: 44, itemIds: [145, 168] }),
]

const previousTitles = [
  'Ежедневная победа', 'Первый вклад', 'Надёжный союзник', 'Осторожная игра', 'Урон по героям',
  'Под давлением', 'Фермерский темп', 'Обзор на карте', 'Участник каждой драки', 'Быстрое решение',
  'Убедительная победа', 'Осада', 'Глубокий обзор', 'Большой урожай', 'Голос команды',
  'Без права на ошибку', 'Мастер урона', 'В центре событий', 'Долгая осада', 'Опора команды',
  'Серия победителя', 'Несокрушимый', 'Легенда фарма', 'Разрушитель крепостей', 'Главный дамагер',
  'Командный двигатель', 'Идеальный вклад', 'Длинная дистанция', 'Убийца строений', 'Гроза поля боя',
]
const previousTitleByTitle = new Map(challenges.map(({ title }, index) => [title, previousTitles[index]]))

if (challenges.length !== 33) throw new Error(`Expected 33 challenges, got ${challenges.length}`)
if (new Set(challenges.map(({ title }) => title)).size !== challenges.length) throw new Error('Challenge titles must be unique')

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 8000 }),
})

async function main() {
  const titles = challenges.map(({ title }) => title)
  const lookupTitles = [...titles, ...previousTitles]
  const existing = await db.challenge.findMany({ where: { title: { in: lookupTitles } }, select: { id: true, title: true } })
  const existingByTitle = new Map(existing.map((row) => [row.title, row]))
  let created = 0
  let updated = 0
  const operations = challenges.map(({ rules, ...data }) => {
    const previousTitle = previousTitleByTitle.get(data.title)
    const existingRow = existingByTitle.get(data.title) || existingByTitle.get(previousTitle)
    const ruleData = rules.map(({ metric, operator, value }) => ({
      metric,
      operator,
      numberValue: metric === 'win' ? null : value,
      booleanValue: metric === 'win' ? value : null,
    }))
    if (!existingRow) {
      created += 1
      return db.challenge.create({ data: { ...data, rules: { create: ruleData } } })
    }
    updated += 1
    return db.challenge.update({ where: { id: existingRow.id }, data: {
      ...data,
      rules: { deleteMany: {}, create: ruleData },
    } })
  })
  await db.$transaction(operations, { maxWait: 15000, timeout: 60000 })

  const summary = await db.challenge.groupBy({
    by: ['category', 'mode', 'publicationStatus'],
    where: { title: { in: titles } },
    _count: { _all: true },
  })
  console.log(JSON.stringify({ created, updated, total: challenges.length, catalog: summary }, null, 2))
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
}).finally(() => db.$disconnect())
