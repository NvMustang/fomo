/**
 * Modal pour afficher et envoyer le batch d'événements du bookmarklet
 */

import React, { useState } from 'react'
import { useBookmarkletBatch } from '@/hooks/useBookmarkletBatch'
import { getApiBaseUrl } from '@/config/env'

interface BookmarkletBatchModalProps {
    isOpen: boolean
    onClose: () => void
}

export const BookmarkletBatchModal: React.FC<BookmarkletBatchModalProps> = ({ isOpen, onClose }) => {
    const { events, clear, removeEvents } = useBookmarkletBatch()
    const [isSending, setIsSending] = useState(false)
    const [results, setResults] = useState<{ success: string[], failed: Array<{ id: string, error: string }> } | null>(null)

    if (!isOpen) return null

    const handleSendAll = async () => {
        if (events.length === 0) return

        setIsSending(true)
        setResults(null)

        const API_BASE_URL = getApiBaseUrl()
        const FOMO_KEY = import.meta.env.VITE_FOMO_KEY || 'LaFomoCrew'

        const success: string[] = []
        const failed: Array<{ id: string, error: string }> = []

        // Envoyer chaque événement
        for (const event of events) {
            try {
                const response = await fetch(`${API_BASE_URL}/ingest/event`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-FOMO-Key': FOMO_KEY
                    },
                    body: JSON.stringify({
                        source: event.source,
                        url: event.url,
                        title: event.title,
                        description: event.description,
                        start: event.start,
                        end: event.end,
                        venue_name: event.venue_name,
                        address: event.address,
                        host: event.host,
                        cover: event.cover,
                        attending_count: event.attending_count,
                        interested_count: event.interested_count
                    })
                })

                const data = await response.json()

                if (!response.ok) {
                    failed.push({ id: event.id, error: data.error || `Erreur ${response.status}` })
                } else {
                    success.push(event.id)
                }
            } catch (error) {
                failed.push({ id: event.id, error: error instanceof Error ? error.message : 'Erreur inconnue' })
            }
        }

        setResults({ success, failed })

        // Supprimer les événements envoyés avec succès
        if (success.length > 0) {
            removeEvents(success)
        }

        setIsSending(false)
    }

    const handleClear = () => {
        if (confirm(`Êtes-vous sûr de vouloir supprimer ${events.length} événement${events.length > 1 ? 's' : ''} du batch ?`)) {
            clear()
            setResults(null)
        }
    }

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString)
            return date.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
        } catch {
            return dateString
        }
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="modal">
                    <div className="modal-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ margin: 0, fontSize: 'var(--text-xl)' }}>
                                📥 Événements en attente ({events.length})
                            </h2>
                            <button
                                onClick={onClose}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '24px',
                                    cursor: 'pointer',
                                    padding: '0',
                                    width: '30px',
                                    height: '30px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                                aria-label="Fermer"
                            >
                                ×
                            </button>
                        </div>

                        {events.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                                <p style={{ margin: 0 }}>Aucun événement en attente</p>
                                <p style={{ margin: '10px 0 0', fontSize: 'var(--text-sm)' }}>
                                    Utilisez le bookmarklet sur Facebook pour ajouter des événements
                                </p>
                            </div>
                        ) : (
                            <>
                                <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '20px' }}>
                                    {events.map((event) => (
                                        <div
                                            key={event.id}
                                            style={{
                                                padding: '12px',
                                                marginBottom: '8px',
                                                border: '1px solid var(--border)',
                                                borderRadius: '4px',
                                                backgroundColor: 'var(--bg-secondary)'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                                                <div style={{ flex: 1 }}>
                                                    <h3 style={{ margin: '0 0 4px', fontSize: 'var(--text-md)', fontWeight: '600' }}>
                                                        {event.title}
                                                    </h3>
                                                    <p style={{ margin: '4px 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                                        {formatDate(event.start)}
                                                    </p>
                                                    {event.venue_name && (
                                                        <p style={{ margin: '4px 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                                                            📍 {event.venue_name}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => removeEvents([event.id])}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: 'var(--text-muted)',
                                                        cursor: 'pointer',
                                                        padding: '4px 8px',
                                                        fontSize: '18px'
                                                    }}
                                                    aria-label="Supprimer"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {results && (
                                    <div style={{
                                        padding: '12px',
                                        marginBottom: '16px',
                                        borderRadius: '4px',
                                        backgroundColor: results.failed.length > 0 ? '#fff3cd' : '#d4edda',
                                        color: results.failed.length > 0 ? '#856404' : '#155724',
                                        fontSize: 'var(--text-sm)'
                                    }}>
                                        {results.success.length > 0 && (
                                            <p style={{ margin: '0 0 8px' }}>
                                                ✅ {results.success.length} événement{results.success.length > 1 ? 's' : ''} envoyé{results.success.length > 1 ? 's' : ''} avec succès
                                            </p>
                                        )}
                                        {results.failed.length > 0 && (
                                            <div>
                                                <p style={{ margin: '0 0 4px', fontWeight: '600' }}>
                                                    ❌ {results.failed.length} erreur{results.failed.length > 1 ? 's' : ''} :
                                                </p>
                                                <ul style={{ margin: '0', paddingLeft: '20px' }}>
                                                    {results.failed.map((f) => (
                                                        <li key={f.id} style={{ marginBottom: '4px' }}>
                                                            {events.find(e => e.id === f.id)?.title || f.id}: {f.error}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                    <button
                                        className="button secondary"
                                        onClick={handleClear}
                                        disabled={isSending}
                                    >
                                        Vider
                                    </button>
                                    <button
                                        className="button primary"
                                        onClick={handleSendAll}
                                        disabled={isSending || events.length === 0}
                                    >
                                        {isSending ? 'Envoi...' : `Envoyer tout (${events.length})`}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

