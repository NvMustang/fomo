/**
 * FOMO MVP - Logo Component
 * 
 * Logo moderne avec indicateur de privacy
 * Utilise les SVG comme dans WelcomeScreen
 */

import React, { useContext } from 'react'
import { PrivacyContext } from '@/contexts/PrivacyContext'

interface LogoProps {
    size?: 'sm' | 'md' | 'lg' | '2xl'
    showPrivacy?: boolean
    className?: string
}

export const Logo: React.FC<LogoProps> = React.memo(({
    size = 'sm',
    showPrivacy = false,
    className = ''
}) => {
    // Utiliser useContext directement pour éviter l'erreur si PrivacyProvider n'est pas disponible
    const privacyContext = useContext(PrivacyContext)
    const isPublicMode = privacyContext?.isPublicMode ?? true // Valeur par défaut si contexte non disponible


    return (
        <div className={`logo-container ${className}`}>
            <div className="logo-content">
                <h1 className={`logo-text`} data-size={size} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.1em' }}>
                    F
                    <img
                        src="/globe-icon.svg"
                        alt="O"
                        style={{
                            height: '1em',
                            width: '1em',
                            display: 'inline-block',
                            verticalAlign: 'middle'
                        }}
                    />
                    M
                    <img
                        src="/lock-icon.svg"
                        alt="O"
                        style={{
                            height: '1em',
                            width: '1em',
                            display: 'inline-block',
                            verticalAlign: 'middle',

                        }}
                    />
                </h1>
                {showPrivacy && (
                    <div className="logo-badge">
                        {isPublicMode ? 'PUBLIC' : 'PRIVATE'}
                    </div>
                )}
            </div>
        </div>
    )
})

Logo.displayName = 'Logo'

export default Logo
