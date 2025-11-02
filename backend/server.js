/**
 * Point d'entrée du serveur
 * Démarre l'application Express
 */

const app = require('./app')

const PORT = process.env.PORT || 3001
const { SPREADSHEET_ID } = require('./utils/sheets-config')

// Déterminer l'environnement
const useTestDb = process.env.USE_TEST_DB === 'true' || process.env.USE_TEST_DB === '1'
const envType = useTestDb ? '🧪 TEST' : '📊 PRODUCTION'

// Démarrage du serveur
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 FOMO Beta Backend démarré sur le port ${PORT}`)
    console.log(`${envType} - Base de données: Google Sheets`)
    console.log(`📋 Spreadsheet ID: ${SPREADSHEET_ID}`)
    console.log(`🖼️ Images: ImgBB`)
    console.log(`🏗️ Architecture: Modulaire`)
    console.log(`📡 Local URL: http://localhost:${PORT}`)
    console.log(`🌐 Network URL: http://0.0.0.0:${PORT}`)
    console.log(`📋 Documentation: http://localhost:${PORT}/`)
})
