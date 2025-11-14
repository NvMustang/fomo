/**
 * OnboardingStateContext - Machine à états pour le parcours visitor
 * 
 * Gère les étapes du parcours visitor de manière linéaire et prévisible
 * Remplace la logique complexe avec useEffect/setTimeout/intervals
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react'
import type { Event } from '@/types/fomoTypes'
import { onboardingTracker, type OnboardingStep } from '@/onboarding/utils/onboardingTracker'
import { getOnboardingToast, type OnboardingToastKey, ONBOARDING_TOASTS } from '@/onboarding/utils/onboardingToasts'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/contexts/AuthContext'
import { useDataContext } from '@/contexts/DataContext'
import { usePrivacy } from '@/contexts/PrivacyContext'

// ===== TYPES =====

/**
 * Étapes du parcours visitor onboarding
 * Note: 'loading' supprimé - géré dans App.tsx (OnboardingFlowWithData)
 */
export type VisitorOnboardingStep =
    | 'event_loaded'         // Pin visible, toast "invitation" (buttons OFF, toggle OFF)
    | 'show_details'         // EventCard ouvert, toast "showDetails", attente clic étiquette (buttons OFF, toggle OFF)
    | 'response_enabled'     // Étiquette cliquée, toast "impatience", boutons actifs (buttons ON, toggle OFF)
    | 'response_given'       // Réponse choisie, animation stars, toast "closeEventCardPrompt" → attente fermeture manuelle
    | 'visitor_modal'        // Modal registration affiché APRÈS eventcard_closed (SKIP si event public OU existing visitor)
    | 'registration_done'    // Plus utilisé, gardé pour compatibilité
    | 'close_eventcard'      // Plus utilisé, gardé pour compatibilité (transition directe response_given → eventcard_closed)
    | 'eventcard_closed'     // EventCard fermé, toast "thankYouOrganizer" (2s), transition directe après 3s
    | 'teasing_public'       // Toast "pssst", attente clic toggle (SKIP si event public)
    | 'exploring_public'     // Toggle cliqué OU event public, toast "welcomePublic" (si event privé), exploration libre, toast "fakeEvents" après 30s
    | 'ready_to_signup'      // CTA cliqué → redirection vers WelcomeScreen (tracking: nombre de visitors qui cliquent)
    | 'onboarding_complete'  // Conversion visitor → user réussie (tracking: nombre de conversions)

/**
 * Flags techniques pour le chargement des ressources
 */
export interface OnboardingFlags {
    mapReady: boolean                // Carte MapLibre initialisée et prête
    // eventsLoaded supprimé : on utilise directement eventsReady de DataContext
}

/**
 * État complet du parcours onboarding
 */
export interface OnboardingState {
    // Étape actuelle
    step: VisitorOnboardingStep

    // Flags techniques
    flags: OnboardingFlags

    // Données du parcours
    onboardingEventId: string | null
    onboardingEvent: Event | null
    visitorName: string | null
    visitorEmail: string | null
    isExistingVisitor: boolean        // Visitor qui a déjà un nom dans localStorage (skip certains toasts)

    // États UI
    privacyToggleEnabled: boolean      // Toggle privacy actif
    showHaloPulse: boolean             // Halo pulse sur toggle (true à teasing_public, false à exploring_public)
    hasToggledPrivacy: boolean         // User a cliqué sur toggle

    // Erreurs
    error: string | null
}

/**
 * Actions disponibles pour modifier l'état
 */
export interface OnboardingActions {
    // Transitions d'étapes
    transitionTo: (step: VisitorOnboardingStep, reason?: string) => void

    // Mise à jour des flags
    setMapReady: () => void
    // setEventsLoaded supprimé : on utilise directement eventsReady de DataContext

    // Mise à jour des données
    setOnboardingEventId: (eventId: string) => void
    setOnboardingEvent: (event: Event | null) => void
    setVisitorInfo: (name: string, email?: string) => void

    // Mise à jour des états UI
    setPrivacyToggleEnabled: (enabled: boolean) => void
    setHasToggledPrivacy: (toggled: boolean) => void

    // Gestion d'erreur
    setError: (error: string | null) => void

    // Reset
    reset: () => void
}

// Type interne pour le contexte (non exporté car uniquement utilisé en interne)
interface OnboardingStateContextType {
    state: OnboardingState
    actions: OnboardingActions
}

// ===== CONTEXT =====

const OnboardingStateContext = createContext<OnboardingStateContextType | undefined>(undefined)

