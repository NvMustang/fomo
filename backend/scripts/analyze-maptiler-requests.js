/**
 * Script d'analyse détaillée des requêtes MapTiler
 * Pour comprendre pourquoi il y a autant d'appels
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

async function analyzeMapTilerRequests() {
    console.log('🔍 Analyse détaillée des requêtes MapTiler...\n')

    try {
        const analytics = await DataServiceV2.getAllActiveData(
            AnalyticsController.ANALYTICS_RANGE,
            DataServiceV2.mappers.analytics
        )

        const maptilerRequests = analytics.filter(a => a.provider === 'maptiler')

        console.log(`📊 Total requêtes MapTiler: ${maptilerRequests.length}\n`)

        // 1. Analyse par endpoint
        console.log('🔍 1. Répartition par endpoint...')
        const byEndpoint = {}
        maptilerRequests.forEach(req => {
            const endpoint = req.endpoint || 'unknown'
            byEndpoint[endpoint] = (byEndpoint[endpoint] || 0) + 1
        })

        const sortedEndpoints = Object.entries(byEndpoint)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)

        sortedEndpoints.forEach(([endpoint, count]) => {
            const percentage = ((count / maptilerRequests.length) * 100).toFixed(1)
            console.log(`   ${endpoint.substring(0, 80)}: ${count} (${percentage}%)`)
        })
        console.log('')

        // 2. Analyse des tiles (pattern typique: tile, tiles, ou URLs avec /tiles/)
        console.log('🔍 2. Analyse des types de requêtes...')
        const tileRequests = maptilerRequests.filter(r => 
            r.endpoint.includes('tile') || 
            r.endpoint.includes('TILE') ||
            r.endpoint.match(/\/\d+\/\d+\/\d+/) // Pattern de coordonnées de tile
        )
        const apiRequests = maptilerRequests.filter(r => 
            r.endpoint.includes('api') ||
            r.endpoint.includes('geocoding') ||
            r.endpoint.includes('search')
        )
        const otherRequests = maptilerRequests.filter(r => 
            !tileRequests.includes(r) && !apiRequests.includes(r)
        )

        console.log(`   📊 Tiles (requêtes de tuiles de carte): ${tileRequests.length} (${((tileRequests.length / maptilerRequests.length) * 100).toFixed(1)}%)`)
        console.log(`   📊 API (geocoding, search, etc.): ${apiRequests.length} (${((apiRequests.length / maptilerRequests.length) * 100).toFixed(1)}%)`)
        console.log(`   📊 Autres: ${otherRequests.length} (${((otherRequests.length / maptilerRequests.length) * 100).toFixed(1)}%)`)
        console.log('')

        // 3. Analyse des erreurs par type
        console.log('🔍 3. Analyse des erreurs par type...')
        const tileErrors = tileRequests.filter(r => !r.success)
        const apiErrors = apiRequests.filter(r => !r.success)
        
        console.log(`   ⚠️ Erreurs tiles: ${tileErrors.length} (${((tileErrors.length / tileRequests.length) * 100).toFixed(1)}% des tiles)`)
        console.log(`   ⚠️ Erreurs API: ${apiErrors.length} (${((apiErrors.length / apiRequests.length) * 100).toFixed(1)}% des API)`)
        console.log('')

        // 4. Analyse temporelle - requêtes par heure/jour
        console.log('🔍 4. Analyse temporelle (dernières 24h)...')
        const now = Date.now()
        const oneDayAgo = now - (24 * 60 * 60 * 1000)
        
        const recentRequests = maptilerRequests.filter(r => {
            const date = new Date(r.timestamp)
            return date.getTime() >= oneDayAgo
        })

        const byHour = {}
        recentRequests.forEach(r => {
            const date = new Date(r.timestamp)
            const hour = date.toISOString().substring(0, 13) + ':00:00'
            byHour[hour] = (byHour[hour] || 0) + 1
        })

        console.log(`   📊 Requêtes MapTiler sur les 24 dernières heures: ${recentRequests.length}`)
        const sortedHours = Object.entries(byHour)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-12) // Dernières 12 heures

        sortedHours.forEach(([hour, count]) => {
            console.log(`      ${hour}: ${count} requêtes`)
        })
        console.log('')

        // 5. Analyse par session - voir les sessions avec le plus de requêtes
        console.log('🔍 5. Top 10 des sessions avec le plus de requêtes MapTiler...')
        const bySession = {}
        maptilerRequests.forEach(r => {
            const sessionId = r.sessionId || 'no-session'
            bySession[sessionId] = (bySession[sessionId] || 0) + 1
        })

        const sortedSessions = Object.entries(bySession)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)

        sortedSessions.forEach(([sessionId, count]) => {
            const percentage = ((count / maptilerRequests.length) * 100).toFixed(1)
            console.log(`   ${sessionId.substring(0, 40)}: ${count} requêtes (${percentage}%)`)
        })
        console.log('')

        // 6. Analyse des patterns de tiles (zoom levels, etc.)
        if (tileRequests.length > 0) {
            console.log('🔍 6. Analyse des patterns de tiles...')
            
            // Extraire les niveaux de zoom des URLs de tiles
            const zoomLevels = {}
            tileRequests.forEach(r => {
                const match = r.endpoint.match(/\/(\d+)\/(\d+)\/(\d+)/)
                if (match) {
                    const zoom = parseInt(match[1])
                    zoomLevels[zoom] = (zoomLevels[zoom] || 0) + 1
                }
            })

            if (Object.keys(zoomLevels).length > 0) {
                console.log('   📊 Répartition par niveau de zoom:')
                Object.entries(zoomLevels)
                    .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                    .forEach(([zoom, count]) => {
                        const percentage = ((count / tileRequests.length) * 100).toFixed(1)
                        console.log(`      Zoom ${zoom}: ${count} tiles (${percentage}%)`)
                    })
            }
            console.log('')
        }

        // 7. Analyse des requêtes dupliquées (même endpoint, même timestamp)
        console.log('🔍 7. Analyse des requêtes potentiellement dupliquées...')
        const requestKeys = maptilerRequests.map(r => `${r.endpoint}|${r.timestamp}`)
        const duplicateKeys = requestKeys.filter((key, index) => requestKeys.indexOf(key) !== index)
        const uniqueDuplicates = [...new Set(duplicateKeys)]
        
        console.log(`   ⚠️ ${uniqueDuplicates.length} groupes de requêtes potentiellement dupliquées`)
        if (uniqueDuplicates.length > 0 && uniqueDuplicates.length <= 10) {
            uniqueDuplicates.slice(0, 5).forEach(key => {
                const [endpoint, timestamp] = key.split('|')
                const count = requestKeys.filter(k => k === key).length
                console.log(`      ${endpoint.substring(0, 60)}... à ${timestamp}: ${count} occurrences`)
            })
        }
        console.log('')

        // 8. Résumé et recommandations
        console.log('📋 RÉSUMÉ ET RECOMMANDATIONS:')
        console.log('')
        
        const tilePercentage = (tileRequests.length / maptilerRequests.length) * 100
        if (tilePercentage > 90) {
            console.log('   ⚠️ Plus de 90% des requêtes MapTiler sont des tiles de carte')
            console.log('   💡 Recommandation: Ne pas tracker les tiles MapTiler (trop de bruit)')
            console.log('      Les tiles sont chargées automatiquement par la carte et génèrent')
            console.log('      des milliers de requêtes par session sans valeur analytique.')
        }

        if (tileErrors.length > 0 && (tileErrors.length / tileRequests.length) > 0.2) {
            console.log('   ⚠️ Taux d\'erreur élevé sur les tiles (>20%)')
            console.log('   💡 Ces erreurs sont probablement des requêtes annulées ou des tiles')
            console.log('      non disponibles, ce qui est normal pour une carte.')
        }

        const avgRequestsPerSession = maptilerRequests.length / Object.keys(bySession).length
        if (avgRequestsPerSession > 1000) {
            console.log('   ⚠️ Moyenne de ' + Math.round(avgRequestsPerSession) + ' requêtes MapTiler par session')
            console.log('   💡 C\'est très élevé et indique qu\'on track probablement toutes les tiles')
        }

        console.log('')
        console.log('✅ Analyse terminée')

    } catch (error) {
        console.error('❌ Erreur lors de l\'analyse:', error)
        process.exit(1)
    }
}

analyzeMapTilerRequests()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('❌ Erreur fatale:', error)
        process.exit(1)
    })

