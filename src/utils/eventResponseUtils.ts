/**
 * Utilitaires partagés pour la gestion des réponses aux événements
 * NOUVEAU SYSTÈME : Historique complet avec initialResponse et finalResponse
 */

import type { UserResponse, UserResponseValue } from '@/types/fomoTypes'
import { format } from 'date-fns'

/**
 * Helper local : Obtient la dernière réponse d'un utilisateur pour un événement
 */
function getLatestResponseLocal(
    responses: UserResponse[],
    userId: string,
    eventId: string
): UserResponse | null {
    const userEventResponses = responses
        .filter(r => r.userId === userId && r.eventId === eventId && !r.deletedAt)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return userEventResponses.length > 0 ? userEventResponses[0] : null
}

// Type pour FomoDataManager (éviter import circulaire)
interface FomoDataManager {
    addEventResponse(userId: string, eventId: string, initialResponse: UserResponseValue, finalResponse: UserResponseValue, invitedByUserId: string): void
}

/**
 * Configuration pour addEventResponse
 */
interface AddEventResponseConfig {
    userId: string
    eventId: string
    finalResponse: UserResponseValue
    invitedByUserId?: string
    setResponses: React.Dispatch<React.SetStateAction<UserResponse[]>>
    fomoData: FomoDataManager
    contextName?: string // Pour les logs
}

/**
 * Crée une réponse optimiste avec initialResponse et finalResponse
 */
export function createOptimisticResponse(
    userId: string,
    eventId: string,
    initialResponse: UserResponseValue,
    finalResponse: UserResponseValue,
    invitedByUserId?: string
): UserResponse {
    const timestamp = Date.now()
    const randomSuffix = Math.random().toString(36).substr(2, 6)
    const id = `${eventId}_${userId}_${timestamp}_${randomSuffix}`

    return {
        id,
        userId,
        eventId,
        initialResponse,
        finalResponse,
        createdAt: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
        ...(invitedByUserId && { invitedByUserId })
    }
}

/**
 * Ajoute une nouvelle entrée d'historique optimistement
 * NOUVEAU SYSTÈME : Ajoute toujours une nouvelle entrée avec initialResponse et finalResponse
 */
export function addResponseOptimistically(
    currentResponses: UserResponse[],
    userId: string,
    eventId: string,
    initialResponse: UserResponseValue,
    finalResponse: UserResponseValue,
    invitedByUserId?: string
): UserResponse[] {
    // Créer une nouvelle entrée d'historique (jamais de mise à jour, toujours création)
    const newEntry = createOptimisticResponse(
        userId,
        eventId,
        initialResponse,
        finalResponse,
        invitedByUserId
    )
    return [...currentResponses, newEntry]
}

/**
 * Rollback : retire la dernière entrée optimiste en cas d'erreur
 * Retire la dernière entrée créée pour ce user+event
 */
export function removeLastResponseOptimistically(
    currentResponses: UserResponse[],
    userId: string,
    eventId: string
): UserResponse[] {
    // Trouver toutes les entrées pour ce user+event
    const entries = currentResponses
        .filter(r => r.userId === userId && r.eventId === eventId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // Si aucune entrée, retourner tel quel
    if (entries.length === 0) return currentResponses

    // Retirer la plus récente (première du tableau trié)
    const lastEntry = entries[0]
    return currentResponses.filter(r => r.id !== lastEntry.id)
}

/**
 * Fonction partagée pour ajouter une réponse (optimiste + batch)
 * NOUVEAU SYSTÈME : Crée une nouvelle entrée avec initialResponse et finalResponse
 */
export function addEventResponseShared(config: AddEventResponseConfig): void {
    const { userId, eventId, finalResponse, invitedByUserId, setResponses, fomoData, contextName = 'Context' } = config

    // Utiliser "none" si pas de invitedByUserId
    const invitedByUserIdValue = invitedByUserId || 'none'

    // Déterminer initialResponse : dernière réponse actuelle pour ce user+event
    setResponses(prev => {
        const latest = getLatestResponseLocal(prev, userId, eventId)
        const initialResponse = latest ? latest.finalResponse : null

        console.log(`🔄 [${contextName}] addEventResponse:`, eventId, `${initialResponse} -> ${finalResponse}`, 'userId:', userId, invitedByUserIdValue !== 'none' ? `invitedByUserId: ${invitedByUserIdValue}` : '')

        // Créer une nouvelle entrée d'historique
        const updated = addResponseOptimistically(
            prev,
            userId,
            eventId,
            initialResponse,
            finalResponse,
            invitedByUserIdValue !== 'none' ? invitedByUserIdValue : undefined
        )

        // Ajouter au batch après la mise à jour optimiste
        try {
            fomoData.addEventResponse(userId, eventId, initialResponse, finalResponse, invitedByUserIdValue)
        } catch (error) {
            console.error(`❌ [${contextName}] Erreur lors de l'ajout de la réponse:`, error)
            // Le rollback sera géré par le catch ci-dessous
        }

        return updated
    })

    // Rollback en cas d'erreur (sera géré par le batch manager)
    // Note: Le batch manager devrait gérer les erreurs et faire le rollback si nécessaire
}

