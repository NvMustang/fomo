/**
 * FOMO MVP - Hook pour la section getVisitorResponse
 * 
 * Section 1 du parcours d'onboarding visitor : getVisitorResponse
 * Commence à l'arrivée de l'app depuis un lien contenant un event
 * Se termine à la fermeture de l'eventcard contenant sa réponse (réponse ajoutée à la DB)
 * 
 * L'utilisateur invité est créé à la soumission du formulaire visitorModal
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useToast } from '@/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { useFomoDataContext } from '@/contexts/FomoDataProvider'
import { getUser } from '@/utils/filterTools'
import { onboardingTracker } from '../utils/onboardingTracker'
import { useVisitorResponseHandlers } from './useVisitorResponseHandlers'
import type { Event, User } from '@/types/fomoTypes'

/**
 * Obtenir le nom de l'organisateur d'un événement
 */
function getOrganizerName(event: Event | null | undefined, users: User[] | null | undefined): string {
    if (!event) {
        return 'L\'organisateur'
    }
    const organizer = getUser(users || [], event.organizerId)
    return organizer?.name || event.organizerName || 'L\'organisateur'
}

interface UseGetVisitorResponseOptions {
    visitorEvent: Event
    setToggleDisabled: (disabled: boolean) => void
    getSelectedEvent?: () => Event | null // Fonction getter pour récupérer selectedEvent depuis DiscoverPage
    onAuthenticated?: () => void
}

