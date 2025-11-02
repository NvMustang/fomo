/**
 * FOMO MVP - Header Component
 * 
 * Header global de l'application avec logo et actions
 */

import React from 'react'
import { Logo } from '@/components'
import { usePrivacy } from '@/contexts/PrivacyContext'

interface HeaderProps {
    // Props can be added here if needed
}

export const Header: React.FC<HeaderProps> = React.memo(() => {
    const { isPublicMode, togglePrivacy, isToggleDisabled } = usePrivacy()

    return (
        <header className="app-header">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* 1. Logo moderne avec indicateur privacy */}
                <Logo
                    showPrivacy={true}
                />

                {/* 2. Toggle button moderne */}
                <div className="header-actions">
                    <div
                        className={`toggle-switch ${isToggleDisabled ? 'toggle-switch--disabled' : ''}`}
                        onClick={isToggleDisabled ? undefined : togglePrivacy}
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
        </header >
    )
})

Header.displayName = 'Header'

export default Header
