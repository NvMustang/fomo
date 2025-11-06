/**
 * FOMO MVP - Visitor Integration
 * 
 * Composants et logique pour l'intégration du mode visitor
 * Regroupe toute la logique d'intégration pour alléger App.tsx
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/contexts/AuthContext'
import { DeviceProvider } from '@/contexts/DeviceContext'
import { PrivacyProvider, usePrivacy } from '@/contexts/PrivacyContext'
import { FiltersProvider } from '@/contexts/FiltersContext'
import { useToast } from '@/hooks'
import { WelcomeScreen } from '@/components'
import DiscoverPage from '@/pages/DiscoverPage'
import { Header } from '@/components'
import { getApiBaseUrl } from '@/config/env'
import type { Event, UserResponseValue } from '@/types/fomoTypes'
import { VisitorNameModal } from '@/components/modals/VisitorNameModal'
import { SignUpModal } from '@/components/modals/SignUpModal'
import { useFomoDataContext, FomoDataProvider } from '@/contexts/FomoDataProvider'
import { getUser } from '@/utils/filterTools'
import { Toast } from '@/components/ui/Toast'
import { PREDEFINED_FAKE_EVENTS } from '@/utils/fakeEventsData'
import { getPexelsImages } from '@/utils/pexelsService'

/**
 * Hook pour gérer l'intégration du mode visitor
 * Détecte l'eventId depuis l'URL et charge l'événement
 */
export function useVisitorIntegration() {
    const { isAuthenticated } = useAuth()
    const [visitorEventId, setVisitorEventId] = useState<string | null>(null)
    const [visitorEvent, setVisitorEvent] = useState<Event | null>(null)
    const [isLoadingVisitorEvent, setIsLoadingVisitorEvent] = useState(false)
    const [visitorEventError, setVisitorEventError] = useState<string | null>(null)

    // Détecter le mode visitor depuis l'URL
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

    return {
        visitorEvent,
        isLoadingVisitorEvent,
        visitorEventError,
        isVisitorMode
    }
}

/**
 * Wrapper centralisé pour toute la logique d'intégration visitor
 * Gère la détection du mode visitor, le FomoDataProvider, et le rendu conditionnel
 */
export const VisitorIntegrationWrapper: React.FC<{
    children: React.ReactNode
}> = ({ children }) => {
    const { isAuthenticated } = useAuth()
    const { visitorEvent, isLoadingVisitorEvent, visitorEventError, isVisitorMode } = useVisitorIntegration()

    // Toast global - toujours disponible pour tous les modes
    const { currentToast, hideToast } = useToast()

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
                children
            )}
            {/* Toast global - unique instance pour toute l'application */}
            <Toast toast={currentToast} onClose={hideToast} />
        </FomoDataProvider>
    )
}

/**
 * Composant pour le mode visitor
 */
export const VisitorModeApp: React.FC<{
    visitorEvent: Event | null
    isLoadingVisitorEvent: boolean
    visitorEventError: string | null
}> = ({ visitorEvent, isLoadingVisitorEvent, visitorEventError }) => {
    const { isAuthenticated } = useAuth()
    const hasError = !!visitorEventError
    const hasNoEvent = !visitorEvent && !isLoadingVisitorEvent

    // Ne pas afficher WelcomeScreen si l'utilisateur est authentifié (pour éviter le démontage de la carte)
    const shouldShowWelcomeScreen = !isAuthenticated && (isLoadingVisitorEvent || hasError || hasNoEvent)

    return (
        <DeviceProvider>
            <PrivacyProvider defaultPublicMode={false}>
                <FiltersProvider>
                    <VisitorModeContent
                        visitorEvent={visitorEvent}
                        visitorEventError={visitorEventError}
                    />
                    {shouldShowWelcomeScreen && (
                        <WelcomeScreen
                            showSpinner={isLoadingVisitorEvent && !hasError && !hasNoEvent}
                            message={
                                isLoadingVisitorEvent
                                    ? 'Chargement...'
                                    : hasNoEvent
                                        ? "Oups... L'événement recherché n'existe plus ou est hors-ligne. Découvre les autres pépites autour de toi ✨"
                                        : hasError
                                            ? "Une erreur est survenue. Réessaie plus tard."
                                            : 'Chargement...'
                            }
                            cta={hasNoEvent ? {
                                label: 'Découvrir FOMO',
                                onClick: () => {
                                    const base = window.location.origin
                                    window.location.assign(`${base}/?event=evt_welcome_000000`)
                                }
                            } : undefined}
                        />
                    )}
                </FiltersProvider>
            </PrivacyProvider>
        </DeviceProvider>
    )
}

/**
 * Hook pour gérer les fake pins en mode visitor
 */
