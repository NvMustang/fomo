/**
 * FOMO Data Provider - Wrapper intelligent
 * 
 * Choisit automatiquement entre VisitorDataProvider et UserDataProvider
 * selon le mode (visitor ou authentifié)
 */

import React, { ReactNode, useContext } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { UserDataProvider, FomoDataContextType, useUserDataContext } from './UserDataContext'
import { VisitorDataProvider, VisitorDataContext } from './VisitorDataContext'
import type { Event } from '@/types/fomoTypes'

// Réexporter le type pour faciliter les imports
export type { FomoDataContextType } from './UserDataContext'

interface FomoDataProviderProps {
    children: ReactNode
    visitorEvent?: Event | null // Optionnel : event pour mode visitor
}

/**
 * Provider intelligent qui choisit entre VisitorDataProvider et UserDataProvider
 */
export const FomoDataProvider: React.FC<FomoDataProviderProps> = ({ children, visitorEvent = null }) => {
    const { isAuthenticated } = useAuth()

    // Si on a un visitorEvent et qu'on n'est pas authentifié → mode visitor
    const isVisitorMode = visitorEvent !== null && !isAuthenticated

    if (isVisitorMode && visitorEvent) {
        return (
            <VisitorDataProvider visitorEvent={visitorEvent}>
                {children}
            </VisitorDataProvider>
        )
    }

    // Sinon → mode user (même si pas encore authentifié, on monte le provider)
    return (
        <UserDataProvider>
            {children}
        </UserDataProvider>
    )
}

/**
 * Hook unifié qui fonctionne avec VisitorDataContext et UserDataContext
 * 
 * VisitorDataContextType est compatible avec FomoDataContextType car :
 * - Les propriétés requises sont implémentées
 * - Les propriétés optionnelles sont présentes (même si ce sont des stubs)
 */
export const useFomoDataContext = (): FomoDataContextType => {
    // Essayer d'abord VisitorDataContext
    const visitorContext = useContext(VisitorDataContext)
    if (visitorContext !== undefined) {
        // VisitorDataContextType est compatible (sous-type) grâce aux propriétés optionnelles
        return visitorContext as FomoDataContextType
    }

    // Sinon utiliser UserDataContext
    return useUserDataContext()
}

