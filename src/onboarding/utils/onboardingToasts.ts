/**
 * FOMO MVP - Configuration centralisée des toasts d'onboarding
 * 
 * Tous les toasts du parcours visitor avec leurs timings, messages et triggers
 * Utilisé par OnboardingStateContext pour afficher automatiquement les toasts
 */

import type { ToastMessage } from '@/components/ui/Toast'

export interface OnboardingToastConfig extends Omit<ToastMessage, 'title' | 'message'> {
    title: string | ((params: Record<string, string>) => string)
    message: string | ((params: Record<string, string>) => string)
    delay?: number // Délai avant affichage (ms)
    duration?: number // Durée d'affichage (ms)
    autoHide?: boolean // Si false, le toast reste jusqu'à interaction
    bounceAnimation?: boolean // Animation rebondissante
}

/**
 * Configuration de tous les toasts d'onboarding
 * Chaque clé correspond à une étape du parcours
 * 
 * Les valeurs par défaut sont définies dans _defaults et peuvent être surchargées
 * par chaque toast individuel
 */
export const ONBOARDING_TOASTS = {
    // ===== VALEURS PAR DÉFAUT =====
    _defaults: {
        type: 'info' as const,
        position: 'top' as const,
        autoHide: true,
        bounceAnimation: false
    },

    // ===== ÉTAPE 1 : ARRIVÉE SUR L'APP =====

    invitation: {
        title: (params: Record<string, string>) => `Tu es invité à ${params.eventTitle}! 👋`,
        message: 'Tap sur le pin bleu pour afficher l\'événement !',
        position: 'bottom' as const,
        delay: 4000, // 4s après le chargement
        
    },

    bonjour: {
        title: (params: Record<string, string>) => `Bonjour ${params.userName}, comment ça va aujourd'hui ? 👋`,
        message: (params: Record<string, string>) => `Veux-tu modifier ta réponse à ${params.eventTitle} ? \n Tap sur leur pin pour les afficher !`,
       
        delay: 1000, // 1s après le chargement
    },

    // ===== ÉTAPE 2 : INTERACTION AVEC L'EVENT CARD =====

    showDetails: {
        title: 'Tu veux plus de détails ? 📋',
        message: 'Tap sur l\'étiquette de l\'événement !',


        delay: 2000 // 2s après ouverture EventCard
    },

    impatience: {
        title: (params: Record<string, string>) => `${params.organizerName} attend ta réponse ! 🎯`,
        message: 'Alors seras-tu présent ?',


        delay: 3000, // 3s après activation boutons
        bounceAnimation: true
    },

    // ===== ÉTAPE 3 : APRÈS RÉPONSE =====

    closeEventCardPrompt: {
        title: 'Tap sur la map pour masquer l\'événement 👆',
        message: '',
       
        delay: 2000, // 2s après response_given (après animation stars)
        
    },

    thankYouOrganizer: {
        title: 'Merci pour ta réponse ! 🎉',
        message: (params: Record<string, string>) => `${params.organizerName} est maintenant au courant.`,
        type: 'success' as const,
        duration: 2000, // 2s d'affichage pour sentiment d'accomplissement
        delay: 1000 // 1s après fermeture EventCard
    },

    // ===== ÉTAPE 4 : DÉCOUVERTE MODE PUBLIC =====

    pssst: {
        title: 'Pssst... 👀',
        message: 'Sais-tu qu\'avec FOMO, tu peux découvrir plein d\'événements publiques autour de chez toi ?\nSwitch vers le mode public de FOMO avec un tap sur le bouton en haut à droite !',
        
        delay: 2000 // 2s après eventcard_closed
    },

    welcomePublic: {
        title: 'Bienvenue sur le mode public ! 🌍',
        message: 'Dans quel mode ? Rouge : Public, bleu : Privé. C\'est simple !',
        type: 'success' as const,
        duration: 10000,
        delay: 1000 // 1s après clic toggle
    },

    fakeEvents: {
        title: 'Ces événements te semblent FAKE ? C\'est normal, ils le sont ! 🎭',
        message: 'Ils sont là pour t\'entrainer à manier l\'app comme un chef 🫡. \nMaintenant que tu gères, connecte-toi et découvre les VRAIS événements 🚀',
        duration: null, // Reste affiché (attente clic CTA)
        delay: 30000, // Affiche après 30s d'exploration
        autoHide: false
    }
} as const

// Exclure _defaults du type des clés de toast
export type OnboardingToastKey = Exclude<keyof typeof ONBOARDING_TOASTS, '_defaults'>

/**
 * Helper pour obtenir un toast avec ses paramètres interpolés
 * Fusionne les valeurs par défaut avec les valeurs spécifiques du toast
 */
export function getOnboardingToast(
    key: OnboardingToastKey,
    params: Record<string, string> = {}
): ToastMessage {
    const defaults = ONBOARDING_TOASTS._defaults
    const config = ONBOARDING_TOASTS[key]

    return {
        title: typeof config.title === 'function' ? config.title(params) : config.title,
        message: typeof config.message === 'function' ? config.message(params) : config.message,
        type: ('type' in config ? config.type : defaults.type) as ToastMessage['type'],
        position: ('position' in config ? config.position : defaults.position) as ToastMessage['position'],
        duration: ('duration' in config ? (config.duration ?? undefined) : undefined),
        bounceAnimation: ('bounceAnimation' in config ? config.bounceAnimation : defaults.bounceAnimation) || undefined
    }
}

