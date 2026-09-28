import { Flame, Sparkles, Target } from 'lucide-react'
import { useState } from 'react'
import { challenges, type Challenge } from '../../entities/challenge'
import { ActivateChallenge } from '../../features/activate-challenge'
import { FilterChallenges, useChallengeFilter } from '../../features/filter-challenges'
import { ActiveChallenges } from '../../widgets/active-challenges'
import { ChallengeGrid } from '../../widgets/challenge-grid'

export function ChallengesPage() {
  const { filter, setFilter } = useChallengeFilter()
  const [activeIds, setActiveIds] = useState([2])
  const [selected, setSelected] = useState<Challenge | null>(null)
  const visible = filter === 'ВСЕ' ? challenges : challenges.filter((item) => item.difficulty === filter)

  const activate = (challenge: Challenge) => {
    setActiveIds((current) => current.includes(challenge.id) || current.length >= 3 ? current : [...current, challenge.id])
    setSelected(null)
  }

  return <>
    <section className="page-hero"><div className="hero-grid" /><div className="relative z-10 mx-auto max-w-[1440px] px-5 py-14 lg:px-10"><div className="section-label"><Flame size={14} /> ИСПЫТАНИЯ</div><h1 className="mt-3 font-display text-4xl font-semibold sm:text-6xl">Выбери свою цель</h1><p className="mt-4 max-w-xl text-[#98958e]">Активируй челлендж до начала матча. Мы проверим результат автоматически.</p><div className="mt-6 inline-flex items-center gap-2 text-xs text-[#c99b59]"><Target size={14} /> Ежедневное обновление через 08:42:16 <Sparkles size={12} /></div></div></section>
    <section className="mx-auto max-w-[1440px] px-5 py-10 lg:px-10 lg:py-14"><div className="grid gap-7 xl:grid-cols-[1fr_300px]">
      <div><FilterChallenges filter={filter} setFilter={setFilter} /><ChallengeGrid challenges={visible} activeIds={activeIds} onSelect={setSelected} /></div>
      <ActiveChallenges activeIds={activeIds} onCancel={(id) => setActiveIds((current) => current.filter((activeId) => activeId !== id))} />
    </div></section>
    {selected && <ActivateChallenge challenge={selected} active={activeIds.includes(selected.id)} slotsFull={activeIds.length >= 3} onActivate={activate} onClose={() => setSelected(null)} />}
  </>
}
