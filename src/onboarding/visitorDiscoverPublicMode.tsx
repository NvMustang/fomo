/**
 * FOMO MVP - Visitor Discover Public Mode
 * 
 * Section 2 du parcours d'onboarding visitor : discoverPublicMode
 * S'affiche uniquement en mode public (après clic sur le toggle privacy)
 * Se termine au clic sur "S'inscrire sur FOMO"
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks'
import { Button } from '@/components'
import { WelcomeScreen } from './modals/WelcomeScreen'
import type { Event } from '@/types/fomoTypes'
import { onboardingTracker } from './utils/onboardingTracker'

interface VisitorDiscoverPublicModeProps {
    visitorRegistrationCompleted: boolean
    onFakeEventCardOpenedRef?: React.MutableRefObject<((event: Event) => void) | undefined>
}

/**
 * Section visitorDiscoverPublicMode
 * Gère la découverte du mode public après le clic sur le toggle privacy
 */
export const VisitorDiscoverPublicMode: React.FC<VisitorDiscoverPublicModeProps> = ({
    visitorRegistrationCompleted,
    onFakeEventCardOpenedRef
}) => {
    const { isPublicMode } = usePrivacy()
    const { isAuthenticated } = useAuth()
    const { showToast, hideToast, currentToast } = useToast()

    // Gérer showWelcomeScreen localement (plus besoin de le passer depuis le parent)
    const [showWelcomeScreen, setShowWelcomeScreen] = useState(false)

    // Logger les changements de showWelcomeScreen pour déboguer
    useEffect(() => {
        console.log('🟡 [VisitorDiscoverPublicMode] showWelcomeScreen changed:', showWelcomeScreen)
    }, [showWelcomeScreen])

    // Fermer automatiquement quand l'utilisateur s'authentifie
    useEffect(() => {
        if (isAuthenticated) {
            setShowWelcomeScreen(false)
        }
    }, [isAuthenticated])

    // États pour la section discoverFomo
    const [showRegistrationButton, setShowRegistrationButton] = useState(false)

    // Refs pour suivre l'état de la section
    const hasToggledPrivacyRef = useRef(false)
    const lastOpenedFakeEventCardIdRef = useRef<string | null>(null)
    const hasShownFakeEventsToastRef = useRef(false)
    const isFakeEventsToastActiveRef = useRef(false)

    // Activer le toggle privacy quand l'inscription est complétée
    // Appelé directement depuis le parent (visitorOnboarding) pour éviter un useEffect inutile

    // Fonction helper pour vérifier si le toast fake events est actif
    const isFakeEventsToast = useCallback((toast: typeof currentToast): boolean => {
        return toast?.title === 'Ces events te semblent FAKE ? 🤔' || isFakeEventsToastActiveRef.current
    }, [])

    // Étape 11: Attendre tap sur toggle privacy puis lancer zoom-out 10s
    useEffect(() => {
        if (!isPublicMode || hasToggledPrivacyRef.current || !visitorRegistrationCompleted) return

        hasToggledPrivacyRef.current = true
        // Ne pas fermer le toast si c'est le toast fake events
        if (!isFakeEventsToast(currentToast)) {
            hideToast() // Fermer toast Pssst
        }
        onboardingTracker.trackStep('privacy_toggled')

        // Toast "Bienvenu en mode public" après 1s (après le toggle privacy)
        // Ne pas afficher si le toast fake events est actif
        setTimeout(() => {
            if (!isFakeEventsToastActiveRef.current) {
                showToast({
                    title: '📍Bienvenu en mode public',
                    message: 'Maintenant, tu peux explorer la carte tranquillement, et voir les détails des événements, mais ça, tu sais déjà 😉',
                    type: 'info',
                    position: 'top',
                    duration: 10000 // Fermer automatiquement après 10 secondes
                })
                onboardingTracker.trackStep('exploration_toast_shown')
            }
        }, 1000) // 1s après le toggle privacy

        // Les fake pins sont maintenant toujours disponibles, filtrés automatiquement par getAllMapEvents selon isPublicMode

        // Lancer animation zoom-out 10s
        const targetZoom = 8
        const durationMs = 10000

        setTimeout(() => {
            onboardingTracker.trackStep('zoomout_started')
            if (window.startPublicModeSequence) {
                window.startPublicModeSequence(targetZoom, durationMs)
            }
            // Track zoom-out completed après la durée
            setTimeout(() => {
                onboardingTracker.trackStep('zoomout_completed')
            }, durationMs)
        }, 200)
    }, [isPublicMode, visitorRegistrationCompleted, showToast, hideToast, currentToast, isFakeEventsToast])

    // Plus besoin de useEffect : le filtrage des fake pins se fait automatiquement dans getAllMapEvents avec matchPublic()

    // Handler pour détecter l'ouverture de FakeEventCard
    const handleFakeEventCardOpened = useCallback((event: Event | null) => {
        if (!event) return

        const eventId = event.id
        const isFakeEvent = eventId && eventId.startsWith('fake-')

        if (!isFakeEvent) return

        // Ne traiter qu'une seule fois par fake event
        if (lastOpenedFakeEventCardIdRef.current === eventId) return
        lastOpenedFakeEventCardIdRef.current = eventId

        // Ne pas fermer le toast si c'est le toast fake events
        if (!isFakeEventsToast(currentToast)) {
            hideToast() // Fermer toast exploration
        }
        onboardingTracker.trackStep('fake_pin_clicked')
        onboardingTracker.trackStep('fake_eventcard_opened')

        // Étape 14: Toast fake events
        setTimeout(() => {
            if (hasShownFakeEventsToastRef.current) return

            isFakeEventsToastActiveRef.current = true
            showToast({
                title: 'Ces events te semblent FAKE ? 🤔',
                message: "C'est normal, ils le sont... C'était un test pour vérifier que tu maîtrises l'app. 💪 Maintenant que tu gères, il est temps de découvrir les VRAIS événements 🚀",
                type: 'info',
                position: 'top'
                // Pas de duration - attend le clic sur le bouton signup
            })

            hasShownFakeEventsToastRef.current = true
            onboardingTracker.trackStep('fake_events_toast_shown')

            // Afficher le bouton 4 secondes après l'affichage du toast
            setTimeout(() => {
                setShowRegistrationButton(true)
            }, 4000) // 4s après le toast
        }, 30000) // 30s après ouverture FakeEventCard
    }, [showToast, hideToast, currentToast, isFakeEventsToast])

    // Exposer handleFakeEventCardOpened via ref pour que visitorOnboarding puisse le passer à DiscoverPage
    useEffect(() => {
        if (onFakeEventCardOpenedRef) {
            onFakeEventCardOpenedRef.current = handleFakeEventCardOpened
        }
        return () => {
            if (onFakeEventCardOpenedRef) {
                onFakeEventCardOpenedRef.current = undefined
            }
        }
    }, [handleFakeEventCardOpened, onFakeEventCardOpenedRef])

    // ===== FIN DE LA SECTION : Clic sur "S'inscrire sur FOMO" =====
    // Étape 15: Clic sur bouton signup → ouvrir WelcomeScreen avec UserConnexionModal
    // UserConnexionModal vérifie l'email et redirige vers UserRegistrationModal si nécessaire
    const handleSignUpClick = useCallback(() => {
        // Fermer le toast "Ces events te semblent FAKE ?" uniquement ici
        isFakeEventsToastActiveRef.current = false
        hideToast() // Fermer le toast "Ces events te semblent FAKE ?"
        console.log('🔵 [VisitorDiscoverPublicMode] handleSignUpClick appelé, setShowWelcomeScreen(true)')
        setShowWelcomeScreen(true)
        onboardingTracker.trackStep('signup_clicked')
        onboardingTracker.trackStep('visitorDiscoverPublicMode_completed')
    }, [hideToast])

    // Rendre le WelcomeScreen via portail si nécessaire
    // Utiliser une clé pour forcer le remontage et déclencher les animations
    const welcomeScreenPortal = React.useMemo(() => {
        if (!showWelcomeScreen || typeof document === 'undefined') {
            return null
        }
        console.log('🟢 [VisitorDiscoverPublicMode] Creating WelcomeScreen portal, showWelcomeScreen:', showWelcomeScreen)
        return createPortal(
            <WelcomeScreen
                key={`welcome-screen-${Date.now()}`}
                partialHeight={true}
                showSpinner={false}
            />,
            document.body
        )
    }, [showWelcomeScreen])

    return (
        <>
            {/* Bouton "S'inscrire sur FOMO" - affiché dans visitorDiscoverPublicMode */}
            {showRegistrationButton && (
                <Button
                    variant="primary"
                    size="lg"
                    onClick={handleSignUpClick}
                    style={{
                        width: '70%',
                        position: 'fixed',
                        bottom: 'var(--md)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 'var(--z-index-modal)',
                        maxWidth: '360px',
                        animation: 'fadeIn 1s ease-in, buttonPulse 2s ease-in-out 2s infinite',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    <span className="map-teaser-text" data-size="xs">
                        <span className="map-teaser-word">S'inscrire sur F
                            <img
                                src="/globe-icon.svg"
                                alt="O"
                                style={{
                                    height: '1em',
                                    width: '1em',
                                    display: 'block',
                                    filter: 'brightness(0) invert(1)',
                                    transform: 'translateY(-0.05em)'
                                }}
                            />M
                            <img
                                src="/lock-icon.svg"
                                alt="O"
                                style={{
                                    height: '1em',
                                    width: '1em',
                                    display: 'block',
                                    filter: 'brightness(0) invert(1)',
                                    transform: 'translateY(-0.05em)'
                                }}
                            />
                        </span>
                    </span>
                </Button>
            )}
            {/* WelcomeScreen avec UserConnexionModal */}
            {/* UserConnexionModal vérifie l'email et redirige vers UserRegistrationModal si nécessaire */}
            {welcomeScreenPortal}
        </>
    )
}

