import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { getFirstErrorMessage } from '@/lib/forms'
import { cn } from '@/lib/utils'

interface StringFieldApi<TValue extends string = string> {
  state: {
    value: TValue
    meta: {
      errors?: Array<unknown>
    }
  }
  handleChange: (value: TValue) => void
  handleBlur: () => void
}

interface TextFieldProps<TValue extends string = string> extends Omit<
  ComponentPropsWithoutRef<'input'>,
  'name' | 'onBlur' | 'onChange' | 'value'
> {
  field: StringFieldApi<TValue>
  label: ReactNode
  labelClassName: string
  inputClassName?: string
  errorClassName?: string
  errorInputClassName?: string
}

interface TextAreaFieldProps<TValue extends string = string> extends Omit<
  ComponentPropsWithoutRef<'textarea'>,
  'name' | 'onBlur' | 'onChange' | 'value'
> {
  field: StringFieldApi<TValue>
  label: ReactNode
  labelClassName: string
  textareaClassName?: string
  errorClassName?: string
  errorInputClassName?: string
}

export function TextField<TValue extends string = string>({
  field,
  label,
  labelClassName,
  inputClassName = 'admin-field',
  errorClassName = 'mt-2 text-xs text-red-400',
  errorInputClassName = 'border-red-500/60 focus:border-red-500/80',
  type = 'text',
  ...inputProps
}: TextFieldProps<TValue>) {
  const error = getFirstErrorMessage(field.state.meta.errors)

  return (
    <div>
      <label className={labelClassName}>{label}</label>
      <input
        {...inputProps}
        type={type}
        value={field.state.value}
        onChange={(event) => field.handleChange(event.target.value as TValue)}
        onBlur={field.handleBlur}
        className={cn(inputClassName, error ? errorInputClassName : '')}
      />
      {error ? <p className={errorClassName}>{error}</p> : null}
    </div>
  )
}

export function TextAreaField<TValue extends string = string>({
  field,
  label,
  labelClassName,
  textareaClassName = 'admin-textarea',
  errorClassName = 'mt-2 text-xs text-red-400',
  errorInputClassName = 'border-red-500/60 focus:border-red-500/80',
  ...textareaProps
}: TextAreaFieldProps<TValue>) {
  const error = getFirstErrorMessage(field.state.meta.errors)

  return (
    <div>
      <label className={labelClassName}>{label}</label>
      <textarea
        {...textareaProps}
        value={field.state.value}
        onChange={(event) => field.handleChange(event.target.value as TValue)}
        onBlur={field.handleBlur}
        className={cn(textareaClassName, error ? errorInputClassName : '')}
      />
      {error ? <p className={errorClassName}>{error}</p> : null}
    </div>
  )
}
