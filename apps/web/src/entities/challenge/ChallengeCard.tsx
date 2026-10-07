import { Check, ChevronRight, Sparkles, Target } from 'lucide-react'
import { difficultyLabel, modeLabel, periodLabel, statusLabel } from './model'
import type { Challenge, ChallengeStatus } from './model'

const heroNames: Record<number, string> = { 2: 'Axe', 8: 'Juggernaut', 44: 'Phantom Assassin' }
const itemNames: Record<number, string> = { 1: 'Blink Dagger', 116: 'Black King Bar', 127: 'Blade Mail', 145: 'Battle Fury', 168: 'Desolator' }

export function ChallengeCard({ challenge, status, onSelect }: { challenge: Challenge; status?: ChallengeStatus; onSelect: () => void }) {
  return (
    <button className="challenge-card text-left" onClick={onSelect}>
      <div className="flex items-start justify-between gap-3"><div className="challenge-icon"><Target size={20} /></div><span className={`difficulty difficulty-${challenge.difficulty.toLowerCase()}`}>{difficultyLabel[challenge.difficulty]}</span></div>
      <div className="mt-8"><div className="text-[10px] font-bold tracking-[0.19em] text-[#8e8a83]">{periodLabel[challenge.period].toUpperCase()} · {modeLabel[challenge.mode]}</div><h3 className="mt-2 font-display text-xl font-semibold">{challenge.title}</h3><p className="mt-3 min-h-[66px] text-sm leading-[1.65] text-[#96938c]">{challenge.description}</p>
        {(challenge.requiredHeroId || challenge.requiredItemIds.length > 0) && <p className="mt-3 text-xs text-[#d8aa60]">Сборка: {challenge.requiredHeroId ? heroNames[challenge.requiredHeroId] ?? `герой #${challenge.requiredHeroId}` : 'любой герой'}{challenge.requiredItemIds.length > 0 ? ` · ${challenge.requiredItemIds.map((id) => itemNames[id] ?? `предмет #${id}`).join(', ')}` : ''}</p>}
        {challenge.availableUntil && <p className="mt-2 text-xs text-[#b8a17a]">Доступно до {new Date(challenge.availableUntil).toLocaleString()}</p>}
      </div>
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-5"><div className="flex gap-4 text-xs"><span className="flex items-center gap-1.5 text-[#e1b46f]"><Sparkles size={14} /> {challenge.xpReward} XP</span><span className="text-[#85827c]">{challenge.seasonPointsReward} SP</span></div><span className={status === 'ACTIVE' ? 'active-state' : 'card-arrow'}>{status ? <><Check size={13} /> {statusLabel[status]}</> : <ChevronRight size={18} />}</span></div>
    </button>
  )
}
