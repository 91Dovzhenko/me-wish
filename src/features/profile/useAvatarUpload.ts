// Своё фото профиля (D-091): выбор → обрезка по кругу → сжатие до 400×400 → бакет avatars → profiles.avatar_path.
// Ограничения файла — как у фото желаний (D-084). Старый файл удаляется после успешного сохранения.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppData } from '../../data/AppData.tsx'
import {
  checkPhotoFile,
  openPhoto,
  PhotoOpenError,
  renderSquare,
  type CropRect,
  type OpenedPhoto,
  type PhotoProblem,
} from '../../lib/image.ts'
import { AVATAR_BUCKET, rememberLocalPhoto, removePhoto, uploadPhoto } from '../../lib/photos.ts'

export const AVATAR_SIDE = 400

type AvatarProblem = PhotoProblem | 'upload'

// Mobile-Profile-AvatarError: «Не получилось загрузить фото: файл больше 20 МБ. Выберите другое.»
const AVATAR_PROBLEM_TEXT: Record<AvatarProblem, string> = {
  type: 'это не картинка. Выберите JPG, PNG или HEIC.',
  size: 'файл больше 20 МБ. Выберите другое.',
  heic: 'этот браузер не открывает HEIC. Выберите JPG или PNG либо откройте в Safari.',
  decode: 'файл не открылся. Выберите другое.',
  upload: 'нет связи. Проверьте интернет и попробуйте ещё раз.',
}

export function useAvatarUpload() {
  const data = useAppData()
  const [cropping, setCropping] = useState<OpenedPhoto | null>(null)
  const [uploading, setUploading] = useState(false)
  const [problem, setProblem] = useState<AvatarProblem | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // исходник освобождаем, когда обрезка закрыта
  useEffect(() => {
    if (!cropping) return
    return () => URL.revokeObjectURL(cropping.url)
  }, [cropping])

  const pick = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = ''
      inputRef.current.click()
    }
  }, [])

  const onFile = useCallback(async (file: File | null | undefined) => {
    if (!file) return
    const bad = checkPhotoFile(file)
    if (bad) {
      setProblem(bad)
      return
    }
    try {
      const opened = await openPhoto(file)
      setProblem(null)
      setCropping(opened)
    } catch (e) {
      setProblem(e instanceof PhotoOpenError ? e.problem : 'decode')
    }
  }, [])

  const cancelCrop = useCallback(() => setCropping(null), [])

  const confirmCrop = useCallback(
    async (crop: CropRect) => {
      if (!cropping || data.status !== 'ready') return
      const { img } = cropping
      const userId = data.profile.id
      const oldPath = data.profile.avatarPath
      setUploading(true)
      setProblem(null)
      let path: string | null = null
      try {
        const { blob, ext } = await renderSquare(img, crop, AVATAR_SIDE)
        setCropping(null)
        path = `${userId}/${crypto.randomUUID()}.${ext}`
        await uploadPhoto(path, blob, () => {}, undefined, AVATAR_BUCKET)
        rememberLocalPhoto(path, blob, AVATAR_BUCKET)
        await data.updateProfile({ avatarPath: path })
        if (oldPath && oldPath !== path) removePhoto(oldPath, AVATAR_BUCKET)
      } catch (e) {
        console.warn('Не удалось загрузить фото профиля:', e)
        // файл загрузился, а профиль не сохранился — файл ни на что не ссылается
        if (path) removePhoto(path, AVATAR_BUCKET)
        setCropping(null)
        setProblem('upload')
      } finally {
        setUploading(false)
      }
    },
    [cropping, data],
  )

  return {
    inputRef,
    pick,
    onFile,
    cropping,
    cancelCrop,
    confirmCrop,
    uploading,
    error: problem ? `Не получилось загрузить фото: ${AVATAR_PROBLEM_TEXT[problem]}` : null,
    clearError: () => setProblem(null),
  }
}
