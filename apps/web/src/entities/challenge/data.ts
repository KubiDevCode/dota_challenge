import { Shield, Swords, Target, Zap, type LucideIcon } from 'lucide-react'

export type Difficulty = 'ЛЕГКО' | 'СРЕДНЕ' | 'СЛОЖНО'

export type Challenge = {
  id: number
  icon: LucideIcon
  eyebrow: string
  title: string
  description: string
  difficulty: Difficulty
  xp: number
  seasonPoints: number
  time: string
  featured?: boolean
}

export const challenges: Challenge[] = [
  { id: 1, icon: Swords, eyebrow: 'БОЕВОЕ', title: 'Без права на ошибку', description: 'Победи в матче, сделав 10+ убийств и погибнув не более 3 раз.', difficulty: 'СЛОЖНО', xp: 500, seasonPoints: 50, time: '3 дня', featured: true },
  { id: 2, icon: Shield, eyebrow: 'ПОДДЕРЖКА', title: 'Незримый защитник', description: 'Поставь 12 вардов и сделай не менее 18 ассистов за один матч.', difficulty: 'СРЕДНЕ', xp: 250, seasonPoints: 25, time: '1 день' },
  { id: 3, icon: Zap, eyebrow: 'КОМАНДНОЕ', title: 'В самом центре', description: 'Прими участие как минимум в 70% убийств своей команды.', difficulty: 'СРЕДНЕ', xp: 250, seasonPoints: 25, time: '2 дня' },
  { id: 4, icon: Target, eyebrow: 'МАСТЕРСТВО', title: 'Идеальный фарм', description: 'Сделай 250 добиваний за 30 минут игрового времени.', difficulty: 'СЛОЖНО', xp: 450, seasonPoints: 45, time: '3 дня' },
  { id: 5, icon: Shield, eyebrow: 'ВЫЖИВАНИЕ', title: 'Неприкасаемый', description: 'Заверши победный матч без единой смерти.', difficulty: 'СЛОЖНО', xp: 600, seasonPoints: 60, time: '5 дней' },
  { id: 6, icon: Zap, eyebrow: 'РАЗМИНКА', title: 'Верный союзник', description: 'Сделай 10 ассистов в одном публичном матче.', difficulty: 'ЛЕГКО', xp: 100, seasonPoints: 10, time: '1 день' },
]
