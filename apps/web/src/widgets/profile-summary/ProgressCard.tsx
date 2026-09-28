import { Crown } from 'lucide-react'

export function ProfileProgressCard() {
  return <div className="rank-card"><div className="rank-card-shine" /><div className="relative z-10 flex items-start justify-between"><div><p className="text-[10px] font-bold tracking-[0.22em] text-[#8f8b83]">ТВОЙ ПРОГРЕСС</p><h2 className="mt-2 font-display text-2xl font-semibold">Искатель испытаний</h2></div><div className="level-badge">7</div></div><div className="relative z-10 my-8 flex justify-center"><div className="rank-emblem"><Crown size={48} strokeWidth={1.3} /></div></div><div className="relative z-10"><div className="mb-2 flex justify-between text-xs"><span className="text-[#9f9b93]">До 8 уровня</span><span>680 / 1 000 XP</span></div><div className="h-2 overflow-hidden rounded-full bg-black/40"><div className="h-full w-[68%] rounded-full bg-gradient-to-r from-[#9f2e24] to-[#ef7059]" /></div><div className="mt-7 grid grid-cols-3 divide-x divide-white/10 border-t border-white/8 pt-5 text-center"><MiniStat value="14" label="Выполнено" /><MiniStat value="#1 284" label="В рейтинге" /><MiniStat value="4" label="Серия дней" /></div></div></div>
}

function MiniStat({ value, label }: { value: string; label: string }) { return <div><div className="font-display text-lg font-semibold">{value}</div><div className="mt-1 text-[9px] uppercase tracking-[0.1em] text-[#77736c]">{label}</div></div> }
