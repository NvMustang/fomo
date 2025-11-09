/**
 * Route Analytics - Exposer les statistiques backend et sauvegarder dans Google Sheets
 */

const express = require('express')
const router = express.Router()
const analyticsTracker = require('../utils/analyticsTracker')
const AnalyticsController = require('../controllers/analyticsController')

/**
 * POST /analytics/save
 * Sauvegarder les analytics depuis le frontend dans Google Sheets
 */
router.post('/save', AnalyticsController.saveAnalytics.bind(AnalyticsController))

/**
 * GET /analytics
 * Récupérer les stats backend (Mapbox, Google Sheets)
 */
router.get('/', (req, res) => {
    try {
        const stats = analyticsTracker.getStats()
        res.json({
            success: true,
            data: stats
        })
    } catch (error) {
        console.error('❌ Erreur récupération analytics:', error)
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

/**
 * GET /analytics/backend
 * Récupérer les stats backend uniquement
 */
router.get('/backend', AnalyticsController.getBackendStats.bind(AnalyticsController))

/**
 * GET /analytics/aggregated
 * Récupérer les statistiques agrégées de tous les utilisateurs depuis Google Sheets
 */
router.get('/aggregated', AnalyticsController.getAggregatedStats.bind(AnalyticsController))

/**
 * POST /analytics/reset
 * Réinitialiser les stats backend
 */
router.post('/reset', (req, res) => {
    try {
        analyticsTracker.reset()
        res.json({
            success: true,
            message: 'Stats réinitialisées'
        })
    } catch (error) {
        console.error('❌ Erreur réinitialisation analytics:', error)
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

/**
 * POST /analytics/clear-cache
 * Instruction pour vider le cache localStorage côté frontend
 * Le frontend doit appeler analyticsTracker.clearAllCache() après avoir reçu cette réponse
 */
router.post('/clear-cache', (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Cache à vider côté frontend',
            action: 'clearAllCache'
        })
    } catch (error) {
        console.error('❌ Erreur instruction vidage cache:', error)
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

module.exports = router

