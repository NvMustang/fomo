import React from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { isBefore, startOfDay } from 'date-fns'
import 'react-day-picker/dist/style.css'

interface DateRangePickerProps {
    /** Date de début sélectionnée */
    startDate?: Date
    /** Date de fin sélectionnée */
    endDate?: Date
    /** Callback appelé quand les dates changent */
    onDateChange: (startDate: Date | undefined, endDate: Date | undefined) => void
    /** Exclure les événements passés (désactive les dates passées si true) */
    excludePastEvents: boolean
    /** Callback appelé quand excludePastEvents change */
    onExcludePastEventsChange: (exclude: boolean) => void
}

/**
 * Composant de sélection de plage de dates
 * Utilise react-day-picker pour une UI moderne et légère
 */
export const DateRangePicker: React.FC<DateRangePickerProps> = ({
    startDate,
    endDate,
    onDateChange,
    excludePastEvents,
    onExcludePastEventsChange
}) => {
    const [range, setRange] = React.useState<DateRange | undefined>(
        startDate && endDate ? { from: startDate, to: endDate } : undefined
    )

    // Gestion de la sélection : 1er clic = début, 2ème clic = fin OU désélection si même date
    const handleSelect = (selectedRange: DateRange | undefined) => {
        if (!selectedRange) {
            setRange(undefined)
            return
        }

        const { from, to } = selectedRange

        // Si on clique sur la même date que "from" (2ème clic), désélectionner
        if (from && !to && range?.from && from.getTime() === range.from.getTime()) {
            setRange(undefined)
            return
        }

        // Sinon, mettre à jour la sélection (range en cours)
        if (from && to) {
            // Inverser si nécessaire pour que from < to
            const finalFrom = from > to ? to : from
            const finalTo = from > to ? from : to
            setRange({ from: finalFrom, to: finalTo })
            // Confirmer et fermer automatiquement après sélection complète
            onDateChange(finalFrom, finalTo)
        } else {
            // Première date seulement
            setRange({ from, to })
        }
    }

    // Fonction pour désactiver les dates passées si excludePastEvents est true
    const isDateDisabled = (date: Date): boolean => {
        if (excludePastEvents) {
            // Désactiver toutes les dates strictement avant aujourd'hui (permettre aujourd'hui)
            const today = startOfDay(new Date())
            const dateToCheck = startOfDay(date)
            return isBefore(dateToCheck, today)
        }
        return false
    }

    return (
        <div className="date-range-picker">
            <div className="date-range-picker__checkbox">
                <label className="date-range-picker__checkbox-label">
                    <input
                        type="checkbox"
                        checked={excludePastEvents}
                        onChange={(e) => onExcludePastEventsChange(e.target.checked)}
                        className="date-range-picker__checkbox-input"
                    />
                    <span className="date-range-picker__checkbox-text">
                        Exclure les événements passés
                    </span>
                </label>
            </div>
            <DayPicker
                mode="range"
                selected={range}
                onSelect={handleSelect}
                numberOfMonths={1}
                weekStartsOn={1}
                locale={undefined}
                disabled={isDateDisabled}
            />
        </div>
    )
}

