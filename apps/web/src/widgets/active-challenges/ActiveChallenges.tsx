import { Clock3 } from 'lucide-react'
import { challenges } from '../../entities/challenge'
import { CancelChallenge } from '../../features/cancel-challenge'

export function ActiveChallenges({ activeIds, onCancel }: { activeIds: number[]; onCancel: (id: number) => void }) {
  return <aside><div className="sticky top-24 rounded-xl border border-white/8 bg-[#0e1013] p-5">
    <div className="flex items-center justify-between"><div><div className="text-[10px] font-bold tracking-[.18em] text-[#77746e]">АКТИВНЫЕ</div><h3 className="mt-1 font-display text-xl">Твои цели</h3></div><div className="slot-counter">{activeIds.length}/3</div></div>
    <div className="mt-5 space-y-3">{activeIds.map((id) => { const item = challenges.find((challenge) => challenge.id === id); if (!item) return null; const Icon = item.icon; return <div key={id} className="active-challenge"><div className="flex gap-3"><div className="mt-0.5 text-[#d75a46]"><Icon size={16} /></div><div><div className="text-xs font-semibold">{item.title}</div><div className="mt-1 text-[10px] text-[#6f6c66]">Ждёт нового матча</div></div></div><CancelChallenge onCancel={() => onCancel(id)} /></div> })}
      {Array.from({ length: 3 - activeIds.length }).map((_, index) => <div className="empty-slot" key={index}>Свободный слот</div>)}
    </div>
    <div className="mt-5 flex items-start gap-2 border-t border-white/7 pt-4 text-[10px] leading-4 text-[#6f6c66]"><Clock3 size={13} className="mt-0.5 shrink-0" /> Следующая автоматическая проверка после завершения матча.</div>
  </div></aside>
}
