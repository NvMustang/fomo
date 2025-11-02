/**
 * Routes pour les réponses d'événements
 * Routes utilisées uniquement (MVP)
 */

const express = require('express')
const router = express.Router()
const ResponsesController = require('../controllers/responsesController')

// GET /api/responses - Récupérer toutes les réponses
router.get('/', ResponsesController.getAllResponses)

module.exports = router