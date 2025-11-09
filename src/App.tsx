/**
 * FOMO MVP - Application Principale
 * Version stable avec écran de chargement séparé et UserConnexionModal
 */

import { useState, useEffect, useRef, Suspense, lazy } from 'react'
import {
    NavBar,
    Header,
    CreateEventModal
} from '@/components'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { useFomoDataContext } from '@/contexts/FomoDataProvider'
import { WelcomeScreen } from '@/components'
import { AppProviders } from '@/components/AppProviders'
import { useNavigation, useModalManager } from '@/hooks'

// Lazy loading des pages - chargées uniquement quand nécessaires
const CalendarPage = lazy(() => import('@/pages/CalendarPage'))
const ConversationPageComponent = lazy(() => import('@/pages/ConversationPage'))
const ProfilePageComponent = lazy(() => import('@/pages/ProfilePage'))
const DiscoverPage = lazy(() => import('@/pages/DiscoverPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'))
const BookmarkletPage = lazy(() => import('@/pages/BookmarkletPage'))
const BookmarkletReceiverPage = lazy(() => import('@/pages/BookmarkletReceiverPage'))
const VisitorModeApp = lazy(() => import('@/onboarding/visitorOnboarding').then(module => ({ default: module.VisitorModeApp })))


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

    // Toute la logique d'intégration visitor est centralisée dans VisitorModeApp
    return (
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><div className="spinner" /></div>}>
            <VisitorModeApp>
                <AppWithDataReady />
            </VisitorModeApp>
        </Suspense>
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
        <AppProviders>
            <AppContent />
        </AppProviders>
    )
}

// Composant interne qui a accès au contexte FomoData - GÈRE SES PROPRES ÉTATS
const AppContent = ({ onMapReady }: { onMapReady?: () => void }) => {
    // Navigation
    const { currentPage, navigate } = useNavigation()

    // Gestion des modals
    const { isCreateEventModalOpen, toggleCreateEventModal, closeCreateEventModal, isModalOpen } = useModalManager()

    // État pour les animations
    const [shouldSlideInNavBar, setShouldSlideInNavBar] = useState(false)


    const { dataReady } = useFomoDataContext()
    const { isAuthenticated } = useAuth()
    const hasTriggeredAnimationsRef = useRef(false)

    // Détecter quand l'app est prête (dataReady) et déclencher les animations d'entrée
    useEffect(() => {
        // Ne déclencher que si l'utilisateur est authentifié, les données sont prêtes, et qu'on est sur la page map
        if (isAuthenticated && dataReady && currentPage === 'map' && !hasTriggeredAnimationsRef.current) {
            hasTriggeredAnimationsRef.current = true

            // Séquence d'animations
            // 1. Slide-up NavBar (1s) - démarre immédiatement
            try {
                sessionStorage.setItem('fomo-just-signed-up', 'true')
                setShouldSlideInNavBar(true)
            } catch { }

            // 2. Pop FilterBar (0.4s) - démarre après navbar (1000ms = durée navbar)
            setTimeout(() => {
                try {
                    sessionStorage.setItem('fomo-pop-filterbar', 'true')
                } catch { }
            }, 1000)
        }
    }, [isAuthenticated, dataReady, currentPage])

    // Détecter si l'utilisateur vient de s'authentifier (après signup depuis visitor mode)
    useEffect(() => {
        // Vérifier si on vient du mode visitor (signup récent)
        const hasJustSignedUp = sessionStorage.getItem('fomo-just-signed-up') === 'true'
        if (hasJustSignedUp && !hasTriggeredAnimationsRef.current) {
            setShouldSlideInNavBar(true)
            // Nettoyer le flag après animation
            setTimeout(() => {
                sessionStorage.removeItem('fomo-just-signed-up')
            }, 1000)
        }
    }, [])


    const { isPublicMode } = usePrivacy()



    // Handler pour la navigation
    const handleNavClick = (page: string) => {
        navigate(page as Parameters<typeof navigate>[0])
    }

    return (
        <div className={`app ${isPublicMode ? 'public' : 'private'}`}>
            <Header />
            <main className="app-body">
                {/* Rendre seulement la page active pour éviter les re-renders inutiles */}
                {/* Suspense pour chaque page avec fallback minimal */}
                <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><div className="spinner" /></div>}>
                    {currentPage === 'dashboard' && <DashboardPage />}
                    {currentPage === 'onboarding' && <OnboardingPage />}
                    {currentPage === 'bookmarklet' && <BookmarkletPage />}
                    {currentPage === 'bookmarklet-receiver' && <BookmarkletReceiverPage />}
                    {currentPage === 'map' && (
                        <DiscoverPage
                            isModalOpen={isModalOpen}
                            onMapReady={onMapReady}
                        />
                    )}
                    {currentPage === 'list' && <CalendarPage />}
                    {currentPage === 'chat' && <ConversationPageComponent />}
                    {currentPage === 'profil' && <ProfilePageComponent />}
                </Suspense>
            </main>
            <NavBar
                onCreateEventClick={toggleCreateEventModal}
                onNavClick={handleNavClick}
                currentPage={currentPage}
                isCreateEventOpen={isCreateEventModalOpen}
                shouldSlideIn={shouldSlideInNavBar}
            />

            {/* Modal de création d'événement */}
            <CreateEventModal
                isOpen={isCreateEventModalOpen}
                onClose={closeCreateEventModal}
            />
        </div>
    )
}
