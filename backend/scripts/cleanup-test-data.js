/**
 * Script pour nettoyer les données de test et réinitialiser les analytics
 * 
 * - Supprime toutes les données analytics existantes
 * - Réinitialise avec une valeur MapTiler de référence
 */

require('dotenv').config()
process.env.FORCE_PRODUCTION = 'true'

const path = require('path')
const scriptDir = __dirname
const backendDir = path.join(scriptDir, '..')

delete require.cache[require.resolve(path.join(backendDir, 'utils/sheets-config'))]

const sheetsConfig = require(path.join(backendDir, 'utils/sheets-config'))
const sheets = sheetsConfig.sheets
const SPREADSHEET_ID = sheetsConfig.SPREADSHEET_ID

async function cleanupTestData() {
    console.log('🧹 Nettoyage des données de test...\n')

    try {

        // 1. Vider la feuille Analytics (garder seulement l'en-tête)
        console.log('📊 Nettoyage de la feuille Analytics...')
        try {
            // Récupérer toutes les données pour voir combien de lignes
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Analytics!A2:M'
            })

            const rows = response.data.values || []
            console.log(`   📊 ${rows.length} lignes à supprimer`)

            if (rows.length > 0) {
                // Supprimer toutes les lignes de données (garder l'en-tête)
                await sheets.spreadsheets.values.clear({
                    spreadsheetId: SPREADSHEET_ID,
                    range: 'Analytics!A2:M'
                })
                console.log('   ✅ Feuille Analytics nettoyée')
            } else {
                console.log('   ℹ️ Feuille Analytics déjà vide')
            }
        } catch (error) {
            if (error.message && error.message.includes('Unable to parse range')) {
                console.log('   ⚠️ Feuille Analytics non trouvée (sera créée automatiquement)')
            } else {
                throw error
            }
        }

        // 2. Ajouter une valeur MapTiler de référence initiale
        console.log('\n📊 Ajout de la valeur MapTiler de référence...')
        const maptilerReferenceValue = 163036
        const now = new Date().toISOString()
        
        // Format: timestamp, provider, endpoint, method, success, error, sessionId, userName, maptilerReferenceValue, maptilerReferenceNote
        const referenceRow = [
            now, // timestamp
            'maptiler_reference', // provider
            'reference', // endpoint
            'GET', // method
            'true', // success
            '', // error
            'system-init', // sessionId
            'system', // userName
            maptilerReferenceValue.toString(), // maptilerReferenceValue
            'Valeur initiale après nettoyage des données de test', // maptilerReferenceNote
            '', // userAgent
            '', // viewportWidth
            '' // viewportHeight
        ]

        try {
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Analytics!A2',
                valueInputOption: 'RAW',
                insertDataOption: 'INSERT_ROWS',
                resource: {
                    values: [referenceRow]
                }
            })
            console.log(`   ✅ Valeur MapTiler de référence ajoutée: ${maptilerReferenceValue}`)
        } catch (error) {
            console.error('   ❌ Erreur lors de l\'ajout de la référence:', error.message)
            throw error
        }

        // 3. Vérifier la feuille Onboarding (optionnelle, juste informer)
        console.log('\n📊 Vérification de la feuille Onboarding...')
        try {
            const onboardingResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Onboarding!A2:M'
            })
            const onboardingRows = onboardingResponse.data.values || []
            if (onboardingRows.length > 0) {
                console.log(`   ⚠️ ${onboardingRows.length} sessions d'onboarding trouvées`)
                console.log('   💡 Pour nettoyer aussi l\'onboarding, utilisez: node scripts/cleanup-onboarding-data.js')
            } else {
                console.log('   ✅ Feuille Onboarding vide')
            }
        } catch (error) {
            if (error.message && error.message.includes('Unable to parse range')) {
                console.log('   ℹ️ Feuille Onboarding non trouvée (optionnelle)')
            } else {
                console.warn('   ⚠️ Erreur lors de la vérification:', error.message)
            }
        }

        console.log('\n✅ Nettoyage terminé!')
        console.log(`📊 Valeur MapTiler de référence: ${maptilerReferenceValue}`)
        console.log('💡 Les nouvelles données analytics seront trackées à partir de maintenant')

    } catch (error) {
        console.error('❌ Erreur lors du nettoyage:', error)
        process.exit(1)
    }
}

// Confirmation avant nettoyage
if (require.main === module) {
    const readline = require('readline')
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })

    console.log('⚠️  ATTENTION: Ce script va supprimer TOUTES les données analytics existantes!')
    console.log('📊 Une valeur MapTiler de référence (163,036) sera ajoutée pour repartir de zéro.\n')
    
    rl.question('Êtes-vous sûr de vouloir continuer? (tapez "OUI" pour confirmer): ', (answer) => {
        if (answer === 'OUI') {
            rl.close()
            cleanupTestData()
                .then(() => process.exit(0))
                .catch(error => {
                    console.error('❌ Erreur fatale:', error)
                    process.exit(1)
                })
        } else {
            console.log('❌ Opération annulée')
            rl.close()
            process.exit(0)
        }
    })
}

module.exports = { cleanupTestData }

