import { Link } from 'react-router'
import Avatar from '../components/Avatar.tsx'
import Logo from '../components/Logo.tsx'
import { SkeletonBlock } from '../components/Skeleton.tsx'
import { useAppData } from '../data/AppData.tsx'

/** Шапка телефона: логотип слева, аватар справа → экран «Профиль». */
export default function MobileHeader() {
  const data = useAppData()
  return (
    <header className="flex items-center justify-between">
      <Logo size="header" />
      <Link to="/profile" aria-label="Профиль" className="rounded-full">
        {data.status === 'ready' ? (
          <Avatar name={data.profile.displayName} src={data.profile.avatarUrl} size={44} />
        ) : (
          <SkeletonBlock className="size-11 rounded-full" />
        )}
      </Link>
    </header>
  )
}