export function useFakePins() {
    const [showTeaserPins, setShowTeaserPins] = useState(false)
    const [selectedFakeEvent, setSelectedFakeEvent] = useState<Event | null>(null)
    const [showWelcomeScreen, setShowWelcomeScreen] = useState(false)
    const [fakeEventsWithImages, setFakeEventsWithImages] = useState<Event[]>([])

    // Charger les images depuis Pexels pour les fake events
    useEffect(() => {
        if (!showTeaserPins || fakeEventsWithImages.length > 0) {
            return
        }

        // Récupérer les titres des events prédéfinis
        const titles = PREDEFINED_FAKE_EVENTS.map(event => event.title)

        // Charger les images depuis Pexels
        getPexelsImages(titles)
            .then((imageMap) => {
                // Créer les events avec les images
                const eventsWithImages: Event[] = PREDEFINED_FAKE_EVENTS.map((event) => {
                    const imageUrl = imageMap.get(event.title) || 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&h=300&fit=crop&crop=center'
                    return {
                        ...event,
                        coverUrl: imageUrl
                    } as Event
                })

                setFakeEventsWithImages(eventsWithImages)
            })
            .catch((error) => {
                console.error('[FakePins] Erreur lors du chargement des images Pexels:', error)
                // Fallback : utiliser une image par défaut
                const eventsWithFallback: Event[] = PREDEFINED_FAKE_EVENTS.map((event) => ({
                    ...event,
                    coverUrl: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&h=300&fit=crop&crop=center'
                } as Event))
                setFakeEventsWithImages(eventsWithFallback)
            })
    }, [showTeaserPins, fakeEventsWithImages.length])

    // Réinitialiser les events quand on désactive les fake pins
    useEffect(() => {
        if (!showTeaserPins) {
            setFakeEventsWithImages([])
        }
    }, [showTeaserPins])

    // Générer les fake events (utiliser la liste prédéfinie avec images)
    const fakeEvents = useMemo(() => {
        if (!showTeaserPins) {
            return []
        }

        return fakeEventsWithImages
    }, [showTeaserPins, fakeEventsWithImages])

    // Handler pour sélectionner un fake event
    const handleSelectFakeEvent = useCallback((event: Event | null) => {
        setSelectedFakeEvent(event)
    }, [])

    return {
        showTeaserPins,
        setShowTeaserPins,
        selectedFakeEvent,
        setSelectedFakeEvent: handleSelectFakeEvent,
        showWelcomeScreen,
        setShowWelcomeScreen,
        fakeEvents
    }
}

export type FakePinsLogic = ReturnType<typeof useFakePins>

/**
 * Hook pour gérer le flux d'intégration visitor
 * Gère le toast initial, le modal visitor et les handlers associés
 */
