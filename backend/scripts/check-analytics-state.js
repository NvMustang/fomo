/**
 * Script pour vérifier l'état actuel des analytics dans les deux bases
 * 
 * Usage: node backend/scripts/check-analytics-state.js
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

async function checkAnalyticsState() {
    console.log('🔍 Vérification de l\'état des analytics...\n')

    const testSpreadsheetId = process.env.GOOGLE_SPREADSHEET_ID_TEST
    const productionSpreadsheetId = process.env.GOOGLE_SPREADSHEET_ID

    if (!productionSpreadsheetId) {
        throw new Error('GOOGLE_SPREADSHEET_ID non défini')
    }

    const auth = new google.auth.GoogleAuth(authConfig)
    const sheets = google.sheets({ version: 'v4', auth })

    async function checkDB(spreadsheetId, dbName) {
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: AnalyticsController.ANALYTICS_RANGE
            })
            
            const rows = response.data.values || []
            const analytics = rows.map(row => DataServiceV2.mappers.analytics(row))
            
            const requests = analytics.filter(a => a.provider !== 'maptiler_reference')
            const maptilerRefs = analytics.filter(a => a.provider === 'maptiler_reference')
            
            // Analyser les dates des références
            const refDates = maptilerRefs.map(ref => ({
                date: new Date(ref.timestamp),
                value: parseFloat(ref.maptilerReferenceValue) || 0,
                note: ref.maptilerReferenceNote || ''
            })).sort((a, b) => a.date - b.date)
            
            console.log(`📊 ${dbName}:`)
            console.log(`   - Total lignes: ${rows.length}`)
            console.log(`   - Requêtes: ${requests.length}`)
            console.log(`   - Références MapTiler: ${maptilerRefs.length}`)
            
            if (refDates.length > 0) {
                console.log(`   - Première référence: ${refDates[0].date.toLocaleString('fr-FR')} (${refDates[0].value.toLocaleString()})`)
                console.log(`   - Dernière référence: ${refDates[refDates.length - 1].date.toLocaleString('fr-FR')} (${refDates[refDates.length - 1].value.toLocaleString()})`)
                
                // Vérifier s'il y a des références anciennes (avant aujourd'hui)
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const oldRefs = refDates.filter(ref => ref.date < today)
                if (oldRefs.length > 0) {
                    console.log(`   ⚠️  ${oldRefs.length} référence(s) datant d'avant aujourd'hui:`)
                    oldRefs.forEach(ref => {
                        console.log(`      - ${ref.date.toLocaleString('fr-FR')}: ${ref.value.toLocaleString()} (${ref.note})`)
                    })
                }
            }
            console.log()
            
            return { requests, maptilerRefs, refDates }
        } catch (error) {
            console.error(`   ❌ Erreur lecture ${dbName}:`, error.message)
            return { requests: [], maptilerRefs: [], refDates: [] }
        }
    }

    // Vérifier PRODUCTION
    const prodData = await checkDB(productionSpreadsheetId, 'PRODUCTION')

    // Vérifier TEST
    let testData = { requests: [], maptilerRefs: [], refDates: [] }
    if (testSpreadsheetId) {
        testData = await checkDB(testSpreadsheetId, 'TEST')
    } else {
        console.log('📊 TEST: non configuré\n')
    }

    // Résumé combiné
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📊 RÉSUMÉ COMBINÉ (ce que voit le dashboard):')
    console.log(`   - Total requêtes: ${prodData.requests.length + testData.requests.length}`)
    console.log(`   - Total références: ${prodData.maptilerRefs.length + testData.maptilerRefs.length}`)
    
    const allRefs = [...prodData.refDates, ...testData.refDates].sort((a, b) => a.date - b.date)
    if (allRefs.length > 0) {
        console.log(`   - Première référence: ${allRefs[0].date.toLocaleString('fr-FR')} (${allRefs[0].value.toLocaleString()})`)
        console.log(`   - Dernière référence: ${allRefs[allRefs.length - 1].date.toLocaleString('fr-FR')} (${allRefs[allRefs.length - 1].value.toLocaleString()})`)
        
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const oldRefs = allRefs.filter(ref => ref.date < today)
        if (oldRefs.length > 0) {
            console.log(`\n   ⚠️  ATTENTION: ${oldRefs.length} référence(s) datant d'avant aujourd'hui détectée(s)!`)
            console.log(`   Ces références proviennent probablement d'une base qui n'a pas été nettoyée.`)
        } else {
            console.log(`\n   ✅ Toutes les références sont d'aujourd'hui ou plus récentes.`)
        }
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

checkAnalyticsState()
    .then(() => {
        console.log('\n✅ Vérification terminée')
        process.exit(0)
    })
    .catch((error) => {
        console.error('\n❌ Erreur:', error.message)
        process.exit(1)
    })

