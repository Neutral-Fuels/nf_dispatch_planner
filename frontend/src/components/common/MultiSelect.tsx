import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '../../utils/cn'

export interface MultiSelectOption {
  value: string | number
  label: string
}

interface MultiSelectProps {
  label?: string
  error?: string
  options: MultiSelectOption[]
  value: (string | number)[]
  onChange: (value: (string | number)[]) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
}

export function MultiSelect({
  label,
  error,
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  required = false,
  className,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOptions = options.filter((opt) => value.includes(opt.value))

  const toggleOption = (optionValue: string | number) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue))
    } else {
      onChange([...value, optionValue])
    }
  }

  const removeOption = (optionValue: string | number, e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(value.filter((v) => v !== optionValue))
  }

  return (
    <div className={cn('w-full', className)} ref={containerRef}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}

      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            'flex min-h-[38px] w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm',
            'focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500',
            disabled && 'cursor-not-allowed bg-gray-100 text-gray-500',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500'
          )}
        >
          <div className="flex flex-wrap gap-1">
            {selectedOptions.length === 0 ? (
              <span className="text-gray-400">{placeholder}</span>
            ) : (
              selectedOptions.map((opt) => (
                <span
                  key={opt.value}
                  className="inline-flex items-center gap-1 rounded bg-primary-100 px-2 py-0.5 text-xs font-medium text-primary-700"
                >
                  {opt.label}
                  {!disabled && (
                    <X
                      className="h-3 w-3 cursor-pointer hover:text-primary-900"
                      onClick={(e) => removeOption(opt.value, e)}
                    />
                  )}
                </span>
              ))
            )}
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 flex-shrink-0 text-gray-400 transition-transform',
              isOpen && 'rotate-180'
            )}
          />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No options available</div>
            ) : (
              options.map((option) => {
                const isSelected = value.includes(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleOption(option.value)}
                    className={cn(
                      'flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50',
                      isSelected && 'bg-primary-50 text-primary-700'
                    )}
                  >
                    <span>{option.label}</span>
                    {isSelected && <Check className="h-4 w-4 text-primary-600" />}
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
    </div>
  )
}
