/**
 * Application Express principale - Version refactorisée
 * Architecture modulaire avec séparation des responsabilités
 */

const express = require('express')
const cors = require('cors')
const { validateConfig } = require('./utils/sheets-config')
// Debug middleware supprimé
const apiRoutes = require('./routes')

// Charger les variables d'environnement
require('dotenv').config()

const app = express()

// Valider la configuration au démarrage
// En Vercel Serverless, on ne peut pas faire process.exit(), donc on log seulement
try {
    validateConfig()
} catch (error) {
    console.error('❌ Configuration invalide:', error.message)
    // En production Vercel, ne pas faire process.exit() car c'est une fonction serverless
    if (process.env.NODE_ENV !== 'production') {
        process.exit(1)
    }
}

// Middleware globaux
// CORS : utiliser variable d'environnement ou autoriser toutes les origines en dev
// En Vercel Preview, autoriser toutes les origines pour faciliter les tests
const corsOrigin = process.env.CORS_ORIGIN ||
    (process.env.VERCEL_ENV === 'preview' ? true :
        (process.env.NODE_ENV === 'production' ? false : true))
app.use(cors({
    origin: corsOrigin,
    credentials: true
}))
app.use(express.json())

// Debug middleware supprimé

// Route racine avec documentation des endpoints
app.get('/', (req, res) => {
    res.json({
        message: 'FOMO Beta Backend - Google Sheets + ImgBB',
        version: '3.0.0',
        architecture: 'Modulaire avec Soft Updates (Contrôleurs + Routes)',
        endpoints: {
            // Événements
            events: 'GET /api/events',
            createEvent: 'POST /api/events',

            // Utilisateurs
            users: 'GET /api/users',
            createUser: 'POST /api/users',
            getUserByEmail: 'GET /api/users/email/:email',
            getUserFriends: 'GET /api/users/:id/friends',

            // Amitiés
            createFriendship: 'POST /api/users/friendships',

            // Réponses
            responses: 'GET /api/responses',

            // Batch (pour les modifications)
            processBatch: 'PUT /api/batch',

            // Tags
            tags: 'GET /api/tags',
            popularTags: 'GET /api/tags/popular',
            searchTags: 'GET /api/tags/search',
            useTag: 'POST /api/tags/use',

            // Utilitaires
            searchAddresses: 'GET /api/geocode/search/:query',
            health: 'GET /api/health'
        }
    })
})

// Montage des routes API
// Vercel préserve le path /api lors du rewrite, donc on monte toujours sur /api
app.use('/api', apiRoutes)

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'Google Sheets',
        imageHost: 'ImgBB',
        architecture: 'Modulaire avec Soft Updates',
        environment: isVercel ? 'Vercel' : 'Local'
    })
})

// Endpoints de debug supprimés

// Gestion des erreurs globale
app.use((error, req, res, next) => {
    console.error('❌ Erreur serveur:', error)
    res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Erreur interne du serveur',
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    })
})

// Gestion des routes non trouvées
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route non trouvée',
        path: req.originalUrl,
        method: req.method
    })
})

module.exports = app
