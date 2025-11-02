/**
 * FOMO MVP - Beta Feedback Modal
 * 
 * Modal pour collecter les retours beta des utilisateurs
 */

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components'
import { getApiBaseUrl } from '@/config/env'
import { useToast } from '@/hooks'

interface BetaModalProps {
    isOpen: boolean
    onClose: () => void
}

export const BetaModal: React.FC<BetaModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth()
    const { showToast } = useToast()
    const [topic, setTopic] = useState('')
    const [message, setMessage] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    // Reset form when modal opens/closes
    useEffect(() => {
        if (!isOpen) {
            setTopic('')
            setMessage('')
            setError('')
        }
    }, [isOpen])

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('modal-open')
        } else {
            document.body.classList.remove('modal-open')
        }
        return () => {
            document.body.classList.remove('modal-open')
        }
    }, [isOpen])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (!topic.trim()) {
            setError('Le sujet est requis')
            return
        }

        if (!message.trim()) {
            setError('La description est requise')
            return
        }

        if (!user) {
            setError('Vous devez être connecté pour soumettre un retour')
            return
        }

        setIsLoading(true)

        try {
            const response = await fetch(`${getApiBaseUrl()}/beta`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userID: user.id,
                    topic: topic.trim(),
                    message: message.trim(),
                    createAt: new Date().toISOString()
                })
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }))
                throw new Error(errorData.error || 'Erreur lors de l\'envoi du formulaire')
            }

            showToast({
                title: 'Merci!',
                message: 'Votre retour a été enregistré avec succès.',
                type: 'success',
                duration: 3000
            })

            // Reset form and close modal
            setTopic('')
            setMessage('')
            onClose()
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erreur lors de l\'envoi du formulaire'
            setError(errorMessage)
            showToast({
                title: 'Erreur',
                message: errorMessage,
                type: 'error',
                duration: 3000
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }

    if (!isOpen) return null

    return (
        <div className="modal_overlay" onClick={handleOverlayClick}>
            <div className="modal_container">
                <div className="modal" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--md)' }}>
                            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
                                Retour Beta
                            </h2>
                            <button
                                className="back-button"
                                onClick={onClose}
                                disabled={isLoading}
                                type="button"
                                aria-label="Fermer"
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="modal-form">
                            <div className="form-section">
                                <label className="form-label">Sujet *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Ex: Bug, Suggestion, Question..."
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    disabled={isLoading}
                                    autoFocus
                                    required
                                />
                            </div>

                            <div className="form-section">
                                <label className="form-label">Description *</label>
                                <textarea
                                    className="form-input form-textarea"
                                    placeholder="Décrivez votre retour en détail..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    disabled={isLoading}
                                    rows={20}
                                    required
                                    style={{ minHeight: '300px' }}
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
                                        disabled={isLoading || !topic.trim() || !message.trim()}
                                        variant="primary"
                                    >
                                        {isLoading ? 'Envoi...' : 'Soumettre'}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default BetaModal