export function useVisitorIntegrationFlow(
    selectedEvent: Event | null,
    onVisitorFormCompleted: (organizerName: string) => void,
    onEventCardClose?: () => void
) {
    const { users } = useFomoDataContext()

    // États pour le modal visitor
    // En mode privé, seules participe, maybe, not_there sont valides pour le modal
    const [showVisitorModal, setShowVisitorModal] = useState(false)
    const [selectedResponseType, setSelectedResponseType] = useState<'participe' | 'maybe' | 'not_there' | null>(null)

    // Animation des étoiles pour les réponses visitor
    const { triggerStars, StarsAnimation } = useStarsAnimation()

    // Handler pour les réponses en mode visitor
    // En mode privé, seules les réponses suivantes sont valides : participe, maybe, not_there, cleared, seen
    const handleVisitorResponseClick = useCallback((responseType: UserResponseValue) => {
        // Filtrer pour ne garder que les réponses valides en mode privé
        const validPrivateResponses: UserResponseValue[] = ['participe', 'maybe', 'not_there', 'cleared', 'seen']

        if (!responseType || !validPrivateResponses.includes(responseType)) {
            return
        }

        // Ne pas ouvrir le modal pour cleared, seen (ces réponses sont automatiques)
        if (responseType === 'cleared' || responseType === 'seen') {
            return
        }

        // Fermer le toast impatience si présent
        if (window.__hideVisitorToast) {
            window.__hideVisitorToast()
        }

        // Sauvegarder la réponse et jouer l'animation des étoiles AVANT d'ouvrir le modal
        const normalizedResponseType = responseType as 'participe' | 'maybe' | 'not_there'
        setSelectedResponseType(normalizedResponseType)

        // Sauvegarder la réponse pour qu'EventCard l'utilise
        try {
            sessionStorage.setItem('fomo-visit-pending-response', normalizedResponseType)
        } catch {
            // Ignorer si sessionStorage indisponible
        }

        // Jouer l'animation des étoiles avec le bon responseType
        triggerStars(normalizedResponseType)

        // Ouvrir le modal 1 seconde après la fin de l'animation des étoiles (3000ms + 1000ms)
        // À chaque changement de réponse, afficher le modal
        setTimeout(() => {
            setShowVisitorModal(true)
        }, 4000) // 1 seconde après la fin de l'animation (3s animation + 1s délai)
    }, [selectedEvent, triggerStars])

    // Handler pour la confirmation du modal visitor
    // Ne fait QUE sauvegarder le nom/email, ne PAS envoyer la réponse
    // La réponse sera envoyée par EventCard.handleClose quand il se ferme
    const handleVisitorModalConfirm = useCallback((name: string, email?: string, city?: string) => {
        // Sauvegarder le nom, email et ville en sessionStorage
        try {
            sessionStorage.setItem('fomo-visit-name', name)
            if (email) {
                sessionStorage.setItem('fomo-visit-email', email)
            }
            if (city) {
                sessionStorage.setItem('fomo-visit-city', city)
            }
            // Sauvegarder aussi la réponse sélectionnée pour qu'EventCard puisse l'utiliser
            if (selectedResponseType) {
                sessionStorage.setItem('fomo-visit-pending-response', selectedResponseType)
            }
        } catch {
            // Ignorer si sessionStorage indisponible
        }

        // Fermer le modal
        setShowVisitorModal(false)
        setSelectedResponseType(null)

        // Fermer EventCard après la fermeture du modal
        setTimeout(() => {
            onEventCardClose?.()
        }, 300) // Petit délai pour laisser le modal se fermer

        // Appeler le callback parent
        if (selectedEvent) {
            const organizer = getUser(users || [], selectedEvent.organizerId)
            const organizerName = organizer?.name || selectedEvent.organizerName || 'L\'organisateur'
            onVisitorFormCompleted(organizerName)
        }
    }, [selectedResponseType, selectedEvent, users, onVisitorFormCompleted, onEventCardClose])

    // Handler pour la fermeture du modal
    const handleVisitorModalClose = useCallback(() => {
        setShowVisitorModal(false)
        setSelectedResponseType(null)
    }, [])

    // Handler pour l'événement centré (vide pour l'instant)
    const handleEventCentered = useCallback(() => {
        // NOP - placeholder pour future logic
    }, [])

    return {
        showVisitorModal,
        selectedResponseType,
        handleVisitorResponseClick,
        handleVisitorModalConfirm,
        handleVisitorModalClose,
        handleEventCentered,
        StarsAnimation,
        organizerName: selectedEvent
            ? (getUser(users || [], selectedEvent.organizerId)?.name || selectedEvent.organizerName || 'L\'organisateur')
            : 'L\'organisateur'
    }
}

/**
 * Mapping des émojis selon le type de réponse
 * 5 émojis par réponse, sets finaux
 */
const getReactionEmojis = (responseType?: 'participe' | 'maybe' | 'not_there'): string[] => {
    switch (responseType) {
        case 'participe':
            // Ambiance positive, énergie, fête
            return ['🎉', '😄', '🙌', '🥳', '💃']
        case 'maybe':
            // Curiosité, hésitation, bienveillance
            return ['🤞', '👀', '🫶', '🤔', '✨']
        case 'not_there':
            // Désolé, fatigué, bienveillant malgré le refus
            return ['🥲', '😅', '🚫', '😴', '🙏']
        default:
            // Par défaut, utiliser les émojis de "participe"
            return ['🎉', '😄', '🙌', '🥳', '💃']
    }
}

// (animation config for previous canvas engine removed)

/**
 * Hook générique pour gérer l'animation des étoiles avec effets avancés
 * Animation spectaculaire avec traînées, glow, particules secondaires
 */
