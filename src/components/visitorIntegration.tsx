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
import { useFomoDataContext, FomoDataProvider } from '@/contexts/FomoDataProvider'
import { getUser } from '@/utils/filterTools'
import { Toast } from '@/components/ui/Toast'

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
    const hasError = !!visitorEventError
    const hasNoEvent = !visitorEvent && !isLoadingVisitorEvent

    const shouldShowWelcomeScreen = isLoadingVisitorEvent || hasError || hasNoEvent

    return (
        <DeviceProvider>
            <PrivacyProvider defaultPublicMode={false}>
                <FiltersProvider>
                    <VisitorModeContent
                        visitorEvent={visitorEvent}
                        visitorEventError={visitorEventError}
                        onEventCardMount={() => {/* signal uniquement pour timing flyTo */ }}
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
export function useFakePins(_visitorEvent: Event | null, isPublicMode: boolean) {
    const [showTeaserPins, setShowTeaserPins] = useState(false)
    const [selectedFakeEvent, setSelectedFakeEvent] = useState<Event | null>(null)
    const [isPublicModeSequence, setIsPublicModeSequence] = useState(false)
    const [hasStartedPublicSequence, setHasStartedPublicSequence] = useState(false)
    const [showWelcomeScreen, setShowWelcomeScreen] = useState(false)
    // Initialiser avec un index aléatoire entre 0 et 49 pour commencer la rotation à un point aléatoire
    const [fakeEventVariantIndex, setFakeEventVariantIndex] = useState(() => Math.floor(Math.random() * 50)) // Rotation 0-49 avec départ aléatoire
    const prevIsPublicModeRef = useRef(isPublicMode)

    // Fonction pour générer des points autour d'une ville dans un rayon donné
    const generatePointsAroundCity = useCallback((
        centerLat: number,
        centerLng: number,
        minRadiusKm: number,
        maxRadiusKm: number,
        count: number
    ): Array<{ lat: number; lng: number }> => {
        const points: Array<{ lat: number; lng: number }> = []
        const degreesPerKm = 1 / 111 // 1 degré de latitude ≈ 111 km

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * 2 * Math.PI
            // Distance aléatoire entre minRadiusKm et maxRadiusKm
            const distanceKm = minRadiusKm + Math.random() * (maxRadiusKm - minRadiusKm)

            const latOffset = distanceKm * degreesPerKm * Math.cos(angle)
            const lngOffset = distanceKm * degreesPerKm * Math.sin(angle) / Math.cos(centerLat * Math.PI / 180)

            points.push({
                lat: centerLat + latOffset,
                lng: centerLng + lngOffset
            })
        }

        return points
    }, [])

    // Fonction pour générer des points autour des grandes villes belges
    const generateRandomPointsInBelgium = useCallback((): Array<{ lat: number; lng: number }> => {
        const points: Array<{ lat: number; lng: number }> = []

        // Coordonnées des grandes villes belges
        const cities = [
            { name: 'Bruxelles', lat: 50.8503, lng: 4.3517 },
            { name: 'Liège', lat: 50.6326, lng: 5.5797 },
            { name: 'Namur', lat: 50.4669, lng: 4.8675 },
            { name: 'Mons', lat: 50.4542, lng: 3.9522 },
            { name: 'Bastogne', lat: 50.0030, lng: 5.7190 },
            { name: 'Gand', lat: 51.0543, lng: 3.7174 }
        ]

        // Pour chaque ville : 5 pins proches (0-15km) + 10 pins moyens (15-60km)
        // Total : 6 villes × 15 pins = 90 pins
        cities.forEach((city) => {
            // 5 pins à proximité proche (0-15km)
            const closePins = generatePointsAroundCity(city.lat, city.lng, 0, 15, 5)
            points.push(...closePins)

            // 10 pins à distance moyenne (15-60km)
            const mediumPins = generatePointsAroundCity(city.lat, city.lng, 15, 60, 10)
            points.push(...mediumPins)
        })

        return points
    }, [generatePointsAroundCity])

    // Générer les fake events
    const fakeEvents = useMemo(() => {
        if (!showTeaserPins) {
            return []
        }

        // Générer 90 fake pins répartis autour des grandes villes belges
        // 6 villes × (5 proches 0-15km + 10 moyens 15-60km) = 90 pins
        const points = generateRandomPointsInBelgium()

        return points.map((point, index) => ({
            id: `fake-${index}`,
            venue: {
                lat: point.lat,
                lng: point.lng,
                name: '',
                address: ''
            },
            title: '',
            isPublic: true,
            isOnline: true,
            isFake: true, // Marqueur pour MapRenderer
            startsAt: '',
            endsAt: '',
            tags: [],
            coverUrl: '',
            description: '',
            organizerId: '',
            organizerName: '',
            stats: { going: 0, interested: 0, friendsGoing: 0, goingCount: 0, interestedCount: 0, notInterestedCount: 0, totalResponses: 0, friendsGoingCount: 0, friendsInterestedCount: 0, friendsGoingList: '', friendsInterestedList: '' }
        } as Event))
    }, [showTeaserPins, generateRandomPointsInBelgium])

    // Détecter le changement de privacy et lancer la séquence Public Mode
    useEffect(() => {
        if (prevIsPublicModeRef.current !== isPublicMode) {
            prevIsPublicModeRef.current = isPublicMode

            // En mode visiteur ET basculement vers Public Mode, lancer la séquence
            if (isPublicMode && !hasStartedPublicSequence) {
                console.info('[VM] Starting Public Mode sequence')
                setHasStartedPublicSequence(true)
                setIsPublicModeSequence(true)
                setShowTeaserPins(true)
                setSelectedFakeEvent(null)

                const targetZoom = 8
                const durationMs = 15000

                // Lancer zoom-out après un court délai pour laisser le temps aux fake pins d'être injectés dans la source
                setTimeout(() => {
                    console.info('[VM] Attempting to call startPublicModeSequence', {
                        available: !!(window as any).startPublicModeSequence,
                        targetZoom,
                        durationMs
                    })
                    if ((window as any).startPublicModeSequence) {
                        try {
                            console.info('[VM] Calling startPublicModeSequence', { targetZoom, durationMs })
                                ; (window as any).startPublicModeSequence(targetZoom, durationMs)
                            console.info('[VM] startPublicModeSequence called successfully')
                        } catch (err) {
                            console.error('[VM] Error during startPublicModeSequence', err)
                        }
                    } else {
                        console.warn('[VM] startPublicModeSequence not available')
                    }
                }, 200)

                // Fin de séquence: marquer la séquence comme terminée (interactions laissées actives)
                const endTimer = window.setTimeout(() => {
                    setIsPublicModeSequence(false)
                }, durationMs + 200)

                // Cleanup en cas de changement d'état prématuré
                return () => {
                    clearTimeout(endTimer)
                    setIsPublicModeSequence(false)
                }
            }
        }
    }, [isPublicMode, hasStartedPublicSequence])

    // Handler pour sélectionner un fake event avec rotation
    const handleSelectFakeEvent = useCallback((event: Event | null) => {
        if (event) {
            // Incrémenter l'index pour rotation (0-49) seulement si on ouvre un nouveau fake event
            // Si c'est le même event, ne pas incrémenter
            // La rotation continue en boucle : après 49, on revient à 0
            if (!selectedFakeEvent || selectedFakeEvent.id !== event.id) {
                setFakeEventVariantIndex((prev) => (prev + 1) % 50)
            }
        } else {
            // Ne pas réinitialiser l'index quand on ferme - continuer la séquence
            // L'index reste où il en est pour la prochaine ouverture
        }
        setSelectedFakeEvent(event)
    }, [selectedFakeEvent])

    return {
        showTeaserPins,
        setShowTeaserPins,
        selectedFakeEvent,
        setSelectedFakeEvent: handleSelectFakeEvent,
        isPublicModeSequence,
        setIsPublicModeSequence,
        showWelcomeScreen,
        setShowWelcomeScreen,
        fakeEvents,
        fakeEventVariantIndex
    }
}

