import { Clock3 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useMatchHistory } from '../../entities/match'
import type { Match } from '../../entities/match'
import { ErrorState, LoadingState } from '../../shared/ui'

const date = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
const number = new Intl.NumberFormat('ru-RU')

function stat(value: number | null) { return value === null ? '—' : number.format(value) }

function MatchRow({ match, completions }: { match: Match; completions: { matchId: string; title: string }[] }) {
  const started = new Date(match.startedAt)
  const completed = completions.filter((item) => item.matchId === match.matchId)
  return <li className="history-row flex-wrap gap-y-2">
    <div className="challenge-icon"><Clock3 size={18} /></div>
    <div className="min-w-0 flex-1"><div className="text-sm font-semibold">Матч #{match.matchId} · {match.heroId === null ? 'Герой неизвестен' : `Герой #${match.heroId}`}</div>
      <div className="mt-1 text-[10px] text-[#9a968f]">{Number.isNaN(started.getTime()) ? 'Дата неизвестна' : date.format(started)}{match.duration !== null ? ` · ${Math.floor(match.duration / 60)} мин` : ''}</div>
      <div className="mt-2 text-xs text-[#a5a098]">K/D/A: {stat(match.kills)}/{stat(match.deaths)}/{stat(match.assists)} · Ластхиты: {stat(match.lastHits)} · Урон героям: {stat(match.heroDamage)} · Урон башням: {stat(match.towerDamage)} · Варды: {stat(match.wardsPlaced)}{match.killParticipation !== null ? ` · Участие в убийствах: ${Math.round(match.killParticipation * 100)}%` : ''}</div>
      {completed.map((item) => <div key={item.title} className="mt-2 text-xs text-[#66bd92]">Испытание выполнено: {item.title}</div>)}
    </div>
    <span className={`text-xs font-semibold ${match.win === true ? 'text-[#66bd92]' : match.win === false ? 'text-[#e16d59]' : 'text-[#a5a098]'}`}>{match.win === true ? 'Победа' : match.win === false ? 'Поражение' : 'Результат неизвестен'}</span>
  </li>
}

export function MatchHistory({ completions = [] }: { completions?: { matchId: string; title: string }[] }) {
  const [params, setParams] = useSearchParams()
  const rawPage = Number(params.get('page'))
  const page = Number.isInteger(rawPage) && rawPage >= 1 && rawPage <= 1000 ? rawPage : 1
  const history = useMatchHistory(page)
  function goTo(next: number) { setParams((current) => { const copy = new URLSearchParams(current); copy.set('page', String(next)); return copy }) }

  return <section className="profile-panel"><div className="section-label"><Clock3 size={14} /> ИСТОРИЯ МАТЧЕЙ</div>
    <h2 className="mt-2 font-display text-2xl">Недавние матчи</h2>
    {history.isPending ? <LoadingState /> : history.isError ? <ErrorState error={history.error} retry={() => void history.refetch()} /> : history.data.items.length === 0 ? <p className="mt-6 text-sm text-[#aaa69f]">Матчей пока нет.</p> : <ul className="mt-5 divide-y divide-white/7">{history.data.items.map((match) => <MatchRow key={match.matchId} match={match} completions={completions} />)}</ul>}
    {history.data && (page > 1 || history.data.hasMore) && <nav aria-label="Страницы истории матчей" className="mt-5 flex items-center justify-between text-sm"><button className="secondary-button" disabled={page === 1} onClick={() => goTo(page - 1)}>Назад</button><span>Страница {page}</span><button className="secondary-button" disabled={!history.data.hasMore} onClick={() => goTo(page + 1)}>Далее</button></nav>}
  </section>
}
