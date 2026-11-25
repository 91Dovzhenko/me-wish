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
                {/* Подложка под строку состояния iPhone (viewport-fit=cover): при прокрутке заголовки
                    уходят под неё, а не под часы и значки сети (004-b, баг из проверки 004-a) */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none fixed inset-x-0 top-0 z-[35] h-[env(safe-area-inset-top)] bg-bg lg:hidden"
                />
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
