/**
 * Contrôleur pour les réponses d'événements - NOUVELLE STRATÉGIE HISTORIQUE
 * Gère la logique métier avec historique complet : chaque changement crée une nouvelle entrée
 * avec initialResponse et finalResponse
 */

const DataServiceV2 = require('../utils/dataService')
const { sheets, SPREADSHEET_ID } = require('../utils/sheets-config')

// Plage Google Sheets pour les réponses (NOUVEAU SCHÉMA: A-G)
// Structure: A=ID, B=CreatedAt, C=UserId, D=InvitedByUserId, E=EventId, F=InitialResponse, G=FinalResponse
const RESPONSES_RANGE = 'Responses!A2:G'

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
                RESPONSES_RANGE,
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
                RESPONSES_RANGE,
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
     * Créer une nouvelle entrée d'historique de réponse
     * Chaque changement crée une nouvelle ligne avec initialResponse et finalResponse
     */
    static async createResponse(req, res) {
        try {
            const { userId, eventId, initialResponse, finalResponse, invitedByUserId } = req.body

            if (!userId || !eventId) {
                return res.status(400).json({
                    success: false,
                    error: 'userId et eventId sont requis'
                })
            }

            // Validation des réponses
            const validResponses = ['going', 'participe', 'interested', 'maybe', 'not_interested', 'not_there', 'cleared', 'seen', 'invited', null]
            if (initialResponse !== null && !validResponses.includes(initialResponse)) {
                return res.status(400).json({
                    success: false,
                    error: 'initialResponse doit être valide ou null'
                })
            }
            if (finalResponse !== null && !validResponses.includes(finalResponse)) {
                return res.status(400).json({
                    success: false,
                    error: 'finalResponse doit être valide ou null'
                })
            }

            // Générer un ID unique pour cette entrée d'historique
            const timestamp = Date.now()
            const randomSuffix = Math.random().toString(36).substr(2, 6)
            const responseId = `${eventId}_${userId}_${timestamp}_${randomSuffix}`

            console.log(`🔄 Création réponse historique: ${responseId}, ${initialResponse} -> ${finalResponse}, invitedByUserId: ${invitedByUserId || 'none'}`)

            // Préparer les données pour la feuille
            // Nouveau schéma: A=ID, B=CreatedAt, C=UserId, D=InvitedByUserId, E=EventId, F=InitialResponse, G=FinalResponse
            const rowData = [
                responseId,                                 // A: ID (unique par changement)
                new Date().toISOString(),                   // B: CreatedAt
                userId,                                     // C: User ID
                invitedByUserId || 'none',                 // D: InvitedByUserId ('none' si non renseigné)
                eventId,                                    // E: Event ID
                initialResponse || '',                      // F: InitialResponse (vide si null)
                finalResponse || '',                        // G: FinalResponse (vide si null)
            ]

            const result = await DataServiceV2.createRow(
                RESPONSES_RANGE,
                rowData
            )

            console.log(`✅ Réponse historique créée: ${responseId}`)
            res.json({
                success: true,
                data: {
                    id: responseId,
                    userId,
                    eventId,
                    initialResponse: initialResponse || null,
                    finalResponse: finalResponse || null,
                    invitedByUserId: invitedByUserId || 'none',
                    createdAt: rowData[1]
                },
                action: 'created'
            })
        } catch (error) {
            console.error('❌ Erreur création réponse:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Helper : Obtenir la dernière réponse d'un utilisateur pour un événement
     * Utile pour la rétrocompatibilité et pour obtenir l'état actuel
     */
    static async getLatestResponse(userId, eventId) {
        const allResponses = await DataServiceV2.getAllActiveData(
            RESPONSES_RANGE,
            DataServiceV2.mappers.response
        )

        // Filtrer par user et event, trier par createdAt décroissant, prendre le premier
        const userEventResponses = allResponses
            .filter(r => r.userId === userId && r.eventId === eventId)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

        return userEventResponses.length > 0 ? userEventResponses[0] : null
    }

    /**
     * Supprimer une réponse (hard delete)
     * NOTE: Le nouveau schéma ne supporte plus le soft delete (pas de colonne deletedAt)
     */
    static async deleteResponse(req, res) {
        try {
            const responseId = req.params.id
            // Suppression complète de la réponse

            await DataServiceV2.hardDelete(
                RESPONSES_RANGE,
                0, // key column (ID)
                responseId
            )

            console.log(`✅ Réponse supprimée (hard delete): ${responseId}`)
            res.json({
                success: true,
                message: 'Réponse supprimée avec succès'
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
                RESPONSES_RANGE,
                DataServiceV2.mappers.response
            )

            // Filtrer par utilisateur et obtenir uniquement les dernières réponses par event
            const userResponsesMap = new Map()
            allResponses
                .filter(r => r.userId === userId)
                .forEach(r => {
                    const key = r.eventId
                    const existing = userResponsesMap.get(key)
                    if (!existing || new Date(r.createdAt) > new Date(existing.createdAt)) {
                        userResponsesMap.set(key, r)
                    }
                })
            const userResponses = Array.from(userResponsesMap.values())

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
                RESPONSES_RANGE,
                DataServiceV2.mappers.response
            )

            // Filtrer par événement et obtenir uniquement les dernières réponses par user
            const eventResponsesMap = new Map()
            allResponses
                .filter(r => r.eventId === eventId)
                .forEach(r => {
                    const key = r.userId
                    const existing = eventResponsesMap.get(key)
                    if (!existing || new Date(r.createdAt) > new Date(existing.createdAt)) {
                        eventResponsesMap.set(key, r)
                    }
                })
            const eventResponses = Array.from(eventResponsesMap.values())

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
     * Mettre à jour le userId de toutes les réponses d'un utilisateur source vers un utilisateur cible
     * Utilisé pour migrer les réponses d'un visitor temporaire vers un utilisateur existant
     */
    static async migrateResponses(sourceUserId, targetUserId) {
        try {
            console.log(`🔄 Migration réponses: ${sourceUserId} -> ${targetUserId}`)

            // Récupérer toutes les réponses brutes (sans mapper) pour avoir les indices
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: RESPONSES_RANGE
            })

            const rows = response.data.values || []
            const responsesToUpdate = []

            // Trouver toutes les réponses du sourceUserId
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i]
                if (row && row[2] === sourceUserId) { // Colonne C = userId (index 2)
                    responsesToUpdate.push({ rowIndex: i, row })
                }
            }

            if (responsesToUpdate.length === 0) {
                console.log(`ℹ️ Aucune réponse à migrer pour ${sourceUserId}`)
                return { migrated: 0 }
            }

            console.log(`📝 ${responsesToUpdate.length} réponse(s) à migrer`)

            // Mettre à jour chaque réponse (remplacer userId dans colonne C)
            const sheetName = RESPONSES_RANGE.split('!')[0]
            const updateRequests = responsesToUpdate.map(({ rowIndex, row }) => {
                const actualRowIndex = rowIndex + 2 // +2 car on commence à la ligne 2
                const range = `${sheetName}!C${actualRowIndex}` // Colonne C = userId

                return {
                    range,
                    values: [[targetUserId]]
                }
            })

            // Mettre à jour toutes les réponses en une seule requête batch
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    valueInputOption: 'RAW',
                    data: updateRequests
                }
            })

            console.log(`✅ ${responsesToUpdate.length} réponse(s) migrée(s) de ${sourceUserId} vers ${targetUserId}`)
            return { migrated: responsesToUpdate.length }
        } catch (error) {
            console.error('❌ Erreur migration réponses:', error)
            throw error
        }
    }

}

module.exports = ResponsesController
