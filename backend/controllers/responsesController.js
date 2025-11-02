/**
 * Contrôleur pour les réponses d'événements - NOUVELLE STRATÉGIE OVERWRITE
 * Gère la logique métier avec overwrite + colonnes système
 */

const DataServiceV2 = require('../utils/dataService')

class ResponsesController {
    /**
     * Récupérer toutes les réponses actives
     */
    static async getAllResponses(req, res) {
        const requestId = Math.random().toString(36).substr(2, 9)
        const timestamp = new Date().toISOString()
        try {
            console.log(`📝 [${requestId}] [${timestamp}] Récupération des réponses (overwrite)...`)
            console.log(`📝 [${requestId}] Headers:`, req.headers['user-agent'] || 'unknown')
            console.log(`📝 [${requestId}] IP:`, req.ip || req.connection.remoteAddress)

            const responses = await DataServiceV2.getAllActiveData(
                'Responses!A2:H',
                DataServiceV2.mappers.response
            )

            console.log(`✅ [${requestId}] ${responses.length} réponses récupérées`)
            res.json({ success: true, data: responses })
        } catch (error) {
            console.error(`❌ [${requestId}] Erreur récupération réponses:`, error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Récupérer une réponse par ID
     */
    static async getResponseById(req, res) {
        try {
            const responseId = req.params.id
            console.log(`📝 Récupération réponse: ${responseId}`)

            const response = await DataServiceV2.getByKey(
                'Responses!A2:H',
                DataServiceV2.mappers.response,
                0, // key column (ID)
                responseId
            )

            if (!response) {
                return res.status(404).json({
                    success: false,
                    error: 'Réponse non trouvée'
                })
            }

            console.log(`✅ Réponse récupérée: ${responseId}`)
            res.json({ success: true, data: response })
        } catch (error) {
            console.error('❌ Erreur récupération réponse:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Créer ou mettre à jour une réponse (UPSERT)
     */
    static async upsertResponse(req, res) {
        try {
            const { userId, eventId, response, email, invitedByUserId } = req.body

            if (!userId || !eventId) {
                return res.status(400).json({
                    success: false,
                    error: 'userId et eventId sont requis'
                })
            }

            // Accepter null comme valeur valide pour response
            if (response !== null && !['going', 'interested', 'not_interested', 'cleared', 'seen', 'invited'].includes(response)) {
                return res.status(400).json({
                    success: false,
                    error: 'response doit être "going", "interested", "not_interested", "cleared", "seen", "invited" ou null'
                })
            }

            const responseId = `${eventId}_${userId}`
            console.log(`🔄 Upsert réponse: ${responseId}, response: ${response}, invitedByUserId: ${invitedByUserId || 'none'}`)

            // Préparer les données pour la feuille
            // Structure: A=ID, B=CreatedAt, C=UserId, D=InvitedByUserId, E=EventId, F=Response, G=ModifiedAt, H=DeletedAt, I=Email
            const rowData = [
                responseId,                                 // A: ID (eventId_userId)
                new Date().toISOString(),                   // B: CreatedAt
                userId,                                     // C: User ID
                invitedByUserId || '',                      // D: InvitedByUserId
                eventId,                                    // E: Event ID (décalé)
                response || '',                             // F: Response (vide si null, décalé)
                new Date().toISOString(),                   // G: ModifiedAt (décalé)
                req.body.deletedAt || '',                   // H: DeletedAt (si fourni, décalé)

            ]

            const result = await DataServiceV2.upsertData(
                'Responses!A2:I',
                rowData,
                0, // key column (ID)
                responseId
            )

            console.log(`✅ Réponse ${result.action}: ${responseId}`)
            res.json({
                success: true,
                data: {
                    id: responseId,
                    userId,
                    eventId,
                    response,
                    email: email || undefined,
                    invitedByUserId: invitedByUserId || undefined,
                    createdAt: rowData[1],
                    modifiedAt: rowData[6]
                },
                action: result.action
            })
        } catch (error) {
            console.error('❌ Erreur upsert réponse:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Supprimer une réponse (soft delete)
     */
    static async deleteResponse(req, res) {
        try {
            const responseId = req.params.id
            // Suppression soft de la réponse

            const result = await DataServiceV2.softDelete(
                'Responses!A2:H',
                0, // key column (ID)
                responseId
            )

            console.log(`✅ Réponse supprimée (soft delete): ${responseId}`)
            res.json({
                success: true,
                message: 'Réponse supprimée avec succès',
                deletedAt: result.deletedAt
            })
        } catch (error) {
            console.error('❌ Erreur suppression réponse:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Récupérer les réponses d'un utilisateur
     */
    static async getUserResponses(req, res) {
        try {
            const userId = req.params.userId
            console.log(`📝 Récupération réponses utilisateur: ${userId}`)

            const allResponses = await DataServiceV2.getAllActiveData(
                'Responses!A2:H',
                DataServiceV2.mappers.response
            )

            // Filtrer par utilisateur
            const userResponses = allResponses.filter(r => r.userId === userId)

            console.log(`✅ ${userResponses.length} réponses récupérées pour ${userId}`)
            res.json({
                success: true,
                data: userResponses
            })
        } catch (error) {
            console.error('❌ Erreur récupération réponses utilisateur:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Récupérer les réponses d'un événement
     */
    static async getEventResponses(req, res) {
        try {
            const eventId = req.params.eventId
            console.log(`📝 Récupération réponses événement: ${eventId}`)

            const allResponses = await DataServiceV2.getAllActiveData(
                'Responses!A2:H',
                DataServiceV2.mappers.response
            )

            // Filtrer par événement
            const eventResponses = allResponses.filter(r => r.eventId === eventId)

            console.log(`✅ ${eventResponses.length} réponses récupérées pour ${eventId}`)
            res.json({
                success: true,
                data: eventResponses
            })
        } catch (error) {
            console.error('❌ Erreur récupération réponses événement:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Migrer toutes les réponses d'un userId vers un autre
     * Utilisé lors de la conversion d'un visitor en user
     */
    static async migrateResponses(oldUserId, newUserId) {
        try {
            console.log(`🔄 Migration des réponses: ${oldUserId} -> ${newUserId}`)

            // Récupérer toutes les réponses de l'ancien userId
            const allResponses = await DataServiceV2.getAllActiveData(
                'Responses!A2:H',
                DataServiceV2.mappers.response
            )

            const responsesToMigrate = allResponses.filter(r => r.userId === oldUserId)
            console.log(`📝 ${responsesToMigrate.length} réponses à migrer`)

            // Pour chaque réponse, créer une nouvelle réponse avec le nouveau userId
            // et supprimer l'ancienne (soft delete)
            for (const response of responsesToMigrate) {
                const oldResponseId = `${response.eventId}_${oldUserId}`
                const newResponseId = `${response.eventId}_${newUserId}`

                // Vérifier si une réponse existe déjà avec le nouveau userId pour cet événement
                const existingResponse = await DataServiceV2.getByKey(
                    'Responses!A2:H',
                    DataServiceV2.mappers.response,
                    0,
                    newResponseId
                )

                if (!existingResponse) {
                    // Créer la nouvelle réponse avec le nouveau userId
                    const rowData = [
                        newResponseId,                           // A: ID
                        response.createdAt || new Date().toISOString(), // B: CreatedAt (garder l'original)
                        newUserId,                               // C: User ID (nouveau)
                        response.invitedByUserId || '',           // D: InvitedByUserId
                        response.eventId,                         // E: Event ID
                        response.response || '',                  // F: Response
                        new Date().toISOString(),                 // G: ModifiedAt
                        ''                                       // H: DeletedAt
                    ]

                    await DataServiceV2.upsertData(
                        'Responses!A2:I',
                        rowData,
                        0,
                        newResponseId
                    )

                    console.log(`✅ Réponse migrée: ${oldResponseId} -> ${newResponseId}`)
                } else {
                    console.log(`⚠️ Réponse déjà existante pour ${newResponseId}, skip`)
                }

                // Soft delete de l'ancienne réponse
                await DataServiceV2.softDelete(
                    'Responses!A2:H',
                    0,
                    oldResponseId
                )
            }

            console.log(`✅ Migration terminée: ${responsesToMigrate.length} réponses migrées`)
            return { migrated: responsesToMigrate.length }
        } catch (error) {
            console.error('❌ Erreur migration réponses:', error)
            throw error
        }
    }
}

module.exports = ResponsesController
