/**
 * FOMO MVP - Application Principale
 * Version stable avec écran de chargement séparé et UserConnexionModal
 */

import React, { Suspense, lazy, ReactNode, useEffect } from 'react'
import {
    NavBar,
    Header,
    CreateEventModal
} from '@/components'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { usePrivacy, PrivacyProvider } from '@/contexts/PrivacyContext'
import { useDataContext, DataProvider } from '@/contexts/DataContext'
import { OnboardingStateProvider } from '@/contexts/OnboardingStateContext'
import { FiltersProvider } from '@/contexts/FiltersContext'
import { WelcomeScreen } from '@/components'
import { useNavigation, useModalManager, useToast } from '@/hooks'
import { Toast } from '@/components/ui/Toast'
import { DeviceProvider } from '@/contexts/DeviceContext'
import { ERROR_MESSAGES, ERROR_CTA } from '@/utils/errorMessages'

// Lazy loading des pages - chargées uniquement quand nécessaires
const CalendarPage = lazy(() => import('@/pages/CalendarPage'))
const ConversationPageComponent = lazy(() => import('@/pages/ConversationPage'))
const ProfilePageComponent = lazy(() => import('@/pages/ProfilePage'))
const DiscoverPage = lazy(() => import('@/pages/DiscoverPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const OnboardingPage = lazy(() => import('@/pages/OnboardingPage'))
const OnboardingFlow = lazy(() => import('@/onboarding/OnboardingFlow').then(module => ({ default: module.OnboardingFlow })))

/**
 * Wrapper qui combine DeviceProvider, PrivacyProvider, DataProvider, FiltersProvider et OnboardingStateProvider
 * 
 * Ordre des providers :
 * 1. DeviceProvider (aucune dépendance)
 * 2. PrivacyProvider (utilise useAuth() uniquement, doit être avant DataProvider)
 * 3. DataProvider (charge les données, utilise usePrivacy())
 * 4. FiltersProvider (state partagé pour les filtres, pas de dépendances)
 * 5. OnboardingStateProvider (utilise useDataContext())
 */
interface AppProvidersProps {
    children: ReactNode
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
    const { currentToast, hideToast } = useToast()

    return (
        <DeviceProvider>
            <PrivacyProvider>
                <DataProvider>
                    <FiltersProvider>
                        <OnboardingStateProvider>
                            {children}
                            {/* Toast notifications - disponible partout */}
                            <Toast toast={currentToast} onClose={hideToast} />
                        </OnboardingStateProvider>
                    </FiltersProvider>
                </DataProvider>
            </PrivacyProvider>
        </DeviceProvider>
    )
}

/**
 * Point d'entrée de l'application
 * Fournit uniquement le contexte d'authentification
 */
export default function App() {
    return (
        <AuthProvider>
            <AppWithAuth />
        </AuthProvider>
    )
}

/**
 * Composant qui a accès à AuthContext
 * 
 * TABLE DE DÉCISION DE ROUTAGE :
 * 
 * | isVisitor | isNewVisitor | hasEventParam | eventFromUrl.isPublic | Route          | Action                                    |
 * |-----------|--------------|---------------|----------------------|----------------|-------------------------------------------|
 * | true      | true         | true          | true                 | /              | Rediriger vers ?event=evt_tester_000000   |
 * | true      | true         | true          | false                | /              | OnboardingFlow avec centerOnEvent         |
 * | true      | true         | false         | -                    | /              | Rediriger vers ?event=evt_tester_000000  |
 * | true      | false        | true          | true                 | /              | Rediriger vers ?event=evt_tester_000000   |
 * | true      | false        | true          | false                | /              | OnboardingFlow avec centerOnEvent         |
 * | true      | false        | false         | -                    | /              | OnboardingFlow                            |
 * | true      | *            | *             | *                    | /visitor       | WelcomeScreen (modal connexion)           |
 * | true      | *            | *             | *                    | /exitonboarding | WelcomeScreen (modal connexion)           |
 * | false     | *            | true          | true                 | /              | AppContent avec centerOnEvent + mode public |
 * | false     | *            | true          | false                | /              | AppContent avec centerOnEvent + mode privé  |
 * | false     | *            | false         | -                    | /              | AppContent normal                         |
 */
const AppWithAuth = () => {
    const { user, isLoggingIn } = useAuth()

    console.info('🔄 [App] AppWithAuth render', {
        isVisitor: user.isVisitor,
        isNewVisitor: user.isNewVisitor,
        isLoggingIn,
        pathname: typeof window !== 'undefined' ? window.location.pathname : 'N/A'
    })

    // Détecter le pathname et les query params
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const hasEventParam = urlParams?.get('event') !== null
    const isExitOnboardingRoute = pathname === '/visitor' || pathname === '/exitonboarding'

    // Ne pas faire de redirections pendant la connexion (évite les race conditions)
    if (isLoggingIn) {
        return <WelcomeScreen showSpinner={true} loadingMessage="Connexion en cours..." />
    }

    // ===== VISITOR =====
    if (user.isVisitor) {
        // Route /visitor ou /exitonboarding → WelcomeScreen (modal connexion)
        if (isExitOnboardingRoute) {
            return (
                <WelcomeScreen
                    showSpinner={false}
                    onContinueAsVisitor={() => {
                        const base = window.location.origin
                        window.location.assign(`${base}/visitor`)
                    }}
                />
            )
        }

        // Visitor avec event → OnboardingFlow avec centerOnEvent
        if (hasEventParam) {
            return (
                <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><div className="spinner" /></div>}>
                    <AppProviders>
                        <OnboardingFlowWithData />
                    </AppProviders>
                </Suspense>
            )
        }

        // New visitor sans event → rediriger vers welcome event
        if (user.isNewVisitor) {
            const hasTriedWelcomeRedirect = sessionStorage.getItem('fomo-welcome-redirect-attempted')

            if (!hasTriedWelcomeRedirect) {
                try {
                    sessionStorage.setItem('fomo-welcome-redirect-attempted', 'true')
                } catch (e) {
                    // Ignorer si sessionStorage indisponible
                }
                const base = window.location.origin
                window.location.assign(`${base}/?event=evt_tester_000000`)
                return <WelcomeScreen showSpinner={true} loadingMessage="Redirection vers l'onboarding..." />
            } else {
                // Deuxième tentative = welcome event inexistant → afficher WelcomeScreen directement
                console.warn('⚠️ [App] Welcome event inexistant, affichage WelcomeScreen')
                try {
                    sessionStorage.removeItem('fomo-welcome-redirect-attempted')
                } catch (e) {
                    // Ignorer
                }
                return (
                    <WelcomeScreen
                        showSpinner={false}
                        onContinueAsVisitor={() => {
                            const base = window.location.origin
                            window.location.assign(`${base}/visitor`)
                        }}
                    />
                )
            }
        }

        // Visitor existant sans event → OnboardingFlow
        return (
            <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><div className="spinner" /></div>}>
                <AppProviders>
                    <OnboardingFlowWithData />
                </AppProviders>
            </Suspense>
        )
    }

    // ===== USER AUTHENTIFIÉ =====
    // User authentifié → AppContent (avec ou sans centerOnEvent selon hasEventParam)
    return (
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><div className="spinner" /></div>}>
            <AppProviders>
                <AppWithData />
            </AppProviders>
        </Suspense>
    )
}

