/**
 * Adapter Vercel Serverless pour Express App
 * 
 * Vercel route /api/* vers cette fonction serverless
 * Le path reçu contient TOUJOURS /api (ex: /api/users/email/...)
 * Express doit donc monter les routes sur /api (comme en local)
 */

const app = require('../backend/app')

// Middleware pour logger le path reçu (debug)
app.use((req, res, next) => {
    if (process.env.VERCEL) {
        console.log('🔍 [Vercel] Path reçu:', req.url, 'Method:', req.method)
    }
    next()
})

// Export de l'app Express pour Vercel
module.exports = app

