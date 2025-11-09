/**
 * Script pour combiner les analytics de test et production
 * 
 * Les appels MapTiler faits en développement local comptent aussi dans le quota,
 * donc il faut les inclure dans le calcul du compteur.
 * 
 * - Récupère les requêtes MapTiler de la DB de test
 * - Les combine avec les requêtes de la DB de production
 * - Nettoie les doublons de références dans les deux bases
 * - Met à jour la référence dans la production avec la valeur actuelle
 * 
 * Usage: node backend/scripts/merge-test-and-prod-analytics.js [valeur_maptiler_actuelle]
 * Exemple: node backend/scripts/merge-test-and-prod-analytics.js 207581
 */

const path = require('path')
const fs = require('fs')
const scriptDir = __dirname
const backendDir = path.join(scriptDir, '..')

// Charger .env depuis backend/ ou racine
const backendEnvPath = path.join(backendDir, '.env')
const rootEnvPath = path.join(backendDir, '..', '.env')
require('dotenv').config({ path: fs.existsSync(backendEnvPath) ? backendEnvPath : rootEnvPath })

delete require.cache[require.resolve(path.join(backendDir, 'utils/sheets-config'))]
delete require.cache[require.resolve(path.join(backendDir, 'utils/dataService'))]
delete require.cache[require.resolve(path.join(backendDir, 'controllers/analyticsController'))]

const DataServiceV2 = require(path.join(backendDir, 'utils/dataService'))
const AnalyticsController = require(path.join(backendDir, 'controllers/analyticsController'))

// Fonction pour récupérer les données d'une DB spécifique
async function getAnalyticsFromDB(spreadsheetId, dbName) {
    console.log(`📊 Récupération des données depuis ${dbName}...`)
    
    // Créer une instance temporaire de sheets-config avec le spreadsheetId spécifique
    const { google } = require('googleapis')
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
    
    const auth = new google.auth.GoogleAuth(authConfig)
    const sheets = google.sheets({ version: 'v4', auth })
    
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: spreadsheetId,
            range: AnalyticsController.ANALYTICS_RANGE
        })
        
        const rows = response.data.values || []
        const analytics = rows.map(row => DataServiceV2.mappers.analytics(row))
        
        const requests = analytics.filter(a => a.provider !== 'maptiler_reference')
        const maptilerRefs = analytics.filter(a => a.provider === 'maptiler_reference')
        
        console.log(`   📊 ${requests.length} requêtes, ${maptilerRefs.length} références MapTiler`)
        
        return {
            requests,
            maptilerRefs,
            rawRows: rows
        }
    } catch (error) {
        console.error(`   ❌ Erreur lecture ${dbName}:`, error.message)
        return {
            requests: [],
            maptilerRefs: [],
            rawRows: []
        }
    }
}

