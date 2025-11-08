/**
 * Route Onboarding - Sauvegarder et récupérer les données d'onboarding
 */

const express = require('express')
const router = express.Router()
const OnboardingController = require('../controllers/onboardingController')

/**
 * POST /onboarding/save
 * Sauvegarder les données d'onboarding depuis le frontend dans Google Sheets
 */
router.post('/save', OnboardingController.saveOnboarding.bind(OnboardingController))

/**
 * GET /onboarding/aggregated
 * Récupérer les statistiques agrégées d'onboarding depuis Google Sheets
 */
router.get('/aggregated', OnboardingController.getAggregatedStats.bind(OnboardingController))

module.exports = router

