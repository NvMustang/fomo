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

        console.log(`🔍 [Geocoding Route] Recherche pour: "${query}" (limit: ${limit}${countryCode ? `, pays: ${countryCode}` : ''})`)

        const result = await GeocodingService.searchAddresses(query, { countryCode, limit })
        
        // Le service retourne { success: true, data: [...] } ou { success: false, error: ... }
        if (result.success && result.data) {
            console.log(`✅ [Geocoding Route] ${result.data.length} résultats trouvés`)
            // Retourner directement le tableau pour le frontend
            res.json(result.data)
        } else {
            // En cas d'erreur, retourner un tableau vide avec un log détaillé
            console.error('❌ [Geocoding Route] Erreur recherche adresses:', result.error || 'Erreur inconnue')
            if (result.details) {
                console.error('📋 [Geocoding Route] Détails:', JSON.stringify(result.details, null, 2))
            }
            // Retourner un tableau vide au lieu d'une erreur 500 pour éviter de casser le frontend
            res.json([])
        }
    } catch (error) {
        console.error('❌ [Geocoding Route] Exception non gérée:', error.message)
        console.error('📋 [Geocoding Route] Stack:', error.stack)
        // Retourner un tableau vide au lieu d'une erreur 500
        res.json([])
    }
})

module.exports = router
