/**
 * Contrôleur pour les événements - NOUVELLE STRATÉGIE OVERWRITE
 * Gère la logique métier avec overwrite + colonnes système
 */

const DataServiceV2 = require('../utils/dataService')

class EventsController {
    // Range Google Sheets pour la feuille Events
    // Colonnes: A=ID, B=CreatedAt, C=Title, D=Description, E=StartsAt, F=EndsAt, G=Venue Name, H=Venue Address, I=Lat, J=Lng, K=Cover URL, L=Image Position, M=Organizer ID, N=Is Public, O=Is Online, P=ModifiedAt, Q=DeletedAt, R=Source
    static EVENTS_RANGE = 'Events!A2:R'

    /**
     * Helper: Obtenir les eventIds avec réponses pour un userId
     * Optimisé: tri une fois + première occurrence = plus récente
     */
    static getEventIdsWithResponses(allResponses, userId) {
        // Filtrer les réponses de l'utilisateur et trier par date décroissante
        const userResponses = allResponses
            .filter(r => r.userId === userId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))  // Plus récent en premier

        // Set pour tracker les eventIds déjà vus (première occurrence = plus récente)
        const eventIdsSet = new Set()

        for (const response of userResponses) {
            eventIdsSet.add(response.eventId)
        }

        return eventIdsSet
    }

    /**
     * Récupérer tous les événements actifs avec filtrage optionnel
     * Query params:
     * - mode: 'visitor' | 'user' (obligatoire)
     * - privacy: 'public' | 'private' (si mode=user)
     * - userId: string (si mode=visitor OU privacy=private)
     * - onlineOnly: 'true' | 'false' (optionnel, default: true)
     */
    static async getAllEvents(req, res) {
        const requestId = Math.random().toString(36).substr(2, 9)
        const timestamp = new Date().toISOString()
        try {
            const { mode, privacy, userId, onlineOnly } = req.query

            // Parser onlineOnly (default: true)
            const shouldFilterOnline = onlineOnly !== 'false' // true sauf si explicitement 'false'

            console.log(`📋 [${requestId}] [${timestamp}] Récupération des événements (overwrite)...`)
            console.log(`📋 [${requestId}] Mode: ${mode}, Privacy: ${privacy}, UserId: ${userId}, OnlineOnly: ${shouldFilterOnline}`)
            console.log(`📋 [${requestId}] Headers:`, req.headers['user-agent'] || 'unknown')
            console.log(`📋 [${requestId}] IP:`, req.ip || req.connection.remoteAddress)

            // Validation des paramètres
            if (!mode || (mode !== 'visitor' && mode !== 'user')) {
                return res.status(400).json({
                    success: false,
                    error: 'Le paramètre "mode" est requis et doit être "visitor" ou "user"'
                })
            }

            if (mode === 'visitor' && privacy !== 'public' && !userId) {
                return res.status(400).json({
                    success: false,
                    error: 'Le paramètre "userId" est requis en mode visitor (sauf en mode public)'
                })
            }

            if (mode === 'user' && privacy === 'private' && !userId) {
                return res.status(400).json({
                    success: false,
                    error: 'Le paramètre "userId" est requis en mode user avec privacy=private'
                })
            }

            // Charger tous les événements
            let events = await DataServiceV2.getAllActiveData(
                EventsController.EVENTS_RANGE,
                DataServiceV2.mappers.event
            )

            // Filtrage selon le mode et la privacy
            if (mode === 'visitor' && privacy === 'public') {
                // SÉCURITÉ : Visitor en mode public ne voit AUCUN event réel
                // Frontend affichera des fake events
                events = []
                console.log(`🔒 [${requestId}] Filtrage visitor/public: 0 événements (fake events côté frontend)`)
            } else if (mode === 'visitor') {
                // Visitor en mode private : UNIQUEMENT events avec réponse

                // Charger les responses
                const allResponses = await DataServiceV2.getAllActiveData(
                    'Responses!A2:G',
                    DataServiceV2.mappers.response
                )

                // Obtenir les eventIds avec réponses (optimisé)
                const eventIdsWithResponses = EventsController.getEventIdsWithResponses(allResponses, userId)

                // Filtrer les events : garder uniquement ceux avec responses
                events = events.filter(evt => eventIdsWithResponses.has(evt.id))

                console.log(`🔒 [${requestId}] Filtrage visitor/private: ${events.length} événements avec réponses pour userId=${userId}`)
            } else if (mode === 'user' && privacy === 'private') {
                // Users en mode private : events avec réponses ET qui sont privés (isPublic !== true)
                // IMPORTANT : Exclure les événements publics même si l'utilisateur y a répondu

                // Charger les responses
                const allResponses = await DataServiceV2.getAllActiveData(
                    'Responses!A2:G',
                    DataServiceV2.mappers.response
                )

                // Obtenir les eventIds avec réponses (optimisé)
                const eventIdsWithResponses = EventsController.getEventIdsWithResponses(allResponses, userId)

                // Filtrer les events : uniquement ceux avec réponses ET qui sont privés
                events = events.filter(evt => 
                    eventIdsWithResponses.has(evt.id) && 
                    evt.isPublic !== true  // Exclure les événements publics (isPublic === true ou undefined)
                )

                console.log(`🔒 [${requestId}] Filtrage user/private: ${events.length} événements privés avec réponses pour userId=${userId}`)
            } else if (mode === 'user' && privacy === 'public') {
                // Users en mode public : tous les événements publics
                events = events.filter(evt => evt.isPublic === true)
                console.log(`🌍 [${requestId}] Filtrage user/public: ${events.length} événements publics`)
            }

            // Filtrage isOnline (si onlineOnly=true, par défaut)
            if (shouldFilterOnline) {
                const beforeOnlineFilter = events.length
                events = events.filter(evt => evt.isOnline !== false) // Garder true et undefined
                console.log(`🌐 [${requestId}] Filtrage online: ${events.length}/${beforeOnlineFilter} événements (${beforeOnlineFilter - events.length} offline exclus)`)
            }

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

            console.log(`✅ [${requestId}] ${events.length} événements récupérés et filtrés`)
            res.json({ success: true, data: events })
        } catch (error) {
            console.error(`❌ [${requestId}] Erreur récupération événements:`, error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Récupérer MES événements (créés par moi)
     * Query params:
     * - userId: string (obligatoire)
     * Retourne TOUS les events créés par userId (online + offline)
     */
    static async getMyEvents(req, res) {
        const requestId = Math.random().toString(36).substr(2, 9)
        try {
            const { userId } = req.query

            console.log(`👤 [${requestId}] Récupération MES événements pour userId=${userId}`)

            // Validation
            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'Le paramètre "userId" est requis'
                })
            }

            // Charger tous les événements
            let events = await DataServiceV2.getAllActiveData(
                EventsController.EVENTS_RANGE,
                DataServiceV2.mappers.event
            )

            // Filtrer uniquement ceux créés par cet utilisateur
            events = events.filter(evt => evt.organizerId === userId)

            console.log(`✅ [${requestId}] ${events.length} événements créés par userId=${userId}`)

            // Enrichir avec tags
            const tagsMap = await DataServiceV2.getTagsByEventIdMap(10)
            if (tagsMap.size > 0) {
                for (const evt of events) {
                    const fromSheet = tagsMap.get(evt.id)
                    if (fromSheet && fromSheet.length) {
                        evt.tags = fromSheet
                    }
                }
            }

            res.json({ success: true, data: events })
        } catch (error) {
            console.error(`❌ [${requestId}] Erreur récupération MES événements:`, error)
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

            // Enrichir avec organizerName depuis la table Users si présent
            try {
                if (event.organizerId) {
                    const organizer = await DataServiceV2.getByKey(
                        'Users!A2:Q',
                        DataServiceV2.mappers.user,
                        0, // key column (ID)
                        event.organizerId
                    )
                    if (organizer && organizer.name) {
                        event.organizerName = organizer.name
                    }
                }
            } catch (_) {
                // silencieux: fallback sur organizerName si présent dans l'event
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
                '',                                         // Q: DeletedAt
                eventData.source || 'manual'                // R: Source (par défaut 'manual' pour création manuelle)
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
            const stats = {
                going: 0,
                participe: 0,
                interested: 0,
                maybe: 0,
                not_interested: 0,
                not_there: 0
            }

            for (const response of eventResponses) {
                switch (response.finalResponse) {
                    case 'going':
                        stats.going++
                        break
                    case 'participe':
                        stats.participe++
                        break
                    case 'interested':
                        stats.interested++
                        break
                    case 'maybe':
                        stats.maybe++
                        break
                    case 'not_interested':
                        stats.not_interested++
                        break
                    case 'not_there':
                        stats.not_there++
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
