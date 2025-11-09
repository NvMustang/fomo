/**
 * Page de réception pour les données du bookmarklet via postMessage
 * 
 * Cette page est chargée dans un iframe invisible par le bookmarklet.
 * Elle écoute les messages postMessage, appelle l'API /ingest/event, puis répond au bookmarklet.
 */

import { useEffect } from 'react'
import { getApiBaseUrl } from '@/config/env'

interface BookmarkletEventPayload {
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

interface BookmarkletMessage {
    type: 'fomo-bookmarklet-event'
    payload: BookmarkletEventPayload
    requestId: string
}

interface BookmarkletResponse {
    type: 'fomo-bookmarklet-response'
    requestId: string
    ok: boolean
    id?: string
    duplicate?: boolean
    error?: string
    details?: string[]
}

export default function BookmarkletReceiverPage() {
    useEffect(() => {
        console.log('📥 [BookmarkletReceiver] Page chargée...')

        // Lire les données depuis l'URL (query params) ou postMessage
        const processData = async (payload: BookmarkletEventPayload, requestId: string) => {
            console.log('📥 [BookmarkletReceiver] Traitement des données:', {
                requestId,
                title: payload.title
            })

            // Préparer la réponse
            const response: BookmarkletResponse = {
                type: 'fomo-bookmarklet-response',
                requestId: message.requestId,
                ok: false
            }

            try {
                const API_BASE_URL = getApiBaseUrl()
                const FOMO_KEY = import.meta.env.VITE_FOMO_KEY || 'LaFomoCrew'

                console.log('📤 [BookmarkletReceiver] Envoi à l\'API:', API_BASE_URL)

                const apiResponse = await fetch(`${API_BASE_URL}/ingest/event`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-FOMO-Key': FOMO_KEY
                    },
                    body: JSON.stringify(message.payload)
                })

                const data = await apiResponse.json()

                if (!apiResponse.ok) {
                    response.ok = false
                    if (apiResponse.status === 401) {
                        response.error = 'Clé API FOMO incorrecte'
                    } else {
                        response.error = data.error || `Erreur ${apiResponse.status}`
                    }
                    response.details = data.details
                } else {
                    response.ok = true
                    response.id = data.id
                    response.duplicate = data.duplicate || false
                }

                console.log('✅ [BookmarkletReceiver] Réponse API:', response)
            } catch (error) {
                console.error('❌ [BookmarkletReceiver] Erreur lors de l\'appel API:', error)
                response.ok = false
                response.error = error instanceof Error ? error.message : 'Erreur réseau'
            }

            // Envoyer la réponse au bookmarklet
            // event.source peut être window.opener (popup) ou window.parent (iframe)
            if (event.source && event.source !== window) {
                try {
                    (event.source as Window).postMessage(response, '*')
                    console.log('📤 [BookmarkletReceiver] Réponse envoyée au bookmarklet:', response)
                } catch (err) {
                    console.error('❌ [BookmarkletReceiver] Erreur lors de l\'envoi de la réponse:', err)
                }
            } else {
                // Fallback: envoyer à window.opener (popup) ou window.parent (iframe)
                try {
                    if (window.opener) {
                        window.opener.postMessage(response, '*')
                        console.log('📤 [BookmarkletReceiver] Réponse envoyée via window.opener:', response)
                    } else if (window.parent && window.parent !== window) {
                        window.parent.postMessage(response, '*')
                        console.log('📤 [BookmarkletReceiver] Réponse envoyée via window.parent:', response)
                    }
                } catch (err) {
                    console.error('❌ [BookmarkletReceiver] Erreur lors de l\'envoi de la réponse:', err)
                }
            }
        }

        window.addEventListener('message', handleMessage)

        // Informer le parent/opener que la page est prête
        // window.parent pour iframe, window.opener pour popup
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'fomo-receiver-ready' }, '*')
            }
        } catch (err) {
            // Ignorer si on ne peut pas envoyer (pas dans un iframe)
        }
        
        try {
            if (window.opener) {
                window.opener.postMessage({ type: 'fomo-receiver-ready' }, '*')
            }
        } catch (err) {
            // Ignorer si on ne peut pas envoyer
        }

        return () => {
            window.removeEventListener('message', handleMessage)
        }
    }, [])

    // Cette page n'affiche rien (iframe invisible)
    return null
}

