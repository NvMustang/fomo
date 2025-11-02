/**
 * Routes pour le traitement des actions en batch
 */

const express = require('express')
const router = express.Router()
const BatchController = require('../controllers/batchController')

// PUT /api/batch - Traiter un batch d'actions
router.put('/', BatchController.processBatch)

module.exports = router
