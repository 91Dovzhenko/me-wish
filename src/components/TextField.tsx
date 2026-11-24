import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label: string
  /** красная звёздочка у подписи */
  requiredMark?: boolean
  /** текст ошибки под полем — поле подсвечено красным */
  error?: string
  /** что-то слева от поля в одну строку с ним (например, иконка списка) */
  before?: ReactNode
  /** крупный текст (16 px) — для главного поля формы */
  large?: boolean
}

/**
 * Поле ввода — Spec-Components «Поля»: обычное, в фокусе (чёрная рамка), с ошибкой, со звёздочкой.
 * Высота 50, скругление 14, рамка 1.5 px.
 */
const TextField = forwardRef<HTMLInputElement, Props>(function TextField(
  { label, requiredMark, error, before, large, className = '', id, ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="text-[13px] font-semibold">
        {label}
        {requiredMark ? (
          <>
            {' '}
            <span aria-hidden="true" className="text-[#d92d20]">
              *
            </span>
          </>
        ) : null}
      </label>
      <div className="flex items-center gap-2.5">
        {before}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`h-[50px] w-full min-w-0 flex-1 rounded-field border-[1.5px] px-3.5 text-text outline-none placeholder:text-text-3 ${
            // на телефоне всегда 16 px: при меньшем шрифте iOS увеличивает страницу при фокусе
            large ? 'text-base' : 'text-base lg:text-[15px]'
          } ${
            error ? 'border-[#d92d20] bg-[#fff7f6]' : 'border-border bg-surface focus:border-text'
          }`}
          {...rest}
        />
      </div>
      {error ? (
        <span id={errorId} className="text-[13px] text-danger">
          {error}
        </span>
      ) : null}
    </div>
  )
})

export default TextField
