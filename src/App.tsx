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
import { FomoDataProvider, useFomoDataContext } from '@/contexts/FomoDataProvider'
import { FiltersProvider } from '@/contexts/FiltersContext'
import { useToast } from '@/hooks'
import { Toast } from '@/components/ui/Toast'
import { WelcomeScreen } from '@/components'

import CalendarPage from '@/pages/CalendarPage'
import ConversationPageComponent from '@/pages/ConversationPage'
import ProfilePageComponent from '@/pages/ProfilePage'
import DiscoverPage from '@/pages/DiscoverPage'
import type { Event } from '@/types/fomoTypes'
import { getApiBaseUrl } from '@/config/env'


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
    const { user, isAuthenticated } = useAuth()
    console.log(`🔄 [App] Showing AppWithAuth - user: ${user?.id || 'none'}, isAuthenticated: ${isAuthenticated}`)

    // Détecter le mode visitor depuis l'URL
    const [visitorEventId, setVisitorEventId] = useState<string | null>(null)
    const [visitorEvent, setVisitorEvent] = useState<Event | null>(null)
    const [isLoadingVisitorEvent, setIsLoadingVisitorEvent] = useState(false)
    const [visitorEventError, setVisitorEventError] = useState<string | null>(null)

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search)
        const eventId = urlParams.get('event')
        if (eventId && !isAuthenticated) {
            setVisitorEventId(eventId)
        } else {
            setVisitorEventId(null)
        }
    }, [isAuthenticated])

    // Charger l'événement visitor si nécessaire
    useEffect(() => {
        if (!visitorEventId || isAuthenticated) {
            setVisitorEvent(null)
            setIsLoadingVisitorEvent(false)
            return
        }

        setIsLoadingVisitorEvent(true)
        setVisitorEventError(null)

        const loadVisitorEvent = async () => {
            try {
                const apiUrl = getApiBaseUrl()
                const response = await fetch(`${apiUrl}/events/${visitorEventId}`)
                if (!response.ok) {
                    throw new Error('Événement non trouvé')
                }
                const data = await response.json()
                if (data.success && data.data) {
                    setVisitorEvent(data.data)
                } else {
                    throw new Error('Format de réponse invalide')
                }
            } catch (error) {
                console.error('Erreur chargement événement visitor:', error)
                setVisitorEventError(error instanceof Error ? error.message : 'Erreur de chargement')
            } finally {
                setIsLoadingVisitorEvent(false)
            }
        }

        loadVisitorEvent()
    }, [visitorEventId, isAuthenticated])

    const isVisitorMode = visitorEventId !== null && !isAuthenticated

    // FomoDataProvider choisit automatiquement entre VisitorDataProvider et UserDataProvider
    return (
        <FomoDataProvider visitorEvent={isVisitorMode ? visitorEvent : null}>
            {/* Si pas authentifié et pas mode visitor, afficher WelcomeScreen (qui contient AuthModal) */}
            {!isAuthenticated && !isVisitorMode ? (
                <WelcomeScreen />
            ) : isVisitorMode ? (
                <VisitorModeApp
                    visitorEvent={visitorEvent}
                    isLoadingVisitorEvent={isLoadingVisitorEvent}
                    visitorEventError={visitorEventError}
                />
            ) : (
                <AppWithDataReady />
            )}
        </FomoDataProvider>
    )
}

// Composant pour le mode visitor
const VisitorModeApp = ({
    visitorEvent,
    isLoadingVisitorEvent,
    visitorEventError
}: {
    visitorEvent: Event | null
    isLoadingVisitorEvent: boolean
    visitorEventError: string | null
}) => {
    const [eventCardMounted, setEventCardMounted] = useState(false)

    // Afficher WelcomeScreen jusqu'à ce que EventCard soit monté
    if (isLoadingVisitorEvent || !visitorEvent || visitorEventError || !eventCardMounted) {
        return (
            <DeviceProvider>
                <PrivacyProvider defaultPublicMode={false}>
                    <FiltersProvider>
                        <VisitorModeContent
                            visitorEvent={visitorEvent}
                            visitorEventError={visitorEventError}
                            onEventCardMount={() => setEventCardMounted(true)}
                        />
                        <WelcomeScreen showSpinner={true} />
                    </FiltersProvider>
                </PrivacyProvider>
            </DeviceProvider>
        )
    }

    return (
        <DeviceProvider>
            <PrivacyProvider defaultPublicMode={false}>
                <FiltersProvider>
                    <VisitorModeContent
                        visitorEvent={visitorEvent}
                        visitorEventError={null}
                        onEventCardMount={() => setEventCardMounted(true)}
                    />
                </FiltersProvider>
            </PrivacyProvider>
        </DeviceProvider>
    )
}

// Contenu du mode visitor
const VisitorModeContent = ({
    visitorEvent,
    visitorEventError,
    onEventCardMount
}: {
    visitorEvent: Event | null
    visitorEventError: string | null
    onEventCardMount: () => void
}) => {
    const { isPublicMode } = usePrivacy()

    const isModalOpen = useCallback((_modalID: string): boolean => {
        // En mode visitor, aucun modal n'est ouvert
        return false
    }, [])

    if (visitorEventError || !visitorEvent) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)' }}>
                        {visitorEventError || 'Événement non trouvé'}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className={`app ${isPublicMode ? 'public' : 'private'}`}>
            <Header />
            <main className="app-body">
                <DiscoverPage
                    isModalOpen={isModalOpen}
                    isVisitorMode={true}
                    visitorEvent={visitorEvent}
                    onEventCardMount={onEventCardMount}
                />
            </main>
            {/* NavBar masquée en mode visitor */}
        </div>
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
        console.log('⏳ [App] Showing WelcomeScreen - data not ready')
        return <WelcomeScreen showSpinner={true} />
    }

    console.log('🚀 [App] Data and map ready, showing main app')

    return <AppContent />
}

