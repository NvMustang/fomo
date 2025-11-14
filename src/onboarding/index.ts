/**
 * FOMO MVP - Onboarding Module Index
 * 
 * Export centralisé pour tous les composants, hooks et utilitaires d'onboarding
 */

// Composants principaux
export { OnboardingFlow } from './OnboardingFlow'

// Hooks
export { useStarsAnimation } from './hooks/useStarsAnimation'

// Modals
export { UserConnexionModal } from './modals/UserConnexionModal'
export { WelcomeScreen } from './modals/WelcomeScreen'
export { VisitorRegistrationModal } from './modals/VisitorRegistrationModal'
export { UserRegistrationModal } from './modals/UserRegistrationModal'

// Utils
export { onboardingTracker } from './utils/onboardingTracker'
export { autoSaveOnboarding } from './utils/autoSaveOnboarding'
export type { OnboardingStep, OnboardingStepEvent, OnboardingSession, OnboardingData } from './utils/onboardingTracker'

