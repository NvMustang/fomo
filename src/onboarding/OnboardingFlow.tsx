/**
 * FOMO MVP - Onboarding Flow Simplifié
 * 
 * Composant ultra-simple : RENDU PUR basé sur state.step
 * Toute la logique (transitions, timers) est dans OnboardingStateContext
 * Les délais UX sont gérés par les toast delays
 */

import React, { useCallback } from 'react'
import { useOnboardingState } from '@/contexts/OnboardingStateContext'
import { VisitorRegistrationModal } from './modals/VisitorRegistrationModal'
import DiscoverPage from '@/pages/DiscoverPage'
import { useAuth } from '@/contexts/AuthContext'
import { useDataContext } from '@/contexts/DataContext'
import { Header } from '@/components'

export const OnboardingFlow: React.FC = () => {
    const { state, actions } = useOnboardingState()
    const { saveVisitorInfo } = useAuth()
    const { eventFromUrl } = useDataContext()

    // ===== CALLBACKS POUR ONBOARDING =====

    // Clic sur pin → show_details (le toast se ferme automatiquement via transitionTo)
    // Depuis teasing_public, clic sur pin → show_details pour recommencer la boucle (EventCard déjà ouverte)
    const handlePinClick = useCallback(() => {
        if (state.step === 'event_loaded') {
            actions.transitionTo('show_details', 'Pin cliqué → EventCard ouverte')
        } else if (state.step === 'teasing_public') {
            // Clic sur pin depuis teasing_public → retour à show_details pour recommencer la boucle (EventCard déjà ouverte)
            actions.transitionTo('show_details', 'Pin cliqué depuis teasing_public → retour à show_details')
        }
    }, [state.step, actions])

    // Clic sur étiquette → response_enabled
    const handleLabelClick = useCallback(() => {
        if (state.step === 'show_details') {
            actions.transitionTo('response_enabled', 'Étiquette cliquée → boutons activés')
        }
    }, [state.step, actions])

    // Clic sur bouton réponse → response_given
    const handleResponseClick = useCallback(() => {
        if (state.step === 'response_enabled') {
            actions.transitionTo('response_given', 'Réponse choisie → animation stars')
        }
    }, [state.step, actions])

    // CTA signup cliqué → transition vers ready_to_signup puis redirection vers WelcomeScreen
    const handleCtaClick = useCallback(() => {
        if (state.step === 'exploring_public') {
            // Transitionner vers ready_to_signup pour tracker le clic sur le CTA
            actions.transitionTo('ready_to_signup', 'CTA cliqué → tracking signup_clicked')
            // Rediriger vers /exitonboarding pour afficher WelcomeScreen avec modal de connexion
            // Selon la table de décision : isVisitor + route /exitonboarding → WelcomeScreen (modal connexion)
            // onboarding_complete sera marqué automatiquement quand user.isVisitor passe à false
            const base = window.location.origin
            window.location.assign(`${base}/exitonboarding`)
        }
    }, [state.step, actions])

    // ===== HELPERS =====

    // Calculer les props visitorMode selon l'étape actuelle
    const getVisitorModeProps = useCallback(() => {
        const baseProps = { enabled: true }

        switch (state.step) {
            case 'event_loaded':
                return {
                    ...baseProps,
                    responseButtonsDisabled: true,
                    onPinClick: handlePinClick
                }
            case 'show_details':
                return {
                    ...baseProps,
                    responseButtonsDisabled: true,
                    onLabelClick: handleLabelClick
                }
            case 'response_enabled':
                return {
                    ...baseProps,
                    onResponseClick: handleResponseClick
                }
            case 'response_given':
                return {
                    ...baseProps,
                    onEventCardClose: () => {
                        // Fermeture EventCard en response_given → transition vers eventcard_closed
                        actions.transitionTo('eventcard_closed', 'EventCard fermée par clic sur map')
                    }
                }
            case 'teasing_public':
                return {
                    ...baseProps,
                    responseButtonsDisabled: true,
                    onPinClick: handlePinClick, // Permettre de cliquer sur un pin pour recommencer le cycle
                    onEventCardClose: () => {
                        // Fermeture EventCard en teasing_public → retour à show_details pour recommencer la boucle (EventCard déjà ouverte)
                        actions.transitionTo('show_details', 'EventCard fermée depuis teasing_public → retour à show_details')
                    }
                }
            default:
                return baseProps
        }
    }, [state.step, handlePinClick, handleLabelClick, handleResponseClick, actions, eventFromUrl])

    // ===== RENDU STABLE =====
    // DiscoverPage est toujours monté de manière stable pour éviter les réinitialisations de la carte
    // Les props visitorMode changent selon l'étape, mais le composant reste monté

    const visitorModeProps = getVisitorModeProps()

    // onMapReady uniquement pour event_loaded (première étape après chargement)
    const handleMapReady = state.step === 'event_loaded'
        ? () => actions.setMapReady()
        : undefined

    return (
        <>
            <Header />
            <DiscoverPage
                onMapReady={handleMapReady}
                visitorMode={visitorModeProps}
            />

            {/* Modal registration - rendu conditionnellement sans affecter DiscoverPage */}
            {state.step === 'visitor_modal' && (
                <VisitorRegistrationModal
                    isOpen={true}
                    organizerName={eventFromUrl?.organizerName || 'L\'organisateur'}
                    onClose={() => {
                        // onClose ne devrait plus être appelé (overlay désactivé, pas de bouton Annuler)
                        // Mais gardé pour compatibilité au cas où
                        if (state.step === 'visitor_modal') {
                            const isPublic = eventFromUrl?.isPublic
                            const nextStep = isPublic ? 'exploring_public' : 'teasing_public'
                            actions.transitionTo(nextStep, 'Visitor skipped registration → continuer onboarding')
                        }
                    }}
                    onConfirm={(name: string, email?: string) => {
                        // TRIGGER: Soumission du formulaire
                        // L'EventCard est déjà fermé, donc on passe directement à la suite de l'onboarding
                        if (state.step !== 'visitor_modal') {
                            return // Protection: ne transitionner que depuis visitor_modal
                        }

                        // Sauvegarder les données
                        saveVisitorInfo(name, email)
                        actions.setVisitorInfo(name, email)

                        // Transition vers la suite de l'onboarding selon le type d'event
                        const isPublic = eventFromUrl?.isPublic
                        const nextStep = isPublic ? 'exploring_public' : 'teasing_public'
                        actions.transitionTo(nextStep, 'Visitor info saved → continuer onboarding')
                    }}
                />
            )}

            {/* CTA "Découvrir les vrais événements" - rendu conditionnellement */}
            {state.step === 'exploring_public' && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: 'var(--lg)',
                        left: '50%',

                        zIndex: 1000
                    }}
                >
                    <button
                        className="cta-glassmorphism cta-centered"
                        onClick={handleCtaClick}
                    >
                        🌟 Connecte-toi sur FOMO
                    </button>
                </div>
            )}
        </>
    )
}
