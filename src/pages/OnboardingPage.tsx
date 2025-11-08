/**
 * Onboarding Page - Page Dashboard Onboarding
 * 
 * Page dédiée pour accéder au dashboard onboarding via /onboarding
 */

import OnboardingDashboard from '@/components/ui/OnboardingDashboard'

const OnboardingPage: React.FC = () => {
    return (
        <div className="onboarding-page">
            <OnboardingDashboard />
        </div>
    )
}

export default OnboardingPage

