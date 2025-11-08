/**
 * Script d'analyse des données analytics
 * 
 * Analyse les données de production pour identifier :
 * - Les doublons
 * - Les anomalies
 * - Les requêtes suspectes
 * - Le "bruit" dans les données
 * 
 * Usage:
 *   node scripts/analyze-analytics-data.js          # Utilise la config par défaut (test en local, prod sur Vercel)
 *   node scripts/analyze-analytics-data.js --prod   # Force l'utilisation de la base de production
 */

const DataServiceV2 = require('../utils/dataService')
const AnalyticsController = require('../controllers/analyticsController')

async function analyzeAnalyticsData(forceProduction = false) {
    // Forcer la production si demandé
    if (forceProduction) {
        process.env.FORCE_PRODUCTION = 'true'
        // Recharger sheets-config pour prendre en compte le changement
        delete require.cache[require.resolve('../utils/sheets-config')]
        console.log('📊 Mode PRODUCTION forcé\n')
    }

    console.log('🔍 Analyse des données analytics...\n')

    try {
        // Récupérer toutes les données analytics
        const analytics = await DataServiceV2.getAllActiveData(
            AnalyticsController.ANALYTICS_RANGE,
            DataServiceV2.mappers.analytics
        )

        console.log(`📊 Total requêtes: ${analytics.length}\n`)

        // Séparer les requêtes normales des références MapTiler
        const requests = analytics.filter(a => a.provider !== 'maptiler_reference')
        const maptilerRefs = analytics.filter(a => a.provider === 'maptiler_reference')

        console.log(`📊 Requêtes API: ${requests.length}`)
        console.log(`📊 Références MapTiler: ${maptilerRefs.length}\n`)

        // 1. Analyse par provider
        console.log('🔍 1. Répartition par provider...')
        const byProvider = {}
        requests.forEach(req => {
            byProvider[req.provider] = (byProvider[req.provider] || 0) + 1
        })
        Object.entries(byProvider)
            .sort((a, b) => b[1] - a[1])
            .forEach(([provider, count]) => {
                const percentage = ((count / requests.length) * 100).toFixed(1)
                console.log(`   - ${provider}: ${count} (${percentage}%)`)
            })
        console.log('')

        // 2. Analyse des erreurs
        console.log('🔍 2. Analyse des erreurs...')
        const errors = requests.filter(r => !r.success)
        const errorsByProvider = {}
        errors.forEach(req => {
            errorsByProvider[req.provider] = (errorsByProvider[req.provider] || 0) + 1
        })
        console.log(`   ⚠️ Total erreurs: ${errors.length} (${((errors.length / requests.length) * 100).toFixed(1)}%)`)
        if (Object.keys(errorsByProvider).length > 0) {
            console.log('   Répartition par provider:')
            Object.entries(errorsByProvider)
                .sort((a, b) => b[1] - a[1])
                .forEach(([provider, count]) => {
                    console.log(`      - ${provider}: ${count}`)
                })
        }
        console.log('')

        // 3. Analyse des timestamps invalides
        console.log('🔍 3. Analyse des timestamps invalides...')
        const invalidTimestamps = requests.filter(r => {
            const date = new Date(r.timestamp)
            return isNaN(date.getTime())
        })
        console.log(`   ⚠️ ${invalidTimestamps.length} requêtes avec timestamp invalide`)
        if (invalidTimestamps.length > 0 && invalidTimestamps.length <= 5) {
            invalidTimestamps.forEach(r => {
                console.log(`      - ${r.provider} ${r.endpoint}: ${r.timestamp}`)
            })
        }
        console.log('')

        // 4. Analyse des requêtes dupliquées (même provider, endpoint, timestamp)
        console.log('🔍 4. Analyse des requêtes potentiellement dupliquées...')
        const requestKeys = requests.map(r => `${r.provider}|${r.endpoint}|${r.timestamp}`)
        const duplicateKeys = requestKeys.filter((key, index) => requestKeys.indexOf(key) !== index)
        const uniqueDuplicates = [...new Set(duplicateKeys)]
        console.log(`   ⚠️ ${uniqueDuplicates.length} groupes de requêtes potentiellement dupliquées`)
        if (uniqueDuplicates.length > 0 && uniqueDuplicates.length <= 5) {
            uniqueDuplicates.slice(0, 5).forEach(key => {
                const [provider, endpoint, timestamp] = key.split('|')
                const count = requestKeys.filter(k => k === key).length
                console.log(`      - ${provider} ${endpoint.substring(0, 40)}... à ${timestamp}: ${count} occurrences`)
            })
        }
        console.log('')

        // 5. Analyse des endpoints les plus appelés
        console.log('🔍 5. Top 10 des endpoints les plus appelés...')
        const byEndpoint = {}
        requests.forEach(req => {
            const key = `${req.provider}:${req.endpoint}`
            byEndpoint[key] = (byEndpoint[key] || 0) + 1
        })
        Object.entries(byEndpoint)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .forEach(([endpoint, count]) => {
                const percentage = ((count / requests.length) * 100).toFixed(1)
                console.log(`   - ${endpoint.substring(0, 60)}: ${count} (${percentage}%)`)
            })
        console.log('')

        // 6. Analyse des sessions uniques
        console.log('🔍 6. Analyse des sessions...')
        const uniqueSessions = new Set(requests.map(r => r.sessionId).filter(Boolean))
        const uniqueUsers = new Set(requests.map(r => r.userName).filter(Boolean))
        console.log(`   📊 Sessions uniques: ${uniqueSessions.size}`)
        console.log(`   📊 Utilisateurs uniques: ${uniqueUsers.size}`)
        console.log(`   📊 Moyenne requêtes par session: ${(requests.length / uniqueSessions.size).toFixed(1)}`)
        console.log('')

        // 7. Analyse des requêtes sans sessionId
        console.log('🔍 7. Analyse des requêtes sans sessionId...')
        const requestsWithoutSession = requests.filter(r => !r.sessionId || r.sessionId === '')
        console.log(`   ⚠️ ${requestsWithoutSession.length} requêtes sans sessionId (${((requestsWithoutSession.length / requests.length) * 100).toFixed(1)}%)`)
        if (requestsWithoutSession.length > 0) {
            const byProviderNoSession = {}
            requestsWithoutSession.forEach(r => {
                byProviderNoSession[r.provider] = (byProviderNoSession[r.provider] || 0) + 1
            })
            console.log('   Répartition par provider:')
            Object.entries(byProviderNoSession)
                .sort((a, b) => b[1] - a[1])
                .forEach(([provider, count]) => {
                    console.log(`      - ${provider}: ${count}`)
                })
        }
        console.log('')

        // 8. Analyse temporelle (requêtes par jour)
        console.log('🔍 8. Analyse temporelle (derniers 7 jours)...')
        const now = Date.now()
        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000)
        const recentRequests = requests.filter(r => {
            const date = new Date(r.timestamp)
            return date.getTime() >= sevenDaysAgo
        })
        
        const byDay = {}
        recentRequests.forEach(r => {
            const date = new Date(r.timestamp)
            const dayKey = date.toISOString().split('T')[0]
            byDay[dayKey] = (byDay[dayKey] || 0) + 1
        })
        
        console.log(`   📊 Requêtes sur les 7 derniers jours: ${recentRequests.length}`)
        Object.entries(byDay)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .forEach(([day, count]) => {
                console.log(`      - ${day}: ${count}`)
            })
        console.log('')

        // 9. Analyse des références MapTiler
        if (maptilerRefs.length > 0) {
            console.log('🔍 9. Analyse des références MapTiler...')
            const refsByUser = {}
            maptilerRefs.forEach(ref => {
                const user = ref.userName || ref.sessionId || 'unknown'
                refsByUser[user] = (refsByUser[user] || 0) + 1
            })
            console.log(`   📊 Total références: ${maptilerRefs.length}`)
            console.log(`   📊 Utilisateurs ayant enregistré: ${Object.keys(refsByUser).length}`)
            if (Object.keys(refsByUser).length <= 10) {
                Object.entries(refsByUser)
                    .sort((a, b) => b[1] - a[1])
                    .forEach(([user, count]) => {
                        console.log(`      - ${user}: ${count} références`)
                    })
            }
            console.log('')
        }

        // 10. Résumé et recommandations
        console.log('📋 RÉSUMÉ ET RECOMMANDATIONS:')
        console.log('')
        
        const issues = []
        if (errors.length > 0 && (errors.length / requests.length) > 0.1) {
            issues.push(`- Taux d'erreur élevé: ${((errors.length / requests.length) * 100).toFixed(1)}% (vérifier les providers en erreur)`)
        }
        if (invalidTimestamps.length > 0) {
            issues.push(`- ${invalidTimestamps.length} requêtes avec timestamps invalides à nettoyer`)
        }
        if (uniqueDuplicates.length > 0) {
            issues.push(`- ${uniqueDuplicates.length} groupes de requêtes potentiellement dupliquées (vérifier le tracking)`)
        }
        if (requestsWithoutSession.length > 0 && (requestsWithoutSession.length / requests.length) > 0.1) {
            issues.push(`- ${((requestsWithoutSession.length / requests.length) * 100).toFixed(1)}% des requêtes sans sessionId (vérifier le tracking)`)
        }

        if (issues.length > 0) {
            console.log('   ⚠️ Problèmes détectés:')
            issues.forEach(issue => console.log(`      ${issue}`))
        } else {
            console.log('   ✅ Aucun problème majeur détecté')
        }

        console.log('')
        console.log('✅ Analyse terminée')

    } catch (error) {
        console.error('❌ Erreur lors de l\'analyse:', error)
        process.exit(1)
    }
}

// Exécuter l'analyse
if (require.main === module) {
    const forceProduction = process.argv.includes('--prod') || process.argv.includes('--production')
    analyzeAnalyticsData(forceProduction)
        .then(() => process.exit(0))
        .catch(error => {
            console.error('❌ Erreur fatale:', error)
            process.exit(1)
        })
}

module.exports = { analyzeAnalyticsData }

