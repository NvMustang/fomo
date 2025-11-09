/**
 * Routes pour l'ingestion d'événements depuis le bookmarklet
 */

const express = require('express')
const router = express.Router()
const IngestController = require('../controllers/ingestController')

// POST /api/ingest/event - Ingérer un événement depuis le bookmarklet
// Le middleware validateApiKey vérifie le header X-FOMO-Key
router.post('/event', IngestController.validateApiKey, IngestController.ingestEvent)

module.exports = router

