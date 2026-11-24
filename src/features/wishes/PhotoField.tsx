import { useRef } from 'react'
import { AlertIcon, CropIcon, ImageIcon, TrashIcon, WarnIcon } from '../../components/Icons.tsx'

// Блок фото формы «Новое желание»: Mobile-Add (пусто / выбрано / загрузка / ошибки / маленькое),
// Desktop-Add и Desktop-Add-Drag (перетаскивание).

// Только картинки. Без multiple — в галерее телефона нельзя отметить несколько (D-088).
// image/* — чтобы на телефоне были и галерея, и камера; .heic/.heif — чтобы HEIC был виден в окне выбора на компьютере.
const ACCEPT = 'image/*,.heic,.heif'

/** Что показать в блоке фото: новое (загружается) или уже сохранённое у желания. */
export type PhotoView = {
  /** undefined — ссылка на сохранённое фото ещё не получена */
  previewUrl: string | undefined
  upload: 'uploading' | 'done' | 'error'
  progress: number
  small: boolean
}

type Props = {
  photo: PhotoView | null
  problem: string | null
  opening: boolean
  dragOver: boolean
  isDesktop: boolean
  onFile: (file: File) => void
  onRecrop: () => void
  onRemove: () => void
  onRetry: () => void
}

export default function PhotoField(props: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const choose = () => inputRef.current?.click()
  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={ACCEPT}
      className="hidden"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        const file = e.target.files?.[0]
        // тот же файл можно выбрать повторно
        e.target.value = ''
        if (file) props.onFile(file)
      }}
    />
  )
  return props.isDesktop ? (
    <DesktopPhoto {...props} choose={choose} input={input} />
  ) : (
    <MobilePhoto {...props} choose={choose} input={input} />
  )
}

type Inner = Props & { choose: () => void; input: React.ReactNode }

function MobilePhoto({
  photo,
  problem,
  opening,
  choose,
  input,
  onRecrop,
  onRemove,
  onRetry,
}: Inner) {
  if (!photo) {
    return (
      <div className="flex flex-col gap-2">
        {input}
        <button
          type="button"
          onClick={choose}
          disabled={opening}
          className={`flex h-[120px] cursor-pointer items-center gap-3.5 rounded-[20px] border-[1.5px] border-dashed bg-[#f7f5ff] px-[18px] text-left ${
            problem ? 'border-[#f3b5ae]' : 'border-[#c9c7ff]'
          }`}
        >
          <span className="flex size-14 flex-none items-center justify-center rounded-[18px] bg-accent-2-soft text-accent-2-text">
            <ImageIcon size={26} />
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-base font-bold">
              {opening ? 'Открываем фото…' : 'Добавить фото'}
            </span>
            <span className="text-[13px] leading-[1.35] text-text-2">
              JPG, PNG или HEIC до 20 МБ.
              <br />
              Подойдёт скриншот
            </span>
          </span>
        </button>
        {problem ? <ErrorLine text={problem} /> : null}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {input}
      <div className="flex items-center gap-3.5">
        <div className="relative w-[120px] flex-none">
          <Preview photo={photo} radius={18} opening={opening} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <ActionButton icon={<CropIcon size={18} />} onClick={onRecrop}>
            Обрезать
          </ActionButton>
          <ActionButton icon={<ImageIcon size={18} />} onClick={choose}>
            Другое фото
          </ActionButton>
          <ActionButton icon={<TrashIcon size={18} strokeWidth={1.8} />} onClick={onRemove} danger>
            Удалить фото
          </ActionButton>
        </div>
      </div>
      <PhotoNotes photo={photo} problem={problem} onRetry={onRetry} />
    </div>
  )
}

function DesktopPhoto({
  photo,
  problem,
  opening,
  dragOver,
  choose,
  input,
  onRecrop,
  onRemove,
  onRetry,
}: Inner) {
  if (!photo) {
    return (
      <div className="flex w-[260px] flex-none flex-col gap-2">
        {input}
        <button
          type="button"
          onClick={choose}
          disabled={opening}
          className={`flex h-[260px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[24px] p-5 text-center transition-colors ${
            dragOver
              ? 'border-2 border-solid border-heart bg-accent-2-soft'
              : `border-[1.5px] border-dashed bg-[#f7f5ff] hover:bg-[#f2efff] ${
                  problem ? 'border-[#f3b5ae]' : 'border-[#c9c7ff]'
                }`
          }`}
        >
          <span className="flex size-[60px] items-center justify-center rounded-[20px] bg-accent-2-soft text-accent-2-text">
            <ImageIcon size={28} />
          </span>
          <span className="text-base font-bold">
            {dragOver ? 'Отпустите, чтобы добавить' : opening ? 'Открываем фото…' : 'Добавить фото'}
          </span>
          <span className="text-sm leading-[1.45] text-text-2">
            Перетащите сюда, вставьте скриншот <b className="whitespace-nowrap text-text">⌘ V</b>{' '}
            или выберите файл
          </span>
          <span className="text-xs text-[#6b6d73]">
            JPG, PNG или HEIC до 20 МБ. Подойдёт скриншот
          </span>
        </button>
        {problem ? <ErrorLine text={problem} /> : null}
      </div>
    )
  }
  return (
    <div className="flex w-[260px] flex-none flex-col gap-2">
      {input}
      <div className="relative">
        <Preview photo={photo} radius={24} opening={opening} />
        {dragOver ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-[24px] border-2 border-heart bg-[rgba(238,233,255,0.88)] p-5 text-center text-base font-bold">
            Отпустите, чтобы заменить
          </div>
        ) : null}
      </div>
      <div className="flex gap-1.5">
        <ActionButton icon={<CropIcon size={16} />} onClick={onRecrop} compact grow>
          Обрезать
        </ActionButton>
        <ActionButton icon={<ImageIcon size={16} />} onClick={choose} compact grow>
          Другое фото
        </ActionButton>
      </div>
      <ActionButton
        icon={<TrashIcon size={16} strokeWidth={1.8} />}
        onClick={onRemove}
        danger
        compact
      >
        Удалить фото
      </ActionButton>
      <PhotoNotes photo={photo} problem={problem} onRetry={onRetry} />
    </div>
  )
}

