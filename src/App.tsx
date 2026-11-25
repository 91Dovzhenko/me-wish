import { lazy } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router'
import { useAuth } from './auth/AuthProvider.tsx'
import AppLayout from './layout/AppLayout.tsx'
import HomePage from './pages/HomePage.tsx'
import InvitePage from './pages/InvitePage.tsx'
import ListPage from './pages/ListPage.tsx'
import LoginPage from './pages/LoginPage.tsx'
import NotFoundPage from './pages/NotFoundPage.tsx'
import ProfilePage from './pages/ProfilePage.tsx'
import TrashPage from './pages/TrashPage.tsx'

// Проверка коллажа на подставных фото — только в режиме разработки, в сборку не попадает
const DevCoversPage = import.meta.env.DEV
  ? lazy(() => import('./pages/DevCoversPage.tsx'))
  : () => null

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
      {/* приглашение — и до входа (вход с карточкой приглашения), и после */}
      <Route path="/i/:token" element={<InvitePage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/l/:listId/*" element={<ListPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/trash" element={<TrashPage />} />
          {import.meta.env.DEV ? <Route path="/dev/covers" element={<DevCoversPage />} /> : null}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
