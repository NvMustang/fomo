/**
 * Routes pour le géocodage
 */

const express = require('express')
const router = express.Router()
const GeocodingService = require('../services/geocodingService')

// GET /api/geocode/search/:query - Rechercher des adresses
router.get('/search/:query', async (req, res) => {
    try {
        const { query } = req.params
        const { countryCode, limit = 5 } = req.query

        const result = await GeocodingService.searchAddresses(query, { countryCode, limit })
        res.json(result)
    } catch (error) {
        console.error('❌ Erreur recherche adresses:', error.message)
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la recherche d\'adresses'
        })
    }
})

module.exports = router
