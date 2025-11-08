/**
 * Script pour analyser les patterns de doublons
 * Pour comprendre si le bruit vient de plusieurs utilisateurs ou d'un même utilisateur
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

async function analyzeDuplicatePatterns() {
    console.log('🔍 Analyse des patterns de doublons...\n')

    try {
        const analytics = await DataServiceV2.getAllActiveData(
            AnalyticsController.ANALYTICS_RANGE,
            DataServiceV2.mappers.analytics
        )

        const requests = analytics.filter(a => a.provider !== 'maptiler_reference')

        console.log(`📊 Total requêtes: ${requests.length}\n`)

        // 1. Analyser les doublons par session (même utilisateur)
        console.log('🔍 1. Doublons au sein d\'une même session...')
        const bySession = {}
        requests.forEach(r => {
            const sessionId = r.sessionId || 'no-session'
            if (!bySession[sessionId]) {
                bySession[sessionId] = []
            }
            bySession[sessionId].push(r)
        })

        let intraSessionDuplicates = 0
        let sessionsWithDuplicates = 0

        Object.entries(bySession).forEach(([sessionId, sessionRequests]) => {
            // Grouper par endpoint + timestamp (à la seconde près)
            const byKey = {}
            sessionRequests.forEach(r => {
                const timestamp = new Date(r.timestamp)
                const key = `${r.provider}|${r.endpoint}|${timestamp.toISOString().substring(0, 19)}` // À la seconde
                if (!byKey[key]) {
                    byKey[key] = []
                }
                byKey[key].push(r)
            })

            // Compter les doublons dans cette session
            Object.values(byKey).forEach(group => {
                if (group.length > 1) {
                    intraSessionDuplicates += group.length - 1
                }
            })

            if (Object.values(byKey).some(group => group.length > 1)) {
                sessionsWithDuplicates++
            }
        })

        console.log(`   📊 Sessions avec doublons internes: ${sessionsWithDuplicates} / ${Object.keys(bySession).length}`)
        console.log(`   📊 Total doublons intra-session: ${intraSessionDuplicates}`)
        console.log(`   📊 Pourcentage de doublons: ${((intraSessionDuplicates / requests.length) * 100).toFixed(1)}%`)
        console.log('')

        // 2. Analyser les doublons entre sessions (plusieurs utilisateurs)
        console.log('🔍 2. Doublons entre différentes sessions...')
        const byKey = {}
        requests.forEach(r => {
            const timestamp = new Date(r.timestamp)
            // Clé: provider + endpoint + timestamp (à la seconde)
            const key = `${r.provider}|${r.endpoint}|${timestamp.toISOString().substring(0, 19)}`
            if (!byKey[key]) {
                byKey[key] = []
            }
            byKey[key].push(r)
        })

        const crossSessionDuplicates = []
        Object.entries(byKey).forEach(([key, group]) => {
            if (group.length > 1) {
                const sessions = new Set(group.map(r => r.sessionId || 'no-session'))
                if (sessions.size > 1) {
                    // Plusieurs sessions différentes ont la même requête
                    crossSessionDuplicates.push({
                        key,
                        count: group.length,
                        sessions: sessions.size,
                        provider: group[0].provider,
                        endpoint: group[0].endpoint.substring(0, 60)
                    })
                }
            }
        })

        console.log(`   📊 Groupes de requêtes identiques partagées entre sessions: ${crossSessionDuplicates.length}`)
        if (crossSessionDuplicates.length > 0) {
            const totalCrossDuplicates = crossSessionDuplicates.reduce((sum, d) => sum + (d.count - 1), 0)
            console.log(`   📊 Total doublons inter-sessions: ${totalCrossDuplicates}`)
            
            // Top 10 des requêtes les plus partagées
            const topShared = crossSessionDuplicates
                .sort((a, b) => b.count - a.count)
                .slice(0, 10)
            
            console.log('   Top 10 des requêtes partagées entre plusieurs sessions:')
            topShared.forEach((d, i) => {
                console.log(`      ${i + 1}. ${d.endpoint}... (${d.count} occurrences, ${d.sessions} sessions)`)
            })
        }
        console.log('')

        // 3. Analyser les patterns temporels (même requête à des moments différents)
        console.log('🔍 3. Patterns temporels (même requête répétée)...')
        const byEndpoint = {}
        requests.forEach(r => {
            const endpointKey = `${r.provider}|${r.endpoint}`
            if (!byEndpoint[endpointKey]) {
                byEndpoint[endpointKey] = []
            }
            byEndpoint[endpointKey].push({
                timestamp: new Date(r.timestamp).getTime(),
                sessionId: r.sessionId || 'no-session'
            })
        })

        // Trouver les endpoints qui sont appelés très fréquemment
        const frequentEndpoints = Object.entries(byEndpoint)
            .filter(([_, calls]) => calls.length > 10)
            .map(([endpoint, calls]) => {
                calls.sort((a, b) => a.timestamp - b.timestamp)
                const timeSpan = calls[calls.length - 1].timestamp - calls[0].timestamp
                const sessions = new Set(calls.map(c => c.sessionId))
                return {
                    endpoint,
                    count: calls.length,
                    sessions: sessions.size,
                    timeSpan: timeSpan / 1000 / 60, // en minutes
                    callsPerMinute: calls.length / (timeSpan / 1000 / 60)
                }
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 10)

        console.log('   Top 10 des endpoints les plus fréquemment appelés:')
        frequentEndpoints.forEach((e, i) => {
            console.log(`      ${i + 1}. ${e.endpoint.substring(0, 60)}...`)
            console.log(`         ${e.count} appels, ${e.sessions} sessions, ${e.timeSpan.toFixed(1)} min, ${e.callsPerMinute.toFixed(1)} appels/min`)
        })
        console.log('')

        // 4. Analyser les requêtes avec timestamp exact identique
        console.log('🔍 4. Requêtes avec timestamp exact identique...')
        const byExactTimestamp = {}
        requests.forEach(r => {
            const key = `${r.provider}|${r.endpoint}|${r.timestamp}`
            if (!byExactTimestamp[key]) {
                byExactTimestamp[key] = []
            }
            byExactTimestamp[key].push(r)
        })

        const exactDuplicates = Object.entries(byExactTimestamp)
            .filter(([_, group]) => group.length > 1)
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 10)

        console.log(`   📊 Groupes avec timestamp exact identique: ${Object.entries(byExactTimestamp).filter(([_, g]) => g.length > 1).length}`)
        if (exactDuplicates.length > 0) {
            console.log('   Top 10 des timestamps exacts avec le plus de doublons:')
            exactDuplicates.forEach(([key, group], i) => {
                const [provider, endpoint, timestamp] = key.split('|')
                const sessions = new Set(group.map(r => r.sessionId || 'no-session'))
                console.log(`      ${i + 1}. ${timestamp}: ${group.length} requêtes identiques`)
                console.log(`         ${endpoint.substring(0, 60)}...`)
                console.log(`         ${sessions.size} sessions différentes`)
            })
        }
        console.log('')

        // 5. Résumé et conclusions
        console.log('📋 RÉSUMÉ ET CONCLUSIONS:')
        console.log('')
        
        const totalDuplicates = intraSessionDuplicates + (crossSessionDuplicates.reduce((sum, d) => sum + (d.count - 1), 0) || 0)
        const duplicateRate = (totalDuplicates / requests.length) * 100

        console.log(`   📊 Taux de doublons total: ${duplicateRate.toFixed(1)}%`)
        console.log(`   📊 Doublons intra-session: ${intraSessionDuplicates} (${((intraSessionDuplicates / requests.length) * 100).toFixed(1)}%)`)
        console.log(`   📊 Doublons inter-sessions: ${crossSessionDuplicates.reduce((sum, d) => sum + (d.count - 1), 0) || 0} (${((crossSessionDuplicates.reduce((sum, d) => sum + (d.count - 1), 0) / requests.length) * 100).toFixed(1)}%)`)
        console.log('')

        if (intraSessionDuplicates > crossSessionDuplicates.reduce((sum, d) => sum + (d.count - 1), 0)) {
            console.log('   💡 Le bruit vient principalement de DOUBLONS AU SEIN D\'UNE MÊME SESSION')
            console.log('      → Un même utilisateur envoie plusieurs fois les mêmes données')
            console.log('      → Possible causes:')
            console.log('         - Sauvegarde multiple des mêmes données (auto-save + manuel)')
            console.log('         - Re-render React qui déclenche plusieurs fois le tracking')
            console.log('         - Requêtes HTTP interceptées plusieurs fois')
        } else {
            console.log('   💡 Le bruit vient principalement de DOUBLONS ENTRE DIFFÉRENTES SESSIONS')
            console.log('      → Plusieurs utilisateurs envoient les mêmes données')
            console.log('      → Possible causes:')
            console.log('         - Plusieurs utilisateurs font la même action au même moment')
            console.log('         - Requêtes légitimes qui se ressemblent (tiles MapTiler)')
            console.log('         - Cache partagé ou données communes')
        }

        console.log('')
        console.log('✅ Analyse terminée')

    } catch (error) {
        console.error('❌ Erreur lors de l\'analyse:', error)
        process.exit(1)
    }
}

analyzeDuplicatePatterns()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('❌ Erreur fatale:', error)
        process.exit(1)
    })

