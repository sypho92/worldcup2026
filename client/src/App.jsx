import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import Nav from './components/Nav'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import MyBetsPage from './pages/MyBetsPage'
import ScoreboardPage from './pages/ScoreboardPage'
import AdminPage from './pages/AdminPage'
import TableauPage from './pages/TableauPage'
import ChallengesPage from './pages/ChallengesPage'
import ChallengeNotifications from './components/ChallengeNotifications'
import LiveTicker from './components/LiveTicker'

function RequireAuth({ children }) {
  const { player } = useApp()
  if (!player) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  const { player, loading } = useApp()

  if (loading && !player) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span>Connexion...</span>
      </div>
    )
  }

  if (!player) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    )
  }

  return (
    <div className="app-layout">
      <Nav />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
          <Route path="/bets" element={<RequireAuth><MyBetsPage /></RequireAuth>} />
          <Route path="/scoreboard" element={<RequireAuth><ScoreboardPage /></RequireAuth>} />
          <Route path="/tableau" element={<RequireAuth><TableauPage /></RequireAuth>} />
          <Route path="/challenges" element={<RequireAuth><ChallengesPage /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <ChallengeNotifications />
      <LiveTicker />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  )
}
