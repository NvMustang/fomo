/**
 * FOMO MVP - App Providers Wrapper
 * 
 * Encapsule la chaîne commune de providers (DeviceProvider + PrivacyProvider + FiltersProvider)
 * pour éviter la duplication entre AppWithUser et VisitorModeApp
 * 
 * Garde la séparation des providers pour faciliter le debug
 */

import React, { ReactNode } from 'react'
import { DeviceProvider } from '@/contexts/DeviceContext'
import { PrivacyProvider } from '@/contexts/PrivacyContext'
import { FiltersProvider } from '@/contexts/FiltersContext'

interface AppProvidersProps {
    children: ReactNode
    /**
     * Valeur par défaut pour le mode public/privé
     * Utilisé en mode visitor pour forcer le mode privé initialement
     */
    defaultPublicMode?: boolean
}

/**
 * Wrapper qui combine DeviceProvider, PrivacyProvider et FiltersProvider
 * 
 * Ordre des providers :
 * 1. DeviceProvider (aucune dépendance)
 * 2. PrivacyProvider (aucune dépendance, mais peut recevoir defaultPublicMode)
 * 3. FiltersProvider (dépend de useFomoDataContext, useAuth, usePrivacy)
 */
export const AppProviders: React.FC<AppProvidersProps> = ({ children, defaultPublicMode }) => {
    return (
        <DeviceProvider>
            <PrivacyProvider defaultPublicMode={defaultPublicMode}>
                <FiltersProvider>
                    {children}
                </FiltersProvider>
            </PrivacyProvider>
        </DeviceProvider>
    )
}

