import { Link } from 'react-router-dom'
import { UserRound } from 'lucide-react'
import type { LeaderboardEntry } from '../../entities/season'

export function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  return <div className="leaderboard mt-6" aria-label="Рейтинг игроков">
    <div className="leaderboard-row leaderboard-data-row leaderboard-head"><span>МЕСТО</span><span>ИГРОК</span><span className="text-right">ОЧКИ СЕЗОНА</span></div>
    {entries.map((entry) => <div className="leaderboard-row leaderboard-data-row" key={entry.userId}>
      <div className={entry.position <= 3 ? 'font-display text-xl text-[#d7a75d]' : 'text-sm text-[#aaa69f]'}>{entry.position}</div>
      <Link to={`/profile/${entry.userId}`} className="flex min-w-0 items-center gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#e16a55]" aria-label={`Открыть профиль ${entry.displayName}`}>
        {entry.avatarUrl
          ? <img className="h-10 w-10 rounded-lg object-cover" src={entry.avatarUrl} alt="" />
          : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white/5 text-[#aaa69f]"><UserRound size={18} /></span>}
        <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#eeeae3]">{entry.displayName}</span><span className="mt-0.5 block truncate text-[11px] text-[#aaa69f]">{entry.level ? `${entry.level.rankName} · уровень ${entry.level.level}` : 'Без ранга'}</span></span>
      </Link>
      <div className="text-right"><div className="font-display text-lg font-semibold">{entry.seasonalScore.toLocaleString('ru-RU')}</div><div className="text-[9px] text-[#78756f]">SP</div></div>
    </div>)}
  </div>
}
