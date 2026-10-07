import { Flame } from 'lucide-react'
import { useState } from 'react'
import { useChallenges, useMyChallenges } from '../../entities/challenge'
import type { Challenge } from '../../entities/challenge'
import { ActivateChallenge } from '../../features/activate-challenge'
import { FilterChallenges, useChallengeFilter } from '../../features/filter-challenges'
import { ErrorState, LoadingState } from '../../shared/ui'
import { ActiveChallenges } from '../../widgets/active-challenges'
import { ChallengeGrid } from '../../widgets/challenge-grid'

export function ChallengesPage() {
  const { filters, update } = useChallengeFilter()
  const available = useChallenges(filters)
  const mine = useMyChallenges()
  const [selected, setSelected] = useState<Challenge | null>(null)
  const enrollments = mine.data || []
  const activeCount = enrollments.filter((item) => item.status === 'ACTIVE').length

  return <>
    <section className="page-hero"><div className="hero-grid" /><div className="relative z-10 mx-auto max-w-[1440px] px-5 py-14 lg:px-10"><div className="section-label"><Flame size={14} /> ИСПЫТАНИЯ</div><h1 className="mt-3 font-display text-4xl font-semibold sm:text-6xl">Выбери свою цель</h1><p className="mt-4 max-w-xl text-[#98958e]">Активируй челлендж до начала матча. Мы проверим результат автоматически.</p></div></section>
    <section className="mx-auto max-w-[1440px] px-5 py-10 lg:px-10 lg:py-14"><div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0"><FilterChallenges filters={filters} update={update} />
        {available.isPending ? <LoadingState /> : available.isError ? <ErrorState error={available.error} retry={() => { void available.refetch() }} /> : <>
          {available.data.items.length === 0 ? <p className="rounded-xl border border-white/8 p-8 text-center text-sm text-[#96938c]">По выбранным фильтрам испытаний нет.</p> : <ChallengeGrid challenges={available.data.items} enrollments={enrollments} onSelect={setSelected} />}
          {filters.period !== 'DAILY' && <div className="mt-6 flex items-center justify-between gap-3 text-xs text-[#96938c]"><button className="secondary-button disabled:cursor-not-allowed disabled:opacity-40" disabled={filters.page <= 1} onClick={() => update({ page: filters.page - 1 })}>Назад</button><span>Страница {filters.page}</span><button className="secondary-button disabled:cursor-not-allowed disabled:opacity-40" disabled={available.data.items.length < available.data.limit || filters.page >= 1000} onClick={() => update({ page: filters.page + 1 })}>Далее</button></div>}
        </>}
      </div>
      {mine.isPending ? <aside><LoadingState /></aside> : mine.isError ? <aside><ErrorState error={mine.error} retry={() => { void mine.refetch() }} /></aside> : <ActiveChallenges enrollments={enrollments} />}
    </div></section>
    {selected && <ActivateChallenge key={selected.id} challenge={selected} enrollment={enrollments.find((item) => item.challenge.id === selected.id)} slotsFull={activeCount >= 3} unavailable={!mine.isSuccess} onClose={() => setSelected(null)} />}
  </>
}
