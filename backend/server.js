/**
 * Point d'entrée du serveur
 * Démarre l'application Express
 */

const app = require('./app')

const PORT = process.env.PORT || 3001

// Démarrage du serveur
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 FOMO Beta Backend démarré sur le port ${PORT}`)
    console.log(`📊 Base de données: Google Sheets`)
    console.log(`🖼️ Images: ImgBB`)
    console.log(`🏗️ Architecture: Modulaire`)
    console.log(`📡 Network URL: http://0.0.0.0:${PORT}`)
    console.log(`📋 Documentation: http://0.0.0.0:${PORT}/`)
})
