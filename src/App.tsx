import { Navigate, Outlet, Route, Routes } from 'react-router'
import { useAuth } from './auth/AuthProvider.tsx'
import AppLayout from './layout/AppLayout.tsx'
import HomePage from './pages/HomePage.tsx'
import LoginPage from './pages/LoginPage.tsx'
import NotFoundPage from './pages/NotFoundPage.tsx'
import ProfilePage from './pages/ProfilePage.tsx'

/** Пока не вошёл — любой адрес, кроме экрана входа, ведёт на вход. */
function RequireAuth() {
  const { status } = useAuth()
  if (status === 'initializing') return <div className="min-h-dvh bg-bg" aria-busy="true" />
  if (status !== 'signedIn') return <Navigate to="/login" replace />
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
