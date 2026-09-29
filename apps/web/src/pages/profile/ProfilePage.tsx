import { useParams } from 'react-router-dom'
import { useCurrentUser, useMyChallengeSummary, usePublicProfile } from '../../entities/user'
import { RefreshMatches } from '../../features/refresh-matches'
import { apiBaseUrl } from '../../shared/config'
import { ErrorState, LoadingState } from '../../shared/ui'
import { MatchHistory } from '../../widgets/match-history'
import { ProfileCover, ProfileSidebar, ProfileStats } from '../../widgets/profile-summary'
import { ApiError } from '../../shared/api'

function ProfileContent({ id, own }: { id: string; own: boolean }) {
  const profile = usePublicProfile(id)
  const summary = useMyChallengeSummary(own)
  if (profile.isPending) return <LoadingState />
  if (profile.isError) return <ErrorState error={profile.error} retry={() => void profile.refetch()} />
  return <>
    <ProfileCover profile={profile.data} />
    <section className="mx-auto max-w-[1180px] px-5 py-10 lg:px-10 lg:py-14"><div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <ProfileSidebar profile={profile.data} />
      <div className="space-y-5"><ProfileStats profile={profile.data} active={summary.data?.active} />
        {own && <><RefreshMatches /><MatchHistory completions={summary.data?.completions} /></>}
      </div>
    </div></section>
  </>
}

function OwnProfile() {
  const me = useCurrentUser()
  if (me.isPending) return <LoadingState />
  if (me.isError) {
    if (me.error instanceof ApiError && me.error.status === 401) return <section className="mx-auto max-w-[1180px] px-5 py-16 lg:px-10"><h1 className="font-display text-4xl">Войдите в Steam</h1><p className="mt-4 text-[#aaa69f]">Войдите, чтобы увидеть свой профиль и историю матчей.</p><a className="steam-button mt-6 inline-flex" href={`${apiBaseUrl}/auth/steam`}>Войти через Steam</a></section>
    return <ErrorState error={me.error} retry={() => void me.refetch()} />
  }
  return <ProfileContent id={me.data.id} own />
}

export function ProfilePage() {
  const { id } = useParams()
  return id ? <ProfileContent id={id} own={false} /> : <OwnProfile />
}
