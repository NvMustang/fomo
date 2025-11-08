/**
 * FOMO MVP - User Registration Modal
 * 
 * Modal d'inscription complète (nom, ville, email)
 * Utilisé depuis UserConnexionModal ou visitorDiscoverPublicMode
 */

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components'
import { useModalScrollHint } from '@/hooks'
import { getCity } from '@/utils/getSessionId'
import { isValidEmail } from '@/utils/emailValidation'
import { onboardingTracker } from '@/onboarding/utils/onboardingTracker'
import { FomoDataManager } from '@/utils/dataManager'

interface UserRegistrationModalProps {
    isOpen: boolean
    onClose: () => void
    onSignUp: () => void // Callback après inscription réussie
    email?: string // Email pré-rempli (optionnel)
    renderInWelcomeScreen?: boolean // Si true, s'affiche dans WelcomeScreen sans createPortal
}

export const UserRegistrationModal: React.FC<UserRegistrationModalProps> = ({
    isOpen,
    onClose,
    onSignUp,
    email: initialEmail = '',
    renderInWelcomeScreen = false
}) => {
    const { login, isLoading } = useAuth()
    const dataManagerRef = useRef(new FomoDataManager())
    const [name, setName] = useState('')
    const [email, setEmail] = useState(initialEmail)
    const [city, setCity] = useState('')
    const [error, setError] = useState('')

    const modalContentRef = useModalScrollHint(isOpen)

    // Charger les données depuis sessionStorage au montage
    useEffect(() => {
        if (!isOpen) {
            setName('')
            setEmail(initialEmail || '')
            setCity('')
            setError('')
            return
        }

        // Charger email depuis sessionStorage si pas fourni
        if (!initialEmail) {
            try {
                const visitorEmail = sessionStorage.getItem('fomo-visit-email')
                if (visitorEmail && visitorEmail.trim()) {
                    setEmail(visitorEmail.trim())
                }
            } catch {
                // Ignorer si sessionStorage indisponible
            }
        }

        // Charger nom depuis sessionStorage
        try {
            const visitorName = sessionStorage.getItem('fomo-visit-name')
            if (visitorName && visitorName.trim()) {
                setName(visitorName.trim())
            }
        } catch {
            // Ignorer si sessionStorage indisponible
        }

        // Charger la ville depuis storage
        try {
            const savedCity = getCity()
            if (savedCity) {
                setCity(savedCity)
            }
        } catch {
            // Ignorer si storage indisponible
        }
    }, [isOpen, initialEmail])

    // Handler pour le formulaire d'inscription complet
    const handleRegistrationSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!name.trim()) {
            setError('Le nom est requis')
            return
        }

        if (!email.trim()) {
            setError('L\'email est requis')
            return
        }

        if (!isValidEmail(email.trim())) {
            setError('Veuillez saisir une adresse email valide')
            onboardingTracker.trackStep('user_form_email_error')
            return
        }

        if (!city.trim()) {
            setError('La ville est requise')
            return
        }

        try {
            // Géocoder la ville AVANT de créer le profil
            let lat: number | null = null
            let lng: number | null = null
            
            try {
                console.log('🌐 Géocodage de la ville:', city.trim())
                const addresses = await dataManagerRef.current.searchAddresses(city.trim(), { limit: 1 })
                
                if (addresses.length > 0) {
                    const firstResult = addresses[0]
                    lat = parseFloat(firstResult.lat)
                    lng = parseFloat(firstResult.lon)
                    console.log('✅ Coordonnées trouvées:', { lat, lng })
                } else {
                    console.warn('⚠️ Aucune coordonnée trouvée pour:', city.trim())
                }
            } catch (geocodeError) {
                console.error('❌ Erreur lors du géocodage:', geocodeError)
                // Ne pas bloquer l'inscription si le géocodage échoue
            }
            
            // Créer le profil avec toutes les données (y compris coordonnées) en une seule fois
            await login(name.trim(), city.trim(), email.trim(), undefined, lat, lng)
            
            // Track création de compte réussie
            onboardingTracker.trackStep('user_account_created')
            
            // Marquer le signup pour animation navbar
            try {
                sessionStorage.setItem('fomo-just-signed-up', 'true')
            } catch (e) {
                // Ignorer si sessionStorage indisponible
            }
            onSignUp()
        } catch (error) {
            setError('Erreur lors de la création du profil. Réessayez.')
            console.error('Erreur de création:', error)
        }
    }

    if (!isOpen) return null

    const modalContent = (
        <div className={`modal_container ${renderInWelcomeScreen ? 'modal-no-backdrop' : ''}`}>
            <div className={renderInWelcomeScreen ? 'modal modal-welcome' : 'modal'} onClick={(e) => e.stopPropagation()}>
                <div ref={modalContentRef} className="modal-content modal-form">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--md)' }}>
                        <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-semibold)' }}>Créer votre profil</h2>
                        <button
                            className="back-button"
                            onClick={onClose}
                            disabled={isLoading}
                            type="button"
                            aria-label="Retour"
                        >
                            ←
                        </button>
                    </div>
                    <p className="auth-subtitle">Complétez votre profil</p>
                    <form onSubmit={handleRegistrationSubmit} className="modal-form">
                        <div className="form-section">
                            <label className="form-label">
                                Votre nom
                                <span className="form-label-hint">Obligatoire</span>
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ex: Marie Dupont"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onFocus={() => onboardingTracker.trackStep('user_form_name_focus')}
                                onBlur={() => onboardingTracker.trackStep('user_form_name_blur')}
                                disabled={isLoading}
                                autoFocus
                            />
                        </div>

                        <div className="form-section">
                            <label className="form-label">
                                Votre ville
                                <span className="form-label-hint">Obligatoire</span>
                            </label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Ex: Bruxelles, New York, Paris..."
                                value={city}
                                onChange={(e) => {
                                    setCity(e.target.value)
                                    // Track focus sur le premier changement (approximation)
                                    if (!city && e.target.value) {
                                        onboardingTracker.trackStep('user_form_city_focus')
                                    }
                                }}
                                onFocus={() => onboardingTracker.trackStep('user_form_city_focus')}
                                onBlur={() => onboardingTracker.trackStep('user_form_city_blur')}
                                disabled={isLoading}
                            />
                        </div>

                        <div className="form-section">
                            <label className="form-label">
                                Email
                                {initialEmail ? (
                                    <span className="form-label-hint">Confirmé</span>
                                ) : (
                                    <span className="form-label-hint">Obligatoire</span>
                                )}
                            </label>
                            <input
                                type="email"
                                name="signEmail"
                                id="auth-signEmail"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onFocus={() => onboardingTracker.trackStep('user_form_email_focus')}
                                onBlur={() => onboardingTracker.trackStep('user_form_email_blur')}
                                disabled={isLoading || !!initialEmail}
                                required={!initialEmail}
                            />
                        </div>

                        {error && (
                            <div className="error-message">
                                {error}
                            </div>
                        )}

                        <div className="form-section">
                            <div className="form-actions">
                                <Button
                                    type="submit"
                                    disabled={isLoading || !name.trim() || !city.trim() || !email.trim()}
                                    variant="primary"
                                >
                                    Créer mon profil
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )

    // Si renderInWelcomeScreen est true, retourner directement le contenu (sera dans WelcomeScreen)
    if (renderInWelcomeScreen) {
        return modalContent
    }

    // Sinon, utiliser createPortal comme avant
    const portalTarget = typeof document !== 'undefined' ? document.body : null
    if (!portalTarget) return null

    return createPortal(
        <div className="modal_overlay" onClick={onClose}>
            {modalContent}
        </div>,
        portalTarget
    )
}

UserRegistrationModal.displayName = 'UserRegistrationModal'
