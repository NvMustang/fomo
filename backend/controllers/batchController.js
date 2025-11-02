/**
 * Contrôleur pour le traitement des actions en batch
 * Gère les réponses aux événements et autres actions groupées
 */

const ResponsesController = require('./responsesController')
const UsersController = require('./usersController')
const DataServiceV2 = require('../utils/dataService')

class BatchController {
    /**
     * Traiter un batch d'actions
     */
    static async processBatch(req, res) {
        const requestId = Math.random().toString(36).substr(2, 9)
        const timestamp = new Date().toISOString()

        try {
            const { actions, userId } = req.body

            console.log(`🔄 [${requestId}] [${timestamp}] Réception batch - ${actions?.length || 0} actions pour userId: ${userId}`)

            if (!actions || !Array.isArray(actions)) {
                console.error(`❌ [${requestId}] actions n'est pas un tableau`)
                return res.status(400).json({
                    success: false,
                    error: 'actions doit être un tableau'
                })
            }

            if (!userId) {
                console.error(`❌ [${requestId}] userId manquant`)
                return res.status(400).json({
                    success: false,
                    error: 'userId est requis'
                })
            }

            console.log(`🔄 [${requestId}] Traitement de ${actions.length} actions en batch pour l'utilisateur ${userId}`)

            // Log détaillé des actions
            actions.forEach((action, index) => {
                console.log(`  [${requestId}] Action ${index + 1}: type=${action.type}, data=`, action.data)
            })

            let processed = 0
            const results = []

            // Traiter chaque action
            for (const action of actions) {
                try {
                    let result = null

                    switch (action.type) {
                        case 'event_response':
                            result = await BatchController.processEventResponse(action, userId)
                            break
                        case 'friendship_accept':
                        case 'friendship_block':
                        case 'friendship_remove':
                            result = await BatchController.processFriendshipAction(action, userId)
                            break
                        default:
                            console.warn(`⚠️ Type d'action non supporté: ${action.type}`)
                            continue
                    }

                    if (result) {
                        results.push(result)
                        processed++
                    }
                } catch (error) {
                    console.error(`❌ Erreur lors du traitement de l'action ${action.id || 'sans-id'}:`, error)
                    // Continue avec les autres actions même si une échoue
                }
            }

            console.log(`✅ [${requestId}] ${processed} actions traitées avec succès sur ${actions.length}`)

            res.json({
                success: true,
                processed,
                total: actions.length,
                results
            })

        } catch (error) {
            console.error(`❌ [${requestId}] Erreur lors du traitement du batch:`, error)
            res.status(500).json({
                success: false,
                error: error.message
            })
        }
    }

    /**
     * Traiter une réponse à un événement
     */
    static async processEventResponse(action, userId) {
        const { eventId, response, email, invitedByUserId } = action.data

        // Utiliser action.userId si disponible, sinon fallback sur userId global
        // Important : chaque action peut avoir son propre userId (ex: invitations pour différents amis)
        const targetUserId = action.userId || userId

        console.log(`🔄 [BatchController] Traitement réponse - eventId: ${eventId}, response: ${response}, userId: ${targetUserId}${invitedByUserId ? `, invitedByUserId: ${invitedByUserId}` : ''}`)

        if (!eventId) {
            throw new Error('eventId est requis pour event_response')
        }

        // Toujours utiliser upsertResponse pour toutes les réponses (going, interested, not_interested, cleared, seen, invited, null)
        const mockReq = {
            body: {
                userId: targetUserId,
                eventId,
                response: response,

                ...(invitedByUserId !== undefined && { invitedByUserId })
            }
        }

        const mockRes = {
            json: (data) => data,
            status: (code) => ({ json: (data) => data })
        }

        const result = await ResponsesController.upsertResponse(mockReq, mockRes)

        console.log(`✅ [BatchController] Réponse upsertée: ${eventId}_${targetUserId}, action: ${result?.action || 'unknown'}`)

        return {
            type: 'event_response',
            action: 'upserted',
            eventId,
            response: result
        }
    }

    /**
     * Traiter une action d'amitié
     */
    static async processFriendshipAction(action, userId) {
        const { friendshipId, toUserId } = action.data

        if (!friendshipId || !toUserId) {
            throw new Error('friendshipId et toUserId sont requis pour les actions d\'amitié')
        }

        console.log(`👥 [BatchController] Traitement action d'amitié: ${action.type} pour friendshipId=${friendshipId}, toUserId=${toUserId}, userId=${userId}`)

        // Pour "remove", utiliser soft delete
        if (action.type === 'friendship_remove') {
            const mockReq = {
                params: { id: friendshipId }
            }
            const mockRes = {
                json: (data) => data,
                status: (code) => ({ json: (data) => data })
            }

            const result = await UsersController.deleteFriendship(mockReq, mockRes)
            console.log(`✅ [BatchController] Amitié supprimée: ${friendshipId}`)

            return {
                type: action.type,
                action: 'deleted',
                friendshipId,
                toUserId
            }
        }

        // Pour "accept" et "block", récupérer l'amitié existante pour déterminer fromUserId/toUserId
        const allFriendships = await DataServiceV2.getAllActiveData(
            'Friendships!A2:G',
            DataServiceV2.mappers.friendship
        )

        const existingFriendship = allFriendships.find(f => f.id === friendshipId)

        if (!existingFriendship) {
            throw new Error(`Amitié non trouvée: ${friendshipId}`)
        }

        // Déterminer le nouveau statut
        let newStatus
        if (action.type === 'friendship_accept') {
            newStatus = 'active'
        } else if (action.type === 'friendship_block') {
            newStatus = 'blocked'
        } else {
            throw new Error(`Type d'action d'amitié non supporté: ${action.type}`)
        }

        // Utiliser les fromUserId/toUserId de l'amitié existante pour préserver la direction originale
        const mockReq = {
            body: {
                fromUserId: existingFriendship.fromUserId,
                toUserId: existingFriendship.toUserId,
                status: newStatus
            }
        }
        const mockRes = {
            json: (data) => data,
            status: (code) => ({ json: (data) => data })
        }

        const result = await UsersController.upsertFriendship(mockReq, mockRes)

        console.log(`✅ [BatchController] Amitié mise à jour: ${friendshipId}, statut: ${newStatus}, action: ${result?.action || 'unknown'}`)

        return {
            type: action.type,
            action: 'updated',
            friendshipId,
            toUserId,
            status: newStatus,
            result
        }
    }
}

module.exports = BatchController
