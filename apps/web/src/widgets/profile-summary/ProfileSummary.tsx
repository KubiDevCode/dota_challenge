import { Crown, UserRound } from 'lucide-react'
import type { PublicProfile } from '../../entities/user'

const number = new Intl.NumberFormat('ru-RU')

export function ProfileCover({ profile }: { profile: PublicProfile }) {
  return <section className="profile-cover"><div className="hero-grid" /><div className="relative z-10 mx-auto max-w-[1180px] px-5 pb-8 pt-14 lg:px-10">
    <div className="flex items-center gap-5"><div className="profile-avatar overflow-hidden">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" /> : <UserRound size={38} />}</div>
      <div><div className="mb-2 text-[10px] font-bold tracking-[.16em] text-[#7f7c75]">ПРОФИЛЬ ИГРОКА</div><h1 className="font-display text-3xl font-semibold sm:text-5xl">{profile.displayName}</h1></div>
    </div>
  </div></section>
}

export function ProfileSidebar({ profile }: { profile: PublicProfile }) {
  return <aside className="profile-panel h-fit text-center"><div className="rank-emblem small mx-auto"><Crown size={34} strokeWidth={1.3} /></div>
    <div className="mt-5 text-[10px] font-bold tracking-[.18em] text-[#7d7972]">ТЕКУЩИЙ РАНГ</div>
    <h2 className="mt-1 font-display text-2xl">{profile.level?.rankName ?? 'Без ранга'}</h2>
    <p className="mt-5 text-sm text-[#a5a098]">{profile.level ? `${profile.level.level} уровень` : 'Уровень ещё не получен'}</p>
    <div className="mt-6 grid grid-cols-2 divide-x divide-white/8 border-t border-white/8 pt-5"><MiniStat value={number.format(profile.totalXp)} label="всего XP" /><MiniStat value={number.format(profile.seasonalScore)} label="очки сезона" /></div>
  </aside>
}

export function ProfileStats({ profile, active }: { profile: PublicProfile; active?: number }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
    <StatCard value={number.format(profile.totalXp)} label="Всего XP" />
    <StatCard value={number.format(profile.completedChallenges)} label="Выполнено" />
    {active !== undefined && <StatCard value={number.format(active)} label="Активных испытаний" />}
  </div>
}

function MiniStat({ value, label }: { value: string; label: string }) { return <div><div className="font-display text-lg font-semibold">{value}</div><div className="mt-1 text-[8px] uppercase tracking-[.12em] text-[#706d67]">{label}</div></div> }
function StatCard({ value, label }: { value: string; label: string }) { return <div className="stat-card"><div className="font-display text-2xl">{value}</div><div className="mt-1 text-[9px] uppercase tracking-[.1em] text-[#77746e]">{label}</div></div> }
