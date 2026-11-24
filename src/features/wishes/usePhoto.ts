import { useCallback, useEffect, useRef, useState } from 'react'
import {
  checkPhotoFile,
  openPhoto,
  PHOTO_PROBLEM_TEXT,
  PhotoOpenError,
  renderSquare,
  type CropRect,
  type OpenedPhoto,
} from '../../lib/image.ts'
import {
  downloadPhoto,
  photoPath,
  removePhoto,
  UploadAbortedError,
  uploadPhoto,
} from '../../lib/photos.ts'

export type PhotoState = {
  /** исходник — для повторной обрезки */
  original: OpenedPhoto
  crop: CropRect
  /** сжатый квадрат 800×800 */
  blob: Blob
  previewUrl: string
  path: string
  upload: 'uploading' | 'done' | 'error'
  progress: number
}

type Cropping = { original: OpenedPhoto; initial: CropRect | null; isNew: boolean }

/**
 * Фото формы желания: выбор → обрезка → сжатие → загрузка в Storage сразу, пока заполняется форма.
 * Путь — <user_id>/<fileId>.webp|jpg; повторная обрезка и «Другое фото» перезаписывают его.
 * При добавлении fileId = id желания; при редактировании — новый id, чтобы не трогать сохранённое фото,
 * пока изменения не сохранены (старый файл удаляет форма после сохранения).
 * Если форму закрыли без сохранения — загруженный (новый) файл удаляется; сохранённое фото не трогается.
 *
 * savedPath — фото, которое уже есть у желания (редактирование). Его можно обрезать заново
 * (из сохранённого квадрата 800×800), заменить или убрать.
 */
export function usePhoto(userId: string, fileId: string, savedPath: string | null = null) {
  const [photo, setPhoto] = useState<PhotoState | null>(null)
  /** сохранённое фото, пока его не заменили и не убрали */
  const [saved, setSaved] = useState<string | null>(savedPath)
  const [problem, setProblem] = useState<string | null>(null)
  const [cropping, setCropping] = useState<Cropping | null>(null)
  const [opening, setOpening] = useState(false)
  const photoRef = useRef<PhotoState | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const seq = useRef(0)
  /** желание сохранено — файл больше не мусор */
  const keptRef = useRef(false)

  const update = useCallback((next: PhotoState | null) => {
    photoRef.current = next
    setPhoto(next)
  }, [])

  const startUpload = useCallback(
    (state: PhotoState) => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const my = ++seq.current
      update({ ...state, upload: 'uploading', progress: 0 })
      uploadPhoto(
        state.path,
        state.blob,
        (progress) => {
          if (my === seq.current && photoRef.current) update({ ...photoRef.current, progress })
        },
        ctrl.signal,
      )
        .then(() => {
          if (my === seq.current && photoRef.current)
            update({ ...photoRef.current, upload: 'done', progress: 100 })
        })
        .catch((e) => {
          if (e instanceof UploadAbortedError || my !== seq.current) return
          console.warn('Не удалось загрузить фото:', e)
          if (photoRef.current) update({ ...photoRef.current, upload: 'error' })
        })
    },
    [update],
  )

  /** Новый файл: проверка, открытие, затем обрезка. */
  const pickFile = useCallback(async (file: File) => {
    setProblem(null)
    const bad = checkPhotoFile(file)
    if (bad) {
      setProblem(PHOTO_PROBLEM_TEXT[bad])
      return
    }
    setOpening(true)
    try {
      const original = await openPhoto(file)
      setCropping({ original, initial: null, isNew: true })
    } catch (e) {
      setProblem(e instanceof PhotoOpenError ? e.message : PHOTO_PROBLEM_TEXT.decode)
    } finally {
      setOpening(false)
    }
  }, [])

  const confirmCrop = useCallback(
    async (crop: CropRect) => {
      const c = cropping
      if (!c) return
      setCropping(null)
      let rendered: Awaited<ReturnType<typeof renderSquare>>
      try {
        rendered = await renderSquare(c.original.img, crop)
      } catch (e) {
        console.warn('Не удалось обработать фото:', e)
        if (c.isNew) URL.revokeObjectURL(c.original.url)
        setProblem(PHOTO_PROBLEM_TEXT.decode)
        return
      }
      const prev = photoRef.current
      const path = photoPath(userId, fileId, rendered.ext)
      setSaved(null)
      if (prev) {
        URL.revokeObjectURL(prev.previewUrl)
        if (c.isNew && prev.original !== c.original) URL.revokeObjectURL(prev.original.url)
        // формат тот же — файл перезапишется; другой — старый удаляем
        if (prev.path !== path) {
          abortRef.current?.abort()
          removePhoto(prev.path)
        }
      }
      startUpload({
        original: c.original,
        crop,
        blob: rendered.blob,
        previewUrl: URL.createObjectURL(rendered.blob),
        path,
        upload: 'uploading',
        progress: 0,
      })
    },
    [cropping, userId, fileId, startUpload],
  )

  const cancelCrop = useCallback(() => {
    setCropping((c) => {
      // отмена первой обрезки — фото не выбрано
      if (c?.isNew && c.original !== photoRef.current?.original) URL.revokeObjectURL(c.original.url)
      return null
    })
  }, [])

  /** «Обрезать» — снова обрезка исходника с прошлой рамкой; у сохранённого фото — обрезка сохранённого квадрата. */
  const recrop = useCallback(async () => {
    const p = photoRef.current
    if (p) {
      setCropping({ original: p.original, initial: p.crop, isNew: false })
      return
    }
    if (!saved) return
    setProblem(null)
    setOpening(true)
    try {
      const blob = await downloadPhoto(saved)
      const original = await openPhoto(new File([blob], 'photo', { type: blob.type }))
      setCropping({ original, initial: null, isNew: true })
    } catch (e) {
      console.warn('Не удалось открыть фото:', e)
      setProblem('Не получилось открыть фото — проверьте интернет')
    } finally {
      setOpening(false)
    }
  }, [saved])

  const retry = useCallback(() => {
    const p = photoRef.current
    if (p) startUpload(p)
  }, [startUpload])

  /** «Удалить фото». Сохранённое фото удаляется из Storage только после сохранения формы. */
  const remove = useCallback(() => {
    const p = photoRef.current
    if (!p) {
      setSaved(null)
      setProblem(null)
      return
    }
    seq.current++
    abortRef.current?.abort()
    removePhoto(p.path)
    URL.revokeObjectURL(p.previewUrl)
    URL.revokeObjectURL(p.original.url)
    update(null)
    setProblem(null)
  }, [update])

  /** После сохранения желания: файл остаётся в Storage. */
  const keep = useCallback(() => {
    keptRef.current = true
  }, [])

  // Форму закрыли без сохранения — убираем загруженный файл и освобождаем память
  useEffect(
    () => () => {
      const p = photoRef.current
      if (!p) return
      if (!keptRef.current) {
        seq.current++
        abortRef.current?.abort()
        removePhoto(p.path)
      }
      URL.revokeObjectURL(p.original.url)
      URL.revokeObjectURL(p.previewUrl)
    },
    [],
  )

  return {
    photo,
    problem,
    cropping,
    opening,
    pickFile,
    confirmCrop,
    cancelCrop,
    recrop,
    retry,
    remove,
    keep,
    /** сохранённое фото (редактирование), пока его не заменили и не убрали */
    saved,
    /** путь, который запишется в желание */
    finalPath: photo?.path ?? saved,
    /** можно сохранять: фото нет или оно загружено */
    ready: !photo || photo.upload === 'done',
  }
}
