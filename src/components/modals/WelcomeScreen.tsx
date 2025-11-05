/**
 * WelcomeScreen - Écran d'accueil avec fond dégradé et logo FOMO
 * Utilisé pour :
 * - L'écran de bienvenue avec modal d'authentification (quand non authentifié)
 * - L'écran de chargement avec spinner (quand authentifié mais données pas prêtes)
 */

import React from 'react'
import { motion } from 'framer-motion'
import { AuthModal } from '@/components/modals/AuthModal'
import { useAuth } from '@/contexts/AuthContext'
import { Logo } from '@/components/ui/Logo'

interface WelcomeScreenProps {
    showSpinner?: boolean
    message?: string
    isFadingOut?: boolean
    partialHeight?: boolean // Si true, prend seulement 70% de la hauteur
    cta?: {
        label: string
        onClick: () => void
    }
}

type LogoSize = 'sm' | 'md' | 'lg' | '2xl'

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
    showSpinner = false,
    message = "Chargement...",
    isFadingOut = false,
    partialHeight = false,
    cta
}) => {
    const { isAuthenticated } = useAuth()

    // Afficher le spinner si showSpinner est true OU si l'utilisateur est authentifié (transition fluide) et pas de CTA
    const shouldShowSpinner = (showSpinner || isAuthenticated) && !cta

    // Taille du logo toujours en 2xl sur l'écran de chargement
    const logoSize: LogoSize = '2xl'
    // Déterminer le délai d'animation selon le contexte
    const animationDelay = shouldShowSpinner ? 0 : 0.3
    const animationDuration = shouldShowSpinner ? 0.6 : 1.5

    return (
        <div className={`loading-screen ${isFadingOut ? 'fading-out' : ''} ${partialHeight ? 'loading-screen-partial' : ''}`}>
            <motion.div
                className="loading-content"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: animationDuration, ease: "easeOut", delay: animationDelay }}
            >
                <Logo size={logoSize} />
                {shouldShowSpinner && (
                    <>
                        <motion.div
                            className="spinner"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, rotate: 360 }}
                            transition={{
                                opacity: { duration: 0.3 },
                                rotate: { duration: 1, repeat: Infinity, ease: "linear" }
                            }}
                        />
                        <p className="loading-text">{message}</p>
                    </>
                )}
                {!shouldShowSpinner && message && (
                    <p className="loading-text">{message}</p>
                )}
                {cta && (
                    <button
                        onClick={cta.onClick}
                        className="button primary"
                        style={{
                            marginTop: 'var(--md)',
                            padding: 'var(--sm) var(--lg)',
                            fontSize: 'var(--text-base)',
                            fontWeight: 'var(--font-weight-semibold)'
                        }}
                    >
                        {cta.label}
                    </button>
                )}
            </motion.div>
            {!isAuthenticated && !showSpinner && !cta && (
                <div className="welcome-auth-overlay">
                    <AuthModal useVisitorStyle={partialHeight} />
                </div>
            )}
        </div>
    )
}

