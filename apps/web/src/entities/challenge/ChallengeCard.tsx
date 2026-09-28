import { Check, ChevronRight, Clock3, Sparkles } from 'lucide-react'
import type { Challenge } from './data'

export function ChallengeCard({ challenge, active, onSelect }: { challenge: Challenge; active?: boolean; onSelect: () => void }) {
  const Icon = challenge.icon
  return (
    <button className={`challenge-card ${challenge.featured ? 'featured' : ''}`} onClick={onSelect}>
      <div className="flex items-start justify-between"><div className="challenge-icon"><Icon size={20} /></div><span className={`difficulty difficulty-${challenge.difficulty.toLowerCase()}`}>{challenge.difficulty}</span></div>
      <div className="mt-8 text-left"><div className="text-[10px] font-bold tracking-[0.19em] text-[#8e8a83]">{challenge.eyebrow}</div><h3 className="mt-2 font-display text-xl font-semibold">{challenge.title}</h3><p className="mt-3 min-h-[66px] text-sm leading-[1.65] text-[#96938c]">{challenge.description}</p></div>
      <div className="mt-7 flex items-end justify-between border-t border-white/8 pt-5"><div className="flex gap-5 text-xs"><span className="flex items-center gap-1.5 text-[#e1b46f]"><Sparkles size={14} /> {challenge.xp} XP</span><span className="flex items-center gap-1.5 text-[#85827c]"><Clock3 size={14} /> {challenge.time}</span></div><span className={active ? 'active-state' : 'card-arrow'}>{active ? <><Check size={13} /> Активно</> : <ChevronRight size={18} />}</span></div>
    </button>
  )
}
