/**
 * FOMO MVP - Header Component
 * 
 * Header global de l'application avec logo et actions
 */

import React, { useState } from 'react'
import { Logo, BetaModal } from '@/components'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { useOnboardingState } from '@/contexts/OnboardingStateContext'

export const Header: React.FC = React.memo(() => {
    const { isPublicMode, togglePrivacy, isToggleDisabled } = usePrivacy()
    const onboardingState = useOnboardingState()
    const [isBetaModalOpen, setIsBetaModalOpen] = useState(false)

    // Handler pour toggle privacy - la logique de transition est gérée dans OnboardingStateContext
    const handleToggleClick = () => {
        togglePrivacy()
    }

    return (
        <>
            <header className="app-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* 1. Logo moderne avec indicateur privacy */}
                    <Logo
                        showPrivacy={true}
                    />

                    {/* 2. Bouton Beta centré */}
                    <div className="header-beta-container" style={{ display: 'flex', justifyContent: 'center', flex: 1 }}>
                        <button
                            className="button secondary"
                            onClick={() => setIsBetaModalOpen(true)}
                            type="button"
                            aria-label="Ouvrir le formulaire de retour beta"
                            style={{ fontSize: 'var(--text-sm)', padding: 'var(--xs) var(--sm)', position: 'relative', zIndex: 2001 }}
                        >
                            Beta
                        </button>
                    </div>

                    {/* 3. Toggle button moderne */}
                    <div className="header-actions">
                        <div
                            className={`toggle-switch ${isToggleDisabled ? 'toggle-switch--disabled' : ''} ${onboardingState?.state.showHaloPulse ? 'privacy-toggle-halo' : ''}`}
                            onClick={isToggleDisabled ? undefined : handleToggleClick}
                            role="switch"
                            aria-checked={isPublicMode}
                            aria-disabled={isToggleDisabled}
                            aria-label="Basculer entre mode public et privé"
                            style={{
                                cursor: isToggleDisabled ? 'not-allowed' : 'pointer',
                                opacity: isToggleDisabled ? 0.5 : 1
                            }}
                        >
                            {/* Container visuel avec forme et icônes */}
                            <div className="toggle-track">
                                {/* Globe icon */}
                                <img
                                    src="/globe-icon.svg"
                                    alt="Mode public"
                                    className="toggle-icon"
                                />

                                {/* Lock icon */}
                                <img
                                    src="/lock-icon.svg"
                                    alt="Mode privé"
                                    className="toggle-icon"
                                />
                            </div>
                        </div>
                    </div>

                </div>
            </header>
            <BetaModal
                isOpen={isBetaModalOpen}
                onClose={() => setIsBetaModalOpen(false)}
            />
        </>
    )
})

Header.displayName = 'Header'

export default Header
