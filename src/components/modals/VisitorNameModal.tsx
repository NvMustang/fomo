/**
 * FOMO MVP - Visitor Name Modal
 *
 * Modal dynamique pour demander le nom d'un visitor avec 3 variantes émotionnelles selon la réponse
 */

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components'
import { useModalScrollHint } from '@/hooks'
import { VALID_TLDS } from '@/types/fomoTypes'

interface VisitorNameModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (name: string, email?: string, city?: string) => void
    organizerName?: string
    responseType?: 'going' | 'participe' | 'maybe' | 'interested' | 'not_interested' | 'not_there' // Type de réponse pour déterminer la variante
}

// Configuration des variantes émotionnelles
const VARIANT_CONFIG = {
    going: {
        emoji: '🎉',
        title: 'Heureux que vous soyez présent !',
        message: (organizerName: string) => `Laissez vos coordonnées à ${organizerName} afin qu'il/elle prépare votre venue.`,
        gradient: 'linear-gradient(135deg, #ff6b6b 0%, #ffa07a 100%)',
        borderColor: '#ff6b6b',
        vibe: 'enthousiaste'
    },
    participe: {
        emoji: '🎉',
        title: 'Heureux que vous soyez présent !',
        message: (organizerName: string) => `Laissez vos coordonnées à ${organizerName} afin qu'il/elle prépare votre venue.`,
        gradient: 'linear-gradient(135deg, #ff6b6b 0%, #ffa07a 100%)',
        borderColor: '#ff6b6b',
        vibe: 'enthousiaste'
    },
    interested: {
        emoji: '✨',
        title: 'Intéressé ? On a hâte de vous voir !',
        message: (organizerName: string) => `Laissez vos coordonnées à ${organizerName} pour qu'il/elle puisse vous tenir informé.`,
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderColor: '#667eea',
        vibe: 'attentif'
    },
    maybe: {
        emoji: '🤔',
        title: 'Pas sûr ? On garde une place pour toi 😉',
        message: (organizerName: string) => `Laissez tout de même vos coordonnées à ${organizerName} afin de l'informer de votre incertitude.`,
        gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        borderColor: '#4facfe',
        vibe: 'curieux'
    },
    not_interested: {
        emoji: '😢',
        title: 'Pas dispo ? On t\'attend la prochaine fois ❤️',
        message: (organizerName: string) => `Avertissez ${organizerName} que vous ne pourrez être présent malheureusement...`,
        gradient: 'linear-gradient(135deg, #95a5a6 0%, #bdc3c7 100%)',
        borderColor: '#95a5a6',
        vibe: 'bienveillant'
    },
    not_there: {
        emoji: '😔',
        title: 'Oh, triste que tu ne sois pas là...',
        message: (organizerName: string) => `Informez ${organizerName} que vous ne pourrez pas être présent cette fois.`,
        gradient: 'linear-gradient(135deg, #95a5a6 0%, #bdc3c7 100%)',
        borderColor: '#95a5a6',
        vibe: 'bienveillant'
    }
}

export const VisitorNameModal: React.FC<VisitorNameModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    organizerName = 'L\'organisateur',
    responseType = 'going'
}) => {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [city, setCity] = useState('')
    const [emailError, setEmailError] = useState('')

    const isValidEmail = (emailValue: string): boolean => {
        // Email optionnel, donc vide = valide
        if (!emailValue.trim()) return true

        // Validation : vérifier la structure de l'email
        const atIndex = emailValue.indexOf('@')
        const dotIndex = emailValue.lastIndexOf('.')

        // Vérifier qu'il y a un @ et un point après le @
        if (atIndex === -1 || dotIndex === -1 || dotIndex <= atIndex) {
            return false
        }

        // Vérifier qu'il y a des caractères avant le @
        if (atIndex === 0) {
            return false
        }

        // Vérifier qu'il y a des caractères entre le @ et le point
        if (dotIndex - atIndex <= 1) {
            return false
        }

        // Vérifier qu'il y a des caractères après le point
        if (dotIndex === emailValue.length - 1) {
            return false
        }

        // Vérifier que le TLD (domaine principal) est valide
        const tld = emailValue.substring(dotIndex + 1).toLowerCase()

        if (!VALID_TLDS.includes(tld as typeof VALID_TLDS[number])) {
            return false
        }

        return true
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (name.trim()) {
            // Valider l'email s'il est renseigné
            const emailTrimmed = email.trim()
            if (emailTrimmed && !isValidEmail(emailTrimmed)) {
                setEmailError('Veuillez saisir une adresse email valide')
                return
            }
            setEmailError('')
            // L'animation des étoiles est jouée AVANT l'ouverture du modal (sur les boutons de réponse)
            // Ici on confirme simplement
            onConfirm(name.trim(), emailTrimmed || undefined, city.trim() || undefined)
            setName('')
            setEmail('')
            setCity('')
            onClose()
        }
    }

    // Animation de scroll à l'ouverture du modal pour indiquer qu'il y a du contenu scrollable
    const modalContentRef = useModalScrollHint(isOpen)

    if (!isOpen) return null

    // Utiliser directement le type de réponse sans normalisation
    const config = VARIANT_CONFIG[responseType] || VARIANT_CONFIG.going

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
                                Nom *
                            </label>
                            <input
                                id="visit-name"
                                type="text"
                                className="form-input"
                                placeholder="Entrez votre nom"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                                aria-label="Votre nom"
                                required
                            />
                            <p className="form-help">
                                Mais en fait, qui êtes vous ? Entrez un nom suffisamment explicite pour que <strong>{organizerName}</strong> vous reconnaisse sans mal !
                            </p>
                        </div>

                        <div className="form-section">
                            <label htmlFor="visit-email" className="form-label">
                                Adresse e-mail
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
                                aria-label="Votre adresse e-mail"
                            />
                            {emailError && (
                                <div className="error-message">
                                    {emailError}
                                </div>
                            )}
                            <p className="form-help">
                                Laissez-nous votre email. FOMO vous préviendra des derniers détails transmis par votre hôte !
                            </p>
                        </div>

                        <div className="form-section">
                            <label htmlFor="visit-city" className="form-label">
                                Ville
                            </label>
                            <input
                                id="visit-city"
                                type="text"
                                className="form-input"
                                placeholder="Ex: Bruxelles, Liège, Paris..."
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                aria-label="Votre ville"
                            />
                            <p className="form-help">
                                Dans quelle ville habitez-vous ? Cela nous aide à vous proposer des événements près de chez vous.
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

VisitorNameModal.displayName = 'VisitorNameModal'
export default VisitorNameModal
