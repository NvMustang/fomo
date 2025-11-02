/**
 * FOMO MVP - Privacy Context
 *
 * Contexte pour la gestion de la confidentialité
 */

import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react'

// ===== TYPES =====
interface PrivacyContextType {
    isPublicMode: boolean
    togglePrivacy: () => void
}

// ===== CONTEXTE =====
export const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined)

// ===== PROPS =====
interface PrivacyProviderProps {
    children: ReactNode
    defaultPublicMode?: boolean // Permet de forcer une valeur par défaut (pour mode visitor par exemple)
}

// ===== PROVIDER =====
export const PrivacyProvider: React.FC<PrivacyProviderProps> = React.memo(({ children, defaultPublicMode }) => {
    // Fonction helper pour changer les variables CSS
    const updateCSSVariables = useCallback((isPublicMode: boolean) => {
        const root = document.documentElement
        root.style.setProperty('--current-color', isPublicMode ? 'var(--color-public)' : 'var(--color-private)')
        root.style.setProperty('--current-toggle-position', isPublicMode ? '50%' : '-50%')
    }, [])

    // Initialiser l'état depuis le localStorage ou utiliser defaultPublicMode si fourni
    const [isPublicMode, setIsPublicMode] = useState(() => {
        // Si defaultPublicMode est fourni, l'utiliser (ignorer localStorage)
        if (defaultPublicMode !== undefined) {
            return defaultPublicMode
        }
        // Sinon, charger depuis localStorage
        try {
            const savedPrivacy = localStorage.getItem('fomo-privacy')
            if (savedPrivacy !== null) {
                return JSON.parse(savedPrivacy)
            }
        } catch (error) {
            console.warn('Erreur lors du chargement de l\'état privacy:', error)
        }
        return true // Valeur par défaut
    })



    // Initialiser les variables CSS au démarrage et quand isPublicMode change
    useEffect(() => {
        updateCSSVariables(isPublicMode)
    }, [isPublicMode, updateCSSVariables])

    // Sauvegarder l'état dans le localStorage (en arrière-plan pour ne pas bloquer)
    useEffect(() => {
        // Délayer localStorage pour ne pas bloquer le changement visuel
        const timeoutId = setTimeout(() => {
            try {
                localStorage.setItem('fomo-privacy', JSON.stringify(isPublicMode))
            } catch (error) {
                console.warn('Erreur lors de la sauvegarde de l\'état privacy:', error)
            }
        }, 0)

        return () => clearTimeout(timeoutId)
    }, [isPublicMode])

    const togglePrivacy = useCallback(() => {
        const newIsPublicMode = !isPublicMode
        console.log('🎬 [PrivacyContext] Toggle privacy:', {
            from: isPublicMode,
            to: newIsPublicMode
        })
        setIsPublicMode(newIsPublicMode)
        updateCSSVariables(newIsPublicMode)
    }, [isPublicMode, updateCSSVariables])

    const value = {
        isPublicMode,
        togglePrivacy
    }

    return (
        <PrivacyContext.Provider value={value}>
            {children}
        </PrivacyContext.Provider>
    )
})

// ===== HOOK =====
export const usePrivacy = () => {
    const context = useContext(PrivacyContext)
    if (context === undefined) {
        throw new Error('usePrivacy must be used within a PrivacyProvider')
    }
    return context
}
