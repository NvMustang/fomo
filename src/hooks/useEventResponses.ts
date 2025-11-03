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
    const { getCurrentResponse, getLatestResponsesByEvent, addEventResponse, dataReady } = useFomoDataContext()
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

        // NOUVEAU SYSTÈME : Utiliser le helper du contexte
        return getCurrentResponse(userId, eventId)
    }, [dataReady, user?.id, getCurrentResponse])

    // Toggle une réponse (going/interested/not_interested)
    const toggleResponse = useCallback((eventId: string, responseType: 'going' | 'interested' | 'not_interested') => {
        if (!user?.id) return

        // Déterminer la nouvelle réponse (toggle)
        const current = getCurrentResponse(user.id, eventId)
        const finalResponse = current === responseType ? 'cleared' : responseType

        // Utiliser le système de données unifié (mise à jour optimiste + batch)
        addEventResponse(eventId, finalResponse)
    }, [user?.id, getCurrentResponse, addEventResponse])

    // Statistiques
    const totalResponses = useMemo(() => {
        if (!dataReady || !user?.id) return 0
        const latestMap = getLatestResponsesByEvent(user.id)
        // Compter uniquement les réponses non-null
        return Array.from(latestMap.values()).filter(r => r.finalResponse !== null).length
    }, [dataReady, user?.id, getLatestResponsesByEvent])

    // 🚀 OPTIMISATION: Mémoriser le retour pour éviter les re-renders
    return useMemo(() => ({
        getEventResponse,
        toggleResponse,
        totalResponses
    }), [getEventResponse, toggleResponse, totalResponses])
}

export default useEventResponses