/** Превью выбранного фото; во время загрузки — проценты и полоска (Mobile-Add-Uploading). */
function Preview({
  photo,
  radius,
  opening,
}: {
  photo: PhotoView
  radius: number
  opening: boolean
}) {
  return (
    <div
      className="relative aspect-square w-full overflow-hidden bg-bg"
      style={{ borderRadius: radius }}
    >
      {photo.previewUrl ? (
        <img
          src={photo.previewUrl}
          alt="Выбранное фото"
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
      {opening ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/72 text-sm font-bold">
          Открываем фото…
        </div>
      ) : null}
      {photo.upload === 'uploading' ? (
        <div
          role="progressbar"
          aria-label="Фото загружается"
          aria-valuenow={photo.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/72"
        >
          <span className="text-sm font-bold">{photo.progress}%</span>
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-skeleton-line">
            <span
              className="block h-full rounded-full bg-text transition-[width] duration-150"
              style={{ width: `${photo.progress}%` }}
            />
          </span>
        </div>
      ) : null}
    </div>
  )
}

function PhotoNotes({
  photo,
  problem,
  onRetry,
}: {
  photo: PhotoView
  problem: string | null
  onRetry: () => void
}) {
  return (
    <>
      {photo.upload === 'error' ? (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-item bg-danger-soft py-1.5 pr-1.5 pl-3 text-[13px] font-medium text-danger"
        >
          <AlertIcon size={16} className="flex-none" />
          <span className="flex-1">Не получилось загрузить фото</span>
          <button
            type="button"
            onClick={onRetry}
            className="h-8 flex-none cursor-pointer rounded-[10px] bg-surface px-3 text-[13px] font-bold text-danger shadow-[inset_0_0_0_1.5px_#f3c9c4]"
          >
            Повторить
          </button>
        </div>
      ) : null}
      {problem ? <ErrorLine text={problem} /> : null}
      {photo.small ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-item bg-[#fff6e5] px-3 py-2.5 text-[13px] font-medium text-[#8a5a00]"
        >
          <WarnIcon size={16} className="flex-none" />
          Фото маленькое — может быть нечётким
        </div>
      ) : null}
    </>
  )
}

function ErrorLine({ text }: { text: string }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-item bg-danger-soft px-3 py-2.5 text-[13px] font-medium text-danger"
    >
      <AlertIcon size={16} className="flex-none" />
      {text}
    </div>
  )
}

function ActionButton({
  icon,
  danger,
  compact,
  grow,
  onClick,
  children,
}: {
  icon: React.ReactNode
  danger?: boolean
  compact?: boolean
  /** в ряду кнопок — поровну ширины */
  grow?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[38px] cursor-pointer items-center gap-2 rounded-field text-sm font-semibold whitespace-nowrap ${
        compact ? 'flex-none justify-center px-2.5 text-[13px]' : 'px-3.5'
      } ${grow ? 'min-w-0 flex-1' : ''} ${
        danger
          ? 'bg-surface text-danger shadow-[inset_0_0_0_1.5px_#f3c9c4] hover:bg-danger-soft'
          : 'bg-bg text-text hover:bg-[#ebebe5]'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
