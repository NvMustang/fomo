/**
 * Script de nettoyage des références MapTiler dupliquées
 * 
 * - Supprime les doublons de références MapTiler (même timestamp + valeur)
 * - Garde seulement la première occurrence de chaque référence unique
 * - Met à jour la référence initiale avec la valeur actuelle MapTiler
 * 
 * Usage: node backend/scripts/cleanup-maptiler-references.js [valeur_maptiler_actuelle]
 * Exemple: node backend/scripts/cleanup-maptiler-references.js 207581
 */

require('dotenv').config()
process.env.FORCE_PRODUCTION = 'true'

const path = require('path')
const scriptDir = __dirname
const backendDir = path.join(scriptDir, '..')

delete require.cache[require.resolve(path.join(backendDir, 'utils/sheets-config'))]
delete require.cache[require.resolve(path.join(backendDir, 'utils/dataService'))]
delete require.cache[require.resolve(path.join(backendDir, 'controllers/analyticsController'))]

const DataServiceV2 = require(path.join(backendDir, 'utils/dataService'))
const AnalyticsController = require(path.join(backendDir, 'controllers/analyticsController'))
const { sheets, SPREADSHEET_ID, readData, clearSheet, appendData } = require(path.join(backendDir, 'utils/sheets-config'))

async function cleanupMapTilerReferences(currentValue) {
    console.log('🧹 Nettoyage des références MapTiler dupliquées...\n')

    try {
        // 1. Récupérer toutes les données analytics
        console.log('📊 Récupération des données...')
        const analytics = await DataServiceV2.getAllActiveData(
            AnalyticsController.ANALYTICS_RANGE,
            DataServiceV2.mappers.analytics
        )

        // Séparer les requêtes normales des références MapTiler
        const requests = analytics.filter(a => a.provider !== 'maptiler_reference')
        const maptilerRefs = analytics.filter(a => a.provider === 'maptiler_reference')

        console.log(`   📊 Total requêtes: ${requests.length}`)
        console.log(`   📊 Total références MapTiler: ${maptilerRefs.length}\n`)

        // 2. Identifier les doublons de références
        console.log('🔍 Identification des doublons...')
        const refKeys = new Map() // key: "timestamp|value" -> première occurrence
        const duplicates = []
        const uniqueRefs = []

        maptilerRefs.forEach((ref, index) => {
            const timestamp = ref.timestamp
            const value = parseFloat(ref.maptilerReferenceValue) || 0
            const key = `${timestamp}|${value}`

            if (refKeys.has(key)) {
                // Doublon trouvé
                duplicates.push({ ref, index, key })
            } else {
                // Première occurrence - garder
                refKeys.set(key, ref)
                uniqueRefs.push(ref)
            }
        })

        console.log(`   📊 Références uniques: ${uniqueRefs.length}`)
        console.log(`   📊 Doublons à supprimer: ${duplicates.length}\n`)

        if (duplicates.length === 0) {
            console.log('✅ Aucun doublon trouvé, rien à nettoyer')
            return
        }

        // 3. Afficher les doublons trouvés
        console.log('📋 Exemples de doublons:')
        const duplicateGroups = {}
        duplicates.forEach(({ key }) => {
            duplicateGroups[key] = (duplicateGroups[key] || 0) + 1
        })
        Object.entries(duplicateGroups)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([key, count]) => {
                const [timestamp, value] = key.split('|')
                console.log(`   - ${new Date(timestamp).toLocaleString('fr-FR')} valeur ${value}: ${count} doublons`)
            })
        console.log()

        // 4. Demander confirmation
        console.log('⚠️  Cette opération va:')
        console.log('   1. Supprimer toutes les données Analytics (requêtes + références)')
        console.log('   2. Réinsérer les requêtes normales (sans doublons)')
        console.log('   3. Réinsérer les références MapTiler uniques')
        if (currentValue) {
            console.log(`   4. Ajouter une nouvelle référence avec la valeur actuelle: ${currentValue}`)
        }
        console.log()

        // Pour un script automatique, on continue directement
        // En production, vous pourriez ajouter une confirmation interactive

        // 5. Lire toutes les données brutes pour reconstruire
        console.log('📊 Lecture des données brutes depuis Google Sheets...')
        const allRows = await readData('Analytics', 'A2:M')
        console.log(`   📊 ${allRows.length} lignes trouvées\n`)

        // 6. Séparer les requêtes normales des références
        const requestRows = []
        const refRowsMap = new Map() // key: "timestamp|value" -> row

        allRows.forEach((row, index) => {
            const provider = row[1] || ''
            if (provider === 'maptiler_reference') {
                const timestamp = row[0] || ''
                const value = row[7] || ''
                const key = `${timestamp}|${value}`
                // Garder seulement la première occurrence
                if (!refRowsMap.has(key)) {
                    refRowsMap.set(key, row)
                }
            } else {
                // Requête normale - garder toutes
                requestRows.push(row)
            }
        })

        const uniqueRefRows = Array.from(refRowsMap.values())
        console.log(`   📊 Requêtes normales: ${requestRows.length}`)
        console.log(`   📊 Références uniques: ${uniqueRefRows.length} (${maptilerRefs.length - uniqueRefRows.length} doublons supprimés)\n`)

        // 7. Ajouter la nouvelle référence si fournie
        if (currentValue) {
            const now = new Date().toISOString()
            // Calculer le tracked_count approximatif (nombre de requêtes MapTiler trackées)
            const maptilerRequestCount = requestRows.filter(row => row[1] === 'maptiler').length
            
            // Trouver la première référence pour la valeur initiale
            const firstRef = uniqueRefRows
                .filter(row => row[1] === 'maptiler_reference')
                .sort((a, b) => new Date(a[0]) - new Date(b[0]))[0]
            
            const initialValue = firstRef ? parseFloat(firstRef[7]) || 104684 : 104684
            const trackedCumulative = initialValue + maptilerRequestCount
            const variation = currentValue - trackedCumulative
            const percentage = trackedCumulative > 0
                ? ((variation / trackedCumulative) * 100).toFixed(2)
                : '0'
            
            const newRefRow = [
                now, // timestamp (colonne 0)
                'maptiler_reference', // provider (colonne 1)
                'reference', // endpoint (colonne 2)
                'REFERENCE', // method (colonne 3)
                'true', // success (colonne 4)
                '', // error (colonne 5)
                trackedCumulative.toString(), // tracked_count (colonne 6)
                currentValue.toString(), // maptiler_reference_value (colonne 7)
                'Valeur actuelle après nettoyage des doublons', // maptiler_reference_note (colonne 8)
                percentage, // variation_percentage (colonne 9)
                now, // saved_at (colonne 10)
                'cleanup-script', // session_id (colonne 11)
                'Script cleanup' // user_name (colonne 12)
            ]
            uniqueRefRows.push(newRefRow)
            console.log(`   ✅ Nouvelle référence ajoutée: ${currentValue} (notre compteur: ${trackedCumulative}, diff: ${variation > 0 ? '+' : ''}${variation})\n`)
        }

        // 8. Vider la feuille et réinsérer les données nettoyées
        console.log('🧹 Nettoyage de la feuille Analytics...')
        await clearSheet('Analytics', 2)
        console.log('   ✅ Feuille nettoyée\n')

        // 9. Réinsérer les données
        console.log('📤 Réinsertion des données nettoyées...')
        const allCleanRows = [...requestRows, ...uniqueRefRows]
        
        if (allCleanRows.length > 0) {
            await appendData('Analytics', allCleanRows, 2)
            console.log(`   ✅ ${allCleanRows.length} lignes réinsérées (${requestRows.length} requêtes + ${uniqueRefRows.length} références)\n`)
        } else {
            console.log('   ⚠️ Aucune donnée à réinsérer\n')
        }

        console.log('✅ Nettoyage terminé avec succès!')
        console.log(`📊 Résumé:`)
        console.log(`   - Requêtes conservées: ${requestRows.length}`)
        console.log(`   - Références uniques: ${uniqueRefRows.length}`)
        console.log(`   - Doublons supprimés: ${maptilerRefs.length - uniqueRefRows.length}`)
        if (currentValue) {
            console.log(`   - Nouvelle référence: ${currentValue}`)
        }

    } catch (error) {
        console.error('❌ Erreur lors du nettoyage:', error)
        throw error
    }
}

// Récupérer la valeur actuelle depuis les arguments
const currentValue = process.argv[2] ? parseInt(process.argv[2], 10) : null

if (currentValue && (isNaN(currentValue) || currentValue < 0)) {
    console.error('❌ Valeur MapTiler invalide. Usage: node cleanup-maptiler-references.js [valeur_maptiler]')
    process.exit(1)
}

if (!currentValue) {
    console.log('ℹ️  Aucune valeur MapTiler fournie - nettoyage uniquement des doublons')
    console.log('   Usage: node cleanup-maptiler-references.js [valeur_maptiler_actuelle]\n')
}

cleanupMapTilerReferences(currentValue)
    .then(() => {
        console.log('\n✅ Script terminé')
        process.exit(0)
    })
    .catch((error) => {
        console.error('\n❌ Erreur:', error.message)
        process.exit(1)
    })

