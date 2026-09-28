import { ArrowRight, Award, Flame, ShieldCheck, Sparkles, Target, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ProfileProgressCard } from '../../widgets/profile-summary'

export function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-white/7">
        <div className="hero-grid" />
        <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-16 lg:grid-cols-[1fr_440px] lg:px-10 lg:py-24">
          <div className="relative z-10 max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#d44a35]/30 bg-[#d44a35]/8 px-3 py-1.5 text-[11px] font-bold tracking-[0.18em] text-[#ef7a65]"><Flame size={14} /> СЕЗОН 01 · ВОСХОЖДЕНИЕ</div>
            <h1 className="font-display text-5xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-7xl lg:text-[88px]">ДОКАЖИ, ЧТО<br /><span className="text-gradient">ТЫ ДОСТОИН</span></h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-[#aaa79f] sm:text-lg">Выбирай испытания, выполняй их в реальных матчах и поднимайся на вершину сезонного рейтинга.</p>
            <div className="mt-9 flex flex-wrap gap-3"><Link to="/challenges" className="primary-button">Выбрать челлендж <ArrowRight size={17} /></Link><Link to="/leaderboard" className="secondary-button">Смотреть рейтинг</Link></div>
            <div className="mt-12 flex flex-wrap gap-8 text-sm"><Stat value="12 480" label="игроков" /><Stat value="84 219" label="испытаний закрыто" /><Stat value="32 дня" label="до конца сезона" /></div>
          </div>
          <div className="relative z-10 flex items-center justify-center lg:justify-end"><ProfileProgressCard /></div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 py-16 lg:px-10 lg:py-24">
        <div className="mx-auto max-w-2xl text-center"><div className="section-label justify-center"><Sparkles size={14} /> КАК ЭТО РАБОТАЕТ</div><h2 className="mt-3 font-display text-4xl font-semibold">Три шага к вершине</h2><p className="mt-3 text-[#929089]">Никаких сложных правил — выбирай цель и играй как обычно.</p></div>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Feature icon={Target} number="01" title="Выбери испытание" text="Активируй до трёх челленджей перед началом матча." />
          <Feature icon={ShieldCheck} number="02" title="Сыграй матч" text="Мы автоматически проверим результат после завершения игры." />
          <Feature icon={Trophy} number="03" title="Получи награду" text="Заработай опыт, новый уровень и сезонные очки." />
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-5 pb-16 lg:px-10 lg:pb-24"><div className="season-banner"><div className="relative z-10 max-w-2xl"><div className="section-label text-[#f0a56d]"><Award size={14} /> НАГРАДА СЕЗОНА</div><h2 className="mt-4 font-display text-3xl font-semibold sm:text-5xl">Оставь свой след в истории</h2><p className="mt-4 max-w-xl leading-7 text-[#a9a49a]">Заверши сезон в топ-100 и получи уникальную рамку профиля «Первородный огонь».</p><Link to="/leaderboard" className="secondary-button mt-7">Узнать о сезоне <ArrowRight size={16} /></Link></div><Award className="absolute -bottom-14 right-5 h-56 w-56 rotate-12 text-[#d64a35]/10 sm:right-14 sm:h-72 sm:w-72" strokeWidth={0.7} /></div></section>
    </>
  )
}

function Feature({ icon: Icon, number, title, text }: { icon: typeof Target; number: string; title: string; text: string }) {
  return <div className="feature-card"><div className="flex items-center justify-between"><div className="challenge-icon"><Icon size={20} /></div><span className="font-display text-3xl text-white/5">{number}</span></div><h3 className="mt-7 font-display text-xl font-semibold">{title}</h3><p className="mt-3 text-sm leading-6 text-[#8f8c85]">{text}</p></div>
}

function Stat({ value, label }: { value: string; label: string }) { return <div><div className="font-display text-xl font-semibold text-[#e8e4dc]">{value}</div><div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#6f6c66]">{label}</div></div> }
