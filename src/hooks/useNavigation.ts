/**
 * Hook pour gérer la navigation entre les pages
 * 
 * Gère l'état de la page courante et la synchronisation avec l'URL
 */

import { useState, useEffect, useCallback } from 'react'

type Page = 'map' | 'dashboard' | 'onboarding' | 'list' | 'chat' | 'profil'

/**
 * Détecter la page initiale depuis l'URL
 */
function getInitialPage(): Page {
    const path = window.location.pathname
    if (path === '/analytics') {
        return 'dashboard'
    }
    if (path === '/onboarding') {
        return 'onboarding'
    }
    return 'map'
}

/**
 * Hook pour gérer la navigation
 */
export function useNavigation() {
    const [currentPage, setCurrentPage] = useState<Page>(getInitialPage())

    // Écouter les changements d'URL pour la navigation (bouton retour)
    useEffect(() => {
        const handlePopState = () => {
            const path = window.location.pathname
            if (path === '/analytics') {
                setCurrentPage('dashboard')
            } else if (path === '/onboarding') {
                setCurrentPage('onboarding')
            } else if (path === '/') {
                setCurrentPage('map')
            }
        }

        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [])

    // Fonction pour changer de page
    const navigate = useCallback((page: Page) => {
        console.info('🔄 [Navigation] Change page', { from: currentPage, to: page })
        setCurrentPage(page)

        // Mettre à jour l'URL sans recharger la page
        if (page === 'dashboard') {
            window.history.pushState({}, '', '/analytics')
        } else if (page === 'onboarding') {
            window.history.pushState({}, '', '/onboarding')
        } else if (page === 'map') {
            window.history.pushState({}, '', '/')
        }
    }, [currentPage])

    // Exposer la fonction de navigation vers map pour LastActivities
    useEffect(() => {
        window.navigateToMapPage = () => {
            navigate('map')
        }
        return () => {
            delete window.navigateToMapPage
        }
    }, [navigate])

    return {
        currentPage,
        navigate
    }
}

