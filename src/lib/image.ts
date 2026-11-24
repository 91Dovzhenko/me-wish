// Фото желания в браузере: проверка файла, открытие, обрезка квадратом и сжатие (D-066, D-084).

/** Лимит исходного файла — 20 МБ (D-084). В Storage уходит сжатая копия. */
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024
/** Сторона итогового квадрата, px. */
export const PHOTO_SIDE = 800
/** Меньше этого по длинной стороне — предупреждение «Фото маленькое». */
export const SMALL_PHOTO_SIDE = 800
const QUALITY = 0.85

export type PhotoProblem = 'type' | 'size' | 'heic' | 'decode'

export const PHOTO_PROBLEM_TEXT: Record<PhotoProblem, string> = {
  type: 'Это не картинка. Выберите JPG, PNG или HEIC',
  size: 'Файл больше 20 МБ. Выберите фото поменьше',
  heic: 'Этот браузер не открывает HEIC. Выберите JPG или PNG либо откройте в Safari',
  decode: 'Не получилось открыть фото. Выберите другое',
}

const OK_TYPES = ['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/webp']
const HEIC_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']

function ext(name: string) {
  const m = /\.([a-z0-9]+)$/i.exec(name)
  return m ? m[1]!.toLowerCase() : ''
}

function isHeic(file: File) {
  return HEIC_TYPES.includes(file.type) || ['heic', 'heif'].includes(ext(file.name))
}

/** Проверка до открытия: только JPG, PNG, WEBP, HEIC и не больше 20 МБ. */
export function checkPhotoFile(file: File): PhotoProblem | null {
  const typeOk =
    OK_TYPES.includes(file.type) ||
    isHeic(file) ||
    // у файлов без типа (бывает при перетаскивании) смотрим на расширение
    (!file.type && ['jpg', 'jpeg', 'png', 'webp'].includes(ext(file.name)))
  if (!typeOk) return 'type'
  if (file.size > MAX_PHOTO_BYTES) return 'size'
  return null
}

export type OpenedPhoto = {
  /** адрес для <img> (object URL исходника) — освобождать через URL.revokeObjectURL */
  url: string
  img: HTMLImageElement
  width: number
  height: number
  small: boolean
}

/**
 * Открывает картинку средствами браузера (поворот по EXIF браузер учитывает сам).
 * HEIC: Safari (iPhone, Mac) открывает сам, а iPhone при выборе из галереи обычно и так отдаёт JPEG.
 * Chrome и Firefox HEIC не открывают — тогда понятная ошибка (без библиотеки-конвертера).
 */
export async function openPhoto(file: File): Promise<OpenedPhoto> {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
  try {
    await img.decode()
  } catch {
    URL.revokeObjectURL(url)
    throw new PhotoOpenError(isHeic(file) ? 'heic' : 'decode')
  }
  const width = img.naturalWidth
  const height = img.naturalHeight
  if (!width || !height) {
    URL.revokeObjectURL(url)
    throw new PhotoOpenError('decode')
  }
  return { url, img, width, height, small: Math.max(width, height) < SMALL_PHOTO_SIDE }
}

export class PhotoOpenError extends Error {
  problem: PhotoProblem
  constructor(problem: PhotoProblem) {
    super(PHOTO_PROBLEM_TEXT[problem])
    this.problem = problem
  }
}

/** Квадрат в пикселях исходника. */
export type CropRect = { x: number; y: number; size: number }

/** Квадрат по центру — если обрезку пропустили (на всякий случай). */
export function centerCrop(width: number, height: number): CropRect {
  const size = Math.min(width, height)
  return { x: (width - size) / 2, y: (height - size) / 2, size }
}

let webpSupport: boolean | null = null

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY))
}

/**
 * Вырезает квадрат и сжимает до 800×800 (аватар — до 400×400; меньше — если сам квадрат меньше, без растягивания).
 * Формат WEBP; Safari на iPhone WEBP не кодирует — тогда JPEG. Прозрачность — на белом фоне.
 */
export async function renderSquare(
  img: HTMLImageElement,
  crop: CropRect,
  maxSide: number = PHOTO_SIDE,
): Promise<{ blob: Blob; ext: 'webp' | 'jpg' }> {
  const side = Math.max(1, Math.min(maxSide, Math.round(crop.size)))
  const canvas = document.createElement('canvas')
  canvas.width = side
  canvas.height = side
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, side, side)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, side, side)

  if (webpSupport !== false) {
    const webp = await toBlob(canvas, 'image/webp')
    if (webp && webp.type === 'image/webp') {
      webpSupport = true
      canvas.width = canvas.height = 0
      return { blob: webp, ext: 'webp' }
    }
    webpSupport = false
  }
  const jpeg = await toBlob(canvas, 'image/jpeg')
  canvas.width = canvas.height = 0
  if (!jpeg) throw new Error('encode')
  return { blob: jpeg, ext: 'jpg' }
}

/** Первая картинка из буфера обмена или перетаскивания. */
export function firstImageFile(list: FileList | DataTransferItemList | null | undefined) {
  if (!list) return null
  for (let i = 0; i < list.length; i++) {
    const item = list[i]!
    const file = item instanceof File ? item : item.kind === 'file' ? item.getAsFile() : null
    if (file) return file
  }
  return null
}
