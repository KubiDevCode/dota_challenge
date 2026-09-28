import { Outlet } from 'react-router-dom'
import { Header } from '../../widgets/header'

export function Layout() {
  return (
    <div className="min-h-screen bg-[#08090b] text-[#f3f0e9]">
      <div className="ambient-glow" />
      <Header />

      <main className="relative z-10"><Outlet /></main>
      <footer className="relative z-10 border-t border-white/7 px-5 py-8 text-center text-xs text-[#65635e]">Aegis Trials — неофициальный фанатский проект. Dota и Steam являются товарными знаками Valve Corporation.</footer>
    </div>
  )
}
