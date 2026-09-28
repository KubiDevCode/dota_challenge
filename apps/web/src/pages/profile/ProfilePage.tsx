import { useParams } from 'react-router-dom'
import { MatchHistory } from '../../widgets/match-history'
import { ProfileCover, ProfileSidebar, ProfileStats } from '../../widgets/profile-summary'

export function ProfilePage() {
  const { id } = useParams()
  if (id && id !== '76561198123456789') return <section className="mx-auto max-w-[1180px] px-5 py-16 lg:px-10"><h1 className="font-display text-4xl">Профиль не найден</h1><p className="mt-4 text-[#98958e]">Поиск профилей станет доступен после подключения API.</p></section>
  return <>
    <ProfileCover />
    <section className="mx-auto max-w-[1180px] px-5 py-10 lg:px-10 lg:py-14"><div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <ProfileSidebar />
      <div className="space-y-5"><ProfileStats /><MatchHistory /></div>
    </div></section>
  </>
}
