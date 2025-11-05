/**
 * FOMO MVP - Application Principale
 * Version stable avec écran de chargement séparé et AuthModal
 */

import { useState, useEffect, useCallback } from 'react'
import {
    NavBar,
    Header,
    CreateEventModal
} from '@/components'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { DeviceProvider, useDevice } from '@/contexts/DeviceContext'
import { PrivacyProvider, usePrivacy } from '@/contexts/PrivacyContext'
import { useFomoDataContext } from '@/contexts/FomoDataProvider'
import { FiltersProvider } from '@/contexts/FiltersContext'
import { WelcomeScreen } from '@/components'
import { VisitorIntegrationWrapper } from '@/components/visitorIntegration'

import CalendarPage from '@/pages/CalendarPage'
import ConversationPageComponent from '@/pages/ConversationPage'
import ProfilePageComponent from '@/pages/ProfilePage'
import DiscoverPage from '@/pages/DiscoverPage'
import DashboardPage from '@/pages/DashboardPage'


// App principal
export default function App() {
    return (
        <AuthProvider>
            <AppWithAuth />
        </AuthProvider>
    )
}

// Composant qui a accès à AuthContext - LOGIQUE SIMPLE
const AppWithAuth = () => {
    const { isAuthenticated } = useAuth()
    console.info('🔄 [App] AppWithAuth render', { isAuthenticated })

    // Toute la logique d'intégration visitor est centralisée dans VisitorIntegrationWrapper
    return (
        <VisitorIntegrationWrapper>
            <AppWithDataReady />
        </VisitorIntegrationWrapper>
    )
}


// Composant qui vérifie dataReady après authentification
const AppWithDataReady = () => {
    const { dataReady } = useFomoDataContext()

    // Si les données ne sont pas prêtes, afficher WelcomeScreen avec spinner
    if (!dataReady) {
        return <WelcomeScreen showSpinner={true} />
    }

    return <AppWithUser />
}

// Composant simple - SE REND SEULEMENT QUAND USER EST CONNECTÉ
const AppWithUser = () => {
    return (
        <DeviceProvider>
            <PrivacyProvider>
                <FiltersProvider>
                    <AppReady />
                </FiltersProvider>
            </PrivacyProvider>
        </DeviceProvider>
    )
}



// Composant qui vérifie dataReady - LOGIQUE SIMPLE
const AppReady = () => {
    const { dataReady } = useFomoDataContext()

    // === CHARGEMENT DES DONNÉES ===
    // Attendre que les données du backend soient chargées
    if (!dataReady) {
        console.info('⏳ [App] WelcomeScreen while data not ready')
        return <WelcomeScreen showSpinner={true} />
    }

    console.info('🚀 [App] Data and map ready')

    return <AppContent />
}

