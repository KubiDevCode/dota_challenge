import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminPage } from '../../pages/admin'
import { ChallengesPage } from '../../pages/challenges'
import { HomePage } from '../../pages/home'
import { LeaderboardPage } from '../../pages/leaderboard'
import { ProfilePage } from '../../pages/profile'
import { Layout } from './Layout'

export function AppRoutes() {
  return <Routes><Route element={<Layout />}>
    <Route index element={<HomePage />} />
    <Route path="challenges" element={<ChallengesPage />} />
    <Route path="leaderboard" element={<LeaderboardPage />} />
    <Route path="profile" element={<ProfilePage />} />
    <Route path="profile/:id" element={<ProfilePage />} />
    <Route path="admin" element={<AdminPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Route></Routes>
}