async function mergeTestAndProdAnalytics(currentValue) {
    console.log('🔄 Combinaison des analytics test + production...\n')

    try {
        // Configuration d'authentification pour les opérations sur les deux DB
        const { google } = require('googleapis')
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

        const testSpreadsheetId = process.env.GOOGLE_SPREADSHEET_ID_TEST
        const productionSpreadsheetId = process.env.GOOGLE_SPREADSHEET_ID

        if (!testSpreadsheetId) {
            console.log('⚠️  GOOGLE_SPREADSHEET_ID_TEST non défini, utilisation uniquement de la production')
        }

        if (!productionSpreadsheetId) {
            throw new Error('GOOGLE_SPREADSHEET_ID non défini')
        }

        // 1. Récupérer les données de production
        const prodData = await getAnalyticsFromDB(productionSpreadsheetId, 'PRODUCTION')
        console.log()

        // 2. Récupérer les données de test (si disponible)
        let testData = { requests: [], maptilerRefs: [], rawRows: [] }
        if (testSpreadsheetId) {
            testData = await getAnalyticsFromDB(testSpreadsheetId, 'TEST')
            console.log()
        }

        // 3. Combiner les requêtes MapTiler (sans doublons)
        console.log('🔄 Combinaison des requêtes MapTiler...')
        const prodMaptilerRequests = prodData.requests.filter(r => r.provider === 'maptiler')
        
        // Créer un Set des clés de production pour déduplication efficace
        const prodRequestKeys = new Set()
        for (const r of prodMaptilerRequests) {
            prodRequestKeys.add(`${r.timestamp}|${r.endpoint}|${r.provider}`)
        }
        
        // Ajouter les requêtes de test qui ne sont pas déjà dans la production
        const testMaptilerRequests = []
        for (const r of testData.requests) {
            if (r.provider !== 'maptiler') continue
            const key = `${r.timestamp}|${r.endpoint}|${r.provider}`
            if (!prodRequestKeys.has(key)) {
                testMaptilerRequests.push(r)
            }
        }
        
        const allMaptilerRequests = [...prodMaptilerRequests, ...testMaptilerRequests]
        
        console.log(`   📊 Requêtes MapTiler production: ${prodData.requests.filter(r => r.provider === 'maptiler').length}`)
        console.log(`   📊 Requêtes MapTiler test: ${testData.requests.filter(r => r.provider === 'maptiler').length}`)
        console.log(`   📊 Requêtes MapTiler test ajoutées: ${testMaptilerRequests.length}`)
        console.log(`   📊 Total requêtes MapTiler combinées: ${allMaptilerRequests.length}\n`)

        // 4. Combiner et dédupliquer les références MapTiler
        console.log('🔍 Déduplication des références MapTiler...')
        const allRefs = [...prodData.maptilerRefs, ...testData.maptilerRefs]
        const refKeys = new Map() // key: "timestamp|value" -> ref
        
        allRefs.forEach(ref => {
            const timestamp = ref.timestamp
            const value = parseFloat(ref.maptilerReferenceValue) || 0
            const key = `${timestamp}|${value}`
            
            // Garder seulement la première occurrence
            if (!refKeys.has(key)) {
                refKeys.set(key, ref)
            }
        })
        
        const uniqueRefs = Array.from(refKeys.values())
        console.log(`   📊 Références totales: ${allRefs.length}`)
        console.log(`   📊 Références uniques: ${uniqueRefs.length}`)
        console.log(`   📊 Doublons supprimés: ${allRefs.length - uniqueRefs.length}\n`)

        // 5. Calculer le compteur avec toutes les requêtes combinées
        const sortedRefs = uniqueRefs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        const initialRef = sortedRefs[0]
        const initialValue = initialRef ? parseFloat(initialRef.maptilerReferenceValue) || 104684 : 104684
        const initialDate = initialRef
            ? new Date(initialRef.timestamp).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0]
        
        // Compter toutes les requêtes MapTiler depuis la date initiale
        const trackedCount = allMaptilerRequests.filter(r => {
            const reqDate = new Date(r.timestamp).toISOString().split('T')[0]
            return reqDate >= initialDate
        }).length
        
        const trackedCumulative = initialValue + trackedCount
        
        console.log('📊 Calcul du compteur combiné:')
        console.log(`   📊 Valeur initiale: ${initialValue.toLocaleString()}`)
        console.log(`   📊 Requêtes MapTiler trackées (test + prod): ${trackedCount.toLocaleString()}`)
        console.log(`   📊 Compteur cumulatif: ${trackedCumulative.toLocaleString()}`)
        if (currentValue) {
            const diff = currentValue - trackedCumulative
            const diffPercent = trackedCumulative > 0 ? (diff / trackedCumulative * 100) : 0
            console.log(`   📊 Valeur MapTiler actuelle: ${currentValue.toLocaleString()}`)
            console.log(`   📊 Différence: ${diff > 0 ? '+' : ''}${diff.toLocaleString()} (${diffPercent > 0 ? '+' : ''}${diffPercent.toFixed(2)}%)\n`)
        } else {
            console.log()
        }

        // 6. Nettoyer la DB de production (comme dans cleanup-maptiler-references.js)
        console.log('🧹 Nettoyage de la base de production...')
        const { sheets, clearSheet, appendData, readData } = require(path.join(backendDir, 'utils/sheets-config'))
        
        // Forcer la production
        process.env.FORCE_PRODUCTION = 'true'
        delete require.cache[require.resolve(path.join(backendDir, 'utils/sheets-config'))]
        const prodConfig = require(path.join(backendDir, 'utils/sheets-config'))
        
        // Lire toutes les données de production
        const allProdRows = await prodConfig.readData('Analytics', 'A2:M')
        
        // Séparer requêtes et références
        const prodRequestRows = []
        const prodRefRowsMap = new Map()
        
        allProdRows.forEach(row => {
            const provider = row[1] || ''
            if (provider === 'maptiler_reference') {
                const timestamp = row[0] || ''
                const value = row[7] || ''
                const key = `${timestamp}|${value}`
                if (!prodRefRowsMap.has(key)) {
                    prodRefRowsMap.set(key, row)
                }
            } else {
                prodRequestRows.push(row)
            }
        })
        
        const uniqueProdRefRows = Array.from(prodRefRowsMap.values())
        
        // Ajouter la nouvelle référence si fournie
        if (currentValue) {
            const now = new Date().toISOString()
            const newRefRow = [
                now,
                'maptiler_reference',
                'reference',
                'REFERENCE',
                'true',
                '',
                trackedCumulative.toString(),
                currentValue.toString(),
                'Valeur actuelle (test + prod combinés)',
                ((currentValue - trackedCumulative) / trackedCumulative * 100).toFixed(2),
                now,
                'merge-script',
                'Script merge test+prod'
            ]
            uniqueProdRefRows.push(newRefRow)
        }
        
        // Vider et réinsérer
        await prodConfig.clearSheet('Analytics', 2)
        const allCleanRows = [...prodRequestRows, ...uniqueProdRefRows]
        
        // S'assurer que toutes les lignes ont 13 colonnes (A-M)
        const normalizedRows = allCleanRows.map(row => {
            const normalized = Array(13).fill('')
            for (let i = 0; i < Math.min(row.length, 13); i++) {
                normalized[i] = row[i] || ''
            }
            return normalized
        })
        
        await prodConfig.appendData('Analytics', normalizedRows, 2)
        
        console.log(`   ✅ ${allCleanRows.length} lignes réinsérées (${prodRequestRows.length} requêtes + ${uniqueProdRefRows.length} références)\n`)

        // 7. Optionnel : nettoyer aussi la DB de test
        if (testSpreadsheetId && testData.rawRows.length > 0) {
            console.log('🧹 Nettoyage de la base de test...')
            // Utiliser la même logique mais avec testSpreadsheetId
            const authTest = new google.auth.GoogleAuth(authConfig)
            const testSheets = google.sheets({ version: 'v4', auth: authTest })
            
            // Lire les données de test
            const testResponse = await testSheets.spreadsheets.values.get({
                spreadsheetId: testSpreadsheetId,
                range: AnalyticsController.ANALYTICS_RANGE
            })
            const allTestRows = testResponse.data.values || []
            
            // Séparer et dédupliquer
            const testRequestRows = []
            const testRefRowsMap = new Map()
            
            allTestRows.forEach(row => {
                const provider = row[1] || ''
                if (provider === 'maptiler_reference') {
                    const timestamp = row[0] || ''
                    const value = row[7] || ''
                    const key = `${timestamp}|${value}`
                    if (!testRefRowsMap.has(key)) {
                        testRefRowsMap.set(key, row)
                    }
                } else {
                    testRequestRows.push(row)
                }
            })
            
            const uniqueTestRefRows = Array.from(testRefRowsMap.values())
            
            // Vider et réinsérer
            await testSheets.spreadsheets.values.clear({
                spreadsheetId: testSpreadsheetId,
                range: 'Analytics!A2:M'
            })
            
            const allCleanTestRows = [...testRequestRows, ...uniqueTestRefRows]
            if (allCleanTestRows.length > 0) {
                await testSheets.spreadsheets.values.append({
                    spreadsheetId: testSpreadsheetId,
                    range: 'Analytics!A2:M',
                    valueInputOption: 'RAW',
                    resource: { values: allCleanTestRows }
                })
            }
            
            console.log(`   ✅ ${allCleanTestRows.length} lignes réinsérées dans TEST\n`)
        }

        console.log('✅ Nettoyage et combinaison terminés avec succès!')
        console.log(`📊 Résumé:`)
        console.log(`   - Requêtes MapTiler production: ${prodData.requests.filter(r => r.provider === 'maptiler').length}`)
        console.log(`   - Requêtes MapTiler test: ${testData.requests.filter(r => r.provider === 'maptiler').length}`)
        console.log(`   - Total requêtes MapTiler combinées: ${allMaptilerRequests.length}`)
        console.log(`   - Références uniques: ${uniqueRefs.length}`)
        if (currentValue) {
            console.log(`   - Nouvelle référence: ${currentValue}`)
            console.log(`   - Compteur calculé: ${trackedCumulative}`)
        }

    } catch (error) {
        console.error('❌ Erreur lors du nettoyage:', error)
        throw error
    }
}

// Récupérer la valeur actuelle depuis les arguments
const currentValue = process.argv[2] ? parseInt(process.argv[2], 10) : null

if (currentValue && (isNaN(currentValue) || currentValue < 0)) {
    console.error('❌ Valeur MapTiler invalide. Usage: node merge-test-and-prod-analytics.js [valeur_maptiler]')
    process.exit(1)
}

mergeTestAndProdAnalytics(currentValue)
    .then(() => {
        console.log('\n✅ Script terminé')
        process.exit(0)
    })
    .catch((error) => {
        console.error('\n❌ Erreur:', error.message)
        process.exit(1)
    })

