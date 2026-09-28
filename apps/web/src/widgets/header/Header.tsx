import { Gamepad2, Menu, Swords, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Главная', end: true },
  { to: '/challenges', label: 'Челленджи' },
  { to: '/leaderboard', label: 'Рейтинг' },
  { to: '/profile', label: 'Профиль' },
]

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  return <header className="sticky top-0 z-40 border-b border-white/8 bg-[#08090b]/90 backdrop-blur-xl">
    <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-5 lg:px-10">
      <NavLink to="/" className="flex items-center gap-3" onClick={() => setMenuOpen(false)}>
        <div className="logo-mark"><Swords size={20} /></div>
        <div><div className="font-display text-lg font-bold tracking-[0.12em]">AEGIS</div><div className="text-[9px] font-semibold tracking-[0.36em] text-[#a8a49b]">TRIALS</div></div>
      </NavLink>
      <nav className="hidden items-center gap-8 text-sm text-[#9f9d97] md:flex">
        {navItems.map((item) => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>{item.label}</NavLink>)}
      </nav>
      <div className="hidden items-center gap-3 md:flex">
        <NavLink to="/profile" className="profile-pill"><div className="avatar-small"><UserRound size={15} /></div><div><div className="text-xs font-semibold">InvokerEnjoyer</div><div className="text-[9px] text-[#77746e]">7 уровень</div></div></NavLink>
        <button className="steam-button"><Gamepad2 size={16} /> Steam</button>
      </div>
      <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Открыть меню">{menuOpen ? <X /> : <Menu />}</button>
    </div>
    {menuOpen && <div className="border-t border-white/8 bg-[#0e1013] px-5 py-5 md:hidden"><div className="flex flex-col gap-4 text-sm text-[#b8b5ae]">{navItems.map((item) => <NavLink key={item.to} to={item.to} onClick={() => setMenuOpen(false)}>{item.label}</NavLink>)}<button className="steam-button justify-center"><Gamepad2 size={16} /> Войти через Steam</button></div></div>}
  </header>
}
