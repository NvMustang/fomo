/**
 * Routes pour les retours Beta
 */

const express = require('express')
const router = express.Router()
const BetaController = require('../controllers/betaController')

// POST /api/beta - Créer un retour beta
router.post('/', BetaController.createBetaFeedback)

module.exports = router