/**
 * Helper pour déterminer le message d'erreur et le CTA appropriés selon le contexte
 */
const getErrorConfig = (
    eventFromUrlError: string | null,
    context: 'onboarding' | 'app' | 'default'
): { message: string; cta: typeof ERROR_CTA.eventNotFound | typeof ERROR_CTA.default } => {
    // Priorité 1 : Erreur spécifique de l'événement depuis l'URL (404)
    if (eventFromUrlError) {
        // Vérifier si c'est l'erreur eventNotFound (404)
        if (eventFromUrlError === ERROR_MESSAGES.eventNotFound) {
            return {
                message: eventFromUrlError,
                cta: ERROR_CTA.eventNotFound
            }
        }
        // Autre erreur d'événement → CTA par défaut
        return {
            message: eventFromUrlError,
            cta: ERROR_CTA.default
        }
    }

    // Priorité 2 : Message selon le contexte (pas d'erreur spécifique d'événement)
    let message: string
    switch (context) {
        case 'onboarding':
            message = ERROR_MESSAGES.eventLoad
            break
        case 'app':
            message = ERROR_MESSAGES.eventsLoad
            break
        default:
            message = ERROR_MESSAGES.dataLoad
    }

    return {
        message,
        cta: ERROR_CTA.default
    }
}

/**
 * Composant unifié pour gérer le chargement et les erreurs
 * Affiche WelcomeScreen avec spinner si les données ne sont pas prêtes
 * Affiche un message d'erreur si le chargement a échoué
 */