export type FakePinsLogic = ReturnType<typeof useFakePins> & { fakeEventVariantIndex?: number }

/**
 * Hook pour gérer le flux d'intégration visitor
 * Gère le toast initial, le modal visitor et les handlers associés
 */
export function useVisitorIntegrationFlow(
    _visitorEvent: Event | null,
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
    const { setShowStars, StarsAnimation } = useStarsAnimation({
        responseType: selectedResponseType || undefined
    })

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

        // Vérifier si le formulaire a déjà été rempli (nom saisi en sessionStorage)
        let hasAlreadySubmitted = false
        try {
            hasAlreadySubmitted = sessionStorage.getItem('fomo-visit-name') !== null
        } catch {
            // Ignorer si sessionStorage indisponible
        }

        if (hasAlreadySubmitted) {
            // Si le formulaire a déjà été rempli, sauvegarder la réponse pour qu'EventCard l'utilise
            // EventCard enverra la réponse dans son handleClose
            try {
                sessionStorage.setItem('fomo-visit-pending-response', responseType as 'participe' | 'maybe' | 'not_there')
            } catch {
                // Ignorer si sessionStorage indisponible
            }
            // Ne pas ouvrir le modal, la réponse sera envoyée par EventCard.handleClose
            return
        }

        // Sinon, sauvegarder la réponse et jouer l'animation des étoiles AVANT d'ouvrir le modal
        setSelectedResponseType(responseType as 'participe' | 'maybe' | 'not_there')

        // Jouer l'animation des étoiles
        setShowStars(true)

        // Ouvrir le modal après un court délai pour laisser l'animation se jouer
        setTimeout(() => {
            setShowVisitorModal(true)
        }, 500) // Délai pour laisser l'animation démarrer
    }, [selectedEvent, setShowStars])

    // Handler pour la confirmation du modal visitor
    // Ne fait QUE sauvegarder le nom/email, ne PAS envoyer la réponse
    // La réponse sera envoyée par EventCard.handleClose quand il se ferme
    const handleVisitorModalConfirm = useCallback((name: string, email?: string) => {
        // Sauvegarder le nom en sessionStorage
        try {
            sessionStorage.setItem('fomo-visit-name', name)
            if (email) {
                sessionStorage.setItem('fomo-visit-email', email)
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

    // Handler pour l'événement centré (pas de logique spéciale, juste appeler le callback)
    const handleEventCentered = useCallback(() => {
        // Pas de logique spéciale pour le moment
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
            const load = (window as any).__confettiLoader || ((window as any).__confettiLoader = import('canvas-confetti'))
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
                        spread: 40,
                        startVelocity: 21,
                        gravity: 0.9,
                        scalar: 3,
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
 * Hook pour gérer l'animation des étoiles dans le modal visitor
 */
export function useVisitorModalStars(
    _buttonId: string = 'visitor-modal-submit-button',
    responseType?: 'participe' | 'maybe' | 'not_there'
) {
    // Déclenche toujours au centre de l'écran (pas associé au bouton) avec moins de particules mais plus grandes
    return useStarsAnimation({ starCount: 36, duration: 2500, responseType })
}

/**
 * Contenu du mode visitor
 */
const VisitorModeContent: React.FC<{
    visitorEvent: Event | null
    visitorEventError: string | null
    onEventCardMount: () => void
}> = ({ visitorEvent, visitorEventError, onEventCardMount: _onEventCardMount }) => {
    const { isPublicMode, setToggleDisabled } = usePrivacy()
    const { showToast } = useToast()
    const { isAuthenticated } = useAuth()
    const { users } = useFomoDataContext()

    // Gérer les fake pins
    const fakePinsLogic = useFakePins(visitorEvent, isPublicMode)

    // Référence locale pour conditionner le modal visitor (plus de contrôle direct sur DiscoverPage)
    const selectedEventRef = useRef<Event | null>(null)

    // Refs pour le toast initial (déclenché lors du montage de l'EventCard)
    const hasShownIntroToastRef = useRef(false)
    const hasStartedFadeInRef = useRef(false)

    // Déclencher le toast initial après le flyTo + fade-in de l'EventCard
    const handleEventCardMount = useCallback(() => {
        if (!visitorEvent || hasStartedFadeInRef.current) return

        const fadeInTimer = setTimeout(() => {
            hasStartedFadeInRef.current = true

            setTimeout(() => {
                if (hasShownIntroToastRef.current) return

                const organizer = getUser(users || [], visitorEvent.organizerId)
                const organizerName = organizer?.name || visitorEvent.organizerName || 'L\'organisateur'

                showToast({
                    title: `${organizerName} t'attend 🎉`,
                    message: `Tu viens ? Pour connaître les détails, clique sur la carte de l'événement !`,
                    type: 'info',
                    duration: 5000,
                    className: 'toast-visitor'
                })

                hasShownIntroToastRef.current = true
            }, 2000)
        }, 4000)

        return () => clearTimeout(fadeInTimer)
    }, [visitorEvent, users, showToast])

    // Synchroniser selectedEventRef avec selectedEvent dans DiscoverPage
    // (utilisé pour le flux du modal visitor)
    useEffect(() => {
        // Exposer une fonction pour que DiscoverPage puisse mettre à jour selectedEventRef
        const updateSelectedEventRef = (event: Event | null) => {
            selectedEventRef.current = event
        }
            ; (window as any).__updateVisitorSelectedEventRef = updateSelectedEventRef
        return () => {
            delete (window as any).__updateVisitorSelectedEventRef
        }
    }, [])

    // Fermer WelcomeScreen et terminer séquence Public Mode si l'utilisateur se connecte
    useEffect(() => {
        if (isAuthenticated) {
            fakePinsLogic.setShowWelcomeScreen(false)
            fakePinsLogic.setShowTeaserPins(false)
            fakePinsLogic.setSelectedFakeEvent(null)
            fakePinsLogic.setIsPublicModeSequence(false)

            // Réactiver interactions map et fade-out fake pins
            const map = (window as any).getMap?.()
            if (map) {
                map.dragPan.enable()
                map.scrollZoom.enable()
            }

            // Séquence de transition à la connexion avec délais de 200ms
            // 1. Fade-out fake pins
            if ((window as any).fadeOutFakePins) {
                (window as any).fadeOutFakePins()
            }

            // 2. Attendre 200ms puis fade-in vrais pins (géré par DiscoverPage)
            // 3. Attendre 200ms puis slide-up NavBar
            setTimeout(() => {
                try {
                    // Déclencher l'animation de slide-in de la NavBar côté App
                    sessionStorage.setItem('fomo-just-signed-up', 'true')
                } catch { }

                // 4. Attendre 200ms puis pop FilterBar
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
                    }, 200)
                }, 200) // Délai pour pop FilterBar
            }, 200) // Délai pour slide-up NavBar
        }
    }, [isAuthenticated, fakePinsLogic, showToast])

    // Désactiver le toggle au démarrage en mode visitor (sera activé après complétion du formulaire)
    // Vérifier si le formulaire a déjà été complété (visitorName existe en sessionStorage)
    useEffect(() => {
        try {
            const hasCompletedForm = sessionStorage.getItem('fomo-visit-name') !== null
            setToggleDisabled(!hasCompletedForm)
        } catch {
            // Si sessionStorage indisponible, désactiver par défaut
            setToggleDisabled(true)
        }
        return () => {
            setToggleDisabled(false) // Réactiver en cas de démontage
        }
    }, [setToggleDisabled])

    // Handler appelé quand le formulaire visitor est complété
    const handleVisitorFormCompleted = useCallback((_organizerName: string) => {
        // Activer le toggle privacy
        setToggleDisabled(false)

        // Ajouter le halo pulse au toggle privacy après un délai pour s'assurer que le DOM est mis à jour
        setTimeout(() => {
            const toggleElement = document.querySelector('.toggle-switch')
            if (toggleElement) {
                console.log('[Visitor] Ajout de la classe privacy-toggle-halo au toggle')
                toggleElement.classList.add('privacy-toggle-halo')

                // Retirer la classe quand l'utilisateur clique sur le toggle
                const handleToggleClick = () => {
                    toggleElement.classList.remove('privacy-toggle-halo')
                    toggleElement.removeEventListener('click', handleToggleClick)
                    console.log('[Visitor] Retrait de la classe privacy-toggle-halo après clic')
                }

                // Ajouter l'event listener pour retirer la classe au clic
                toggleElement.addEventListener('click', handleToggleClick, { once: true })
            } else {
                console.warn('[Visitor] Toggle element non trouvé')
            }
        }, 100) // Délai pour laisser le DOM se mettre à jour après setToggleDisabled
    }, [setToggleDisabled])

    // Handler pour fermer EventCard (utilisé après fermeture du modal)
    const handleEventCardClose = useCallback(() => {
        // Fermer EventCard en réinitialisant selectedEventRef
        selectedEventRef.current = null
        // Notifier DiscoverPage pour fermer l'EventCard via window
        if ((window as any).__closeEventCard) {
            (window as any).__closeEventCard()
        }

        // Vérifier si le formulaire a été complété (visitorName existe)
        let hasCompletedForm = false
        try {
            hasCompletedForm = sessionStorage.getItem('fomo-visit-name') !== null
        } catch {
            // Ignorer si sessionStorage indisponible
        }

        // Si le formulaire a été complété, activer le toggle et ajouter l'animation
        if (hasCompletedForm) {
            console.log('[Visitor] handleEventCardClose: Formulaire complété, activation du toggle')
            // Activer le toggle privacy
            setToggleDisabled(false)

            // Ajouter le halo pulse au toggle privacy après un délai pour s'assurer que le DOM est mis à jour
            setTimeout(() => {
                const toggleElement = document.querySelector('.toggle-switch')
                if (toggleElement) {
                    console.log('[Visitor] Ajout de la classe privacy-toggle-halo au toggle')
                    toggleElement.classList.add('privacy-toggle-halo')

                    // Retirer la classe quand l'utilisateur clique sur le toggle
                    const handleToggleClick = () => {
                        toggleElement.classList.remove('privacy-toggle-halo')
                        toggleElement.removeEventListener('click', handleToggleClick)
                        console.log('[Visitor] Retrait de la classe privacy-toggle-halo après clic')
                    }

                    // Ajouter l'event listener pour retirer la classe au clic
                    toggleElement.addEventListener('click', handleToggleClick, { once: true })
                } else {
                    console.warn('[Visitor] Toggle element non trouvé dans handleEventCardClose')
                }
            }, 100)

            // Le toast a été supprimé car le teaser sur la FakeEventCard remplit ce rôle
        }
    }, [showToast, setToggleDisabled])

    // Gérer le flux d'intégration visitor
    const integrationFlow = useVisitorIntegrationFlow(
        visitorEvent,
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


    return (
        <div className={`app vmIntegrationFork ${isPublicMode ? 'public' : 'private'}`} data-fork="vmIntegrationFork">
            <Header />
            <main className="app-body">
                <DiscoverPage
                    isModalOpen={isModalOpen}
                    visitorMode={{
                        enabled: true,
                        event: visitorEvent,
                        onEventCardMount: handleEventCardMount,
                        fakePinsLogic,
                        onResponseClick: integrationFlow.handleVisitorResponseClick,
                        onEventCardClose: handleEventCardClose,
                        starsAnimation: integrationFlow.StarsAnimation,
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
                        {/* Animation étoiles pour visitor (affichée dans DiscoverPage) */}
                    </>
                )}
            </main>
            {/* NavBar masquée en mode visitor */}
        </div>
    )
}

