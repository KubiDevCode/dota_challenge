import { Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { difficultyLabel, modeLabel } from '../../entities/challenge'
import type { ChallengeFilters, ChallengeMode, Difficulty } from '../../entities/challenge'

const difficulties: Difficulty[] = ['EASY', 'MEDIUM', 'HARD']
const modes: ChallengeMode[] = ['PERSISTENT', 'SINGLE_MATCH']

export function useChallengeFilter() {
  const [params, setParams] = useSearchParams()
  const rawDifficulty = params.get('difficulty')?.toUpperCase()
  const rawMode = params.get('mode')
  const rawPage = Number(params.get('page'))
  const filters: ChallengeFilters = {
    page: Number.isInteger(rawPage) && rawPage > 0 && rawPage <= 1000 ? rawPage : 1,
    difficulty: difficulties.find((value) => value === rawDifficulty),
    mode: modes.find((value) => value === rawMode),
    category: params.get('category')?.trim().slice(0, 64) || undefined,
  }
  const update = (changes: Partial<ChallengeFilters>) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      for (const [key, value] of Object.entries(changes)) {
        if (key === 'page') {
          if (value === 1) next.delete(key)
          else next.set(key, String(value))
        } else if (!value) next.delete(key)
        else next.set(key, key === 'difficulty' ? String(value).toLowerCase() : String(value))
      }
      if (!('page' in changes)) next.delete('page')
      return next
    })
  }
  return { filters, update }
}

export function FilterChallenges({ filters, update }: { filters: ChallengeFilters; update: (changes: Partial<ChallengeFilters>) => void }) {
  return <div className="mb-6 space-y-3">
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/8 bg-white/[0.025] p-1 text-xs">
      <button className={!filters.difficulty ? 'filter-active' : 'filter-button'} onClick={() => update({ difficulty: undefined })}>Все</button>
      {difficulties.map((difficulty) => <button key={difficulty} className={filters.difficulty === difficulty ? 'filter-active' : 'filter-button'} onClick={() => update({ difficulty })}>{difficultyLabel[difficulty][0] + difficultyLabel[difficulty].slice(1).toLowerCase()}</button>)}
    </div>
    <div className="flex flex-wrap gap-3">
      <label className="sr-only" htmlFor="challenge-mode">Тип испытания</label>
      <select id="challenge-mode" className="secondary-button bg-[#111317]" value={filters.mode || ''} onChange={(event) => update({ mode: event.target.value as ChallengeMode || undefined })}><option value="">Любой тип</option>{modes.map((mode) => <option key={mode} value={mode}>{modeLabel[mode]}</option>)}</select>
      <form className="flex min-w-0 flex-1 gap-2 sm:max-w-xs" onSubmit={(event) => { event.preventDefault(); const value = new FormData(event.currentTarget).get('category'); update({ category: String(value || '').trim().slice(0, 64) || undefined }) }}>
        <input key={filters.category || ''} name="category" aria-label="Категория" maxLength={64} defaultValue={filters.category || ''} placeholder="Категория" className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.025] px-3 text-xs text-white" />
        <button className="secondary-button" aria-label="Применить категорию"><Search size={15} /></button>
      </form>
    </div>
  </div>
}
