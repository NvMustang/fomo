/**
 * Script pour supprimer la référence avec 104684 de la base PRODUCTION
 * 
 * Usage: node backend/scripts/remove-old-reference.js
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
const DataServiceV2 = require(path.join(backendDir, 'utils/dataService'))

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

async function removeOldReference() {
    console.log('🧹 Suppression de la référence avec 104684...\n')

    const productionSpreadsheetId = process.env.GOOGLE_SPREADSHEET_ID

    if (!productionSpreadsheetId) {
        throw new Error('GOOGLE_SPREADSHEET_ID non défini')
    }

    const auth = new google.auth.GoogleAuth(authConfig)
    const sheets = google.sheets({ version: 'v4', auth })

    try {
        // Lire toutes les données
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: productionSpreadsheetId,
            range: AnalyticsController.ANALYTICS_RANGE
        })
        
        const rows = response.data.values || []
        const analytics = rows.map(row => DataServiceV2.mappers.analytics(row))
        
        // Séparer requêtes et références
        const requests = analytics.filter(a => a.provider !== 'maptiler_reference')
        const maptilerRefs = analytics.filter(a => a.provider === 'maptiler_reference')
        
        console.log(`📊 État actuel:`)
        console.log(`   - Requêtes: ${requests.length}`)
        console.log(`   - Références: ${maptilerRefs.length}`)
        
        // Trouver la référence avec 104684
        const oldRef = maptilerRefs.find(ref => {
            const value = parseFloat(ref.maptilerReferenceValue) || 0
            return value === 104684
        })
        
        if (!oldRef) {
            console.log('   ✅ Aucune référence avec 104684 trouvée')
            return
        }
        
        console.log(`\n🔍 Référence trouvée:`)
        console.log(`   - Date: ${new Date(oldRef.timestamp).toLocaleString('fr-FR')}`)
        console.log(`   - Valeur: ${oldRef.maptilerReferenceValue}`)
        console.log(`   - Note: ${oldRef.maptilerReferenceNote}`)
        
        // Filtrer pour garder seulement les références avec 207581
        const validRefs = maptilerRefs.filter(ref => {
            const value = parseFloat(ref.maptilerReferenceValue) || 0
            return value === 207581
        })
        
        console.log(`\n📊 Après nettoyage:`)
        console.log(`   - Références à garder: ${validRefs.length}`)
        
        // Reconstruire les lignes
        const requestRows = rows.filter(row => {
            const provider = row[1] || ''
            return provider !== 'maptiler_reference'
        })
        
        const refRows = rows.filter(row => {
            const provider = row[1] || ''
            if (provider !== 'maptiler_reference') return false
            const value = parseFloat(row[7]) || 0
            return value === 207581
        })
        
        const allRows = [...requestRows, ...refRows]
        
        // Normaliser toutes les lignes à 13 colonnes
        const normalizedRows = allRows.map(row => {
            const normalized = Array(13).fill('')
            for (let i = 0; i < Math.min(row.length, 13); i++) {
                normalized[i] = row[i] || ''
            }
            return normalized
        })
        
        // Vider et réinsérer
        await sheets.spreadsheets.values.clear({
            spreadsheetId: productionSpreadsheetId,
            range: 'Analytics!A2:M'
        })
        
        if (normalizedRows.length > 0) {
            await sheets.spreadsheets.values.append({
                spreadsheetId: productionSpreadsheetId,
                range: 'Analytics!A2:M',
                valueInputOption: 'RAW',
                resource: {
                    values: normalizedRows
                }
            })
        }
        
        console.log(`\n✅ Référence avec 104684 supprimée`)
        console.log(`   - ${normalizedRows.length} lignes réinsérées (${requestRows.length} requêtes + ${refRows.length} références)`)
        
    } catch (error) {
        console.error(`❌ Erreur:`, error.message)
        throw error
    }
}

removeOldReference()
    .then(() => {
        console.log('\n✅ Script terminé')
        process.exit(0)
    })
    .catch((error) => {
        console.error('\n❌ Erreur:', error.message)
        process.exit(1)
    })

