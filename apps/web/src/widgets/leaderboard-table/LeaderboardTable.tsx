import { Crown, Medal, Search, UserRound } from 'lucide-react'
import { leaders } from '../../entities/user'

export function LeaderboardTable() {
  return <>
      <section className="mx-auto max-w-[1180px] px-5 py-12 lg:px-10 lg:py-16">
        <div className="podium-grid">
          <Podium player={leaders[1]} rank="II" className="order-2 md:order-1 md:mt-10" />
          <Podium player={leaders[0]} rank="I" winner className="order-1 md:order-2" />
          <Podium player={leaders[2]} rank="III" className="order-3 md:mt-16" />
        </div>

        <div className="mt-12 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h2 className="font-display text-2xl font-semibold">Общий рейтинг</h2><p className="mt-1 text-xs text-[#77746e]">Обновлено 3 минуты назад</p></div><div className="flex gap-2"><div className="search-box"><Search size={15} /><span>Найти игрока</span></div><button className="filter-active border border-white/8">Мир</button><button className="filter-button border border-white/8">Друзья</button></div></div>

        <div className="leaderboard mt-6">
          <div className="leaderboard-row leaderboard-head"><span>#</span><span>ИГРОК</span><span className="hidden sm:block">ВЫПОЛНЕНО</span><span className="hidden sm:block">ВИНРЕЙТ</span><span>ОЧКИ</span></div>
          {leaders.map((leader) => <div key={leader.place} className="leaderboard-row"><div className={leader.place <= 3 ? 'font-display text-xl text-[#d7a75d]' : 'text-sm text-[#76736d]'}>{leader.place}</div><div className="flex items-center gap-3"><div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${leader.color} p-[1px]`}><div className="grid h-full w-full place-items-center rounded-[7px] bg-[#17191d]"><UserRound size={18} /></div></div><div><div className="text-sm font-semibold">{leader.name}</div><div className="mt-0.5 text-[11px] text-[#77746e]">Уровень {leader.level}</div></div></div><div className="hidden text-sm text-[#aaa69f] sm:block">{leader.completed}</div><div className="hidden text-sm text-[#aaa69f] sm:block">{leader.winrate}%</div><div className="text-right"><div className="font-display text-lg font-semibold">{leader.points.toLocaleString('ru-RU')}</div><div className="text-[9px] text-[#78756f]">SP</div></div></div>)}
          <div className="my-rank-separator"><span>···</span></div>
          <div className="leaderboard-row my-rank"><div className="text-xs text-[#e16a55]">1 284</div><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-lg border border-[#bd4937]/30 bg-[#bd4937]/10"><UserRound size={18} /></div><div><div className="text-sm font-semibold">InvokerEnjoyer <span className="you-badge">ВЫ</span></div><div className="mt-0.5 text-[11px] text-[#77746e]">Уровень 7</div></div></div><div className="hidden text-sm text-[#aaa69f] sm:block">14</div><div className="hidden text-sm text-[#aaa69f] sm:block">53%</div><div className="text-right"><div className="font-display text-lg font-semibold">680</div><div className="text-[9px] text-[#78756f]">SP</div></div></div>
        </div>
      </section>
  </>
}

function Podium({ player, rank, winner, className = '' }: { player: typeof leaders[number]; rank: string; winner?: boolean; className?: string }) {
  return <div className={`podium-card ${winner ? 'winner' : ''} ${className}`}><div className="podium-rank">{winner ? <Crown size={24} /> : <Medal size={21} />}<span>{rank}</span></div><div className={`mx-auto mt-5 h-16 w-16 rounded-xl bg-gradient-to-br ${player.color} p-[1px]`}><div className="grid h-full w-full place-items-center rounded-[11px] bg-[#17191d]"><UserRound size={25} /></div></div><h3 className="mt-4 font-display text-xl">{player.name}</h3><p className="mt-1 text-[10px] uppercase tracking-[.12em] text-[#77746e]">Уровень {player.level}</p><div className="mt-5 font-display text-2xl text-[#e7b76f]">{player.points.toLocaleString('ru-RU')} <span className="text-xs">SP</span></div></div>
}