export function useStarsAnimation(options?: {
    buttonId?: string
    starCount?: number
    duration?: number
    responseType?: 'participe' | 'maybe' | 'not_there'
}) {
    const [showStars, setShowStars] = useState(false)
    const starsRef = useRef<HTMLDivElement>(null)
    const buttonId = options?.buttonId
    const starCount = options?.starCount ?? 40
    const duration = options?.duration ?? 3000
    // Utiliser un ref pour stocker le responseType dynamique
    const responseTypeRef = useRef<'participe' | 'maybe' | 'not_there' | undefined>(options?.responseType)

    // Fonction pour déclencher l'animation avec un responseType
    const triggerStars = useCallback((responseType?: 'participe' | 'maybe' | 'not_there') => {
        if (responseType) {
            responseTypeRef.current = responseType
        }
        setShowStars(true)
    }, [])

    useEffect(() => {
        if (!showStars || !starsRef.current) return

        // Lire le responseType depuis le ref au moment de l'exécution
        const responseType = responseTypeRef.current

        // Position centrale (fixe)
        starsRef.current.style.left = '50%'
        starsRef.current.style.top = '50%'
        starsRef.current.style.transform = 'translate(-50%, -50%)'
        starsRef.current.style.width = '100vw'
        starsRef.current.style.height = '100vh'

        const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const count = prefersReducedMotion ? Math.max(8, Math.floor(starCount * 0.4)) : starCount

        const container = starsRef.current
        // Confetti via canvas-confetti (dynamic import) + logs; no DOM fallback
        try {
            // Créer un canvas explicitement pour éviter l'erreur getContext
            let canvas = container.querySelector('canvas') as HTMLCanvasElement
            if (!canvas) {
                canvas = document.createElement('canvas')
                canvas.style.position = 'absolute'
                canvas.style.top = '0'
                canvas.style.left = '0'
                canvas.style.width = '100%'
                canvas.style.height = '100%'
                canvas.style.pointerEvents = 'none'
                container.appendChild(canvas)
            }

            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const load = window.__confettiLoader || (window.__confettiLoader = import('canvas-confetti'))
            load.then((mod: any) => {
                console.info('[StarsAnimation] canvas-confetti loaded')
                const confetti = mod.default || mod
                // Désactiver useWorker pour éviter l'erreur transferControlToOffscreen
                // Passer le canvas explicitement au lieu du container
                const myConfetti = confetti.create(canvas, { resize: true, useWorker: false })

                // Configuration pour le modal visitor (quand buttonId n'est pas fourni)
                const isVisitorModal = !buttonId

                let cfg: any
                if (isVisitorModal) {
                    // Configuration fixe pour le modal visitor (bas de l'écran, centré)
                    cfg = {
                        particleCount: 50,
                        spread: 30,
                        startVelocity: 21,
                        gravity: 0.9,
                        scalar: 4,
                        decay: 0.9760116708098051,
                        drift: 0,
                        angle: 90,
                        ticks: 150,
                        origin: { x: 0.5, y: 1.0 }, // Bas de l'écran, centré
                        flat: true,
                        disableForReducedMotion: prefersReducedMotion,
                    }

                    // Créer les shapes d'emojis
                    const ems = getReactionEmojis(responseType)
                    const shapes = ems.map(emoji => {
                        try {
                            return confetti.shapeFromText({ text: emoji, scalar: cfg.scalar })
                        } catch (err) {
                            console.error('[StarsAnimation] Error creating shape for emoji', emoji, err)
                            return null
                        }
                    }).filter((shape: any) => shape !== null)

                    if (shapes.length > 0) {
                        cfg.shapes = shapes
                    }
                } else {
                    // Configuration originale pour les autres usages
                    const base = {
                        particleCount: Math.max(40, Math.floor(count * 6)),
                        spread: 70,
                        startVelocity: 35,
                        ticks: Math.floor(duration / 8),
                        gravity: 1.0,
                        scalar: 1.0,
                        origin: { x: 0.5, y: 0.5 },
                        disableForReducedMotion: prefersReducedMotion,
                    }

                    cfg = (() => {
                        switch (responseType) {
                            case 'participe':
                                return { ...base, spread: 85, startVelocity: 50, gravity: 0.9, scalar: 1.1 }
                            case 'maybe':
                                return { ...base, spread: 60, startVelocity: 30, gravity: 0.85, scalar: 0.95, origin: { x: 0.5, y: 0.5 } }
                            case 'not_there':
                                return { ...base, spread: 50, startVelocity: 25, gravity: 0.7, scalar: 0.9 }
                            default:
                                return base
                        }
                    })()

                    // Créer les shapes d'emojis selon le type de réponse
                    const ems = getReactionEmojis(responseType)
                    const shapes = ems.map(emoji => {
                        try {
                            return confetti.shapeFromText({ text: emoji, scalar: cfg.scalar })
                        } catch (err) {
                            console.error('[StarsAnimation] Error creating shape for emoji', emoji, err)
                            return null
                        }
                    }).filter((shape: any) => shape !== null)

                    if (shapes.length > 0) {
                        cfg.shapes = shapes
                    }
                }

                console.info('[StarsAnimation] trigger confetti', { responseType, cfg, isVisitorModal })
                myConfetti({ ...cfg })

                // Double burst seulement si ce n'est pas le modal visitor
                if (!isVisitorModal) {
                    setTimeout(() => {
                        myConfetti({ ...cfg, particleCount: Math.round(cfg.particleCount * 0.6), spread: cfg.spread + 15, scalar: cfg.scalar * 0.92 })
                    }, 120)
                }

                // Emoji accent DOM (seulement si ce n'est pas le modal visitor, car les emojis sont déjà dans le confetti)
                let timer: NodeJS.Timeout
                if (!isVisitorModal) {
                    const accent = document.createElement('div')
                    accent.style.position = 'absolute'
                    accent.style.left = '50%'
                    accent.style.top = '50%'
                    accent.style.transform = 'translate(-50%, -50%)'
                    accent.style.pointerEvents = 'none'
                    const ems = getReactionEmojis(responseType)
                    const frag = document.createDocumentFragment()
                    for (let i = 0; i < 5; i++) {
                        const span = document.createElement('span')
                        span.textContent = ems[i % ems.length]
                        span.style.position = 'absolute'
                        span.style.left = '0'
                        span.style.top = '0'
                        span.style.fontSize = `${28 + Math.floor(Math.random() * 16)}px`
                        const ang = (i / 5) * Math.PI * 2 + Math.random() * 0.25
                        const dist = 60 + Math.random() * 80
                        span.style.transform = `translate3d(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px, 0)`
                        span.style.opacity = '0'
                        span.style.transition = `transform ${Math.floor(duration * 0.8)}ms cubic-bezier(.17,.67,.46,1.01), opacity ${Math.floor(duration * 0.5)}ms ease`
                        frag.appendChild(span)
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                span.style.opacity = '1'
                                span.style.transform = `translate3d(${Math.cos(ang) * (dist + 20)}px, ${Math.sin(ang) * (dist + 20)}px, 0)`
                            })
                        })
                    }
                    accent.appendChild(frag)
                    container.appendChild(accent)

                    timer = setTimeout(() => {
                        if (container.contains(accent)) container.removeChild(accent)
                        setShowStars(false)
                    }, duration)
                } else {
                    // Pour le modal visitor, juste un timer pour fermer l'animation
                    timer = setTimeout(() => {
                        setShowStars(false)
                    }, duration)
                }

                return () => clearTimeout(timer)
            }).catch((err: any) => {
                console.error('[StarsAnimation] confetti import failed', err)
                setShowStars(false)
            })
        } catch (err) {
            console.error('[StarsAnimation] confetti import threw', err)
            setShowStars(false)
        }

        return () => { }
    }, [showStars, buttonId, starCount, duration])

    const StarsAnimation = showStars ? createPortal(
        <div
            ref={starsRef}
            className="stars-container stars-container--fade-out"
        />,
        document.body
    ) : null

    return {
        showStars,
        setShowStars, // Gardé pour compatibilité
        triggerStars, // Nouvelle fonction pour déclencher avec responseType
        StarsAnimation
    }
}

