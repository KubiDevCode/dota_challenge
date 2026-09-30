import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { ApiError, apiRequest } from '../../shared/api'

const statusSchema = z.object({
  status: z.enum(['idle', 'queued', 'processing', 'failed']), retryable: z.boolean(), lastSuccessfulSync: z.string().nullable(),
})
const refreshSchema = z.object({ status: z.literal('queued'), jobId: z.string() })

export function RefreshMatches() {
  const client = useQueryClient()
  const [monitorUntil, setMonitorUntil] = useState(0)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [outcome, setOutcome] = useState<'success' | null>(null)
  const previousSuccess = useRef<string | null>(null)
  const observedSuccess = useRef<string | null | undefined>(undefined)
  const status = useQuery({
    queryKey: ['match-sync-status'],
    queryFn: async ({ signal }) => statusSchema.parse(await apiRequest('/me/match-sync-status', { signal })),
    retry: false,
    refetchInterval: 10_000,
  })
  const refresh = useMutation({
    mutationFn: async () => refreshSchema.parse(await apiRequest('/me/matches/refresh', { method: 'POST' })),
    onSuccess: () => {
      previousSuccess.current = status.data?.lastSuccessfulSync ?? null
      setOutcome(null)
      setMonitorUntil(Date.now() + 120_000)
      setCooldownUntil(Date.now() + 60_000)
      void status.refetch()
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 429) setCooldownUntil(Date.now() + 60_000)
    },
  })

  useEffect(() => {
    if (!status.data) return
    const lastSuccessfulSync = status.data.lastSuccessfulSync
    if (observedSuccess.current === undefined || observedSuccess.current !== lastSuccessfulSync) {
      observedSuccess.current = lastSuccessfulSync
      if (lastSuccessfulSync) {
        void client.invalidateQueries({ queryKey: ['my-matches'] })
        void client.invalidateQueries({ queryKey: ['public-profile'] })
        void client.invalidateQueries({ queryKey: ['my-challenges'] })
      }
    }

    if (!monitorUntil) return
    if (status.data.status === 'failed') { setMonitorUntil(0); return }
    if (lastSuccessfulSync && lastSuccessfulSync !== previousSuccess.current) {
      setOutcome('success')
      setMonitorUntil(0)
    }
  }, [client, monitorUntil, status.data])

  useEffect(() => {
    if (cooldownUntil <= Date.now() && monitorUntil <= Date.now()) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [cooldownUntil, monitorUntil])

  const seconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
  const running = monitorUntil > now
  const state = status.data?.status
  return <section className="profile-panel" aria-label="Синхронизация матчей">
    <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-xl">Синхронизация матчей</h2>
      <p role="status" className="mt-2 text-sm text-[#aaa69f]">
        {state === 'failed' ? 'Ошибка провайдера матчей.' : state === 'processing' ? 'Обработка матчей…' : state === 'queued' || running ? 'Обновление в очереди…' : outcome === 'success' ? 'Матчи успешно обновлены.' : 'Можно обновить историю матчей.'}
      </p></div>
      <button className="secondary-button" disabled={refresh.isPending || running || state === 'queued' || state === 'processing' || seconds > 0} onClick={() => refresh.mutate()}>Обновить матчи</button>
    </div>
    {state === 'failed' && <p role="alert" className="mt-3 text-sm text-[#e16d59]">Синхронизация не удалась{status.data?.retryable ? ', попробуйте позже.' : '.'}</p>}
    {status.isError && <p role="alert" className="mt-3 text-sm text-[#e16d59]">Не удалось получить статус синхронизации. <button className="underline" onClick={() => void status.refetch()}>Повторить</button></p>}
    {refresh.isError && <p role="alert" className="mt-3 text-sm text-[#e16d59]">{refresh.error instanceof ApiError && refresh.error.status === 429 ? 'Пауза между обновлениями.' : 'Не удалось запустить обновление матчей.'}</p>}
    {seconds > 0 && <p className="mt-3 text-xs text-[#aaa69f]">Повторное обновление через {seconds} с. Окончательное решение принимает сервер.</p>}
    {status.data?.lastSuccessfulSync && <p className="mt-3 text-xs text-[#77746e]">Последнее успешное обновление: {new Date(status.data.lastSuccessfulSync).toLocaleString('ru-RU')}</p>}
  </section>
}
