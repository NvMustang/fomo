/**
 * FOMO MVP - Date Picker Component (native input-based)
 *
 * Implémentation simple et fiable via input type="date"/"datetime-local".
 * - Affichage/édition en heure locale
 * - Conversion en Date lors du onChange
 */

import React from 'react'

interface FomoDatePickerProps {
    selected: Date | null
    onChange: (date: Date | null) => void
    showTimeSelect?: boolean
    dateFormat?: string
    timeFormat?: string
    placeholder?: string
    minDate?: Date
    maxDate?: Date
    disabled?: boolean
    name?: string
    required?: boolean
    className?: string
}

function pad2(value: number): string {
    return String(value).padStart(2, '0')
}

function toInputValue(date: Date | null, withTime: boolean): string {
    if (!date) return ''
    const year = date.getFullYear()
    const month = pad2(date.getMonth() + 1)
    const day = pad2(date.getDate())
    if (!withTime) return `${year}-${month}-${day}`
    const hours = pad2(date.getHours())
    const minutes = pad2(date.getMinutes())
    return `${year}-${month}-${day}T${hours}:${minutes}`
}

function parseInputValue(value: string): Date | null {
    if (!value) return null
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d
}

export const FomoDatePicker: React.FC<FomoDatePickerProps> = ({
    selected,
    onChange,
    showTimeSelect = false,
    placeholder = 'Sélectionner une date',
    minDate,
    maxDate,
    disabled = false,
    name,
    required = false,
    className
}) => {
    const type = showTimeSelect ? 'datetime-local' : 'date'
    const value = toInputValue(selected, showTimeSelect)
    const min = toInputValue(minDate ?? null, showTimeSelect)
    const max = toInputValue(maxDate ?? null, showTimeSelect)

    return (
        
            <input
                type={type}
                name={name}
                placeholder={placeholder}
                value={value}
                min={min || undefined}
                max={max || undefined}
                disabled={disabled}
                required={required}
                className={className}
                onChange={(e) => {
                    const nextDate = parseInputValue(e.target.value)
                    onChange(nextDate)
                }}
            />
       
    )
}

export default FomoDatePicker
