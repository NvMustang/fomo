/**
 * Routes pour les réponses d'événements
 * NOUVELLE STRATÉGIE : Historique complet avec initialResponse/finalResponse
 */

const express = require('express')
const router = express.Router()
const ResponsesController = require('../controllers/responsesController')

// GET /api/responses - Récupérer toutes les réponses (historique complet)
router.get('/', ResponsesController.getAllResponses)

// POST /api/responses - Créer une nouvelle entrée d'historique de réponse
router.post('/', ResponsesController.createResponse)

module.exports = router