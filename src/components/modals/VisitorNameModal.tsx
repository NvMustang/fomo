/**
 * FOMO MVP - Visitor Name Modal
 *
 * Modal pour demander le nom d'un visitor avant qu'il réponde à un événement
 */

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components'

interface VisitorNameModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: (name: string, email?: string) => void
    organizerName?: string
}

export const VisitorNameModal: React.FC<VisitorNameModalProps> = ({ isOpen, onClose, onConfirm, organizerName }) => {
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (name.trim()) {
            onConfirm(name.trim(), email.trim() || undefined)
            setName('')
            setEmail('')
            onClose()
        }
    }

    if (!isOpen) return null

    const modalContent = (
        <div className="modal_overlay" onClick={onClose}>
            <div className="modal_container">
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-content modal-form">
                        {organizerName && (
                            <div className="form-section">
                                <p style={{
                                    fontSize: 'var(--text-sm)',
                                    color: 'var(--text)',
                                    marginBottom: 'var(--sm)',
                                    lineHeight: 1.5
                                }}>
                                    Laissez vos coordonnées à <strong>{organizerName}</strong> <br />Pour être tenu informé des détails.
                                </p>
                            </div>
                        )}

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
                                onChange={(e) => setEmail(e.target.value)}
                                aria-label="Votre adresse e-mail"
                            />
                            <p className="form-help">* Champ requis</p>
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
                                >
                                    Confirmer
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

