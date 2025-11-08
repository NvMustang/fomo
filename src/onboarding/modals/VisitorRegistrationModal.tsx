/**
 * FOMO MVP - Visitor Registration Modal
 *
 * Modal dynamique pour demander le nom d'un visitor avec 3 variantes émotionnelles selon la réponse
 */

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components'
import { useModalScrollHint } from '@/hooks'
import { isValidEmail } from '@/utils/emailValidation'
import { onboardingTracker } from '@/onboarding/utils/onboardingTracker'

interface VisitorRegistrationModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (name: string, email?: string) => void
    organizerName?: string
    responseType?: 'participe' | 'maybe' | 'not_there' // Type de réponse pour déterminer la variante
}

// Configuration des variantes émotionnelles
const VARIANT_CONFIG = {
    participe: {
        emoji: '🎉',
        title: 'Heureux que vous soyez présent !',
        message: (organizerName: string) => `Laissez vos coordonnées à ${organizerName} afin qu'il/elle prépare votre venue.`
    },
    maybe: {
        emoji: '🤔',
        title: 'Pas sûr ? On garde une place pour toi 😉',
        message: (organizerName: string) => `Laissez vos coordonnées à ${organizerName} afin de l'informer de votre incertitude.`
    },
    not_there: {
        emoji: '😔',
        title: 'Oh, triste que tu ne sois pas là...',
        message: (organizerName: string) => `Informez ${organizerName} que vous ne pourrez pas être présent cette fois.`
    }
}

export const VisitorRegistrationModal: React.FC<VisitorRegistrationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    organizerName = 'L\'organisateur',
    responseType = 'participe'
}) => {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [emailError, setEmailError] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (name.trim()) {
            // Valider l'email s'il est renseigné
            const emailTrimmed = email.trim()
            if (emailTrimmed && !isValidEmail(emailTrimmed)) {
                setEmailError('Veuillez saisir une adresse email valide')
                onboardingTracker.trackStep('visitor_form_email_error')
                return
            }
            setEmailError('')
            // L'animation des étoiles est jouée AVANT l'ouverture du modal (sur les boutons de réponse)
            // Ici on confirme simplement
            onConfirm(name.trim(), emailTrimmed || undefined)
            setName('')
            setEmail('')
            onClose()
        }
    }

    // Animation de scroll à l'ouverture du modal pour indiquer qu'il y a du contenu scrollable
    const modalContentRef = useModalScrollHint(isOpen)

    if (!isOpen) return null

    // Utiliser directement le type de réponse sans normalisation
    const config = VARIANT_CONFIG[responseType] || VARIANT_CONFIG.participe

    const modalContent = (
        <div className="modal_overlay" onClick={onClose}>
            <div className="modal_container">
                <div
                    className="modal visitor-modal-dynamic"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        ref={modalContentRef}
                        className="modal-content modal-form visitor-form-dynamic"
                    >
                        {/* Header avec emoji et titre */}
                        <div className="form-section visitor-form-header">
                            <div style={{ fontSize: '48px', marginBottom: 'var(--sm)' }}>
                                {config.emoji}
                            </div>
                            <h2 style={{
                                fontSize: 'var(--text-xl)',
                                fontWeight: 'var(--font-weight-bold)',
                                color: 'var(--text)',
                                margin: 0,
                                marginBottom: 'var(--sm)'
                            }}>
                                {config.title}
                            </h2>
                            <p style={{
                                fontSize: 'var(--text-md)',
                                color: 'var(--text)',
                                margin: 0,
                                lineHeight: 1.6
                            }}>
                                {config.message(organizerName)}
                            </p>
                        </div>

                        {/* Formulaire */}
                        <div className="form-section">
                            <label htmlFor="visit-name" className="form-label">
                                Nom
                                <span className="form-label-hint">Obligatoire</span>
                            </label>
                            <input
                                id="visit-name"
                                type="text"
                                className="form-input"
                                placeholder="Entrez votre nom"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onFocus={() => onboardingTracker.trackStep('visitor_form_name_focus')}
                                onBlur={() => onboardingTracker.trackStep('visitor_form_name_blur')}
                                autoFocus
                                aria-label="Votre nom"
                                required
                            />
                            <p className="form-help">
                                Mais en fait, qui êtes-vous ? 🤷‍♂️ <br /> Entrez un nom suffisamment explicite pour que <strong>{organizerName}</strong> vous reconnaisse sans mal !
                            </p>
                        </div>

                        <div className="form-section">
                            <label htmlFor="visit-email" className="form-label">
                                E-mail
                                <span className="form-label-hint">Non-obligatoire</span>
                            </label>
                            <input
                                id="visit-email"
                                type="email"
                                className="form-input"
                                placeholder="votre@email.com"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value)
                                    if (emailError) setEmailError('')
                                }}
                                onFocus={() => onboardingTracker.trackStep('visitor_form_email_focus')}
                                onBlur={() => onboardingTracker.trackStep('visitor_form_email_blur')}
                                aria-label="Votre adresse e-mail"
                            />
                            {emailError && (
                                <div className="error-message">
                                    {emailError}
                                </div>
                            )}
                            <p className="form-help">
                                Afin que FOMO puisse vous prévenir des derniers détails transmis par votre hôte !
                            </p>
                        </div>

                        <div className="form-section">
                            <div className="form-actions" style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 'var(--sm)'
                            }}>
                                <Button
                                    variant="primary"
                                    onClick={handleSubmit}
                                    disabled={!name.trim()}
                                    style={{ width: '100%' }}
                                    id="visitor-modal-submit-button"
                                >
                                    C'est parti ! ✈️
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={onClose}
                                    style={{ width: '100%' }}
                                >
                                    Annuler
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )

    // Utiliser un portail pour rendre le modal directement dans document.body
    // afin qu'il soit hors du stacking context de l'EventCard
    const portalTarget = typeof document !== 'undefined' ? document.body : null
    if (!portalTarget) return null

    return createPortal(modalContent, portalTarget)
}

VisitorRegistrationModal.displayName = 'VisitorRegistrationModal'
export default VisitorRegistrationModal
