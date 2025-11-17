/**
 * Contrôleur pour l'ingestion d'événements depuis le bookmarklet
 * Reçoit les données d'événements Facebook et les enregistre dans Google Sheets
 */

const DataServiceV2 = require('../utils/dataService')
const EventsController = require('./eventsController')
const GeocodingService = require('../services/geocodingService')

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

        if (!payload.description || typeof payload.description !== 'string' || !payload.description.trim()) {
            errors.push('Le champ "description" est obligatoire')
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

        // L'adresse est obligatoire car le géocodage en dépend
        if (!payload.address || typeof payload.address !== 'string' || !payload.address.trim()) {
            errors.push('Le champ "address" est obligatoire (nécessaire pour le géocodage)')
        }

        if (!payload.cover || typeof payload.cover !== 'string' || !payload.cover.trim()) {
            errors.push('Le champ "cover" (image de couverture) est obligatoire')
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
     * Inclut le géocodage de l'adresse si disponible
     */
    static async transformPayload(payload) {
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

        // Calculer la date de fin : si absente, ajouter 8h à la date de début
        let endsAt = payload.end || ''
        if (!endsAt && payload.start) {
            const startDate = new Date(payload.start)
            if (!isNaN(startDate.getTime())) {
                startDate.setHours(startDate.getHours() + 8)
                endsAt = startDate.toISOString()
            }
        }

        // Géocodage de l'adresse si disponible
        let lat = '0.000000'
        let lng = '0.000000'
        if (payload.address && payload.address.trim()) {
            const addressTrimmed = payload.address.trim()

            // Détecter si l'adresse contient des coordonnées au format "50,493184, 5,164947" (lat, lng avec virgules comme séparateur décimal)
            // Pattern: nombre avec virgule décimale (une ou plusieurs décimales), virgule (ou virgule+espace), nombre avec virgule décimale
            const coordPattern = /^(-?\d+,\d+)\s*,\s*(-?\d+,\d+)$/
            const coordMatch = addressTrimmed.match(coordPattern)

            if (coordMatch) {
                // Extraire et convertir les coordonnées (remplacer virgules par points pour parseFloat)
                const latStr = coordMatch[1].replace(',', '.')
                const lngStr = coordMatch[2].replace(',', '.')
                const latNum = parseFloat(latStr)
                const lngNum = parseFloat(lngStr)

                // Valider que les coordonnées sont dans des plages valides
                if (!isNaN(latNum) && !isNaN(lngNum) && latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180) {
                    lat = latNum.toFixed(6)
                    lng = lngNum.toFixed(6)
                    console.log(`📍 Coordonnées extraites depuis l'adresse: ${lat}, ${lng}`)
                } else {
                    console.warn(`⚠️ Coordonnées invalides détectées dans l'adresse: ${addressTrimmed}`)
                    // Fallback sur géocodage
                    try {
                        console.log(`🌐 Géocodage de l'adresse: ${addressTrimmed}`)
                        const geocodeResult = await GeocodingService.searchAddresses(addressTrimmed, { limit: 1 })

                        if (geocodeResult.success && geocodeResult.data && geocodeResult.data.length > 0) {
                            const firstResult = geocodeResult.data[0]
                            lat = parseFloat(firstResult.lat || 0).toFixed(6)
                            lng = parseFloat(firstResult.lon || 0).toFixed(6)
                            console.log(`✅ Coordonnées trouvées via géocodage: ${lat}, ${lng}`)
                        } else {
                            console.warn(`⚠️ Aucune coordonnée trouvée pour: ${addressTrimmed}`)
                        }
                    } catch (geocodeError) {
                        console.error('❌ Erreur lors du géocodage:', geocodeError)
                    }
                }
            } else {
                // Pas de coordonnées détectées, faire le géocodage normal
                try {
                    console.log(`🌐 Géocodage de l'adresse: ${addressTrimmed}`)
                    const geocodeResult = await GeocodingService.searchAddresses(addressTrimmed, { limit: 1 })

                    if (geocodeResult.success && geocodeResult.data && geocodeResult.data.length > 0) {
                        const firstResult = geocodeResult.data[0]
                        lat = parseFloat(firstResult.lat || 0).toFixed(6)
                        lng = parseFloat(firstResult.lon || 0).toFixed(6)
                        console.log(`✅ Coordonnées trouvées: ${lat}, ${lng}`)
                    } else {
                        console.warn(`⚠️ Aucune coordonnée trouvée pour: ${addressTrimmed}`)
                    }
                } catch (geocodeError) {
                    console.error('❌ Erreur lors du géocodage:', geocodeError)
                    // Ne pas bloquer l'ingestion si le géocodage échoue
                }
            }
        }

        // Image position par défaut: 50:50
        const imagePosition = '50;50'

        // Organizer ID : utiliser uniquement le champ host (nom de l'organisateur) depuis le form POST
        // Le form POST envoie toujours le nom de l'organisateur dans le champ host
        const organizerId = (payload.host && typeof payload.host === 'string' && payload.host.trim())
            ? payload.host.trim()
            : ''

        // Source : utiliser l'URL de l'événement
        const source = payload.url || payload.source || 'facebook'

        // Format de ligne Google Sheets: [id, createdAt, title, description, startsAt, endsAt, venueName, venueAddress, lat, lng, coverUrl, imagePosition, organizerId, isPublic, isOnline, modifiedAt, deletedAt, source, deleteUrl]
        const rowData = [
            eventId,                                    // A: ID
            now,                                        // B: CreatedAt
            payload.title.trim(),                       // C: Title
            payload.description || '',                  // D: Description
            payload.start,                              // E: StartsAt
            endsAt,                                     // F: EndsAt (start + 8h si absent)
            venueName,                                  // G: Venue Name
            payload.address || '',                     // H: Venue Address
            lat,                                        // I: Latitude (géocodée)
            lng,                                        // J: Longitude (géocodée)
            payload.cover || '',                       // K: Cover URL
            imagePosition,                              // L: Image Position (50;50 par défaut)
            organizerId,                                // M: Organizer ID (depuis payload ou défaut)
            'true',                                     // N: Is Public (toujours true)
            'true',                                     // O: Is Online (toujours true)
            now,                                        // P: ModifiedAt
            '',                                         // Q: DeletedAt
            source,                                     // R: Source (URL de l'événement)
            ''                                          // S: ImgBB Delete URL (vide par défaut, sera rempli si upload via imgbb)
        ]

        return { eventId, rowData }
    }

    /**
     * Middleware pour valider la clé API depuis le body (pour formulaire POST)
     */
    static validateApiKeyFromBody(req, res, next) {
        const providedKey = req.body.apiKey || req.body.fomoKey || req.body.fomo_key
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

        // Supprimer la clé du body pour éviter de la traiter comme une donnée d'événement
        delete req.body.apiKey
        delete req.body.fomoKey
        delete req.body.fomo_key

        next()
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
            const { eventId, rowData } = await IngestController.transformPayload(payload)

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

    /**
     * Endpoint spécifique pour formulaire POST: POST /api/ingest/event-form
     * Renvoie une page HTML qui communique via postMessage avec expectedOrigin
     */
    static async ingestEventForm(req, res) {
        const requestId = req.body.requestId || Math.random().toString(36).substr(2, 9)
        const timestamp = new Date().toISOString()
        const expectedOrigin = req.body.expectedOrigin || (req.headers.referer ? new URL(req.headers.referer).origin : '*')

        // Log IP et requestId pour ratelimit
        console.log(`📥 [${requestId}] [${timestamp}] Requête formulaire POST`)
        console.log(`📥 [${requestId}] IP:`, req.ip || req.connection.remoteAddress)
        console.log(`📥 [${requestId}] ExpectedOrigin:`, expectedOrigin)

        try {
            // Extraire le payload (sans apiKey, requestId, expectedOrigin)
            const payload = { ...req.body }
            delete payload.apiKey
            delete payload.fomoKey
            delete payload.fomo_key
            delete payload.requestId
            delete payload.expectedOrigin

            console.log(`📥 [${requestId}] Payload:`, JSON.stringify(payload, null, 2))

            // Validation du payload
            const validation = IngestController.validateEventPayload(payload)
            if (!validation.isValid) {
                console.warn(`⚠️ [${requestId}] Validation échouée:`, validation.errors)
                return res.status(400).send(`
<!doctype html>
<html>
<head>
    <meta charset="UTF-8">
    <title>FOMO Bookmarklet</title>
</head>
<body>
    <script>
        (function(){
            const payload = ${JSON.stringify({ id: null, requestId: requestId, expectedOrigin: expectedOrigin })};
            const expected = payload.expectedOrigin || '*';
            
            if (window.opener) {
                window.opener.postMessage({
                    type: 'FOMO_INGEST_RESPONSE',
                    ok: false,
                    error: 'Données invalides',
                    details: ${JSON.stringify(validation.errors)},
                    requestId: payload.requestId
                }, expected);
            }
            
            try { window.close(); } catch(e) {}
        })();
    </script>
</body>
</html>
                `)
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

                return res.send(`
<!doctype html>
<html>
<head>
    <meta charset="UTF-8">
    <title>FOMO Bookmarklet</title>
</head>
<body>
    <script>
        (function(){
            const payload = ${JSON.stringify({ id: duplicate.id, requestId: requestId, expectedOrigin: expectedOrigin })};
            const expected = payload.expectedOrigin || '*';
            
            if (window.opener) {
                window.opener.postMessage({
                    type: 'FOMO_INGEST_RESPONSE',
                    ok: true,
                    id: payload.id,
                    duplicate: true,
                    requestId: payload.requestId
                }, expected);
            }
            
            try { window.close(); } catch(e) {}
        })();
    </script>
</body>
</html>
                `)
            }

            // Transformation et enregistrement
            const { eventId, rowData } = await IngestController.transformPayload(payload)

            await DataServiceV2.upsertData(
                EventsController.EVENTS_RANGE,
                rowData,
                0, // key column (ID)
                eventId
            )

            const city = IngestController.extractCity(payload.address || '')
            console.log(`✅ [${requestId}] Événement ingéré: ${payload.title} - ${city} (ID: ${eventId})`)

            // Renvoyer une page HTML simple qui envoie la réponse via postMessage
            // Cette page s'exécute dans la popup ouverte par le formulaire POST
            return res.send(`
<!doctype html>
<html>
<head>
    <meta charset="UTF-8">
    <title>FOMO Bookmarklet</title>
</head>
<body>
    <script>
        (function(){
            const payload = ${JSON.stringify({ id: eventId, requestId: requestId, expectedOrigin: expectedOrigin })};
            const expected = payload.expectedOrigin || '*';
            
            // Envoyer le message au bookmarklet (window.opener = la page Facebook)
            if (window.opener) {
                window.opener.postMessage({
                    type: 'FOMO_INGEST_RESPONSE',
                    ok: true,
                    id: payload.id,
                    duplicate: false,
                    requestId: payload.requestId
                }, expected);
            }
            
            // Fermer la popup
            try { window.close(); } catch(e) {}
        })();
    </script>
</body>
</html>
            `)

        } catch (error) {
            console.error(`❌ [${requestId}] Erreur ingestion événement:`, error)

            return res.status(500).send(`
<!doctype html>
<html>
<head>
    <meta charset="UTF-8">
    <title>FOMO Bookmarklet</title>
</head>
<body>
    <script>
        (function(){
            const payload = ${JSON.stringify({ id: null, requestId: requestId, expectedOrigin: expectedOrigin })};
            const expected = payload.expectedOrigin || '*';
            
            if (window.opener) {
                window.opener.postMessage({
                    type: 'FOMO_INGEST_RESPONSE',
                    ok: false,
                    error: ${JSON.stringify(error.message || 'Erreur interne du serveur')},
                    requestId: payload.requestId
                }, expected);
            }
            
            try { window.close(); } catch(e) {}
        })();
    </script>
</body>
</html>
            `)
        }
    }
}

module.exports = IngestController

