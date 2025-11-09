/**
 * FOMO MVP - Header Component
 * 
 * Header global de l'application avec logo et actions
 */

import React, { useState, useEffect } from 'react'
import { Logo, BetaModal } from '@/components'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { useAuth } from '@/contexts/AuthContext'
import { useBookmarkletBatch } from '@/hooks/useBookmarkletBatch'
import { BookmarkletBatchModal } from '@/components/modals/BookmarkletBatchModal'

interface HeaderProps {
    // Props can be added here if needed
}

// ID utilisateur autorisé à utiliser le batch bookmarklet
const ALLOWED_USER_ID = import.meta.env.VITE_BOOKMARKLET_ALLOWED_USER_ID || ''

export const Header: React.FC<HeaderProps> = React.memo(() => {
    const { isPublicMode, togglePrivacy, isToggleDisabled } = usePrivacy()
    const { isAuthenticated, user } = useAuth()
    const { batchSize } = useBookmarkletBatch()
    const [isBetaModalOpen, setIsBetaModalOpen] = useState(false)
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
    const [hasToggled, setHasToggled] = useState(false)
    const [isVisitorMode, setIsVisitorMode] = useState(false)

    // Vérifier si l'utilisateur est autorisé à utiliser le batch
    const isUserAllowed = !ALLOWED_USER_ID || (user?.id === ALLOWED_USER_ID)

    // Logs pour suivre les vérifications du bouton d'import
    useEffect(() => {
        console.log('🔍 [Header] === VÉRIFICATIONS BOUTON IMPORT ===')
        console.log('🔍 [Header] batchSize:', batchSize)
        console.log('🔍 [Header] ALLOWED_USER_ID (env):', ALLOWED_USER_ID || '(non défini)')
        console.log('🔍 [Header] user?.id:', user?.id || '(non authentifié)')
        console.log('🔍 [Header] isAuthenticated:', isAuthenticated)
        console.log('🔍 [Header] isUserAllowed:', isUserAllowed)
        console.log('🔍 [Header] Bouton visible?:', batchSize > 0 && isUserAllowed)
        
        if (batchSize > 0 && !isUserAllowed) {
            console.warn('⚠️ [Header] Événements en attente mais utilisateur non autorisé')
            console.warn('⚠️ [Header] ALLOWED_USER_ID attendu:', ALLOWED_USER_ID)
            console.warn('⚠️ [Header] User ID actuel:', user?.id)
        }
        
        if (isUserAllowed && batchSize === 0) {
            console.log('ℹ️ [Header] Utilisateur autorisé mais aucun événement en attente')
        }
        
        console.log('🔍 [Header] === FIN VÉRIFICATIONS ===')
    }, [batchSize, isUserAllowed, user?.id, isAuthenticated, ALLOWED_USER_ID])

    // Détecter si on est en mode visitor (parcours d'intégration)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search)
        const eventId = urlParams.get('event')
        setIsVisitorMode(eventId !== null && !isAuthenticated)
    }, [isAuthenticated])

    return (
        <>
            <header className="app-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* 1. Logo moderne avec indicateur privacy */}
                    <Logo
                        showPrivacy={true}
                    />

                    {/* 2. Boutons centrés */}
                    <div className="header-beta-container" style={{ display: 'flex', justifyContent: 'center', flex: 1, gap: '8px' }}>
                        {batchSize > 0 && isUserAllowed && (
                            <button
                                className="button primary"
                                onClick={() => setIsBatchModalOpen(true)}
                                type="button"
                                aria-label={`Importer ${batchSize} événement${batchSize > 1 ? 's' : ''} du bookmarklet`}
                                style={{ 
                                    fontSize: 'var(--text-sm)', 
                                    padding: 'var(--xs) var(--sm)', 
                                    position: 'relative', 
                                    zIndex: 2001,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <span>📥 Importer</span>
                                <span style={{
                                    background: 'rgba(255, 255, 255, 0.3)',
                                    borderRadius: '10px',
                                    padding: '2px 6px',
                                    fontSize: 'var(--text-xs)',
                                    fontWeight: 'bold'
                                }}>
                                    {batchSize}
                                </span>
                            </button>
                        )}
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
                            className={`toggle-switch ${isToggleDisabled ? 'toggle-switch--disabled' : ''} ${!hasToggled && !isToggleDisabled && isVisitorMode ? 'privacy-toggle-halo' : ''}`}
                            onClick={isToggleDisabled ? undefined : () => {
                                setHasToggled(true)
                                togglePrivacy()
                            }}
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
            <BookmarkletBatchModal
                isOpen={isBatchModalOpen}
                onClose={() => setIsBatchModalOpen(false)}
            />
        </>
    )
})

Header.displayName = 'Header'

export default Header