/**
 * Contenu du mode visitor - Nouvelle séquence refondue
 */
const VisitorModeContent: React.FC<{
    visitorEvent: Event | null
    visitorEventError: string | null
}> = ({ visitorEvent, visitorEventError }) => {
    const { isPublicMode, setToggleDisabled } = usePrivacy()
    const { showToast, hideToast } = useToast()
    const { isAuthenticated } = useAuth()
    const { users } = useFomoDataContext()

    // Gérer les fake pins
    const fakePinsLogic = useFakePins()

    // Référence locale pour conditionner le modal visitor
    const selectedEventRef = useRef<Event | null>(null)

    // États pour la nouvelle séquence
    const [responseButtonsDisabled, setResponseButtonsDisabled] = useState(true)
    const [showSignUpModal, setShowSignUpModal] = useState(false)
    const [signUpModalButtonDelay, setSignUpModalButtonDelay] = useState(999999) // Délai très long pour cacher le bouton initialement
    const [showWelcomeScreenFromSignUp, setShowWelcomeScreenFromSignUp] = useState(false)
    const [hasCompletedForm, setHasCompletedForm] = useState(false)
    const [hasShownFakeEventsToast, setHasShownFakeEventsToast] = useState(false) // État pour déclencher le useEffect

    // Refs pour suivre l'état de la séquence
    const hasStartedFlyToRef = useRef(false)
    const hasShownInvitationToastRef = useRef(false)
    const hasOpenedVisitorEventCardRef = useRef(false)
    const hasShownDetailsToastRef = useRef(false)
    const hasActivatedButtonsRef = useRef(false)
    const hasShownImpatienceToastRef = useRef(false)
    const hasCompletedFormRef = useRef(false)
    const hasShownThankYouToastRef = useRef(false)
    const hasShownPssstToastRef = useRef(false)
    const hasToggledPrivacyRef = useRef(false)
    const hasShownExplorationToastRef = useRef(false)
    const lastOpenedFakeEventCardIdRef = useRef<string | null>(null)
    const hasShownFakeEventsToastRef = useRef(false)

    // Timer cumulatifs (en millisecondes depuis le début)
    // Étape 1: 0s (initialisation)
    // Étape 2: 1s (chargement) + 3s (flyTo) = 4s
    // Étape 4: 4s + 3s = 7s (après ouverture EventCard)
    // Étape 6: 7s + 5s = 12s (après activation boutons)
    // Étape 9: variable (après fermeture formulaire) + 1s
    // Étape 10: variable + 1s + 2s = variable + 3s
    // Étape 12: variable (après toggle) + 10s (zoom-out)
    // Étape 14: variable (après ouverture fake card) + 10s

    // Étape 1: Initialisation - Toggle inactif, attendre 1s puis lancer flyTo 3s
    useEffect(() => {
        if (!visitorEvent || hasStartedFlyToRef.current) return

        // Désactiver toggle au démarrage
        setToggleDisabled(true)

        // Attendre 1s après chargement puis lancer flyTo 3s
        const timer1 = setTimeout(() => {
            hasStartedFlyToRef.current = true
            // Lancer flyTo vers l'événement (3s)
            if (window.centerMapOnEvent && visitorEvent.venue) {
                window.centerMapOnEvent(visitorEvent, 3000)
            }
        }, 1000)

        // Étape 2: Toast invitation en bas après flyTo (4s total = 1s + 3s)
        const timer2 = setTimeout(() => {
            if (hasShownInvitationToastRef.current) return

            showToast({
                title: `Tu es invité à ${visitorEvent.title || 'cet événement'}! 👋`,
                message: 'Tap sur le pin bleu pour afficher l\'événement !',
                type: 'info',
                position: 'bottom',
                className: 'toast-visitor'
                // Pas de duration - attend le clic sur le pin
            })

            hasShownInvitationToastRef.current = true
        }, 4000) // 1s + 3s

        return () => {
            clearTimeout(timer1)
            clearTimeout(timer2)
        }
    }, [visitorEvent, users, showToast, setToggleDisabled])

    // Synchroniser selectedEventRef avec selectedEvent dans DiscoverPage
    useEffect(() => {
        const updateSelectedEventRef = (event: Event | null) => {
            selectedEventRef.current = event
        }
            ; (window.__updateVisitorSelectedEventRef = updateSelectedEventRef)
        return () => {
            delete window.__updateVisitorSelectedEventRef
        }
    }, [])

    // Fermer WelcomeScreen si l'utilisateur se connecte
    useEffect(() => {
        if (isAuthenticated) {
            fakePinsLogic.setShowWelcomeScreen(false)
            fakePinsLogic.setShowTeaserPins(false)
            fakePinsLogic.setSelectedFakeEvent(null)

            // Réactiver interactions map et fade-out fake pins
            const map = window.getMap?.() as { dragPan?: { enable: () => void }; scrollZoom?: { enable: () => void } } | undefined
            if (map) {
                map.dragPan?.enable()
                map.scrollZoom?.enable()
            }

            // Séquence de transition à la connexion avec délais de 200ms
            // 1. Fade-out fake pins
            if (window.fadeOutFakePins) {
                window.fadeOutFakePins()
            }

            // 2. Attendre 200ms puis fade-in vrais pins (géré par DiscoverPage)
            // 3. Attendre 200ms puis slide-up NavBar
            setTimeout(() => {
                try {
                    // Déclencher l'animation de slide-in de la NavBar côté App
                    sessionStorage.setItem('fomo-just-signed-up', 'true')
                } catch { }

                // 4. Attendre la fin de l'animation NavBar (1s) puis pop FilterBar
                setTimeout(() => {
                    // Déclencher l'animation pop FilterBar
                    try {
                        sessionStorage.setItem('fomo-pop-filterbar', 'true')
                    } catch { }

                    // 5. Toast de bienvenue après toute la séquence
                    setTimeout(() => {
                        showToast({
                            title: '🎉 Bienvenue sur FOMO',
                            message: 'Voici les vrais événements autour de toi !',
                            type: 'success',
                            duration: 5000,
                        })
                    }, 3200) // Après l'animation FilterBar (3s) + 200ms
                }, 1000) // Délai pour pop FilterBar (après fin animation NavBar)
            }, 200) // Délai pour slide-up NavBar
        }
    }, [isAuthenticated, fakePinsLogic, showToast])

    // Handler pour détecter l'ouverture de l'EventCard
    const handleEventCardOpened = useCallback((event: Event | null) => {
        if (!event || hasOpenedVisitorEventCardRef.current || !visitorEvent) return

        const eventId = event.id
        const isVisitorEvent = eventId === visitorEvent.id

        if (!isVisitorEvent) return

        hasOpenedVisitorEventCardRef.current = true
        // Le toast invitation a déjà été fermé lors du clic sur le pin

        // Étape 4: Toast détails après 3s
        setTimeout(() => {
            if (hasShownDetailsToastRef.current) return

            showToast({
                title: 'Tu veux plus de détails ? 👀',
                message: 'Tap sur l\'étiquette de l\'événement !',
                type: 'info',
                position: 'top',
                className: 'toast-visitor'
                // Pas de duration - attend le clic sur l'étiquette
            })

            hasShownDetailsToastRef.current = true
        }, 3000) // 3s après ouverture EventCard
    }, [visitorEvent, showToast])

    // Handler pour fermer le toast invitation lors du clic sur le pin
    const handlePinClick = useCallback(() => {
        // Fermer le toast invitation immédiatement
        if (hasShownInvitationToastRef.current) {
            hideToast()
        }
    }, [hideToast])

    // Exposer les fonctions pour que DiscoverPage puisse les utiliser
    useEffect(() => {
        ; (window.__onVisitorEventCardOpened = handleEventCardOpened)
            ; (window.__hideVisitorToast = hideToast)
            ; (window.__onVisitorPinClick = handlePinClick)
        return () => {
            delete window.__onVisitorEventCardOpened
            delete window.__hideVisitorToast
            delete window.__onVisitorPinClick
        }
    }, [handleEventCardOpened, handlePinClick, hideToast])


    // Étape 5: Clic sur étiquette EventCard → activer boutons
    // Exposer une fonction globale pour que EventCard puisse activer les boutons
    useEffect(() => {
        const activateButtons = () => {
            if (hasActivatedButtonsRef.current) return
            hasActivatedButtonsRef.current = true
            setResponseButtonsDisabled(false)
            hideToast() // Fermer toast détails

            // Étape 6: Toast impatience après 5s
            setTimeout(() => {
                if (hasShownImpatienceToastRef.current) return

                const organizer = getUser(users || [], visitorEvent?.organizerId || '')
                const organizerName = organizer?.name || visitorEvent?.organizerName || 'L\'organisateur'

                showToast({
                    title: `${organizerName} attend ta réponse avec impatience ! ⏰`,
                    message: 'Seras-tu présent ?',
                    type: 'info',
                    position: 'top',
                    bounceAnimation: true,
                    className: 'toast-visitor'
                    // Pas de duration - attend le clic sur une réponse
                })

                hasShownImpatienceToastRef.current = true
            }, 5000) // 5s après activation boutons
        }

            ; (window.__activateVisitorButtons = activateButtons)
        return () => {
            delete window.__activateVisitorButtons
        }
    }, [visitorEvent, users, showToast])

    // Handler appelé quand le formulaire visitor est complété
    const handleVisitorFormCompleted = useCallback((organizerName: string) => {
        // Ne traiter que la première complétion du formulaire
        if (hasCompletedFormRef.current) {
            return // Déjà complété, ne rien faire
        }

        hasCompletedFormRef.current = true
        setHasCompletedForm(true)

        // Étape 9: Toast remerciement après 1s
        setTimeout(() => {
            if (hasShownThankYouToastRef.current) return

            showToast({
                title: 'Merci pour ta réponse ! 🙏',
                message: `${organizerName} est maintenant prévenu(e).`,
                type: 'success',
                position: 'top',
                duration: 3000,
                className: 'toast-visitor'
            })

            hasShownThankYouToastRef.current = true

            // Étape 10: Toast Pssst + Modal signup après 5s (6s total depuis fermeture formulaire)
            setTimeout(() => {
                if (hasShownPssstToastRef.current) return

                showToast({
                    title: 'Pssst! 👀',
                    message: (
                        <>
                            Sait-on que sur FOMO, tu peux aussi découvrir les events publics autour de chez toi ?
                            Bascule en mode public via un tap sur le bouton en haut à droite !
                        </>
                    ),
                    type: 'info',
                    position: 'top',
                    className: 'toast-visitor'
                    // Pas de duration - attend le tap sur le toggle
                })

                // Ouvrir modal signup en même temps (fade in simultané) mais bouton caché
                setShowSignUpModal(true)

                hasShownPssstToastRef.current = true
            }, 5000) // 5s après toast remerciement (au lieu de 2s)
        }, 1000) // 1s après fermeture formulaire

        // Activer le toggle privacy (une seule fois, à la première complétion)
        setToggleDisabled(false)
    }, [setToggleDisabled, showToast])

    // Handler pour fermer EventCard (utilisé après fermeture du modal)
    const handleEventCardClose = useCallback(() => {
        // Fermer EventCard en réinitialisant selectedEventRef
        selectedEventRef.current = null
        hasOpenedVisitorEventCardRef.current = false
        // Notifier DiscoverPage pour fermer l'EventCard via window
        if (window.__closeEventCard) {
            window.__closeEventCard()
        }
    }, [])

    // Étape 11: Attendre tap sur toggle privacy puis lancer zoom-out 10s
    useEffect(() => {
        if (!isPublicMode || hasToggledPrivacyRef.current || !hasCompletedForm) return

        hasToggledPrivacyRef.current = true
        hideToast() // Fermer toast Pssst

        // Lancer animation zoom-out 10s
        const targetZoom = 8
        const durationMs = 10000
        fakePinsLogic.setShowTeaserPins(true)

        setTimeout(() => {
            if (window.startPublicModeSequence) {
                window.startPublicModeSequence(targetZoom, durationMs)
            }
        }, 200)

        // Étape 12: Toast exploration après fin animation zoom-out (10s)
        setTimeout(() => {
            if (hasShownExplorationToastRef.current) return

            showToast({
                title: 'Bienvenu en mode public! 📍',
                message: 'Maintenant, tu peux explorer la carte tranquillement, et voir les détails des événements, mais ça, tu sais déjà 😉',
                type: 'info',
                position: 'top',
                className: 'toast-visitor'
                // Pas de duration - attend le clic sur un fake pin
            })

            hasShownExplorationToastRef.current = true
        }, durationMs + 200) // 10s + 200ms

        // Le bouton sera affiché 2s après le toast "Ces events te semblent FAKE ?" (géré dans le useEffect)
    }, [isPublicMode, hasCompletedForm, fakePinsLogic, showToast])

    // Handler pour détecter l'ouverture de FakeEventCard
    const handleFakeEventCardOpened = useCallback((event: Event | null) => {
        if (!event) return

        const eventId = event.id
        const isFakeEvent = eventId && eventId.startsWith('fake-')

        if (!isFakeEvent) return

        // Ne traiter qu'une seule fois par fake event
        if (lastOpenedFakeEventCardIdRef.current === eventId) return
        lastOpenedFakeEventCardIdRef.current = eventId

        hideToast() // Fermer toast exploration

        // Étape 14: Toast fake events
        setTimeout(() => {
            if (hasShownFakeEventsToastRef.current) return

            showToast({
                title: 'Ces events te semblent FAKE ? 🤔',
                message: "C'est normal, ils le sont... C'était un test pour vérifier que tu maîtrises l'app. 💪 Maintenant que tu gères, il est temps de découvrir les VRAIS événements 🚀",
                type: 'info',
                position: 'top',
                className: 'toast-visitor'
                // Pas de duration - attend le clic sur le bouton signup
            })

            hasShownFakeEventsToastRef.current = true
            setHasShownFakeEventsToast(true) // Déclencher le useEffect pour afficher le bouton
        }, 30000) // 30s après ouverture FakeEventCard
    }, [showToast])

    // Surveiller l'affichage du toast "Ces events te semblent FAKE ?" et afficher le bouton 4s après
    useEffect(() => {
        if (!hasShownFakeEventsToast) return

        // Afficher le bouton 4 secondes après l'affichage du toast (2s + 2s supplémentaires)
        const timer = setTimeout(() => {
            setSignUpModalButtonDelay(0) // Afficher le bouton
        }, 4000) // 4s après le toast

        return () => clearTimeout(timer)
    }, [hasShownFakeEventsToast]) // Déclencher quand le toast est affiché

    // Exposer la fonction pour que DiscoverPage puisse notifier l'ouverture de FakeEventCard
    useEffect(() => {
        ; (window.__onVisitorFakeEventCardOpened = handleFakeEventCardOpened)
        return () => {
            delete window.__onVisitorFakeEventCardOpened
        }
    }, [handleFakeEventCardOpened])

    // Étape 15: Clic sur bouton signup → ouvrir WelcomeScreen avec AuthModal
    const handleSignUp = useCallback(() => {
        hideToast() // Fermer le toast "Ces events te semblent FAKE ?"
        setShowSignUpModal(false)
        setShowWelcomeScreenFromSignUp(true)
    }, [hideToast])

    // Gérer le flux d'intégration visitor
    const integrationFlow = useVisitorIntegrationFlow(
        selectedEventRef.current,
        handleVisitorFormCompleted,
        handleEventCardClose
    )

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


    // Afficher WelcomeScreen si demandé
    if (showWelcomeScreenFromSignUp) {
        return <WelcomeScreen />
    }

    return (
        <div className={`app vmIntegrationFork ${isPublicMode ? 'public' : 'private'}`} data-fork="vmIntegrationFork">
            <Header />
            <main className="app-body">
                <DiscoverPage
                    isModalOpen={isModalOpen}
                    visitorMode={{
                        enabled: true,
                        event: visitorEvent,
                        fakePinsLogic,
                        onResponseClick: integrationFlow.handleVisitorResponseClick,
                        onEventCardClose: handleEventCardClose,
                        starsAnimation: integrationFlow.StarsAnimation,
                        responseButtonsDisabled,
                    }}
                    onEventCentered={integrationFlow.handleEventCentered}
                />
                {/* Modal visitor - rendu tant qu'on est en mode visitor */}
                {visitorEvent && (
                    <>
                        <VisitorNameModal
                            isOpen={integrationFlow.showVisitorModal}
                            onClose={integrationFlow.handleVisitorModalClose}
                            onConfirm={integrationFlow.handleVisitorModalConfirm}
                            organizerName={integrationFlow.organizerName}
                            responseType={integrationFlow.selectedResponseType || 'participe'}
                        />
                        <SignUpModal
                            isOpen={showSignUpModal}
                            onClose={() => setShowSignUpModal(false)}
                            onSignUp={handleSignUp}
                            showButtonDelay={signUpModalButtonDelay}
                        />
                        {/* Animation étoiles pour visitor (affichée dans DiscoverPage) */}
                    </>
                )}
            </main>
            {/* NavBar masquée en mode visitor */}
        </div>
    )
}

