/**
 * FOMO MVP - Hook pour charger l'événement visitor depuis l'URL
 * Détecte l'eventId depuis l'URL et charge l'événement depuis l'API
 */

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getApiBaseUrl } from '@/config/env'
import type { Event } from '@/types/fomoTypes'

export function useLoadVisitorEvent() {
    const { isAuthenticated } = useAuth()
    const [visitorEventId, setVisitorEventId] = useState<string | null>(null)
    const [visitorEvent, setVisitorEvent] = useState<Event | null>(null)
    const [isLoadingVisitorEvent, setIsLoadingVisitorEvent] = useState(false)
    const [visitorEventError, setVisitorEventError] = useState<string | null>(null)

    // Détecter le mode visitor depuis l'URL
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search)
        const eventId = urlParams.get('event')
        if (eventId && !isAuthenticated) {
            setVisitorEventId(eventId)
        } else {
            setVisitorEventId(null)
        }
    }, [isAuthenticated])

    // Charger l'événement visitor si nécessaire
    useEffect(() => {
        if (!visitorEventId || isAuthenticated) {
            setVisitorEvent(null)
            setIsLoadingVisitorEvent(false)
            return
        }

        setIsLoadingVisitorEvent(true)
        setVisitorEventError(null)

        const loadVisitorEvent = async () => {
            try {
                const apiUrl = getApiBaseUrl()
                const response = await fetch(`${apiUrl}/events/${visitorEventId}`)
                if (!response.ok) {
                    throw new Error('Événement non trouvé')
                }
                const data = await response.json()
                if (data.success && data.data) {
                    setVisitorEvent(data.data)
                } else {
                    throw new Error('Format de réponse invalide')
                }
            } catch (error) {
                console.error('Erreur chargement événement visitor:', error)
                setVisitorEventError(error instanceof Error ? error.message : 'Erreur de chargement')
            } finally {
                setIsLoadingVisitorEvent(false)
            }
        }

        loadVisitorEvent()
    }, [visitorEventId, isAuthenticated])

    const isVisitorMode = visitorEventId !== null && !isAuthenticated

    return {
        visitorEvent,
        isLoadingVisitorEvent,
        visitorEventError,
        isVisitorMode
    }
}