// ===== PROVIDER =====

/**
 * Calculer l'état initial de l'onboarding
 * Fait de manière synchrone pour éviter un useEffect inutile
 * 
 * Note: visitor-id maintenant géré par AuthContext (source unique de vérité)
 */
const getInitialState = (): OnboardingState => {
    // Note: Le chargement est maintenant géré dans App.tsx (OnboardingFlowWithData)
    // On commence directement à 'event_loaded' car les données sont garanties prêtes
    return {
        step: 'event_loaded', // Commence directement ici car données déjà chargées dans App.tsx
        flags: {
            mapReady: false
        },
        onboardingEventId: null, // Sera déterminé depuis DataContext
        onboardingEvent: null,
        visitorName: null,
        visitorEmail: null,
        isExistingVisitor: false,
        privacyToggleEnabled: false,
        showHaloPulse: false,
        hasToggledPrivacy: false,
        error: null
    }
}

/**
 * Transitions autorisées entre étapes
 * Note: 'loading' supprimé car géré dans App.tsx
 */
const ALLOWED_TRANSITIONS: Record<VisitorOnboardingStep, VisitorOnboardingStep[]> = {
    'event_loaded': ['show_details', 'exploring_public'], // Permettre transition vers exploring_public si toggle activé
    'show_details': ['response_enabled', 'exploring_public'], // Permettre transition vers exploring_public si toggle activé
    'response_enabled': ['response_given', 'exploring_public'], // Permettre transition vers exploring_public si toggle activé
    'response_given': ['eventcard_closed', 'exploring_public'], // Permettre transition vers exploring_public si toggle activé
    'visitor_modal': ['teasing_public', 'exploring_public', 'onboarding_complete'], // teasing_public/exploring_public après modal, onboarding_complete si skip
    'registration_done': ['onboarding_complete'], // Plus utilisé, gardé pour compatibilité
    'close_eventcard': ['eventcard_closed'],
    'eventcard_closed': ['visitor_modal', 'teasing_public', 'exploring_public'], // Toast "thankYouOrganizer" (2s) → transition directe après 3s
    'teasing_public': ['exploring_public', 'show_details'], // Permettre de boucler : fermeture EventCard ou clic pin → retour à show_details (EventCard ouverte)
    'exploring_public': ['ready_to_signup'], // CTA cliqué → ready_to_signup (tracking)
    'ready_to_signup': ['onboarding_complete'], // Conversion visitor → user → onboarding_complete (tracking)
    'onboarding_complete': [] // État final
}