const DataReadyGuard = ({
    children,
    context = 'default'
}: {
    children: ReactNode
    context?: 'onboarding' | 'app' | 'default'
}) => {
    const { dataReady, eventsReady, hasError, eventFromUrlError } = useDataContext()

    // Si erreur de chargement, afficher message d'erreur avec CTA
    if (dataReady && hasError) {
        const { message, cta } = getErrorConfig(eventFromUrlError, context)
        return (
            <WelcomeScreen
                showSpinner={false}
                cta={{
                    label: cta.label,
                    message: message,
                    onClick: cta.onClick
                }}
            />
        )
    }

    // Si données pas encore prêtes OU events pas encore chargés, afficher spinner
    // eventsReady garantit que les events sont chargés avant d'afficher la carte
    if (!dataReady || !eventsReady) {
        return <WelcomeScreen showSpinner={true} loadingMessage="En train de mettre les petits plats dans les grands..." />
    }

    return <>{children}</>
}

/**
 * Composant qui vérifie que les données sont prêtes pour l'app principale
 */
const AppWithData = () => {
    return (
        <DataReadyGuard context="app">
            <AppWithProviders />
        </DataReadyGuard>
    )
}

/**
 * Composant qui vérifie que les données sont prêtes pour OnboardingFlow
 * Gère aussi la redirection si event public + nouveau visitor
 */
const OnboardingFlowWithData = () => {
    const { eventFromUrl } = useDataContext()
    const { user } = useAuth()

    // Si event public + visitor (nouveau ou existing) → rediriger vers welcome event en mode privé (plus sûr)
    useEffect(() => {
        if (!eventFromUrl) return

        const isPublic = eventFromUrl.isPublic
        if (isPublic) {
            console.log(`🔄 [App] Event public détecté pour ${user.isNewVisitor ? 'nouveau' : 'existing'} visitor → redirection vers welcome event en mode privé`)
            const base = window.location.origin
            window.location.assign(`${base}/?event=evt_tester_000000`)
        }
    }, [eventFromUrl, user.isNewVisitor])

    return (
        <DataReadyGuard context="onboarding">
            <OnboardingFlow />
        </DataReadyGuard>
    )
}

/**
 * Composant qui applique les providers communs (Device, Privacy, Filters)
 * Utilisé uniquement pour les utilisateurs authentifiés avec données prêtes
 * Note: AppProviders et DataProvider sont déjà appliqués au niveau supérieur
 */
const AppWithProviders = () => {
    return <AppContent />
}

// Composant interne qui a accès au contexte FomoData - GÈRE SES PROPRES ÉTATS
const AppContent = ({ onMapReady }: { onMapReady?: () => void }) => {
    // Navigation
    const { currentPage, navigate } = useNavigation()

    // Gestion des modals
    const { isCreateEventModalOpen, toggleCreateEventModal, closeCreateEventModal, isModalOpen } = useModalManager()

    const { user } = useAuth()
    const { isPublicMode, setIsPublicMode } = usePrivacy()
    const { eventFromUrl } = useDataContext()

    // Si user authentifié avec event dans l'URL → définir le mode privacy selon l'event
    useEffect(() => {
        if (user.isVisitor) return // Ne pas appliquer pour les visitors
        if (!eventFromUrl) return

        const shouldBePublic = eventFromUrl.isPublic ?? false
        if (isPublicMode !== shouldBePublic) {
            console.log(`🔄 [AppContent] Event ${eventFromUrl.isPublic ? 'public' : 'privé'} détecté → passage en mode ${shouldBePublic ? 'public' : 'privé'}`)
            setIsPublicMode(shouldBePublic)
        }
    }, [eventFromUrl, user.isVisitor, isPublicMode, setIsPublicMode])

    // Animations : si user authentifié (pas visitor), déclencher les animations
    const shouldSlideInNavBar = !user.isVisitor

    // Remettre le scroll en haut lors du changement de page
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' })
    }, [currentPage])

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
            {!user.isVisitor && (
                <NavBar
                    onCreateEventClick={toggleCreateEventModal}
                    onNavClick={handleNavClick}
                    currentPage={currentPage}
                    isCreateEventOpen={isCreateEventModalOpen}
                    shouldSlideIn={shouldSlideInNavBar}
                />
            )}

            {/* Modal de création d'événement */}
            <CreateEventModal
                isOpen={isCreateEventModalOpen}
                onClose={closeCreateEventModal}
            />
        </div>
    )
}
