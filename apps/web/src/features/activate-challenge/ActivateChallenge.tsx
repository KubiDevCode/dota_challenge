import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Target, X } from 'lucide-react'
import { challengeKeys, enrollmentSchema, difficultyLabel, modeLabel, statusLabel } from '../../entities/challenge'
import type { Challenge, Enrollment } from '../../entities/challenge'
import { apiRequest, ApiError } from '../../shared/api'

export function ActivateChallenge({ challenge, enrollment, slotsFull, unavailable, onClose }: {
  challenge: Challenge
  enrollment?: Enrollment
  slotsFull: boolean
  unavailable: boolean
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: async () => enrollmentSchema.parse(await apiRequest<unknown>(`/challenges/${challenge.id}/activate`, { method: 'POST' })),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: challengeKeys.mine }),
        queryClient.invalidateQueries({ queryKey: challengeKeys.lists }),
        queryClient.invalidateQueries({ queryKey: ['my-challenges'] }),
      ])
    },
  })
  const activate = () => mutation.mutate(undefined, { onSuccess: onClose })
  const blocked = Boolean(enrollment) || slotsFull || unavailable || mutation.isPending
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal max-h-[calc(100dvh-40px)] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="challenge-dialog-title" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button><div className="challenge-icon large"><Target size={26} /></div><div className="mt-5 text-[10px] font-bold tracking-[0.2em] text-[#d65a46]">{challenge.category.toUpperCase()} · {difficultyLabel[challenge.difficulty]}</div><h3 id="challenge-dialog-title" className="mt-2 font-display text-3xl font-semibold">{challenge.title}</h3><p className="mt-3 leading-7 text-[#aaa69f]">{challenge.description}</p><p className="mt-3 text-xs text-[#aaa69f]">{modeLabel[challenge.mode]}{challenge.mode === 'SINGLE_MATCH' ? ' — цель нужно выполнить в одном матче.' : ' — прогресс проверяется по матчам после активации.'}</p><div className="mt-7 grid grid-cols-2 gap-3"><div className="modal-stat"><span>Награда</span><strong>+{challenge.xpReward} XP</strong></div><div className="modal-stat"><span>Рейтинг</span><strong>+{challenge.seasonPointsReward} SP</strong></div></div><div className="mt-5 rounded-lg border border-white/8 bg-white/[0.025] p-4 text-xs leading-5 text-[#89867f]">Задание начнёт учитывать матчи после активации.</div>{mutation.isError && <p role="alert" className="mt-4 text-sm text-[#e16d59]">{mutation.error instanceof ApiError ? mutation.error.message : 'Не удалось активировать испытание.'}</p>}<button className="primary-button mt-6 w-full justify-center disabled:cursor-not-allowed disabled:opacity-50" disabled={blocked} onClick={activate}>{enrollment ? <><Check size={17} /> {statusLabel[enrollment.status]}</> : unavailable ? 'Активные испытания недоступны' : slotsFull ? 'Все слоты заняты' : mutation.isPending ? 'Активация…' : 'Активировать испытание'}</button></div></div>
}
