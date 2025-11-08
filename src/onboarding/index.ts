/**
 * FOMO MVP - Onboarding Module Index
 * 
 * Export centralisé pour tous les composants, hooks et utilitaires d'onboarding
 */

// Composants principaux
export { VisitorModeApp } from './visitorOnboarding'
export { VisitorDiscoverPublicMode } from './visitorDiscoverPublicMode'

// Hooks
// useLoadVisitorEvent et useGetVisitorResponse sont privés (utilisés uniquement dans visitorOnboarding.tsx)
export { useVisitorResponseHandlers } from './hooks/useVisitorResponseHandlers'
export { useStarsAnimation } from './hooks/useStarsAnimation'

// Modals
export { UserConnexionModal } from './modals/UserConnexionModal'
export { WelcomeScreen } from './modals/WelcomeScreen'
export { VisitorRegistrationModal } from './modals/VisitorRegistrationModal'
export { UserRegistrationModal } from './modals/UserRegistrationModal'

// Contexts (déplacé dans src/contexts/)
export { VisitorDataProvider, VisitorDataContext, type VisitorDataContextType } from '@/contexts/VisitorDataContext'

// Utils
export { onboardingTracker } from './utils/onboardingTracker'
export { autoSaveOnboarding } from './utils/autoSaveOnboarding'
export type { OnboardingStep, OnboardingStepEvent, OnboardingSession, OnboardingData } from './utils/onboardingTracker'

