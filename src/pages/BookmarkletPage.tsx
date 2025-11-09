/**
 * Page de réception des données du bookmarklet Facebook
 * 
 * Le bookmarklet stocke les données dans localStorage et redirige vers cette page.
 * Cette page récupère les données, les envoie à l'API, puis affiche le résultat.
 */

import { useEffect, useState } from 'react'
import { useNavigation } from '@/hooks'
import { getApiBaseUrl } from '@/config/env'

interface BookmarkletData {
    source: string
    url: string
    title: string
    description?: string
    start: string
    end?: string
    venue_name?: string
    address?: string
    host?: string
    cover?: string
    attending_count?: string | number
    interested_count?: string | number
}

interface BookmarkletResult {
    ok: boolean
    id?: string
    duplicate?: boolean
    error?: string
    details?: string[]
}

export default function BookmarkletPage() {
    const { navigate } = useNavigation()
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
    const [message, setMessage] = useState<string>('')
    const [result, setResult] = useState<BookmarkletResult | null>(null)

    useEffect(() => {
        // Récupérer le token depuis l'URL
        const urlParams = new URLSearchParams(window.location.search)
        const token = urlParams.get('token')

        if (!token) {
            setStatus('error')
            setMessage('Token manquant. Veuillez utiliser le bookmarklet depuis une page d\'événement Facebook.')
            return
        }

        // Récupérer les données depuis localStorage
        const storageKey = `fomo-bookmarklet-${token}`
        const storedData = localStorage.getItem(storageKey)

        if (!storedData) {
            setStatus('error')
            setMessage('Données introuvables. Le token a peut-être expiré. Veuillez réessayer avec le bookmarklet.')
            return
        }

        let payload: BookmarkletData
        try {
            payload = JSON.parse(storedData)
        } catch (error) {
            setStatus('error')
            setMessage('Erreur lors de la lecture des données. Format invalide.')
            return
        }

        // Envoyer les données à l'API
        sendToAPI(payload, token)
    }, [])

    async function sendToAPI(payload: BookmarkletData, token: string) {
        try {
            const API_BASE_URL = getApiBaseUrl()
            // Récupérer la clé API depuis les variables d'environnement ou utiliser la valeur par défaut
            const FOMO_KEY = import.meta.env.VITE_FOMO_KEY || 'LaFomoCrew'

            const response = await fetch(`${API_BASE_URL}/ingest/event`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-FOMO-Key': FOMO_KEY
                },
                body: JSON.stringify(payload)
            })

            const data: BookmarkletResult = await response.json()

            if (!response.ok) {
                setStatus('error')
                if (response.status === 401) {
                    setMessage('Erreur: La clé API FOMO est incorrecte.')
                } else {
                    setMessage(data.error || `Erreur ${response.status}`)
                }
                setResult(data)
                return
            }

            // Succès
            setStatus('success')
            setResult(data)
            if (data.duplicate) {
                setMessage(`⚠️ Doublon détecté. L'événement existe déjà (ID: ${data.id})`)
            } else {
                setMessage(`✅ Événement ajouté avec succès ! (ID: ${data.id})`)
            }

            // Nettoyer localStorage
            const storageKey = `fomo-bookmarklet-${token}`
            localStorage.removeItem(storageKey)

            // Rediriger vers la carte après 3 secondes
            setTimeout(() => {
                navigate('map')
            }, 3000)

        } catch (error) {
            console.error('❌ [BookmarkletPage] Erreur lors de l\'envoi:', error)
            setStatus('error')
            setMessage('Erreur réseau. Vérifiez votre connexion et réessayez.')
        }
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '20px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            backgroundColor: '#f5f5f5'
        }}>
            <div style={{
                background: 'white',
                borderRadius: '8px',
                padding: '32px',
                maxWidth: '500px',
                width: '100%',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                textAlign: 'center'
            }}>
                {status === 'loading' && (
                    <>
                        <div className="spinner" style={{ margin: '0 auto 20px' }} />
                        <h2 style={{ margin: '0 0 10px', color: '#333' }}>Envoi en cours...</h2>
                        <p style={{ margin: 0, color: '#666' }}>Traitement de votre événement...</p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>✅</div>
                        <h2 style={{ margin: '0 0 10px', color: '#155724' }}>Succès !</h2>
                        <p style={{ margin: '0 0 20px', color: '#666' }}>{message}</p>
                        {result?.id && (
                            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#999' }}>
                                ID: {result.id}
                            </p>
                        )}
                        <p style={{ margin: '20px 0 0', fontSize: '14px', color: '#999' }}>
                            Redirection vers la carte dans 3 secondes...
                        </p>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div style={{ fontSize: '48px', marginBottom: '20px' }}>❌</div>
                        <h2 style={{ margin: '0 0 10px', color: '#dc3545' }}>Erreur</h2>
                        <p style={{ margin: '0 0 20px', color: '#666' }}>{message}</p>
                        {result?.details && result.details.length > 0 && (
                            <ul style={{ margin: '0 0 20px', paddingLeft: '20px', textAlign: 'left', color: '#666' }}>
                                {result.details.map((detail, i) => (
                                    <li key={i}>{detail}</li>
                                ))}
                            </ul>
                        )}
                        <button
                            onClick={() => navigate('map')}
                            style={{
                                padding: '10px 20px',
                                border: 'none',
                                background: '#1877f2',
                                color: 'white',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '600'
                            }}
                        >
                            Retour à la carte
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

