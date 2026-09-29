import { Clock3, Target } from 'lucide-react'
import { modeLabel, statusLabel } from '../../entities/challenge'
import type { Enrollment } from '../../entities/challenge'
import { CancelChallenge } from '../../features/cancel-challenge'

export function ActiveChallenges({ enrollments }: { enrollments: Enrollment[] }) {
  const active = enrollments.filter((item) => item.status === 'ACTIVE')
  const past = enrollments.filter((item) => item.status !== 'ACTIVE')
  return <aside><div className="xl:sticky xl:top-24 rounded-xl border border-white/8 bg-[#0e1013] p-5">
    <div className="flex items-center justify-between"><div><div className="text-[10px] font-bold tracking-[.18em] text-[#77746e]">АКТИВНЫЕ</div><h3 className="mt-1 font-display text-xl">Твои цели</h3></div><div className="slot-counter">{active.length}/3</div></div>
    <div className="mt-5 space-y-3">{active.length === 0 && <p className="text-xs text-[#96938c]">Активных испытаний пока нет. Выбери цель из каталога.</p>}
      {active.map((item) => <div key={item.id} className="active-challenge"><div className="flex min-w-0 gap-3"><div className="mt-0.5 text-[#d75a46]"><Target size={16} /></div><div className="min-w-0"><div className="text-xs font-semibold">{item.challenge.title}</div><div className="mt-1 text-[10px] text-[#8f8c85]">{statusLabel[item.status]} · {modeLabel[item.challenge.mode]}</div><div className="mt-1 text-[10px] text-[#6f6c66]">Проверено матчей: {item.attemptsChecked}</div></div></div><CancelChallenge enrollmentId={item.id} /></div>)}
      {Array.from({ length: Math.max(0, 3 - active.length) }).map((_, index) => <div className="empty-slot" key={index}>Свободный слот</div>)}
    </div>
    <div className="mt-5 flex items-start gap-2 border-t border-white/7 pt-4 text-[10px] leading-4 text-[#6f6c66]"><Clock3 size={13} className="mt-0.5 shrink-0" /> Следующая автоматическая проверка после завершения матча.</div>
    {past.length > 0 && <div className="mt-5 border-t border-white/7 pt-4"><h4 className="text-xs font-semibold text-[#aaa69f]">История испытаний</h4><div className="mt-3 space-y-2">{past.map((item) => <div key={item.id} className="flex justify-between gap-3 text-xs"><span className="min-w-0 text-[#96938c]">{item.challenge.title}</span><span className="shrink-0 text-[#c99b59]">{statusLabel[item.status]}</span></div>)}</div></div>}
  </div></aside>
}
