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
                
                // Si c'est une requête depuis un formulaire (requestId présent), renvoyer une page HTML
                if (req.body.requestId) {
                    const result = {
                        ok: false,
                        error: 'Données invalides',
                        details: validation.errors
                    }
                    return res.status(400).send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>FOMO Bookmarklet</title>
</head>
<body>
    <script>
        (function() {
            const result = ${JSON.stringify(result)};
            const requestId = ${JSON.stringify(req.body.requestId)};
            
            const response = {
                type: 'fomo-bookmarklet-response',
                requestId: requestId,
                ok: false,
                error: result.error,
                details: result.details
            };
            
            try {
                if (window.opener) {
                    window.opener.postMessage(response, '*');
                }
            } catch (e) {}
            
            try {
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage(response, '*');
                }
            } catch (e) {}
            
            setTimeout(function() {
                try {
                    window.close();
                } catch (e) {}
            }, 500);
        })();
    </script>
</body>
</html>
                    `)
                }
                
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
                
                // Si c'est une requête depuis un formulaire (requestId présent), renvoyer une page HTML
                if (req.body.requestId) {
                    const result = {
                        ok: true,
                        id: duplicate.id,
                        duplicate: true
                    }
                    return res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>FOMO Bookmarklet</title>
</head>
<body>
    <script>
        (function() {
            const result = ${JSON.stringify(result)};
            const requestId = ${JSON.stringify(req.body.requestId)};
            
            const response = {
                type: 'fomo-bookmarklet-response',
                requestId: requestId,
                ok: result.ok,
                id: result.id,
                duplicate: result.duplicate || false
            };
            
            try {
                if (window.opener) {
                    window.opener.postMessage(response, '*');
                }
            } catch (e) {}
            
            try {
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage(response, '*');
                }
            } catch (e) {}
            
            setTimeout(function() {
                try {
                    window.close();
                } catch (e) {}
            }, 500);
        })();
    </script>
</body>
</html>
                    `)
                }
                
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

            // Si c'est une requête depuis un formulaire (requestId présent), renvoyer une page HTML
            // qui envoie la réponse via postMessage
            if (req.body.requestId) {
                const result = {
                    ok: true,
                    id: eventId,
                    duplicate: false
                }
                return res.send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>FOMO Bookmarklet</title>
</head>
<body>
    <script>
        (function() {
            const result = ${JSON.stringify(result)};
            const requestId = ${JSON.stringify(req.body.requestId)};
            
            // Envoyer la réponse au parent/opener
            const response = {
                type: 'fomo-bookmarklet-response',
                requestId: requestId,
                ok: result.ok,
                id: result.id,
                duplicate: result.duplicate || false
            };
            
            try {
                if (window.opener) {
                    window.opener.postMessage(response, '*');
                    console.log('📤 Réponse envoyée via window.opener');
                }
            } catch (e) {
                console.error('Erreur postMessage opener:', e);
            }
            
            try {
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage(response, '*');
                    console.log('📤 Réponse envoyée via window.parent');
                }
            } catch (e) {
                console.error('Erreur postMessage parent:', e);
            }
            
            // Fermer la fenêtre après 500ms
            setTimeout(function() {
                try {
                    window.close();
                } catch (e) {
                    // Ignorer si on ne peut pas fermer
                }
            }, 500);
        })();
    </script>
</body>
</html>
                `)
            }

            res.json({
                ok: true,
                id: eventId
            })

        } catch (error) {
            console.error(`❌ [${requestId}] Erreur ingestion événement:`, error)
            
            // Si c'est une requête depuis un formulaire (requestId présent), renvoyer une page HTML
            if (req.body && req.body.requestId) {
                const result = {
                    ok: false,
                    error: error.message || 'Erreur interne du serveur'
                }
                return res.status(500).send(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>FOMO Bookmarklet</title>
</head>
<body>
    <script>
        (function() {
            const result = ${JSON.stringify(result)};
            const requestId = ${JSON.stringify(req.body.requestId)};
            
            const response = {
                type: 'fomo-bookmarklet-response',
                requestId: requestId,
                ok: false,
                error: result.error
            };
            
            try {
                if (window.opener) {
                    window.opener.postMessage(response, '*');
                }
            } catch (e) {}
            
            try {
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage(response, '*');
                }
            } catch (e) {}
            
            setTimeout(function() {
                try {
                    window.close();
                } catch (e) {}
            }, 500);
        })();
    </script>
</body>
</html>
                `)
            }
            
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
            const { eventId, rowData } = IngestController.transformPayload(payload)

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

