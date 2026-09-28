import { Check, X } from 'lucide-react'
import type { Challenge } from '../../entities/challenge'

export function ActivateChallenge({ challenge, active, slotsFull, onActivate, onClose }: {
  challenge: Challenge
  active: boolean
  slotsFull: boolean
  onActivate: (challenge: Challenge) => void
  onClose: () => void
}) {
  const Icon = challenge.icon
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="challenge-dialog-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button><div className="challenge-icon large"><Icon size={26} /></div><div className="mt-5 text-[10px] font-bold tracking-[0.2em] text-[#d65a46]">{challenge.eyebrow}</div><h3 id="challenge-dialog-title" className="mt-2 font-display text-3xl font-semibold">{challenge.title}</h3><p className="mt-3 leading-7 text-[#aaa69f]">{challenge.description}</p><div className="mt-7 grid grid-cols-2 gap-3"><div className="modal-stat"><span>Награда</span><strong>+{challenge.xp} XP</strong></div><div className="modal-stat"><span>Рейтинг</span><strong>+{challenge.seasonPoints} SP</strong></div></div><div className="mt-5 rounded-lg border border-white/8 bg-white/[0.025] p-4 text-xs leading-5 text-[#89867f]">Задание начнёт учитывать матчи после активации. Один матч может закрыть несколько испытаний.</div><button className="primary-button mt-6 w-full justify-center" onClick={() => onActivate(challenge)}>{active ? <><Check size={17} /> Уже активно</> : slotsFull ? 'Все слоты заняты' : 'Активировать испытание'}</button></div></div>
}
