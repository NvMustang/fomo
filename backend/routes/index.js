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
const betaRoutes = require('./beta')
const analyticsRoutes = require('./analytics')
const onboardingRoutes = require('./onboarding')
const ingestRoutes = require('./ingest')

// Montage des routes
router.use('/events', eventsRoutes)
router.use('/users', usersRoutes)
router.use('/responses', responsesRoutes)
router.use('/geocode', geocodingRoutes)
router.use('/batch', batchRoutes)
router.use('/tags', tagsRoutes)
router.use('/beta', betaRoutes)
router.use('/analytics', analyticsRoutes)
router.use('/onboarding', onboardingRoutes)
router.use('/ingest', ingestRoutes)

module.exports = router
