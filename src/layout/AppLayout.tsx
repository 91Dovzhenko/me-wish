import { Outlet } from 'react-router'
import OfflineBanner from '../components/OfflineBanner.tsx'
import { ToastProvider } from '../components/Toast.tsx'
import { AppDataProvider } from '../data/AppData.tsx'
import { ListActionsProvider } from '../features/lists/ListActions.tsx'
import InstallHint from '../features/install/InstallHint.tsx'
import MembershipWatcher from '../features/members/MembershipWatcher.tsx'
import { WishActionsProvider } from '../features/wishes/WishActions.tsx'
import Sidebar from './Sidebar.tsx'

/**
 * Раскладка для вошедшего пользователя.
 * Телефон (до 1023 px): страница сама рисует шапку; нижней панели вкладок нет.
 * Компьютер (от 1024 px): белое боковое меню слева, контент прямо на сером фоне (вариант Б, D-093).
 */
export default function AppLayout() {
  return (
    <AppDataProvider>
      <ToastProvider>
        <ListActionsProvider>
          <WishActionsProvider>
            <div className="min-h-dvh bg-bg lg:flex lg:gap-3 lg:p-3">
              <div className="hidden lg:flex">
                <Sidebar />
              </div>
              <div className="min-w-0 flex-1">
                <OfflineBanner />
                <Outlet />
              </div>
            </div>
            <InstallHint />
            <MembershipWatcher />
          </WishActionsProvider>
        </ListActionsProvider>
      </ToastProvider>
    </AppDataProvider>
  )
}
