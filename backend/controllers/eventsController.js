/**
 * Contrôleur pour les événements - NOUVELLE STRATÉGIE OVERWRITE
 * Gère la logique métier avec overwrite + colonnes système
 */

const DataServiceV2 = require('../utils/dataService')

class EventsController {
    // Range Google Sheets pour la feuille Events
    static EVENTS_RANGE = 'Events!A2:Q'

    /**
     * Récupérer tous les événements actifs
     */
    static async getAllEvents(req, res) {
        const requestId = Math.random().toString(36).substr(2, 9)
        const timestamp = new Date().toISOString()
        try {
            console.log(`📋 [${requestId}] [${timestamp}] Récupération des événements (overwrite)...`)
            console.log(`📋 [${requestId}] Headers:`, req.headers['user-agent'] || 'unknown')
            console.log(`📋 [${requestId}] IP:`, req.ip || req.connection.remoteAddress)

            const events = await DataServiceV2.getAllActiveData(
                EventsController.EVENTS_RANGE,
                DataServiceV2.mappers.event
            )

            // Enrichir avec la feuille Tags si disponible (limite 10)
            const tagsMap = await DataServiceV2.getTagsByEventIdMap(10)
            if (tagsMap.size > 0) {
                for (const evt of events) {
                    const fromSheet = tagsMap.get(evt.id)
                    if (fromSheet && fromSheet.length) {
                        evt.tags = fromSheet
                    }
                }
            }

            console.log(`✅ [${requestId}] ${events.length} événements récupérés`)
            res.json({ success: true, data: events })
        } catch (error) {
            console.error(`❌ [${requestId}] Erreur récupération événements:`, error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Récupérer un événement par ID
     */
    static async getEventById(req, res) {
        try {
            const eventId = req.params.id
            console.log(`📋 Récupération événement: ${eventId}`)

            const event = await DataServiceV2.getByKey(
                EventsController.EVENTS_RANGE,
                DataServiceV2.mappers.event,
                0, // key column (ID)
                eventId
            )

            if (!event) {
                return res.status(404).json({
                    success: false,
                    error: 'Événement non trouvé'
                })
            }

            // Remplacer les tags depuis la feuille Tags si présents
            try {
                const tagsMap = await DataServiceV2.getTagsByEventIdMap(10)
                const fromSheet = tagsMap.get(event.id)
                if (fromSheet && fromSheet.length) {
                    event.tags = fromSheet
                }
            } catch (_) {
                // silencieux: fallback déjà géré
            }

            console.log(`✅ Événement récupéré: ${event.title}`)
            res.json({ success: true, data: event })
        } catch (error) {
            console.error('❌ Erreur récupération événement:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Créer ou mettre à jour un événement (UPSERT)
     */
    static async upsertEvent(req, res) {
        try {
            const eventData = req.body
            const eventId = eventData.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

            console.log(`🔄 Upsert événement: ${eventId}`)

            // Préparer les données pour la feuille
            // Formater imagePosition en format simple "x;y" si présent
            let imagePositionStr = ''
            if (eventData.coverImagePosition && typeof eventData.coverImagePosition === 'object') {
                imagePositionStr = `${eventData.coverImagePosition.x || 50};${eventData.coverImagePosition.y || 50}`
            }

            const rowData = [
                eventId,                                    // A: ID
                eventData.createdAt || new Date().toISOString(), // B: CreatedAt
                eventData.title || '',                      // C: Title
                eventData.description || '',                // D: Description
                eventData.startsAt || '',                   // E: StartsAt
                eventData.endsAt || '',                     // F: EndsAt
                eventData.venue?.name || '',                // G: Venue Name
                eventData.venue?.address || '',             // H: Venue Address
                parseFloat(eventData.venue?.lat || 0).toFixed(6),  // I: Latitude (format avec points)
                parseFloat(eventData.venue?.lng || 0).toFixed(6),  // J: Longitude (format avec points)
                eventData.coverUrl || '',                   // K: Cover URL
                imagePositionStr,                           // L: Image Position (format: "50;50")
                eventData.organizerId || 'admin-fomo',      // M: Organizer ID
                eventData.isPublic || 'false',              // N: Is Public
                eventData.isOnline || 'false',              // O: Is Online
                new Date().toISOString(),                   // P: ModifiedAt
                ''                                          // Q: DeletedAt
            ]

            const result = await DataServiceV2.upsertData(
                EventsController.EVENTS_RANGE,
                rowData,
                0, // key column (ID)
                eventId
            )

            // Synchroniser la feuille Tags (max 10)
            try {
                const tags = Array.isArray(eventData.tags) ? eventData.tags : []
                await DataServiceV2.upsertEventTags(eventId, tags, 10)
            } catch (err) {
                console.error(`❌ Échec sync Tags pour event ${eventId}:`, err.message)
                console.error('Stack:', err.stack)
                // Ne pas faire échouer la création de l'event si Tags échoue
            }

            console.log(`✅ Événement ${result.action}: ${eventId}`)
            res.json({
                success: true,
                data: { ...eventData, id: eventId },
                action: result.action
            })
        } catch (error) {
            console.error('❌ Erreur upsert événement:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Supprimer un événement (soft delete)
     */
    static async deleteEvent(req, res) {
        try {
            const eventId = req.params.id
            console.log(`🗑️ Suppression événement: ${eventId}`)

            const result = await DataServiceV2.softDelete(
                EventsController.EVENTS_RANGE,
                0, // key column (ID)
                eventId
            )

            console.log(`✅ Événement supprimé: ${eventId}`)
            res.json({
                success: true,
                message: 'Événement supprimé avec succès',
                deletedAt: result.deletedAt
            })
        } catch (error) {
            console.error('❌ Erreur suppression événement:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Calculer les statistiques d'un événement
     */
    static async getEventStats(req, res) {
        try {
            const eventId = req.params.id
            console.log(`📊 Calcul statistiques événement: ${eventId}`)

            const responses = await DataServiceV2.getAllActiveData(
                'Responses!A2:G',
                DataServiceV2.mappers.response
            )

            // Filtrer par eventId et obtenir uniquement les dernières réponses par user
            const latestResponsesMap = new Map()
            responses
                .filter(r => r.eventId === eventId)
                .forEach(r => {
                    const existing = latestResponsesMap.get(r.userId)
                    if (!existing || new Date(r.createdAt) > new Date(existing.createdAt)) {
                        latestResponsesMap.set(r.userId, r)
                    }
                })

            const eventResponses = Array.from(latestResponsesMap.values())
            const stats = { going: 0, interested: 0, not_interested: 0 }

            for (const response of eventResponses) {
                switch (response.finalResponse) {
                    case 'going':
                        stats.going++
                        break
                    case 'interested':
                        stats.interested++
                        break
                    case 'not_interested':
                        stats.not_interested++
                        break
                }
            }

            console.log(`✅ Statistiques calculées: ${JSON.stringify(stats)}`)
            res.json({ success: true, data: stats })
        } catch (error) {
            console.error('❌ Erreur calcul statistiques:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }
}

module.exports = EventsController
