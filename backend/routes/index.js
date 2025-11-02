/**
 * Router principal - Assemble toutes les routes
 */

const express = require('express')
const router = express.Router()

// Import des routes
const eventsRoutes = require('./events')
const usersRoutes = require('./users')
const responsesRoutes = require('./responses')
const geocodingRoutes = require('./geocoding')
const batchRoutes = require('./batch')
const tagsRoutes = require('./tags')

// Montage des routes
router.use('/events', eventsRoutes)
router.use('/users', usersRoutes)
router.use('/responses', responsesRoutes)
router.use('/geocode', geocodingRoutes)
router.use('/batch', batchRoutes)
router.use('/tags', tagsRoutes)

module.exports = router
