import { CalendarDays, TrendingUp, Trophy } from 'lucide-react'
import { LeaderboardTable } from '../../widgets/leaderboard-table'

export function LeaderboardPage() {
  return <>
      <section className="page-hero"><div className="hero-grid" /><div className="relative z-10 mx-auto max-w-[1440px] px-5 py-14 lg:px-10"><div className="section-label"><Trophy size={14} /> СЕЗОННЫЙ РЕЙТИНГ</div><div className="mt-3 flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><h1 className="font-display text-4xl font-semibold sm:text-6xl">Лучшие из лучших</h1><p className="mt-4 max-w-xl text-[#98958e]">Рейтинг формируется по очкам за выполненные испытания текущего сезона.</p></div><div className="flex gap-3"><div className="info-chip"><CalendarDays size={16} /> До конца: <strong>32 дня</strong></div><div className="info-chip"><TrendingUp size={16} /> Твоё место: <strong>#1 284</strong></div></div></div></div></section>
    <LeaderboardTable />
  </>
}
