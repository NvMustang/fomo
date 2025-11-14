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

// POST /api/responses/migrate - Migrer les réponses d'un userId vers un autre (générique)
router.post('/migrate', async (req, res) => {
    try {
        const { sourceUserId, targetUserId } = req.body

        if (!sourceUserId || !targetUserId) {
            return res.status(400).json({
                success: false,
                error: 'sourceUserId et targetUserId sont requis'
            })
        }

        if (sourceUserId === targetUserId) {
            return res.status(400).json({
                success: false,
                error: 'sourceUserId et targetUserId ne peuvent pas être identiques'
            })
        }

        const migrationResult = await ResponsesController.migrateResponses(sourceUserId, targetUserId)
        
        res.json({
            success: true,
            message: 'Migration réussie',
            data: {
                responsesMigrated: migrationResult.migrated
            }
        })
    } catch (error) {
        console.error('❌ Erreur migration réponses:', error)
        res.status(500).json({ success: false, error: error.message })
    }
})

module.exports = router