// Composant interne qui a accès au contexte FomoData - GÈRE SES PROPRES ÉTATS
const AppContent = ({ onMapReady }: { onMapReady?: () => void }) => {
    // === ÉTATS APP ===
    const [currentPage, setCurrentPage] = useState<string>('map') // Démarre directement sur map
    const [isCreateEventModalOpen, setIsCreateEventModalOpen] = useState<boolean>(false)


    const { showToast, hideToast, currentToast } = useToast()
    const { platformInfo } = useDevice()
    const { isPublicMode } = usePrivacy()

    // === GESTION SIMPLIFIÉE DU VIEWPORT ===
    // Surveillance uniquement sur smartphone (mobile)
    // ⚠️ ATTENTION: Ce useEffect cause 2 rerenders de DiscoverPage (testé le 2025-10-26)
    // Les dépendances [platformInfo?.isMobile, showToast, hideToast] déclenchent des rerenders
    // TODO: Optimiser pour éviter les rerenders inutiles
    useEffect(() => {
        // ⚠️ TEMPORAIREMENT DÉSACTIVÉ - Toast qui suit le viewport
        return undefined

        // eslint-disable-next-line no-unreachable
        console.log('🔄 [App] useEffect viewport monitoring - platformInfo:', platformInfo?.isMobile, 'visualViewport:', !!window.visualViewport)

        if (!platformInfo?.isMobile || !window.visualViewport) return

        let lastScrollY = window.scrollY
        let scrollCheckTimeout: number | null = null
        let viewportCheckTimeout: number | null = null
        let isScrollStable = true

        // Vérifier si le scroll est stable (pas de changement de scrollY)
        const checkScrollStability = () => {
            const currentScrollY = window.scrollY
            if (Math.abs(currentScrollY - lastScrollY) > 1) {
                // Scroll en cours (même avec inertie)
                isScrollStable = false
                lastScrollY = currentScrollY

                // Réinitialiser le timeout pour attendre la fin du scroll
                if (scrollCheckTimeout !== null) {
                    clearTimeout(scrollCheckTimeout)
                }

                // Après 500ms sans changement de scrollY, considérer le scroll comme stable
                scrollCheckTimeout = window.setTimeout(() => {
                    isScrollStable = true
                    // Vérifier le viewport une fois le scroll stable
                    checkViewport()
                }, 500)
            } else {
                // Scroll stable
                isScrollStable = true
            }
        }

        const checkViewport = () => {
            const currentHeight = window.visualViewport?.height || 0
            const screenHeight = window.screen.height
            const heightPercentage = currentHeight / screenHeight

            // === GESTION DU TOAST DE SCROLL ===
            // Toast uniquement entre 70% et 85% et quand scroll stable
            // (clavier ouvert = < 70%, barre d'adresse cachée = > 85%)
            const isViewportInRange = heightPercentage >= 0.70 && heightPercentage < 0.85

            // Fermeture immédiate si le viewport sort de la plage (même pendant le scroll)
            if (!isViewportInRange) {
                hideToast()
                return
            }

            // Ouverture du toast uniquement si le scroll est stable
            if (!isScrollStable) return

            // Debounce uniquement pour l'ouverture du toast (évite les ouvertures/fermetures trop rapides)
            if (viewportCheckTimeout !== null) {
                clearTimeout(viewportCheckTimeout)
            }

            viewportCheckTimeout = window.setTimeout(() => {
                // Vérifier à nouveau que le viewport est toujours dans la plage
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

        const handleScroll = () => {
            checkScrollStability()
        }

        const handleViewportChange = () => {
            // Toujours vérifier le viewport (pour fermeture immédiate du toast)
            checkViewport()
        }

        // Setup des event listeners
        const vp = window.visualViewport
        if (vp) {
            // TypeScript strict mode: vp est vérifié non-null dans le if
            vp!.addEventListener('resize', handleViewportChange)
        }
        window.addEventListener('scroll', handleScroll, { passive: true })

        // Appel initial avec délai pour laisser le scroll se stabiliser
        const initialTimeout = window.setTimeout(() => {
            checkViewport()
        }, 1000)

        // Cleanup
        return () => {
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', handleViewportChange)
            }
            window.removeEventListener('scroll', handleScroll)
            if (scrollCheckTimeout !== null) clearTimeout(scrollCheckTimeout)
            if (viewportCheckTimeout !== null) clearTimeout(viewportCheckTimeout)
            clearTimeout(initialTimeout)
        }
    }, [platformInfo?.isMobile, showToast, hideToast])



    // Fonction pour changer de page
    const handleNavClick = (page: string) => {
        console.log('🔄 [App] Navigation: changing page from', currentPage, 'to', page)
        setCurrentPage(page)
    }

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
                {currentPage === 'map' && <DiscoverPage isModalOpen={isModalOpen} onMapReady={onMapReady} />}
                {currentPage === 'list' && <CalendarPage />}
                {currentPage === 'chat' && <ConversationPageComponent />}
                {currentPage === 'profil' && <ProfilePageComponent />}
            </main>
            <NavBar
                onCreateEventClick={handleCreateEventClick}
                onNavClick={handleNavClick}
                currentPage={currentPage}
                isCreateEventOpen={isCreateEventModalOpen}
            />

            {/* Modal de création d'événement */}
            <CreateEventModal
                isOpen={isCreateEventModalOpen}
                onClose={handleCloseCreateEventModal}
            />

            {/* Toast global */}
            <Toast toast={currentToast} onClose={hideToast} />
        </div>
    )
}