// Composant interne qui a accès au contexte FomoData - GÈRE SES PROPRES ÉTATS
const AppContent = ({ onMapReady }: { onMapReady?: () => void }) => {
    // === ÉTATS APP ===
    // Détecter la route depuis l'URL
    const getInitialPage = (): string => {
        const path = window.location.pathname
        if (path === '/dashboard') {
            return 'dashboard'
        }
        return 'map'
    }

    const [currentPage, setCurrentPage] = useState<string>(getInitialPage())
    const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState<boolean>(false)
    const [shouldSlideInNavBar, setShouldSlideInNavBar] = useState(false)
    
    // Callback pour réinitialiser la sélection d'événement depuis le profil
    const handleEventCentered = useCallback(() => {
        // La sélection est gérée par DiscoverPage via window.setSelectedEventFromProfile
        // Ce callback est appelé après le centrage pour nettoyer
    }, [])

    // Écouter les changements d'URL pour la navigation
    useEffect(() => {
        const handlePopState = () => {
            const path = window.location.pathname
            if (path === '/dashboard') {
                setCurrentPage('dashboard')
            } else if (path === '/') {
                setCurrentPage('map')
            }
        }

        window.addEventListener('popstate', handlePopState)
        return () => window.removeEventListener('popstate', handlePopState)
    }, [])

    // Détecter si l'utilisateur vient de s'authentifier (après signup)
    useEffect(() => {
        // Vérifier si on vient du mode visitor (signup récent)
        const hasJustSignedUp = sessionStorage.getItem('fomo-just-signed-up') === 'true'
        if (hasJustSignedUp) {
            setShouldSlideInNavBar(true)
            // Nettoyer le flag après animation
            setTimeout(() => {
                sessionStorage.removeItem('fomo-just-signed-up')
            }, 1000)
        }
    }, [])


    // ⚠️ TEMPORAIREMENT DÉSACTIVÉ - Toast qui suit le viewport
    // const { showToast, hideToast } = useToast()
    const { platformInfo } = useDevice()
    const { isPublicMode } = usePrivacy()

    // === GESTION SIMPLIFIÉE DU VIEWPORT ===
    // Surveillance uniquement sur smartphone (mobile)
    // ⚠️ ATTENTION: Ce useEffect cause 2 rerenders de DiscoverPage (testé le 2025-10-26)
    // Les dépendances [platformInfo?.isMobile, showToast, hideToast] déclenchent des rerenders
    // TODO: Optimiser pour éviter les rerenders inutiles
    useEffect(() => {
        // ⚠️ TEMPORAIREMENT DÉSACTIVÉ - Toast qui suit le viewport
        // Code commenté pour éviter les erreurs TypeScript
        // Décommenter et réactiver useToast() si besoin de réactiver cette fonctionnalité
        return undefined

        /* eslint-disable */
        /*
        const { showToast, hideToast } = useToast()
        console.log('🔄 [App] useEffect viewport monitoring - platformInfo:', platformInfo?.isMobile, 'visualViewport:', !!window.visualViewport)

        if (!platformInfo?.isMobile || !window.visualViewport) return

        let lastScrollY = window.scrollY
        let scrollCheckTimeout: number | null = null
        let viewportCheckTimeout: number | null = null
        let isScrollStable = true

        const checkScrollStability = () => {
            const currentScrollY = window.scrollY
            if (Math.abs(currentScrollY - lastScrollY) > 1) {
                isScrollStable = false
                lastScrollY = currentScrollY
                if (scrollCheckTimeout !== null) {
                    clearTimeout(scrollCheckTimeout)
                }
                scrollCheckTimeout = window.setTimeout(() => {
                    isScrollStable = true
                    checkViewport()
                }, 500)
            } else {
                isScrollStable = true
            }
        }

        const checkViewport = () => {
            const currentHeight = window.visualViewport?.height || 0
            const screenHeight = window.screen.height
            const heightPercentage = currentHeight / screenHeight
            const isViewportInRange = heightPercentage >= 0.70 && heightPercentage < 0.85

            if (!isViewportInRange) {
                hideToast()
                return
            }

            if (!isScrollStable) return

            if (viewportCheckTimeout !== null) {
                clearTimeout(viewportCheckTimeout)
            }

            viewportCheckTimeout = window.setTimeout(() => {
                const currentHeightCheck = window.visualViewport?.height || 0
                const screenHeightCheck = window.screen.height
                const heightPercentageCheck = currentHeightCheck / screenHeightCheck
                const isViewportInRangeCheck = heightPercentageCheck >= 0.70 && heightPercentageCheck < 0.85

                if (isViewportInRangeCheck && isScrollStable) {
                    showToast({
                        title: "💡 Conseil",
                        message: "Scroll up pour une meilleure UI",
                        type: "info",
                        duration: 5000
                    })
                } else {
                    hideToast()
                }
            }, 300)
        }

        const handleScroll = () => checkScrollStability()
        const handleViewportChange = () => checkViewport()

        const vp = window.visualViewport
        if (vp) {
            vp!.addEventListener('resize', handleViewportChange)
        }
        window.addEventListener('scroll', handleScroll, { passive: true })

        const initialTimeout = window.setTimeout(() => {
            checkViewport()
        }, 1000)

        return () => {
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', handleViewportChange)
            }
            window.removeEventListener('scroll', handleScroll)
            if (scrollCheckTimeout !== null) clearTimeout(scrollCheckTimeout)
            if (viewportCheckTimeout !== null) clearTimeout(viewportCheckTimeout)
            clearTimeout(initialTimeout)
        }
        */
    }, [platformInfo?.isMobile])



    // Fonction pour changer de page
    const handleNavClick = (page: string) => {
        console.info('🔄 [App] Navigation change', { from: currentPage, to: page })
        setCurrentPage(page)
        
        // Mettre à jour l'URL sans recharger la page
        if (page === 'dashboard') {
            window.history.pushState({}, '', '/dashboard')
        } else if (page === 'map') {
            window.history.pushState({}, '', '/')
        }
        
        // Réinitialiser l'événement sélectionné lors d'un changement de page manuel
        if (page !== 'map' && (window as any).setSelectedEventFromProfile) {
            // La sélection est gérée par DiscoverPage via window.setSelectedEventFromProfile
        }
    }

    // Exposer la fonction de navigation vers map pour LastActivities
    useEffect(() => {
        window.navigateToMapPage = () => {
            setCurrentPage('map')
        }
        return () => {
            delete (window as any).navigateToMapPage
        }
    }, [])

    // Gestion du modal de création d'événement
    const handleCreateEventClick = () => {
        setIsCreateEventModalOpen(prev => !prev)
    }

    const handleCloseCreateEventModal = () => {
        setIsCreateEventModalOpen(false)
    }

    // Fonction helper pour vérifier si un modal est ouvert (mémorisée avec useCallback)
    const isModalOpen = useCallback((modalID: string): boolean => {
        if (modalID === 'createEvent') {
            return isCreateEventModalOpen
        }
        return false
    }, [isCreateEventModalOpen])

    return (
        <div className={`app ${isPublicMode ? 'public' : 'private'}`}>
            <Header />
            <main className="app-body">
                {/* Rendre seulement la page active pour éviter les re-renders inutiles */}
                {currentPage === 'dashboard' && <DashboardPage />}
                {currentPage === 'map' && (
                    <DiscoverPage
                        isModalOpen={isModalOpen}
                        onMapReady={onMapReady}
                        onEventCentered={handleEventCentered}
                    />
                )}
                {currentPage === 'list' && <CalendarPage />}
                {currentPage === 'chat' && <ConversationPageComponent />}
                {currentPage === 'profil' && <ProfilePageComponent />}
            </main>
            <NavBar
                onCreateEventClick={handleCreateEventClick}
                onNavClick={handleNavClick}
                currentPage={currentPage}
                isCreateEventOpen={isCreateEventModalOpen}
                shouldSlideIn={shouldSlideInNavBar}
            />

            {/* Modal de création d'événement */}
            <CreateEventModal
                isOpen={isCreateEventModalOpen}
                onClose={handleCloseCreateEventModal}
            />
        </div>
    )
}
