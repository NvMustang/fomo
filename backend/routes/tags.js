/**
 * Routes pour les tags
 */

const express = require('express')
const router = express.Router()
const TagsController = require('../controllers/tagsController')

// GET /api/tags - Récupérer tous les tags
router.get('/', TagsController.getAllTags)

// GET /api/tags/popular - Récupérer les tags populaires
router.get('/popular', TagsController.getPopularTags)

// GET /api/tags/search - Rechercher des tags
router.get('/search', TagsController.searchTags)

// POST /api/tags/use - Enregistrer l'utilisation d'un tag
router.post('/use', TagsController.useTag)

module.exports = router

