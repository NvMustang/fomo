/**
 * Point d'entrée du serveur
 * Démarre l'application Express
 */

const app = require('./app')

const PORT = process.env.PORT || 3001
const { SPREADSHEET_ID } = require('./utils/sheets-config')

// Déterminer l'environnement automatiquement
// Local = toujours test, Vercel = toujours production
const isLocal = !process.env.VERCEL
const envType = isLocal ? '🧪 TEST' : '📊 PRODUCTION'

// Initialiser la sauvegarde automatique des analytics backend
const autoSaveBackendAnalytics = require('./utils/autoSaveBackendAnalytics')
autoSaveBackendAnalytics.init()

// Démarrage du serveur
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 FOMO Beta Backend démarré sur le port ${PORT}`)
    console.log(`${envType} - Base de données: Google Sheets`)
    console.log(`📋 Spreadsheet ID: ${SPREADSHEET_ID}`)

    console.log(`📡 Local URL: http://localhost:${PORT}`)
    console.log(`🌐 Network URL: http://0.0.0.0:${PORT}`)
    console.log(`📋 Documentation: http://localhost:${PORT}/`)
})
