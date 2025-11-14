/**
 * Script CLEAN ALL - Réinitialisation complète des analytics
 * 
 * Nettoie la base PRODUCTION uniquement (source de vérité unique) :
 * - Vide toutes les données analytics de la base PRODUCTION
 * - Ajoute une référence initiale MapTiler avec la valeur actuelle
 * - Fournit un code JavaScript pour vider les caches localStorage
 * 
 * Usage: node backend/scripts/clean-all-analytics.js [valeur_maptiler_actuelle]
 * Exemple: node backend/scripts/clean-all-analytics.js 207581
 * 
 * ⚠️  ATTENTION : Cette opération est irréversible !
 * 📊 Stratégie : Source de vérité unique = PROD uniquement
 */

const path = require('path')
const fs = require('fs')
const scriptDir = __dirname
const backendDir = path.join(scriptDir, '..')

// Charger .env depuis backend/ ou racine
const backendEnvPath = path.join(backendDir, '.env')
const rootEnvPath = path.join(backendDir, '..', '.env')
require('dotenv').config({ path: fs.existsSync(backendEnvPath) ? backendEnvPath : rootEnvPath })

const { google } = require('googleapis')
const AnalyticsController = require(path.join(backendDir, 'controllers/analyticsController'))

// Configuration d'authentification
const authConfig = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    ? {
        credentials: typeof process.env.GOOGLE_SERVICE_ACCOUNT_KEY === 'string' 
            ? JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
            : process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ],
        subject: process.env.GOOGLE_DELEGATED_USER_EMAIL || null
    }
    : {
        keyFile: path.join(backendDir, 'service-account.json'),
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ],
        subject: process.env.GOOGLE_DELEGATED_USER_EMAIL || null
    }

async function cleanAllAnalytics(currentValue) {
    console.log('🧹 CLEAN ALL - Réinitialisation complète des analytics...\n')
    console.log('⚠️  ATTENTION : Cette opération va supprimer TOUTES les données analytics !\n')

    if (!currentValue || isNaN(currentValue) || currentValue < 0) {
        console.error('❌ Valeur MapTiler invalide. Usage: node clean-all-analytics.js [valeur_maptiler]')
        process.exit(1)
    }

    const productionSpreadsheetId = process.env.GOOGLE_SPREADSHEET_ID

    if (!productionSpreadsheetId) {
        throw new Error('GOOGLE_SPREADSHEET_ID non défini')
    }

    const auth = new google.auth.GoogleAuth(authConfig)
    const sheets = google.sheets({ version: 'v4', auth })

    // Créer la référence initiale
    const now = new Date().toISOString()
    const initialRefRow = [
        now,                                    // timestamp (colonne 0)
        'maptiler_reference',                  // provider (colonne 1)
        'reference',                           // endpoint (colonne 2)
        'REFERENCE',                           // method (colonne 3)
        'true',                                // success (colonne 4)
        '',                                    // error (colonne 5)
        currentValue.toString(),               // tracked_count (colonne 6) - valeur de départ
        currentValue.toString(),               // maptiler_reference_value (colonne 7)
        'Référence initiale après clean-all', // maptiler_reference_note (colonne 8)
        '0',                                   // variation_percentage (colonne 9) - 0% au départ
        now,                                   // saved_at (colonne 10)
        'clean-all-script',                    // session_id (colonne 11)
        'Script clean-all'                     // user_name (colonne 12)
    ]

    // Réinitialiser la base de PRODUCTION uniquement (source de vérité unique)
    console.log('📊 Étape 1/2 : Nettoyage de la base PRODUCTION (source de vérité unique)...')
    try {
        // Vider la feuille Analytics (garder l'en-tête)
        await sheets.spreadsheets.values.clear({
            spreadsheetId: productionSpreadsheetId,
            range: 'Analytics!A2:M'
        })
        console.log('   ✅ Feuille Analytics vidée')

        // Ajouter la référence initiale
        await sheets.spreadsheets.values.append({
            spreadsheetId: productionSpreadsheetId,
            range: 'Analytics!A2:M',
            valueInputOption: 'RAW',
            resource: {
                values: [initialRefRow]
            }
        })
        console.log(`   ✅ Référence initiale ajoutée: ${currentValue.toLocaleString()}\n`)
    } catch (error) {
        console.error(`   ❌ Erreur réinitialisation PRODUCTION:`, error.message)
        throw error
    }

    // Instructions pour vider les caches localStorage
    console.log('📊 Étape 2/2 : Instructions pour vider les caches localStorage...\n')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📋 COPIEZ ET COLLEZ CE CODE DANS LA CONSOLE DU NAVIGATEUR (F12) :\n')
    console.log('```javascript')
    console.log('// Vider les caches analytics')
    console.log('localStorage.removeItem("fomo_analytics_prod")')
    console.log('localStorage.removeItem("fomo_analytics_test")')
    console.log('')
    console.log('// Si analyticsTracker est disponible (dans l\'app)')
    console.log('if (typeof analyticsTracker !== "undefined" && analyticsTracker.clearAllCache) {')
    console.log('    analyticsTracker.clearAllCache()')
    console.log('    console.log("✅ Caches vidés via analyticsTracker")')
    console.log('} else {')
    console.log('    console.log("✅ Caches vidés manuellement")')
    console.log('}')
    console.log('')
    console.log('// Recharger la page pour appliquer les changements')
    console.log('// window.location.reload()')
    console.log('```')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    // Résumé final
    console.log('✅ CLEAN ALL terminé avec succès!\n')
    console.log('📊 Résumé:')
    console.log(`   ✅ Base PRODUCTION (source de vérité unique): réinitialisée avec référence ${currentValue.toLocaleString()}`)
    console.log(`   ⏳ Caches localStorage: à vider manuellement (voir instructions ci-dessus)\n`)
    console.log('📝 Prochaines étapes:')
    console.log(`   1. Copiez le code JavaScript ci-dessus`)
    console.log(`   2. Ouvrez la console du navigateur (F12)`)
    console.log(`   3. Collez et exécutez le code`)
    console.log(`   4. Rechargez la page pour voir les changements`)
    console.log(`\n📝 Le compteur repartira de ${currentValue.toLocaleString()}`)
    console.log(`📝 Les nouvelles requêtes seront trackées à partir de maintenant`)
    console.log(`📝 Le nouveau système de tracking (requêtes 304 incluses) est actif`)
}

// Récupérer la valeur actuelle depuis les arguments
const currentValue = process.argv[2] ? parseInt(process.argv[2], 10) : null

cleanAllAnalytics(currentValue)
    .then(() => {
        console.log('\n✅ Script terminé')
        process.exit(0)
    })
    .catch((error) => {
        console.error('\n❌ Erreur:', error.message)
        process.exit(1)
    })

