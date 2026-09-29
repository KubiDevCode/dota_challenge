import { CalendarDays, Trophy } from 'lucide-react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ApiError } from '../../shared/api'
import { ErrorState, LoadingState } from '../../shared/ui'
import { useLeaderboard } from '../../entities/season'
import { LeaderboardTable } from '../../widgets/leaderboard-table'

function pageFromUrl(value: string | null) {
  const page = Number(value)
  return Number.isInteger(page) && page >= 1 && page <= 1000 ? page : 1
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))
}

export function LeaderboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawPage = searchParams.get('page')
  const page = pageFromUrl(rawPage)
  const query = useLeaderboard(page)

  useEffect(() => {
    if (rawPage !== null && rawPage !== String(page)) {
      const next = new URLSearchParams(searchParams)
      next.set('page', String(page))
      setSearchParams(next, { replace: true })
    }
  }, [page, rawPage, searchParams, setSearchParams])

  const changePage = (nextPage: number) => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(nextPage))
    setSearchParams(next)
  }

  if (query.isPending) return <><PageHeading /><LoadingState /></>
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) {
      return <><PageHeading /><section className="mx-auto max-w-xl px-5 py-16 text-center"><h2 className="font-display text-2xl">Активного сезона пока нет</h2><p className="mt-3 text-sm text-[#98958e]">Сезонный рейтинг появится после начала нового сезона.</p></section></>
    }
    return <><PageHeading /><ErrorState error={query.error} retry={() => void query.refetch()} /></>
  }

  const { season, items, hasMore } = query.data
  return <>
    <PageHeading seasonName={season.name} endsAt={season.endsAt} />
    <section className="mx-auto max-w-[1180px] px-5 py-10 lg:px-10 lg:py-14">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><h2 className="font-display text-2xl font-semibold">Рейтинг сезона</h2><p className="mt-1 text-xs text-[#77746e]">Места и очки в порядке, заданном сервером</p></div><p className="text-xs text-[#77746e]">{formatDate(season.startsAt)} — {formatDate(season.endsAt)}</p></div>
      {items.length === 0
        ? <div className="mt-6 rounded-xl border border-white/8 px-5 py-14 text-center text-sm text-[#98958e]">В этом сезоне пока нет участников рейтинга.</div>
        : <LeaderboardTable entries={items} />}
      <nav className="mt-5 flex items-center justify-between" aria-label="Страницы рейтинга">
        <button className="secondary-button" onClick={() => changePage(page - 1)} disabled={page <= 1}>Назад</button>
        <span className="text-xs text-[#98958e]">Страница {page}</span>
        <button className="secondary-button" onClick={() => changePage(page + 1)} disabled={!hasMore || page >= 1000}>Дальше</button>
      </nav>
    </section>
  </>
}

function PageHeading({ seasonName, endsAt }: { seasonName?: string; endsAt?: string }) {
  return <section className="page-hero"><div className="hero-grid" /><div className="relative z-10 mx-auto max-w-[1440px] px-5 py-14 lg:px-10"><div className="section-label"><Trophy size={14} /> СЕЗОННЫЙ РЕЙТИНГ</div><div className="mt-3 flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><h1 className="font-display text-4xl font-semibold sm:text-6xl">Лучшие из лучших</h1><p className="mt-4 max-w-xl text-[#98958e]">Рейтинг формируется по очкам за выполненные испытания текущего сезона.</p></div>{seasonName && endsAt && <div className="flex flex-wrap gap-3"><div className="info-chip"><CalendarDays size={16} /> {seasonName}</div><div className="info-chip">Сезон завершится: <strong>{formatDate(endsAt)}</strong></div></div>}</div></div></section>
}
