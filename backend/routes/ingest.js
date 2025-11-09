/**
 * Routes pour l'ingestion d'événements depuis le bookmarklet
 */

const express = require('express')
const router = express.Router()
const IngestController = require('../controllers/ingestController')

// POST /api/ingest/event - Ingérer un événement depuis le bookmarklet (header X-FOMO-Key)
// Le middleware validateApiKey vérifie le header X-FOMO-Key
router.post('/event', IngestController.validateApiKey, IngestController.ingestEvent)

// POST /api/ingest/event-form - Ingérer un événement via formulaire POST (clé dans le body)
// Pour les formulaires HTML qui ne peuvent pas envoyer de headers personnalisés
// Renvoie une page HTML qui communique via postMessage
router.post('/event-form', IngestController.validateApiKeyFromBody, IngestController.ingestEventForm)

module.exports = router

