/**
 * FiltersContext - State partagé pour les filtres d'événements
 * 
 * Stocke uniquement le state des filtres partagé entre FilterBar et DiscoverPage.
 * La logique métier reste dans useFilters.
 */

import React, { createContext, useContext, useState, ReactNode } from 'react'
import type { UserResponseValue } from '@/types/fomoTypes'

export interface Filters {
  searchQuery: string
  customStartDate?: Date
  customEndDate?: Date
  tags: string[]
  organizerId: string | undefined
  responses: (UserResponseValue | 'all')[] // Multi-sélection comme tags
  showHiddenEvents?: boolean
  hideRejectedEvents: boolean
  excludePastEvents: boolean // Exclure les événements passés par défaut
}

interface FiltersContextType {
  filters: Filters
  setFilters: React.Dispatch<React.SetStateAction<Filters>>
}

const FiltersContext = createContext<FiltersContextType | undefined>(undefined)

export const FiltersProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [filters, setFilters] = useState<Filters>({
    searchQuery: '',
    tags: ['all'],
    organizerId: undefined,
    responses: ['all'], // Par défaut, toutes les réponses
    customStartDate: undefined,
    customEndDate: undefined,
    hideRejectedEvents: true,
    excludePastEvents: true, // Par défaut, exclure les événements passés
  })

  return (
    <FiltersContext.Provider value={{ filters, setFilters }}>
      {children}
    </FiltersContext.Provider>
  )
}

export const useFiltersContext = () => {
  const context = useContext(FiltersContext)
  if (!context) {
    throw new Error('useFiltersContext must be used within FiltersProvider')
  }
  return context
}

