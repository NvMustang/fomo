/**
 * Script de réinitialisation complète des analytics
 * 
 * - Vide toutes les données analytics de la base PRODUCTION (source de vérité unique)
 * - Ajoute une référence initiale MapTiler avec la valeur actuelle
 * - Permet de repartir sur une base saine avec le nouveau système de tracking
 * 
 * Usage: node backend/scripts/reset-analytics-clean.js [valeur_maptiler_actuelle]
 * Exemple: node backend/scripts/reset-analytics-clean.js 207581
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

async function resetAnalytics(currentValue) {
    console.log('🔄 Réinitialisation complète des analytics...\n')
    console.log('⚠️  ATTENTION : Cette opération va supprimer TOUTES les données analytics !\n')

    if (!currentValue || isNaN(currentValue) || currentValue < 0) {
        console.error('❌ Valeur MapTiler invalide. Usage: node reset-analytics-clean.js [valeur_maptiler]')
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
        'Référence initiale après réinitialisation complète', // maptiler_reference_note (colonne 8)
        '0',                                   // variation_percentage (colonne 9) - 0% au départ
        now,                                   // saved_at (colonne 10)
        'reset-script',                        // session_id (colonne 11)
        'Script reset'                         // user_name (colonne 12)
    ]

    // Réinitialiser la base de PRODUCTION uniquement (source de vérité unique)
    console.log('🧹 Réinitialisation de la base PRODUCTION (source de vérité unique)...')
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

    console.log('✅ Réinitialisation terminée avec succès!')
    console.log(`📊 Résumé:`)
    console.log(`   - Base PRODUCTION (source de vérité unique): réinitialisée avec référence ${currentValue.toLocaleString()}`)
    console.log(`\n📝 Le compteur repartira de ${currentValue.toLocaleString()}`)
    console.log(`📝 Les nouvelles requêtes seront trackées à partir de maintenant`)
    console.log(`📝 Le nouveau système de tracking (requêtes 304 incluses) est actif`)
    console.log(`\n⚠️  IMPORTANT : Il faut aussi vider les caches localStorage côté frontend !`)
    console.log(`   - Ouvrir la console du navigateur`)
    console.log(`   - Exécuter : analyticsTracker.clearAllCache()`)
    console.log(`   - Ou appeler l'endpoint : POST /analytics/clear-cache`)
    console.log(`   - Les clés à vider : 'fomo_analytics_prod' et 'fomo_analytics_test'`)
}

// Récupérer la valeur actuelle depuis les arguments
const currentValue = process.argv[2] ? parseInt(process.argv[2], 10) : null

resetAnalytics(currentValue)
    .then(() => {
        console.log('\n✅ Script terminé')
        process.exit(0)
    })
    .catch((error) => {
        console.error('\n❌ Erreur:', error.message)
        process.exit(1)
    })

