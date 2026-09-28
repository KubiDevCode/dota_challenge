import { CheckCircle2, Clock3 } from 'lucide-react'
import { demoHistory } from '../../entities/match'

export function MatchHistory() { return <>
            <div className="profile-panel"><div className="flex items-center justify-between"><div><div className="section-label"><Clock3 size={14} /> ИСТОРИЯ</div><h2 className="mt-2 font-display text-2xl">Недавние испытания</h2></div><button className="text-xs text-[#85827c] hover:text-white">Смотреть все</button></div><div className="mt-5 divide-y divide-white/7">{demoHistory.map((item) => <div className="history-row" key={item.match}><div className="challenge-icon"><item.icon size={18} /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{item.title}</div><div className="mt-1 text-[10px] text-[#6f6c66]">{item.match} · {item.date}</div></div><div className="text-right"><div className="text-xs font-semibold text-[#d8a761]">+{item.xp} XP</div><div className="mt-1 flex items-center justify-end gap-1 text-[9px] text-[#66bd92]"><CheckCircle2 size={10} /> {item.status}</div></div></div>)}</div></div>
</> }
