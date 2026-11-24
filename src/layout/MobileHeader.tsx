import { Link } from 'react-router'
import Logo from '../components/Logo.tsx'
import ProfileAvatar from '../components/ProfileAvatar.tsx'

/** Шапка телефона: логотип слева, аватар справа → экран «Профиль». */
export default function MobileHeader() {
  return (
    <header className="flex items-center justify-between">
      <Logo size="header" />
      <Link to="/profile" aria-label="Профиль" className="rounded-full">
        <ProfileAvatar size={44} />
      </Link>
    </header>
  )
}
