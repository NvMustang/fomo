/**
 * FOMO MVP - Visitor Onboarding
 * 
 * Composants et logique pour le parcours d'onboarding du mode visitor
 * Regroupe toute la logique d'onboarding pour alléger App.tsx
 */

import React, { useCallback, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { AppProviders } from '@/components/AppProviders'
import { useToast } from '@/hooks'
import { WelcomeScreen } from './modals/WelcomeScreen'
import DiscoverPage from '@/pages/DiscoverPage'
import { Header } from '@/components/ui/Header'
import type { Event } from '@/types/fomoTypes'
import { VisitorRegistrationModal } from './modals/VisitorRegistrationModal'
import { VisitorDiscoverPublicMode } from './visitorDiscoverPublicMode'
import { FomoDataProvider } from '@/contexts/FomoDataProvider'
import { Toast } from '@/components/ui/Toast'
import { PREDEFINED_FAKE_EVENTS } from '@/utils/fakeEventsData'
// Hooks d'onboarding
import { useLoadVisitorEvent } from './hooks/useLoadVisitorEvent'
import { useGetVisitorResponse } from './hooks/useGetVisitorResponse'
import { onboardingTracker } from './utils/onboardingTracker'

/**
 * Composant principal pour le mode visitor
 * Gère la détection du mode visitor, le FomoDataProvider, et le rendu conditionnel
 */
export const VisitorModeApp: React.FC<{
    children: React.ReactNode
}> = ({ children }) => {
    const { isAuthenticated } = useAuth()
    const { visitorEvent, isLoadingVisitorEvent, visitorEventError, isVisitorMode } = useLoadVisitorEvent()

    // Toast global - toujours disponible pour tous les modes
    const { currentToast, hideToast } = useToast()

    const hasError = !!visitorEventError
    const hasNoEvent = !visitorEvent && !isLoadingVisitorEvent

    // Ne pas afficher WelcomeScreen si l'utilisateur est authentifié (pour éviter le démontage de la carte)
    const shouldShowWelcomeScreen = !isAuthenticated && (isLoadingVisitorEvent || hasError || hasNoEvent)

    return (
        <FomoDataProvider visitorEvent={isVisitorMode ? visitorEvent : null}>
            {/* Si pas authentifié et pas mode visitor, afficher WelcomeScreen (qui contient UserConnexionModal) */}
            {!isAuthenticated && !isVisitorMode ? (
                <WelcomeScreen />
            ) : isVisitorMode ? (
        <AppProviders defaultPublicMode={false}>
            <VisitorOnboarding
                visitorEvent={visitorEvent}
                visitorEventError={visitorEventError}
            />
            {shouldShowWelcomeScreen && (
                <WelcomeScreen
                    showSpinner={isLoadingVisitorEvent && !hasError && !hasNoEvent}
                    cta={hasNoEvent ? {
                        label: 'Découvrir FOMO',
                        onClick: () => {
                            const base = window.location.origin
                            window.location.assign(`${base}/?event=evt_welcome_000000`)
                        }
                    } : undefined}
                />
            )}
        </AppProviders>
            ) : (
                children
            )}
            {/* Toast global - unique instance pour toute l'application */}
            <Toast toast={currentToast} onClose={hideToast} />
        </FomoDataProvider>
    )
}


/**
 * Orchestrateur du parcours d'onboarding visitor
 * Utilise les hooks spécialisés pour gérer chaque section du parcours
 */
const VisitorOnboarding: React.FC<{
    visitorEvent: Event | null
    visitorEventError: string | null
}> = ({ visitorEvent, visitorEventError }) => {
    const { isPublicMode, setToggleDisabled } = usePrivacy()
    const hasStartedFlyToRef = useRef(false)

    // Fake events directement depuis PREDEFINED_FAKE_EVENTS (plus besoin de useFakePins)
    const fakeEvents = PREDEFINED_FAKE_EVENTS

    // Étape 2: FlyTo vers l'événement (1s après chargement) - Commun aux deux cas
    // Déclenché avant le montage de l'EventCard pour une meilleure UX
    // Attend que la carte soit prête (window.centerMapOnEvent disponible)
    useEffect(() => {
        if (!visitorEvent || hasStartedFlyToRef.current) return

        const startFlyTo = () => {
            if (window.centerMapOnEvent && visitorEvent.venue) {
                hasStartedFlyToRef.current = true
                onboardingTracker.trackStep('flyto_started')
                // Lancer flyTo vers l'événement (3s)
                window.centerMapOnEvent(visitorEvent, 3000)
                // Track flyTo completed après 3s
                setTimeout(() => {
                    onboardingTracker.trackStep('flyto_completed')
                }, 3000)
                return true
            }
            return false
        }

        // Attendre 1s puis vérifier si la carte est prête
        const timer = setTimeout(() => {
            // Si la carte est déjà prête, déclencher immédiatement
            if (startFlyTo()) {
                return
            }

            // Sinon, vérifier périodiquement jusqu'à ce que la carte soit prête
            const checkInterval = setInterval(() => {
                if (startFlyTo()) {
                    clearInterval(checkInterval)
                }
            }, 100) // Vérifier toutes les 100ms

            // Nettoyer après 5s max (au cas où la carte ne serait jamais prête)
            setTimeout(() => {
                clearInterval(checkInterval)
            }, 5000)
        }, 1000) // 1s après chargement de l'événement

        return () => clearTimeout(timer)
    }, [visitorEvent])

    // Ref pour stocker getSelectedEvent depuis DiscoverPage
    const getSelectedEventRef = useRef<(() => Event | null) | null>(null)

    // Gérer la section 1 : getVisitorResponse
    const visitorResponse = useGetVisitorResponse({
        visitorEvent: visitorEvent!,
        setToggleDisabled,
        getSelectedEvent: () => getSelectedEventRef.current?.() || null,
        onAuthenticated: () => {
            // Callback appelé quand l'utilisateur s'authentifie
            // La logique de transition est gérée dans useGetVisitorResponse
        }
    })

    const isModalOpen = useCallback((_modalID: string): boolean => {
        // En mode visitor, aucun modal n'est ouvert
        return false
    }, [])

    if (visitorEventError || !visitorEvent) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <div style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)' }}>
                        {visitorEventError}
                    </p>
                </div>
            </div>
        )
    }

    // Extraire les valeurs du hook visitorResponse
    const { 
        responseButtonsDisabled, 
        responseHandlers, 
        visitorRegistrationCompleted, 
        handleEventCardClose, 
        onLabelClick,
        onEventCardOpened,
        onPinClick
    } = visitorResponse

    // Ref pour exposer handleFakeEventCardOpened depuis visitorDiscoverPublicMode
    const fakeEventCardOpenedRef = useRef<((event: Event) => void) | undefined>(undefined)

    // Activer le toggle privacy quand l'inscription est complétée (évite un useEffect dans visitorDiscoverPublicMode)
    useEffect(() => {
        if (visitorRegistrationCompleted) {
            setToggleDisabled(false)
        }
    }, [visitorRegistrationCompleted, setToggleDisabled])

    // Fermer l'EventCard avant que l'utilisateur quitte l'app (pour envoyer la réponse)
    useEffect(() => {
        const handleBeforeUnload = () => {
            // Fermer l'EventCard si elle est ouverte (pour envoyer la réponse)
            handleEventCardClose()
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload)
        }
    }, [handleEventCardClose])

    return (
        <div className={`app vmIntegrationFork ${isPublicMode ? 'public' : 'private'}`} data-fork="vmIntegrationFork">
            <Header />
            <main className="app-body">
                <DiscoverPage
                    isModalOpen={isModalOpen}
                    visitorMode={{
                        enabled: true,
                        event: visitorEvent,
                        fakeEvents,
                        onResponseClick: responseHandlers.handleVisitorResponseClick,
                        onEventCardClose: handleEventCardClose,
                        starsAnimation: responseHandlers.StarsAnimation,
                        responseButtonsDisabled,
                        onLabelClick,
                        onEventCardOpened,
                        onPinClick,
                        onFakeEventCardOpened: fakeEventCardOpenedRef.current,
                        getSelectedEvent: (getter) => {
                            getSelectedEventRef.current = getter
                        },
                    }}
                />
                {/* Modal visitor (visitorModal) - rendu tant qu'on est en mode visitor */}
                {visitorEvent && (
                    <>
                        <VisitorRegistrationModal
                            isOpen={responseHandlers.showVisitorModal}
                            onClose={responseHandlers.handleVisitorModalClose}
                            onConfirm={responseHandlers.handleVisitorModalConfirm}
                            organizerName={responseHandlers.organizerName}
                            responseType={responseHandlers.selectedResponseType || 'participe'}
                        />
                        {/* Animation étoiles pour visitor (affichée dans DiscoverPage) */}
                    </>
                )}
            </main>
            {/* Section visitorDiscoverPublicMode - s'affiche uniquement en mode public */}
                {isPublicMode && visitorRegistrationCompleted && (
                    <VisitorDiscoverPublicMode
                        visitorRegistrationCompleted={visitorRegistrationCompleted}
                        onFakeEventCardOpenedRef={fakeEventCardOpenedRef}
                />
            )}
            {/* NavBar masquée en mode visitor */}
        </div>
    )
}

