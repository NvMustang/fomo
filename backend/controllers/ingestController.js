/**
 * Contrôleur pour l'ingestion d'événements depuis le bookmarklet
 * Reçoit les données d'événements Facebook et les enregistre dans Google Sheets
 */

const DataServiceV2 = require('../utils/dataService')
const EventsController = require('./eventsController')

class IngestController {
    /**
     * Middleware de vérification de la clé API
     */
    static validateApiKey(req, res, next) {
        const providedKey = req.headers['x-fomo-key']
        const expectedKey = process.env.FOMO_KEY

        if (!expectedKey) {
            console.error('❌ FOMO_KEY non configurée dans les variables d\'environnement')
            return res.status(500).json({
                ok: false,
                error: 'Configuration serveur invalide'
            })
        }

        if (!providedKey || providedKey !== expectedKey) {
            console.warn(`⚠️ Tentative d'accès avec clé invalide depuis ${req.ip}`)
            return res.status(401).json({
                ok: false,
                error: 'Clé d\'authentification invalide'
            })
        }

        next()
    }

    /**
     * Valider le payload d'événement
     */
    static validateEventPayload(payload) {
        const errors = []

        if (!payload.url || typeof payload.url !== 'string' || !payload.url.trim()) {
            errors.push('Le champ "url" est obligatoire')
        }

        if (!payload.title || typeof payload.title !== 'string' || !payload.title.trim()) {
            errors.push('Le champ "title" est obligatoire')
        }

        if (!payload.start || typeof payload.start !== 'string' || !payload.start.trim()) {
            errors.push('Le champ "start" est obligatoire')
        } else {
            // Vérifier que c'est une date ISO valide
            const startDate = new Date(payload.start)
            if (isNaN(startDate.getTime())) {
                errors.push('Le champ "start" doit être une date ISO valide')
            }
        }

        // Validation optionnelle de "end" si présent
        if (payload.end && typeof payload.end === 'string' && payload.end.trim()) {
            const endDate = new Date(payload.end)
            if (isNaN(endDate.getTime())) {
                errors.push('Le champ "end" doit être une date ISO valide si fourni')
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        }
    }

    /**
     * Extraire la ville depuis une adresse
     * Format attendu: "Rue, Code Postal Ville, Pays"
     */
    static extractCity(address) {
        if (!address || typeof address !== 'string') return ''
        
        const parts = address.split(',').map(p => p.trim())
        // Prendre l'avant-dernier élément (généralement la ville)
        if (parts.length >= 2) {
            return parts[parts.length - 2] || ''
        }
        return ''
    }

    /**
     * Vérifier si un événement existe déjà (déduplication)
     */
    static async checkDuplicate(url, title, start) {
        try {
            const events = await DataServiceV2.getAllActiveData(
                EventsController.EVENTS_RANGE,
                DataServiceV2.mappers.event
            )

            // Vérifier par URL (si stockée dans description ou autre champ)
            // Pour l'instant, on vérifie par title + start
            const duplicate = events.find(evt => {
                const titleMatch = evt.title && evt.title.trim().toLowerCase() === title.trim().toLowerCase()
                const startMatch = evt.startsAt && evt.startsAt === start
                return titleMatch && startMatch
            })

            return duplicate || null
        } catch (error) {
            console.error('❌ Erreur lors de la vérification de déduplication:', error)
            // En cas d'erreur, on continue quand même (ne pas bloquer l'ingestion)
            return null
        }
    }

    /**
     * Transformer le payload bookmarklet vers le format Google Sheets
     */
    static transformPayload(payload) {
        const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
        const now = new Date().toISOString()

        // Extraire le nom du venue depuis venue_name, host ou address (dans cet ordre de priorité)
        let venueName = payload.venue_name || ''
        if (!venueName) {
            venueName = payload.host || ''
        }
        if (!venueName && payload.address) {
            // Essayer d'extraire depuis l'adresse (première partie avant la virgule)
            const addressParts = payload.address.split(',').map(p => p.trim())
            venueName = addressParts[0] || ''
        }

        // Format de ligne Google Sheets: [id, createdAt, title, description, startsAt, endsAt, venueName, venueAddress, lat, lng, coverUrl, imagePosition, organizerId, isPublic, isOnline, modifiedAt, deletedAt, source]
        const rowData = [
            eventId,                                    // A: ID
            now,                                        // B: CreatedAt
            payload.title.trim(),                       // C: Title
            payload.description || '',                  // D: Description
            payload.start,                              // E: StartsAt
            payload.end || '',                          // F: EndsAt
            venueName,                                  // G: Venue Name
            payload.address || '',                     // H: Venue Address
            '0.000000',                                 // I: Latitude (placeholder, géocodage futur)
            '0.000000',                                // J: Longitude (placeholder, géocodage futur)
            payload.cover || '',                       // K: Cover URL
            '',                                         // L: Image Position (vide par défaut)
            'bookmarklet-fomo',                        // M: Organizer ID
            'true',                                     // N: Is Public (événements Facebook publics)
            'false',                                   // O: Is Online (par défaut false, peut être détecté si pas d'address)
            now,                                        // P: ModifiedAt
            '',                                         // Q: DeletedAt
            payload.source || 'facebook'                // R: Source (par défaut 'facebook' pour le bookmarklet)
        ]

        return { eventId, rowData }
    }

    /**
     * Endpoint principal: POST /api/ingest/event
     */
    static async ingestEvent(req, res) {
        const requestId = Math.random().toString(36).substr(2, 9)
        const timestamp = new Date().toISOString()

        try {
            const payload = req.body

            console.log(`📥 [${requestId}] [${timestamp}] Requête d'ingestion d'événement`)
            console.log(`📥 [${requestId}] IP:`, req.ip || req.connection.remoteAddress)
            console.log(`📥 [${requestId}] Payload:`, JSON.stringify(payload, null, 2))

            // Validation du payload
            const validation = IngestController.validateEventPayload(payload)
            if (!validation.isValid) {
                console.warn(`⚠️ [${requestId}] Validation échouée:`, validation.errors)
                return res.status(400).json({
                    ok: false,
                    error: 'Données invalides',
                    details: validation.errors
                })
            }

            // Vérification de déduplication
            const duplicate = await IngestController.checkDuplicate(
                payload.url,
                payload.title,
                payload.start
            )

            if (duplicate) {
                const city = IngestController.extractCity(payload.address || '')
                console.log(`🔄 [${requestId}] Doublon détecté: ${payload.title} - ${city} (ID existant: ${duplicate.id})`)
                return res.json({
                    ok: true,
                    id: duplicate.id,
                    duplicate: true
                })
            }

            // Transformation et enregistrement
            const { eventId, rowData } = IngestController.transformPayload(payload)

            await DataServiceV2.upsertData(
                EventsController.EVENTS_RANGE,
                rowData,
                0, // key column (ID)
                eventId
            )

            const city = IngestController.extractCity(payload.address || '')
            console.log(`✅ [${requestId}] Événement ingéré: ${payload.title} - ${city} (ID: ${eventId})`)

            res.json({
                ok: true,
                id: eventId
            })

        } catch (error) {
            console.error(`❌ [${requestId}] Erreur ingestion événement:`, error)
            res.status(500).json({
                ok: false,
                error: error.message || 'Erreur interne du serveur'
            })
        }
    }
}

module.exports = IngestController

