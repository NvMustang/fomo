/**
 * Hook centralisé pour la gestion des réponses aux événements
 * 
 * Centralise la logique de getUserResponse et userResponsesMap actuellement dupliquée entre :
 * - EventsMapPage.tsx
 * - EventsListPage.tsx  
 * - ProfilePage.tsx
 * 
 * Respecte les stratégies FOMO :
 * - Optimistic updates immédiats
 * - Debounce 5s pour les POST
 * - Cache global via FomoDataContext
 */

import { useMemo, useCallback } from 'react'
import { useFomoDataContext } from '@/contexts/FomoDataProvider'
import { useAuth } from '@/contexts/AuthContext'

import type { UserResponseValue } from '@/types/fomoTypes'


interface UseEventResponsesReturn {
    // Récupérer la réponse d'un utilisateur pour un événement
    getEventResponse: (eventId: string) => UserResponseValue

    // Toggle une réponse (going/interested/not_interested)
    toggleResponse: (eventId: string, responseType: 'going' | 'interested' | 'not_interested') => void

    // Statistiques
    totalResponses: number
}

export function useEventResponses(): UseEventResponsesReturn {
    const { responses, addEventResponse, dataReady } = useFomoDataContext()
    const { user } = useAuth()

    // Récupérer la réponse d'un utilisateur pour un événement
    const getEventResponse = useCallback((eventId: string): UserResponseValue => {
        if (!dataReady) return null

        // Déterminer l'identifiant de l'utilisateur (user authentifié ou visitor)
        let userId: string | null = null
        if (user?.id) {
            userId = user.id
        } else {
            // Mode visitor : récupérer le visitorUserId depuis sessionStorage
            try {
                userId = sessionStorage.getItem('fomo-visit-user-id')
            } catch {
                // Ignore si sessionStorage indisponible
            }
        }

        if (!userId) return null

        const match = responses.find(r => r.userId === userId && r.eventId === eventId)
        return match ? match.response : null
    }, [dataReady, user?.id, responses])

    // Toggle une réponse (going/interested/not_interested)
    const toggleResponse = useCallback((eventId: string, responseType: 'going' | 'interested' | 'not_interested') => {
        if (!user?.id) return

        // Déterminer la nouvelle réponse (toggle)
        const current = responses.find(r => r.userId === user.id && r.eventId === eventId)?.response || null
        const newResponse = current === responseType ? 'cleared' : responseType

        // Utiliser le système de données unifié (mise à jour optimiste + batch)
        addEventResponse(eventId, newResponse)
    }, [user?.id, responses, addEventResponse])

    // Statistiques
    const totalResponses = useMemo(() => {
        if (!dataReady || !user?.id) return 0
        return responses.reduce((count, r) => count + (r.userId === user.id && r.response ? 1 : 0), 0)
    }, [dataReady, user?.id, responses])

    // 🚀 OPTIMISATION: Mémoriser le retour pour éviter les re-renders
    return useMemo(() => ({
        getEventResponse,
        toggleResponse,
        totalResponses
    }), [getEventResponse, toggleResponse, totalResponses])
}

export default useEventResponses
