import { ChevronDown, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import type { Difficulty } from '../../entities/challenge'

type Filter = 'ВСЕ' | Difficulty
const filters: Filter[] = ['ВСЕ', 'ЛЕГКО', 'СРЕДНЕ', 'СЛОЖНО']
const values: Record<Exclude<Filter, 'ВСЕ'>, string> = {
  ЛЕГКО: 'easy', СРЕДНЕ: 'medium', СЛОЖНО: 'hard',
}

export function useChallengeFilter() {
  const [searchParams, setSearchParams] = useSearchParams()
  const difficulty = searchParams.get('difficulty')
  const filter: Filter = (Object.keys(values) as Exclude<Filter, 'ВСЕ'>[])
    .find((key) => values[key] === difficulty) || 'ВСЕ'
  const setFilter = (next: Filter) => {
    setSearchParams((previous) => {
      const params = new URLSearchParams(previous)
      if (next === 'ВСЕ') params.delete('difficulty')
      else params.set('difficulty', values[next])
      return params
    })
  }
  return { filter, setFilter }
}

export function FilterChallenges({ filter, setFilter }: { filter: Filter; setFilter: (filter: Filter) => void }) {
  return <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
    <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.025] p-1 text-xs">{filters.map((item) => <button key={item} className={filter === item ? 'filter-active' : 'filter-button'} onClick={() => setFilter(item)}>{item === 'ВСЕ' ? 'Все' : item[0] + item.slice(1).toLowerCase()}</button>)}</div>
    <button className="secondary-button"><Search size={15} /> Найти челлендж <ChevronDown size={14} /></button>
  </div>
}
