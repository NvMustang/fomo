/**
 * FOMO MVP - Privacy Context
 *
 * Contexte pour la gestion de la confidentialité
 * Lit le mode visitor depuis AuthContext pour déterminer l'état initial
 */

import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react'
import { useAuth } from './AuthContext'

// ===== TYPES =====
interface PrivacyContextType {
    isPublicMode: boolean
    setIsPublicMode: (isPublic: boolean) => void
    togglePrivacy: () => void
    isToggleDisabled: boolean
    setToggleDisabled: (disabled: boolean) => void
}

// ===== CONTEXTE =====
export const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined)

// ===== PROPS =====
interface PrivacyProviderProps {
    children: ReactNode
}

// ===== PROVIDER =====
export const PrivacyProvider: React.FC<PrivacyProviderProps> = React.memo(({ children }) => {
    const { user } = useAuth()

    // Fonction helper pour changer les variables CSS
    const updateCSSVariables = useCallback((isPublicMode: boolean) => {
        const root = document.documentElement
        root.style.setProperty('--current-color', isPublicMode ? 'var(--color-public)' : 'var(--color-private)')
        root.style.setProperty('--current-toggle-position', isPublicMode ? '50%' : '-50%')
    }, [])

    // Initialiser l'état depuis le localStorage ou mode visitor
    const [isPublicMode, setIsPublicMode] = useState(() => {
        // Visitors commencent en mode private (false) par défaut
        if (user.isVisitor) {
            console.log('🔍 [PrivacyContext] Visitor détecté: mode private par défaut')
            return false
        }

        // Users authentifiés: charger depuis localStorage
        try {
            const savedPrivacy = localStorage.getItem('fomo-privacy')
            if (savedPrivacy !== null) {
                const parsed = JSON.parse(savedPrivacy)
                console.log('🔍 [PrivacyContext] User authentifié: chargement localStorage:', parsed)
                return parsed
            }
        } catch (error) {
            console.warn('Erreur lors du chargement de l\'état privacy:', error)
        }

        // Valeur par défaut pour users authentifiés: public (true)
        console.log('🔍 [PrivacyContext] User authentifié: mode public par défaut')
        return true
    })

    // État pour désactiver le toggle (peut être contrôlé depuis l'extérieur via setToggleDisabled)
    const [isToggleDisabled, setIsToggleDisabled] = useState(false)

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
        // Ne pas permettre le toggle si désactivé
        if (isToggleDisabled) {
            return
        }

        // Fermer l'EventCard avant de toggle (pour envoyer la réponse si elle est ouverte)
        if (window.__closeEventCard) {
            window.__closeEventCard()
        }

        const newIsPublicMode = !isPublicMode
        console.log('🎬 [PrivacyContext] Toggle privacy:', {
            from: isPublicMode,
            to: newIsPublicMode,
            stackTrace: new Error().stack
        })
        setIsPublicMode(newIsPublicMode)
        updateCSSVariables(newIsPublicMode)
    }, [isPublicMode, updateCSSVariables, isToggleDisabled])

    const setToggleDisabled = useCallback((disabled: boolean) => {
        setIsToggleDisabled(disabled)
    }, [])

    const value = {
        isPublicMode,
        setIsPublicMode,
        togglePrivacy,
        isToggleDisabled,
        setToggleDisabled
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
