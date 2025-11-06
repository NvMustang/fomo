/**
 * FOMO MVP - Sign Up Modal
 * 
 * Modal d'inscription affiché en bas de l'écran avec bouton "S'inscrire sur FOMO"
 * Si la ville n'est pas dans sessionStorage, demande la ville avant d'ouvrir WelcomeScreen
 */

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { getCity } from '@/utils/getSessionId'

interface SignUpModalProps {
    isOpen: boolean
    onClose: () => void
    onSignUp: () => void
    showButtonDelay?: number // Délai en ms avant d'afficher le bouton
}

export const SignUpModal: React.FC<SignUpModalProps> = ({
    isOpen,
    onClose,
    onSignUp,
    showButtonDelay = 0
}) => {
    const [showButton, setShowButton] = useState(false)
    const [showCityForm, setShowCityForm] = useState(false)
    const [city, setCity] = useState('')
    const [isCityValid, setIsCityValid] = useState(false)

    // Vérifier si la ville est dans sessionStorage au montage et quand isOpen change
    useEffect(() => {
        if (!isOpen) {
            setShowButton(false)
            setShowCityForm(false)
            setCity('')
            setIsCityValid(false)
            return
        }

        // Vérifier si la ville est déjà dans sessionStorage ou localStorage
        try {
            const savedCity = getCity()

            if (savedCity) {
                // Ville déjà présente, afficher le bouton normalement
                const timer = setTimeout(() => {
                    setShowButton(true)
                }, showButtonDelay)
                return () => clearTimeout(timer)
            } else {
                // Ville absente, afficher le formulaire de ville
                const timer = setTimeout(() => {
                    setShowCityForm(true)
                }, showButtonDelay)
                return () => clearTimeout(timer)
            }
        } catch {
            // En cas d'erreur storage, afficher le formulaire de ville
            const timer = setTimeout(() => {
                setShowCityForm(true)
            }, showButtonDelay)
            return () => clearTimeout(timer)
        }
    }, [isOpen, showButtonDelay])

    const handleCitySubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (city.trim() && isCityValid) {
            // Sauvegarder la ville dans sessionStorage
            try {
                sessionStorage.setItem('fomo-visit-city', city.trim())
            } catch {
                // Ignorer si sessionStorage indisponible
            }
            // Fermer le formulaire et appeler onSignUp
            setShowCityForm(false)
            onSignUp()
        }
    }

    if (!isOpen) return null

    // Afficher le formulaire de ville si nécessaire
    if (showCityForm) {
        const portalTarget = typeof document !== 'undefined' ? document.body : null
        if (!portalTarget) return null

        return createPortal(
            <div className="modal_overlay" onClick={onClose}>
                <div className="modal_container">
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content modal-form">
                            <h2 style={{
                                margin: 0,
                                marginBottom: 'var(--sm)',
                                fontSize: 'var(--text-lg)',
                                fontWeight: 'var(--font-weight-semibold)'
                            }}>
                                D'où viens-tu ?
                            </h2>
                            <p className="auth-subtitle" style={{ marginBottom: 'var(--md)' }}>
                                Nous cherchons les événements proche de toi !
                            </p>
                            <form onSubmit={handleCitySubmit} className="modal-form">
                                <div className="form-section">
                                    <label className="form-label">Votre ville *</label>
                                    <AddressAutocomplete
                                        value={city}
                                        onChange={setCity}
                                        onAddressSelect={() => {
                                            // Optionnel : on pourrait stocker les coordonnées pour plus tard
                                        }}
                                        onValidationChange={setIsCityValid}
                                        placeholder="Ex: Bruxelles, New York, Paris..."
                                        className="form-input"
                                    />
                                </div>
                                <div className="form-section">
                                    <div className="form-actions">
                                        <Button
                                            type="submit"
                                            disabled={!city.trim() || !isCityValid}
                                            variant="primary"
                                            style={{ width: '100%' }}
                                        >
                                            Continuer
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>,
            portalTarget
        )
    }

    // Afficher le bouton d'inscription normal
    if (!showButton) return null

    return (
        <Button
            variant="primary"
            size="lg"
            onClick={onSignUp}
            style={{
                width: '70%',
                position: 'fixed',
                bottom: 'var(--md)',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 'var(--z-index-modal)',
                maxWidth: '360px',
                animation: 'fadeIn 1s ease-in, buttonPulse 2s ease-in-out 2s infinite',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
        >
            <span className="map-teaser-text" data-size="xs">
                <span className="map-teaser-word">S'inscrire sur F

                <img
                        src="/globe-icon.svg"
                        alt="O"
                        style={{
                            height: '1em',
                            width: '1em',
                            display: 'block',
                            filter: 'brightness(0) invert(1)',
                            transform: 'translateY(-0.05em)'
                        }}
                    />M

                    <img
                        src="/lock-icon.svg"
                        alt="O"
                        style={{
                            height: '1em',
                            width: '1em',
                            display: 'block',
                            filter: 'brightness(0) invert(1)',
                            transform: 'translateY(-0.05em)'
                        }}
                    />
                    
                </span>
            </span>
        </Button>
    )
}

SignUpModal.displayName = 'SignUpModal'