export const OnboardingStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, setState] = useState<OnboardingState>(getInitialState)
    const { showToast, hideToast } = useToast()
    const { user } = useAuth()
    const { eventFromUrl, eventsReady } = useDataContext()
    const { setToggleDisabled, isPublicMode } = usePrivacy()

    // Ref pour éviter les toasts en double
    const shownToastsRef = useRef<Set<string>>(new Set())
    // Ref pour stocker le step actuel (pour vérifier dans les setTimeout)
    const currentStepRef = useRef<VisitorOnboardingStep>(state.step)
    // Ref pour suivre l'état précédent de user.isVisitor (pour détecter la conversion)
    const wasVisitorRef = useRef(user.isVisitor)

    // Synchroniser la ref avec le state
    useEffect(() => {
        currentStepRef.current = state.step
    }, [state.step])

    // ===== TRANSITIONS =====

    const transitionTo = useCallback((newStep: VisitorOnboardingStep, _reason?: string) => {
        // Valider la transition AVANT de fermer le toast et mettre à jour le state
        // Utiliser currentStepRef pour avoir la valeur la plus récente
        const currentStep = currentStepRef.current
        const allowedSteps = ALLOWED_TRANSITIONS[currentStep]

        if (!allowedSteps.includes(newStep)) {
            console.error(`❌ [OnboardingState] Transition invalide: ${currentStep} → ${newStep}`)
            return
        }

        // Fermer le toast AVANT setState pour éviter l'erreur React
        // "Cannot update a component while rendering a different component"
        hideToast()

        // Maintenant mettre à jour le state
        setState(prev => {
            // Nettoyer la ref des toasts affichés lors de la transition
            // Les toasts avec durée se ferment automatiquement, les toasts persistants restent jusqu'à interaction
            shownToastsRef.current.clear()

            // Mapper les étapes du state machine vers les étapes du tracker
            const trackerStepMap: Record<VisitorOnboardingStep, OnboardingStep> = {
                'event_loaded': 'eventcard_opened',
                'show_details': 'details_toast_shown',
                'response_enabled': 'label_clicked',
                'response_given': 'form_completed',
                'visitor_modal': 'getVisitorResponse_started',
                'registration_done': 'getVisitorResponse_completed',
                'close_eventcard': 'getVisitorResponse_completed',
                'eventcard_closed': 'getVisitorResponse_completed',
                'teasing_public': 'visitorDiscoverPublicMode_started',
                'exploring_public': 'visitorDiscoverPublicMode_started',
                'ready_to_signup': 'signup_clicked',
                'onboarding_complete': 'user_account_created'
            }

            if (trackerStepMap[newStep]) {
                onboardingTracker.trackStep(trackerStepMap[newStep])
            }

            // Gérer les états UI spéciaux selon le step
            let updates: Partial<OnboardingState> = { step: newStep }

            // Activer le toggle et le halo pulse APRÈS visitor_modal (peu importe si skip ou confirm)
            // Cela se fait quand on arrive à teasing_public (event privé) ou exploring_public (event public ou après toggle)
            if (newStep === 'teasing_public') {
                updates = { ...updates, showHaloPulse: true, privacyToggleEnabled: true }
            }

            if (newStep === 'exploring_public') {
                // Désactiver le halo (toggle activé) et activer le toggle
                updates = { ...updates, showHaloPulse: false, privacyToggleEnabled: true }
            }

            // Conserver l'event existant (déjà dans le state)
            return {
                ...prev,
                ...updates
            }
        })
    }, [eventFromUrl, hideToast])

    // ===== FLAGS =====
    // Note: setVisitorIdCreated supprimé car géré par AuthContext


    const setMapReady = useCallback(() => {
        setState(prev => ({
            ...prev,
            flags: { ...prev.flags, mapReady: true }
        }))
        console.log('✅ [OnboardingState] mapReady = true')
    }, [])

    // ===== DONNÉES =====

    const setOnboardingEventId = useCallback((eventId: string) => {
        setState(prev => ({ ...prev, onboardingEventId: eventId }))
    }, [])

    const setOnboardingEvent = useCallback((event: Event | null) => {
        setState(prev => ({ ...prev, onboardingEvent: event }))
    }, [])

    const setVisitorInfo = useCallback((name: string, email?: string) => {
        setState(prev => ({
            ...prev,
            visitorName: name,
            visitorEmail: email || null,
            isExistingVisitor: true // Devient existing visitor
        }))
    }, [])

    const setPrivacyToggleEnabled = useCallback((enabled: boolean) => {
        setState(prev => ({ ...prev, privacyToggleEnabled: enabled }))
    }, [])

    const setHasToggledPrivacy = useCallback((toggled: boolean) => {
        setState(prev => ({ ...prev, hasToggledPrivacy: toggled }))
    }, [])

    // ===== ERREUR =====

    const setError = useCallback((error: string | null) => {
        setState(prev => ({ ...prev, error }))
    }, [])

    // ===== RESET =====

    const reset = useCallback(() => {
        setState(getInitialState())
    }, [])

    // ===== TRANSITION AUTOMATIQUE VERS event_loaded + CENTRAGE CARTE =====

    useEffect(() => {
        // Centrer la carte sur l'event quand la carte est prête
        // Note: Le chargement est maintenant géré dans App.tsx, on commence directement à event_loaded
        // Délai de 0,5s pour attendre que les pins soient montés sur la carte
        if (state.step === 'event_loaded' &&
            state.flags.mapReady &&
            eventFromUrl &&
            typeof window !== 'undefined' &&
            (window as any).centerMapOnEvent) {

            const timer = setTimeout(() => {
                const map = typeof window !== 'undefined' && (window as any).getMap ? (window as any).getMap() : null
                const mapStateBefore = map ? {
                    zoom: map.getZoom(),
                    center: map.getCenter() ? [map.getCenter().lng, map.getCenter().lat] : null
                } : null
                console.log('🗺️ [OnboardingState] Centrage automatique sur l\'event (après délai 0,5s)', {
                    eventId: eventFromUrl.id,
                    eventTitle: eventFromUrl.title,
                    eventVenue: eventFromUrl.venue,
                    mapStateBefore
                })
                    ; (window as any).centerMapOnEvent(eventFromUrl, 3000)

                // Log après appel pour vérifier si la fonction a bien été exécutée
                setTimeout(() => {
                    const mapStateAfter = map ? {
                        zoom: map.getZoom(),
                        center: map.getCenter() ? [map.getCenter().lng, map.getCenter().lat] : null
                    } : null
                    console.log('🗺️ [OnboardingState] État carte après centerMapOnEvent:', mapStateAfter)
                }, 100)
            }, 500)

            return () => {
                console.log('🔍 [OnboardingState] Cleanup timer centrage (useEffect se réexécute)')
                clearTimeout(timer)
            }
        }
    }, [state.step, state.flags, eventFromUrl, eventsReady, transitionTo])

    // ===== GESTION DU TOGGLE PRIVACY SELON ISNEWVISITOR =====

    /**
     * Gérer l'activation/désactivation du toggle privacy selon isNewVisitor
     * - Si isNewVisitor = true : toggle désactivé au début de l'onboarding
     * - Si isNewVisitor = false : toggle activé dès le début
     * - Le toggle est activé quand on arrive à teasing_public ou exploring_public
     */
    useEffect(() => {
        // Si on est dans l'onboarding (pas encore complété)
        if (state.step === 'onboarding_complete') {
            // Onboarding terminé : activer le toggle
            setToggleDisabled(false)
            return
        }

        // Si isNewVisitor = false (visiteur existant), activer le toggle dès le début
        if (!user.isNewVisitor) {
            setToggleDisabled(false)
            return
        }

        // Si isNewVisitor = true, désactiver le toggle au début
        // Activer le toggle quand on arrive à teasing_public ou exploring_public
        if (user.isNewVisitor) {
            if (state.step === 'teasing_public' || state.step === 'exploring_public') {
                setToggleDisabled(false)
            } else {
                // Désactiver le toggle pour les autres étapes si isNewVisitor = true
                setToggleDisabled(true)
            }
        }
    }, [state.step, user.isNewVisitor, setToggleDisabled])

    // ===== TRANSITION AUTOMATIQUE VERS exploring_public QUAND TOGGLE PRIVACY =====

    /**
     * Écouter les changements de privacy mode et déclencher la transition vers exploring_public
     * si l'utilisateur est un visitor et passe en mode public
     * 
     * IMPORTANT: Cette logique est centralisée ici pour éviter d'avoir du code d'onboarding
     * dans des composants partagés comme Header
     */
    useEffect(() => {
        // Ne déclencher la transition que pour les visitors
        if (!user.isVisitor) {
            return
        }

        // Ne pas déclencher si l'onboarding est déjà complété
        if (state.step === 'onboarding_complete') {
            return
        }

        // Ne pas déclencher si on est déjà à exploring_public
        if (state.step === 'exploring_public') {
            return
        }

        // Si on passe en mode public, déclencher la transition vers exploring_public
        if (isPublicMode) {
            const currentStep = state.step
            console.log(`🎯 [OnboardingState] Toggle privacy: passage privé → public depuis étape ${currentStep}`)
            transitionTo('exploring_public', 'Toggle privacy: passage privé → public')
            setHasToggledPrivacy(true)
        }
    }, [isPublicMode, user.isVisitor, state.step, transitionTo, setHasToggledPrivacy])

    // Actions stables (tous useCallback, donc référence stable)
    const actions = {
        transitionTo,
        setMapReady,
        setOnboardingEventId,
        setOnboardingEvent,
        setVisitorInfo,
        setPrivacyToggleEnabled,
        setHasToggledPrivacy,
        setError,
        reset
    }

    // ===== TOASTS AUTOMATIQUES =====

    /**
     * Affiche un toast d'onboarding avec délai et tracking
     * @param key - Clé du toast
     * @param params - Paramètres pour le toast
     * @param expectedStep - Step attendu pour afficher le toast (optionnel, vérifie si on est toujours dans ce step)
     */
    const showOnboardingToast = useCallback((
        key: OnboardingToastKey,
        params: Record<string, string> = {},
        expectedStep?: VisitorOnboardingStep
    ) => {
        // Éviter les doublons
        if (shownToastsRef.current.has(key)) {
            return
        }

        const config = ONBOARDING_TOASTS[key]
        const toastConfig = getOnboardingToast(key, params)

        // Appliquer le délai si configuré
        const delay = ('delay' in config && config.delay !== undefined) ? config.delay : 0

        setTimeout(() => {
            // Vérifier qu'on est toujours dans le step attendu (si spécifié)
            if (expectedStep && currentStepRef.current !== expectedStep) {
                console.log(`⏭️ [OnboardingToasts] Toast ${key} annulé: step actuel (${currentStepRef.current}) !== step attendu (${expectedStep})`)
                return
            }

            showToast(toastConfig)
            shownToastsRef.current.add(key)
            console.log(`🎯 [OnboardingToasts] Affiché: ${key}`)
        }, delay)
    }, [showToast])

    // Pas de timer automatique : l'utilisateur doit fermer l'EventCard manuellement
    // Le toast "closeEventCardPrompt" s'affiche pour éduquer l'utilisateur
    // La fermeture est détectée via callback onEventCardClose passé depuis OnboardingFlow

    /**
     * Transition automatique : eventcard_closed → visitor_modal ou teasing_public/exploring_public
     * 
     * Toast "thankYouOrganizer" dure 2s (géré en interne par le toast)
     * Délai de 1,5s avant l'affichage du modal (pour nouveau visitor + event privé)
     * 
     * Logique :
     * - Nouveau visitor (!isExistingVisitor) + event privé → visitor_modal (avec délai 1,5s)
     * - Existing visitor → skip visitor_modal (a déjà un nom)
     * - Event public → skip visitor_modal (pas besoin de registration)
     */
    useEffect(() => {
        if (state.step !== 'eventcard_closed') return

        const isPublic = eventFromUrl?.isPublic
        // Utiliser user.isNewVisitor depuis AuthContext (source de vérité)
        const isNewVisitor = user.isNewVisitor
        const isExisting = !isNewVisitor

        // Logs ciblés avant transition vers visitor_modal
        if (isNewVisitor && !isPublic) {
            const map = typeof window !== 'undefined' && (window as any).getMap ? (window as any).getMap() : null
            const mapStateBefore = map ? {
                zoom: map.getZoom(),
                center: map.getCenter() ? [map.getCenter().lng, map.getCenter().lat] : null,
                bounds: map.getBounds() ? {
                    ne: [map.getBounds().getNorthEast().lng, map.getBounds().getNorthEast().lat],
                    sw: [map.getBounds().getSouthWest().lng, map.getBounds().getSouthWest().lat]
                } : null
            } : null
            console.log('🔍 [OnboardingState] Avant transition visitor_modal - État carte:', {
                mapReady: state.flags.mapReady,
                mapStateBefore,
                centerMapOnEventAvailable: typeof window !== 'undefined' && typeof (window as any).centerMapOnEvent === 'function',
                eventFromUrl: eventFromUrl ? { id: eventFromUrl.id, title: eventFromUrl.title, venue: eventFromUrl.venue } : null
            })
        }

        // Skip visitor_modal si event public OU si existing visitor (a déjà un nom)
        if (isPublic || isExisting) {
            // Attendre que le toast "thankYouOrganizer" soit affiché (délai 1s) et terminé (durée 2s)
            // Total: 3s pour laisser le temps au toast de s'afficher complètement
            // exploring_public uniquement si l'app est en mode public (toggle activé)
            // Sinon, passer par teasing_public pour encourager l'activation du toggle
            const shouldGoToExploringPublic = isPublicMode
            const nextStep = shouldGoToExploringPublic ? 'exploring_public' : 'teasing_public'
            const timer = setTimeout(() => {
                transitionTo(nextStep, `Skip visitor_modal (${isPublic ? 'event public' : 'existing visitor'}) → ${shouldGoToExploringPublic ? 'exploring_public' : 'teasing_public'}`)
            }, 3000) // 3 secondes (1s délai toast + 2s durée toast)

            return () => {
                clearTimeout(timer)
            }
        } else if (isNewVisitor) {
            // Nouveau visitor + event privé → afficher visitor_modal après délai de 3s
            // (cohérent avec la fin du toast "thankYouOrganizer" qui dure 2s avec délai 1s)
            const timer = setTimeout(() => {
                transitionTo('visitor_modal', 'Nouveau visitor → afficher modal registration')
            }, 3000) // 3 secondes

            return () => {
                clearTimeout(timer)
            }
        }
    }, [state.step, eventFromUrl, user.isNewVisitor, state.flags.mapReady, transitionTo, isPublicMode])

    /**
     * Déclencher les toasts automatiquement selon l'étape
     * IMPORTANT: Ne pas afficher les toasts d'onboarding pour les utilisateurs connectés (non-visitors)
     */
    useEffect(() => {
        // Ne pas afficher les toasts d'onboarding si l'utilisateur n'est pas un visitor
        if (!user.isVisitor) {
            return
        }

        const { step } = state

        // Mapping étape → toast(s)
        switch (step) {
            case 'event_loaded':
                // Attendre que la carte soit prête avant d'afficher le toast
                // (mapReady garantit que la carte est montée et prête)
                if (!state.flags.mapReady) {
                    return // Ne pas afficher le toast tant que la carte n'est pas prête
                }
                // Si existing visitor (pas newVisitor et a un nom), afficher "bonjour", sinon "invitation"
                // Utiliser user.isNewVisitor depuis AuthContext (source de vérité)
                if (!user.isNewVisitor && user.name) {
                    showOnboardingToast('bonjour', {
                        userName: user.name,
                        eventTitle: eventFromUrl?.title || 'ces événements auxquels tu es invité'
                    }, 'event_loaded')
                } else {
                    showOnboardingToast('invitation', {
                        eventTitle: eventFromUrl?.title || 'cet événement'
                    }, 'event_loaded')
                }
                break

            case 'show_details':
                // Afficher le toast pour tous les visitors (même existing)
                showOnboardingToast('showDetails', {}, 'show_details')
                break

            case 'response_enabled':
                // Afficher le toast pour tous les visitors (même existing)
                showOnboardingToast('impatience', {
                    organizerName: eventFromUrl?.organizerName || 'L\'organisateur'
                }, 'response_enabled')
                break

            case 'response_given':
                // Toast éducatif : apprendre à fermer l'EventCard en cliquant sur la map
                showOnboardingToast('closeEventCardPrompt', {}, 'response_given')
                break



            case 'eventcard_closed':
                showOnboardingToast('thankYouOrganizer', {
                    organizerName: eventFromUrl?.organizerName || 'L\'organisateur'
                }, 'eventcard_closed')
                break

            case 'teasing_public':
                // Toast "pssst" : afficher si pas d'eventFromUrl (existing visitor) OU si event privé (skip si event public)
                if (!eventFromUrl || !eventFromUrl.isPublic) {
                    showOnboardingToast('pssst', {}, 'teasing_public')
                }
                break

            case 'exploring_public':
                // Toast "welcomePublic" uniquement si event privé (skip si event public)
                // Affiché immédiatement quand on arrive à exploring_public (après toggle ou si event public)
                if (eventFromUrl && !eventFromUrl.isPublic) {
                    showOnboardingToast('welcomePublic', {}, 'exploring_public')
                }
                // Toast "fakeEvents" avec delay 30s (duration null = reste affiché)
                showOnboardingToast('fakeEvents', {}, 'exploring_public')
                break

            case 'ready_to_signup':
                // Pas de toast, juste redirection vers WelcomeScreen
                break

            // onboarding_complete : marqué lors de la conversion visitor → user (pas de toast)
        }
    }, [state.step, state.flags.mapReady, eventFromUrl, user.isNewVisitor, user.name, user.isVisitor, showOnboardingToast, transitionTo])

    /**
     * Détecter la conversion visitor → user et marquer onboarding_complete
     * Cette logique est dans le Provider pour rester active même après redirection
     */
    useEffect(() => {
        // Si on était visitor et qu'on ne l'est plus → conversion réussie
        if (wasVisitorRef.current && !user.isVisitor) {
            // Vérifier qu'on est dans ready_to_signup ou exploring_public (pas déjà complété)
            if (state.step === 'ready_to_signup' || state.step === 'exploring_public') {
                console.log('✅ [OnboardingState] Conversion visitor → user détectée, marquage onboarding_complete')
                transitionTo('onboarding_complete', 'Conversion visitor → user réussie')
            }
        }
        // Mettre à jour la référence
        wasVisitorRef.current = user.isVisitor
    }, [user.isVisitor, state.step, transitionTo])

    const value: OnboardingStateContextType = {
        state,
        actions
    }

    return (
        <OnboardingStateContext.Provider value={value}>
            {children}
        </OnboardingStateContext.Provider>
    )
}

// ===== HOOK =====

export const useOnboardingState = (): OnboardingStateContextType => {
    const context = useContext(OnboardingStateContext)
    if (!context) {
        throw new Error('useOnboardingState must be used within OnboardingStateProvider')
    }
    return context
}

// Hook optionnel qui retourne null si le contexte n'est pas disponible
export const useOnboardingStateOptional = (): OnboardingStateContextType | null => {
    const context = useContext(OnboardingStateContext)
    return context || null
}