export function useGetVisitorResponse({
    visitorEvent,
    setToggleDisabled,
    getSelectedEvent,
    onAuthenticated
}: UseGetVisitorResponseOptions) {
    const { showToast, hideToast, currentToast } = useToast()
    const hasShownPssstToastRef = useRef(false)

    // Fonction helper pour vérifier si le toast fake events est actif
    // Vérifie à la fois le titre et le message pour être plus robuste
    const isFakeEventsToast = useCallback((toast: typeof currentToast): boolean => {
        if (!toast) return false
        const titleMatch = toast.title === 'Ces events te semblent FAKE ? 🤔'
        const messageMatch = typeof toast.message === 'string' && 
            toast.message.includes("C'est normal, ils le sont... C'était un test")
        return titleMatch || messageMatch
    }, [])

    // Fonction wrapper pour showToast qui ne remplace pas le toast fake events
    const safeShowToast = useCallback((toast: Parameters<typeof showToast>[0]) => {
        if (!isFakeEventsToast(currentToast)) {
            showToast(toast)
        }
    }, [showToast, currentToast, isFakeEventsToast])
    const { isAuthenticated } = useAuth()
    const { isPublicMode } = usePrivacy()
    const { users, currentUserId, currentUserName, getLatestResponse, responses } = useFomoDataContext()

    // Ref pour suivre isPublicMode et vérifier sa valeur actuelle dans les timeouts
    const isPublicModeRef = useRef(isPublicMode)
    useEffect(() => {
        isPublicModeRef.current = isPublicMode
    }, [isPublicMode])

    // Plus besoin de selectedEventRef : on utilise visitorEvent directement dans useVisitorResponseHandlers

    // États pour la section getVisitorResponse
    const [visitorRegistrationCompleted, setVisitorRegistrationCompleted] = useState(false)

    // Refs pour suivre l'état de la séquence
    const hasShownInvitationToastRef = useRef(false)
    const hasOpenedVisitorEventCardRef = useRef(false)
    const hasShownDetailsToastRef = useRef(false)
    const hasExpandedDetailsRef = useRef(false)
    const hasActivatedButtonsRef = useRef(false)
    const hasShownImpatienceToastRef = useRef(false)
    const visitorRegistrationCompletedRef = useRef(false)
    const hasShownThankYouToastRef = useRef(false)
    const hasShownCloseEventCardToastRef = useRef(false)
    const hasClickedResponseRef = useRef(false) // Ref pour suivre si une réponse a été cliquée

    // Vérifier si le visitor a déjà répondu à cet événement (vérification synchrone au début)
    // VisitorDataContext charge les réponses depuis le backend, donc on vérifie directement dans responses
    const existingResponse = currentUserId && visitorEvent && responses?.find(
        r => r.userId === currentUserId &&
            r.eventId === visitorEvent.id &&
            r.finalResponse !== null &&
            r.finalResponse !== 'cleared'
    ) || (currentUserId && visitorEvent && getLatestResponse ? getLatestResponse(currentUserId, visitorEvent.id) : null)

    const hasResponse = existingResponse !== null && existingResponse !== undefined
    const hasUser = !!currentUserName
    const hasUserAndResponse = hasUser && hasResponse

    // Configurer l'état initial une seule fois quand les données sont disponibles
    const hasInitializedRef = useRef(false)
    useEffect(() => {
        if (hasInitializedRef.current) return
        if (!currentUserId || !visitorEvent) return // Attendre que les données soient disponibles

        hasInitializedRef.current = true

        if (hasResponse) {
            // Activer directement le toggle
            setToggleDisabled(false)

            // Si user + response : afficher directement "Discover FOMO" (pas besoin de formulaire)
            if (hasUserAndResponse) {
                setVisitorRegistrationCompleted(true)
                visitorRegistrationCompletedRef.current = true
            }

            hasActivatedButtonsRef.current = true
        }
    }, [currentUserId, visitorEvent, hasResponse, hasUserAndResponse, setToggleDisabled])

    // ===== DÉBUT DE LA SECTION : getVisitorResponse =====
    // Étape 1: Initialisation - Toggle inactif, tracking démarré
    useEffect(() => {
        if (!visitorEvent) return

        // Démarrer le tracking de session
        onboardingTracker.startSession()
        onboardingTracker.trackStep('getVisitorResponse_started')

        // Désactiver toggle au démarrage
        setToggleDisabled(true)
    }, [visitorEvent, setToggleDisabled])

    // FlyTo est maintenant géré dans visitorOnboarding.tsx pour se déclencher avant le montage de l'EventCard

    // Étape 3: Toast après flyTo (4s) - Cas A ou Cas B
    useEffect(() => {
        if (!visitorEvent || hasShownInvitationToastRef.current) return

        const timer = setTimeout(() => {
            // Cas B : Toast "Bonjour" si user + response existent
            if (hasUserAndResponse && currentUserName) {
                showToast({
                    title: `Bonjour ${currentUserName}, comment ça va aujourd'hui ? 👋`,
                    message: `Voulez-vous modifier votre réponse à ${visitorEvent.title} ?`,
                    type: 'info',
                    position: 'top',
                    duration: 8000,
                })
                hasShownInvitationToastRef.current = true
                onboardingTracker.trackStep('bonjour_toast_shown')
                return
            }

            // Cas A : Toast invitation si pas de réponse existante
            if (!hasResponse) {
                showToast({
                    title: `Tu es invité à ${visitorEvent.title || 'cet événement'}! 👋`,
                    message: 'Tap sur le pin bleu pour afficher l\'événement !',
                    type: 'info',
                    position: 'bottom',
                    // Pas de duration - attend le clic sur le pin
                })

                hasShownInvitationToastRef.current = true
                onboardingTracker.trackStep('invitation_toast_shown')
            }
        }, 4000) // 1s + 3s

        return () => clearTimeout(timer)
    }, [visitorEvent, showToast, hasResponse, hasUserAndResponse, currentUserName])

    // Plus besoin de synchroniser selectedEventRef : on utilise visitorEvent directement

    // Transition à la connexion
    useEffect(() => {
        if (isAuthenticated) {
            // Réactiver interactions map et fade-out fake pins
            const map = window.getMap?.() as { dragPan?: { enable: () => void }; scrollZoom?: { enable: () => void } } | undefined
            if (map) {
                map.dragPan?.enable()
                map.scrollZoom?.enable()
            }

            // Séquence de transition à la connexion
            if (window.fadeOutFakePins) {
                window.fadeOutFakePins()
            }

            setTimeout(() => {
                try {
                    sessionStorage.setItem('fomo-just-signed-up', 'true')
                } catch { }

                setTimeout(() => {
                    try {
                        sessionStorage.setItem('fomo-pop-filterbar', 'true')
                    } catch { }

                    setTimeout(() => {
                        safeShowToast({
                            title: '🎉 Bienvenue sur FOMO',
                            message: 'Voici les vrais événements autour de toi !',
                            type: 'success',
                            duration: 5000,
                        })
                    }, 3200)
                }, 1000)
            }, 200)

            onAuthenticated?.()
        }
    }, [isAuthenticated, safeShowToast, onAuthenticated])

    // Handler pour détecter l'ouverture de l'EventCard
    const handleEventCardOpened = useCallback((event: Event | null) => {
        // Ne pas déclencher si le visitor a déjà répondu
        if (hasResponse) return

        if (!event || hasOpenedVisitorEventCardRef.current || !visitorEvent) return

        const eventId = event.id
        const isVisitorEvent = eventId === visitorEvent.id

        if (!isVisitorEvent) return

        hasOpenedVisitorEventCardRef.current = true
        onboardingTracker.trackStep('eventcard_opened')

        // Étape 4: Toast détails après 3s (seulement si les détails n'ont pas déjà été étendus)
        setTimeout(() => {
            if (hasShownDetailsToastRef.current || hasExpandedDetailsRef.current) return

            showToast({
                title: 'Tu veux plus de détails ? 👀',
                message: 'Tap sur l\'étiquette de l\'événement !',
                type: 'info',
                position: 'top'
                // Pas de duration - attend le clic sur l'étiquette
            })

            hasShownDetailsToastRef.current = true
            onboardingTracker.trackStep('details_toast_shown')
        }, 3000) // 3s après ouverture EventCard
    }, [visitorEvent, showToast, hasResponse])

    // Handler pour fermer le toast invitation lors du clic sur le pin
    const handlePinClick = useCallback(() => {
        if (hasShownInvitationToastRef.current) {
            // Ne pas fermer le toast fake events
            if (!isFakeEventsToast(currentToast)) {
                hideToast()
            }
            onboardingTracker.trackStep('pin_clicked')
        }
    }, [hideToast, currentToast, isFakeEventsToast])

    // Les callbacks sont maintenant passés directement via props (visitorMode)

    // Callback appelé au clic sur l'étiquette (indépendant de l'état des boutons)
    const handleLabelClick = useCallback(() => {
        // Ne pas déclencher si le visitor a déjà répondu ou si déjà traité
        if (hasResponse || hasActivatedButtonsRef.current) return

        // Marquer que les détails ont été étendus (trigger principal)
        if (!hasExpandedDetailsRef.current) {
            hasExpandedDetailsRef.current = true
            onboardingTracker.trackStep('details_expanded')
        }

        hasActivatedButtonsRef.current = true
        // Ne pas fermer le toast fake events
        if (!isFakeEventsToast(currentToast)) {
            hideToast() // Fermer toast détails
        }
        onboardingTracker.trackStep('label_clicked')
        onboardingTracker.trackStep('buttons_activated')

        // Étape 6-7: Timer du toast impatience démarre dès le clic sur l'étiquette (5s après)
        // Le toast s'affichera après 5s si l'utilisateur n'a pas cliqué sur une réponse entre-temps
        setTimeout(() => {
            if (hasShownImpatienceToastRef.current) return
            // Ne pas afficher si le visitor a déjà répondu
            if (hasResponse) return

            // Ne pas afficher si le visiteur a cliqué sur une réponse entre-temps
            if (hasClickedResponseRef.current) {
                return
            }

            // Vérification supplémentaire dans sessionStorage (pour sécurité)
            try {
                const pendingResponse = sessionStorage.getItem('fomo-visit-pending-response')
                if (pendingResponse) {
                    // Le visiteur a cliqué sur une réponse entre-temps, ne pas afficher le toast
                    return
                }
            } catch {
                // Ignorer si sessionStorage indisponible
            }

            const organizerName = getOrganizerName(visitorEvent, users)

            // Ne pas remplacer le toast fake events
            safeShowToast({
                title: `${organizerName} attend ta réponse avec impatience ! ⏰`,
                message: 'Seras-tu présent ?',
                type: 'info',
                position: 'top',
                bounceAnimation: true
                // Pas de duration - attend le clic sur une réponse
            })

            hasShownImpatienceToastRef.current = true
            onboardingTracker.trackStep('impatience_toast_shown')
        }, 5000) // 5s après clic sur l'étiquette
    }, [visitorEvent, users, safeShowToast, hideToast, hasResponse, currentToast, isFakeEventsToast])

    // Fonction pour afficher le toast éducatif (commune aux deux cas)
    const showCloseEventCardToast = useCallback((selectedEvent: Event | null) => {
        if (hasShownCloseEventCardToastRef.current) return

        // Ne pas afficher le toast si l'EventCard est déjà fermée (selectedEvent est null)
        if (!selectedEvent) {
            return
        }

        // Ne pas afficher le toast pour les fake events (uniquement pour le visitorEvent)
        const isFakeEvent = selectedEvent.id?.startsWith('fake-') || selectedEvent.isFake
        if (isFakeEvent) {
            return
        }

        // Ne pas afficher le toast si ce n'est pas le visitorEvent
        if (selectedEvent.id !== visitorEvent.id) {
            return
        }

        showToast({
            title: 'Pour fermer l\'event card, tu peux tap en dehors de l\'étiquette 🫵',
            message: '',
            type: 'info',
            position: 'top',
            duration: 5000
        })

        hasShownCloseEventCardToastRef.current = true
        onboardingTracker.trackStep('exploration_toast_shown')
    }, [showToast, visitorEvent])

    // showCloseEventCardToast est maintenant exposé directement via return

    // Handler appelé quand le formulaire visitor est complété (Cas A)
    const handleVisitorFormCompleted = useCallback((organizerName: string) => {
        console.log('📝 [useGetVisitorResponse] handleVisitorFormCompleted appelé', {
            organizerName,
            visitorRegistrationCompletedRef: visitorRegistrationCompletedRef.current
        })

        if (visitorRegistrationCompletedRef.current) {
            console.log('⚠️ [useGetVisitorResponse] Inscription déjà complétée, retour')
            return
        }

        visitorRegistrationCompletedRef.current = true
        setVisitorRegistrationCompleted(true)
        console.log('✅ [useGetVisitorResponse] visitorRegistrationCompleted mis à true')

        // Le toast éducatif est maintenant géré dans useVisitorResponseHandlers (mutualisé avec Cas B)
    }, [])

    // ===== FIN DE LA SECTION : getVisitorResponse =====
    // La réponse est ajoutée à la fermeture de l'EventCard
    // visitorEvent ne change jamais (prop stable)
    // hasUserAndResponse ne change qu'une fois au montage (déterminé au début)
    const handleEventCardClose = useCallback(() => {
        hasOpenedVisitorEventCardRef.current = false

        // Fork : Si user + response existent et qu'une réponse a été modifiée, marquer l'inscription comme complétée
        if (hasUserAndResponse && !visitorRegistrationCompletedRef.current) {
            setVisitorRegistrationCompleted(true)
            visitorRegistrationCompletedRef.current = true
        }

        // Marquer la fin de la section getVisitorResponse
        onboardingTracker.trackStep('getVisitorResponse_completed')

        // Toast "Merci pour ta réponse" (commun aux deux cas)
        const organizerName = getOrganizerName(visitorEvent, users)
        if (!hasShownThankYouToastRef.current) {
            hasShownThankYouToastRef.current = true
            safeShowToast({
                title: 'Merci pour ta réponse ! 🙏',
                message: `${organizerName} est maintenant prévenu(e).`,
                type: 'success',
                position: 'top',
                duration: 3000
            })
            onboardingTracker.trackStep('thankyou_toast_shown')
        }

        // Toast "Pssst!" dans 5s (uniquement si le toggle privacy n'a pas été activé)
        if (!hasShownPssstToastRef.current && visitorEvent && !isPublicMode) {
            hasShownPssstToastRef.current = true
            setTimeout(() => {
                // Vérifier la valeur actuelle de isPublicMode au moment de l'exécution
                if (!isPublicModeRef.current) {
                    safeShowToast({
                        title: 'Pssst! 👀',
                        message: (
                            <>
                                Sait-on que sur FOMO, tu peux aussi découvrir les events publics autour de chez toi ?
                                Bascule en mode public via un tap sur le bouton en haut à droite !
                            </>
                        ),
                        type: 'info',
                        position: 'top',
                    })
                    onboardingTracker.trackStep('pssst_toast_shown')
                    onboardingTracker.trackStep('visitorDiscoverPublicMode_started')
                }
            }, 5000) // 5s après fermeture de l'EventCard
        }
    }, [hasUserAndResponse, visitorEvent, users, safeShowToast, isPublicMode])

    // Callback pour marquer qu'une réponse a été cliquée (pour éviter d'afficher le toast impatience)
    const markResponseClicked = useCallback(() => {
        hasClickedResponseRef.current = true
    }, [])

    // Fonction wrapper pour hideToast qui ne ferme pas le toast fake events
    const safeHideToast = useCallback(() => {
        if (!isFakeEventsToast(currentToast)) {
            hideToast()
        }
    }, [hideToast, currentToast, isFakeEventsToast])

    // Gérer les handlers de réponses visitor
    // Utiliser visitorEvent comme selectedEvent initial, mais passer getSelectedEvent pour les vérifications dans les timeouts
    const responseHandlers = useVisitorResponseHandlers(
        visitorEvent, // Utilisé pour les vérifications initiales
        handleVisitorFormCompleted,
        handleEventCardClose,
        hasUserAndResponse, // Passer le fork
        safeHideToast, // Passer safeHideToast pour fermer le toast impatience (sans fermer le toast fake events)
        showCloseEventCardToast, // Passer le toast éducatif (mutualisé entre Cas A et Cas B)
        getSelectedEvent, // Passer getSelectedEvent pour vérifier selectedEvent actuel dans les timeouts
        markResponseClicked // Passer le callback pour marquer qu'une réponse a été cliquée
    )

    // Calculer si les boutons doivent être désactivés initialement (une seule fois)
    // Si hasResponse est true, les boutons sont activés dès le début
    // Sinon, EventCard les activera au clic sur l'étiquette
    const responseButtonsDisabled = !hasResponse

    return {
        // États et handlers pour DiscoverPage
        responseButtonsDisabled,
        responseHandlers,
        visitorRegistrationCompleted,
        hasUserAndResponse, // Exposer pour le fork
        handleEventCardClose,
        onLabelClick: handleLabelClick,
        onEventCardOpened: handleEventCardOpened,
        onPinClick: handlePinClick,
        onHideToast: safeHideToast, // Utiliser safeHideToast pour protéger le toast fake events
        showCloseEventCardToast
    }
}

