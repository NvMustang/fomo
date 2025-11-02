/**
 * Utilitaires partagés pour la gestion des réponses aux événements
 * Logique commune entre UserDataContext et VisitorDataContext
 */

import type { UserResponse, UserResponseValue } from '@/types/fomoTypes'
import { format } from 'date-fns'

// Type pour FomoDataManager (éviter import circulaire)
interface FomoDataManager {
    addEventResponse(userId: string, eventId: string, response: UserResponseValue, invitedByUserId: string): void
}

/**
 * Configuration pour addEventResponse
 */
interface AddEventResponseConfig {
    userId: string
    eventId: string
    response: UserResponseValue
    invitedByUserId?: string
    setResponses: React.Dispatch<React.SetStateAction<UserResponse[]>>
    fomoData: FomoDataManager
    contextName?: string // Pour les logs
}

/**
 * Crée une réponse optimiste pour la mise à jour immédiate de l'UI
 */
export function createOptimisticResponse(
    userId: string,
    eventId: string,
    response: UserResponseValue,
    invitedByUserId?: string
): UserResponse {
    return {
        userId,
        eventId,
        response,
        createdAt: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
        ...(invitedByUserId && { invitedByUserId })
    }
}

/**
 * Met à jour optimistement la liste des réponses
 * Utilisé par UserDataContext et VisitorDataContext
 */
export function updateResponsesOptimistically(
    currentResponses: UserResponse[],
    userId: string,
    eventId: string,
    response: UserResponseValue,
    invitedByUserId?: string
): UserResponse[] {
    const existing = currentResponses.find(r => r.userId === userId && r.eventId === eventId)

    if (existing) {
        return currentResponses.map(r =>
            r.userId === userId && r.eventId === eventId
                ? {
                    ...r,
                    response,
                    createdAt: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
                    ...(invitedByUserId && { invitedByUserId })
                }
                : r
        )
    } else {
        return [...currentResponses, createOptimisticResponse(userId, eventId, response, invitedByUserId)]
    }
}

/**
 * Rollback : retire une réponse optimiste en cas d'erreur
 */
export function removeResponseOptimistically(
    currentResponses: UserResponse[],
    userId: string,
    eventId: string
): UserResponse[] {
    return currentResponses.filter(r => !(r.userId === userId && r.eventId === eventId))
}

/**
 * Fonction partagée pour ajouter une réponse (optimiste + batch)
 * Utilisée par UserDataContext et VisitorDataContext
 */
export function addEventResponseShared(config: AddEventResponseConfig): void {
    const { userId, eventId, response, invitedByUserId, setResponses, fomoData, contextName = 'Context' } = config

    // Utiliser "none" si pas de invitedByUserId
    const invitedByUserIdValue = invitedByUserId || 'none'

    console.log(`🔄 [${contextName}] addEventResponse called:`, eventId, response, 'userId:', userId, invitedByUserIdValue !== 'none' ? `invitedByUserId: ${invitedByUserIdValue}` : '')

    // Mise à jour optimiste IMMÉDIATE
    setResponses(prev => {
        const existing = prev.find(r => r.userId === userId && r.eventId === eventId)
        if (existing) {
            console.log(`🔄 [${contextName}] Updating existing response:`, existing.response, '->', response)
        } else {
            console.log(`🔄 [${contextName}] Adding new response:`, response)
        }
        return updateResponsesOptimistically(prev, userId, eventId, response, invitedByUserIdValue !== 'none' ? invitedByUserIdValue : undefined)
    })

    // Ajouter au batch (exactement comme UserDataContext)
    try {
        fomoData.addEventResponse(userId, eventId, response, invitedByUserIdValue)
    } catch (error) {
        console.error(`❌ [${contextName}] Erreur lors de l'ajout de la réponse:`, error)
        // Rollback en cas d'erreur
        setResponses(prev => removeResponseOptimistically(prev, userId, eventId))
    }
}

