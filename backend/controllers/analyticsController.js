/**
 * Contrôleur pour les Analytics
 * Sauvegarde les données analytics dans Google Sheets
 */

const DataServiceV2 = require('../utils/dataService')
const analyticsTracker = require('../utils/analyticsTracker')

class AnalyticsController {
    // Range Google Sheets pour la feuille Analytics
    // Colonnes: Timestamp, Provider, Endpoint, Method, Success, Error, Tracked Count, MapTiler Ref Value, MapTiler Ref Note, Variation %, Saved At, Session ID, User Name
    static ANALYTICS_RANGE = 'Analytics!A2:M'

    /**
     * Sauvegarder les analytics depuis le frontend
     */
    static async saveAnalytics(req, res) {
        const requestId = Math.random().toString(36).substr(2, 9)
        const timestamp = new Date().toISOString()

        try {
            const { sessionId, userName, stats, history, maptilerReferences } = req.body

            if (!stats || !history || !maptilerReferences) {
                return res.status(400).json({
                    success: false,
                    error: 'Données analytics incomplètes'
                })
            }

            // SessionId est optionnel (fallback si non fourni)
            const effectiveSessionId = sessionId || `unknown-${Date.now()}`
            const effectiveUserName = userName || 'Inconnu'

            console.log(`📊 [${requestId}] [${timestamp}] Sauvegarde analytics...`)
            console.log(`📊 [${requestId}] Stats:`, Object.keys(stats))
            console.log(`📊 [${requestId}] History: ${history.length} requêtes à sauvegarder`)
            console.log(`📊 [${requestId}] MapTiler refs: ${maptilerReferences.length} valeurs`)

            // Compter par provider pour info
            const byProvider = {}
            history.forEach(r => {
                byProvider[r.provider] = (byProvider[r.provider] || 0) + 1
            })
            console.log(`📊 [${requestId}] Répartition:`, byProvider)

            // Préparer les données à sauvegarder
            const requestsToSave = []
            const referencesToSave = []

            // Calculer les valeurs cumulatives pour chaque référence MapTiler
            const sortedRefs = maptilerReferences.sort((a, b) => a.timestamp - b.timestamp)
            const initialRef = sortedRefs[0]
            const initialValue = initialRef?.value || 104684
            const initialDate = initialRef
                ? new Date(initialRef.timestamp).toISOString().split('T')[0]
                : new Date().toISOString().split('T')[0]

            // Sauvegarder TOUTES les requêtes API de l'historique
            history.forEach(request => {
                requestsToSave.push([
                    new Date(request.timestamp).toISOString(), // timestamp
                    request.provider, // provider (maptiler, mapbox, googlesheets, backend)
                    request.endpoint || '', // endpoint
                    request.method || 'GET', // method
                    request.success ? 'true' : 'false', // success
                    request.error || '', // error
                    '', // tracked_count (vide pour les requêtes normales)
                    '', // maptiler_reference_value (vide pour les requêtes normales)
                    '', // maptiler_reference_note (vide pour les requêtes normales)
                    '', // variation_percentage (vide pour les requêtes normales)
                    new Date().toISOString(), // saved_at
                    effectiveSessionId, // session_id
                    effectiveUserName // user_name
                ])
            })

            // Sauvegarder les valeurs de référence MapTiler avec calculs
            maptilerReferences.forEach(ref => {
                const refDate = new Date(ref.timestamp).toISOString().split('T')[0]
                // Compter les requêtes depuis la date initiale jusqu'à cette référence
                const trackedSinceStart = history.filter(r => {
                    if (r.provider !== 'maptiler') return false
                    const reqDate = new Date(r.timestamp).toISOString().split('T')[0]
                    return reqDate >= initialDate && reqDate <= refDate
                }).length

                const trackedCumulative = initialValue + trackedSinceStart
                const variation = ref.value - trackedCumulative
                const percentage = trackedCumulative > 0
                    ? ((variation / trackedCumulative) * 100).toFixed(2)
                    : '0'

                referencesToSave.push([
                    new Date(ref.timestamp).toISOString(),
                    'maptiler_reference',
                    'reference',
                    'REFERENCE',
                    'true',
                    '',
                    trackedCumulative.toString(), // tracked_count
                    ref.value.toString(), // maptiler_reference_value
                    ref.note || '', // maptiler_reference_note
                    percentage, // variation_percentage
                    new Date().toISOString(), // saved_at
                    effectiveSessionId, // session_id
                    effectiveUserName // user_name
                ])
            })

            // Sauvegarder dans Google Sheets avec déduplication (append en batch)
            let savedCount = 0
            let savedReferences = 0
            const { appendDataWithDeduplication } = require('../utils/sheets-config')
            
            // Sauvegarder les requêtes normales : déduplication par Timestamp + Provider + Endpoint + Method
            if (requestsToSave.length > 0) {
                const result = await appendDataWithDeduplication('Analytics', requestsToSave, [0, 1, 2, 3], 2, 50000, requestId)
                savedCount += result.saved
                console.log(`✅ [${requestId}] ${result.saved} nouvelles requêtes sauvegardées (${result.duplicates} doublons ignorés)`)
            }
            
            // Sauvegarder les références MapTiler : déduplication par Timestamp + Valeur (colonnes 0 et 7)
            // Cela évite les doublons même si la même valeur est sauvegardée plusieurs fois
            if (referencesToSave.length > 0) {
                const result = await appendDataWithDeduplication('Analytics', referencesToSave, [0, 7], 2, 50000, requestId)
                savedReferences = result.saved
                savedCount += result.saved
                console.log(`✅ [${requestId}] ${result.saved} nouvelles références MapTiler sauvegardées (${result.duplicates} doublons ignorés)`)
            }
            
            if (savedCount === 0) {
                console.log(`⚠️ [${requestId}] Aucune donnée à sauvegarder`)
            }
            res.json({
                success: true,
                message: `${savedCount} nouvelles lignes sauvegardées`
            })
        } catch (error) {
            console.error(`❌ [${requestId}] Erreur sauvegarde analytics:`, error)
            res.status(500).json({
                success: false,
                error: error.message
            })
        }
    }

    /**
     * Récupérer les stats backend (Mapbox, Google Sheets)
     */
    static async getBackendStats(req, res) {
        try {
            const stats = analyticsTracker.getStats()
            res.json({
                success: true,
                data: stats
            })
        } catch (error) {
            console.error('❌ Erreur récupération stats backend:', error)
            res.status(500).json({
                success: false,
                error: error.message
            })
        }
    }

    /**
     * Récupérer les statistiques agrégées depuis Google Sheets
     * Agrège toutes les données de tous les utilisateurs
     */
    static async getAggregatedStats(req, res) {
        try {
            const analytics = await DataServiceV2.getAllActiveData(
                AnalyticsController.ANALYTICS_RANGE,
                DataServiceV2.mappers.analytics
            )

            // Filtrer uniquement les requêtes (pas les références MapTiler)
            const requests = analytics.filter(a => a.provider !== 'maptiler_reference')

            // Filtrer les références MapTiler
            const maptilerReferences = analytics
                .filter(a => a.provider === 'maptiler_reference')
                .map(a => ({
                    timestamp: new Date(a.timestamp).getTime(),
                    value: parseFloat(a.maptilerReferenceValue) || 0,
                    note: a.maptilerReferenceNote || '',
                    sessionId: a.sessionId || '',
                    userName: a.userName || ''
                }))
                .sort((a, b) => a.timestamp - b.timestamp)

            // Agréger par provider
            const statsByProvider = {
                maptiler: { total: 0, success: 0, errors: 0, requests: [] },
                mapbox: { total: 0, success: 0, errors: 0, requests: [] },
                googlesheets: { total: 0, success: 0, errors: 0, requests: [] },
                backend: { total: 0, success: 0, errors: 0, requests: [] }
            }

            // Compter les requêtes par provider
            requests.forEach(req => {
                const provider = req.provider
                if (statsByProvider[provider]) {
                    statsByProvider[provider].total++
                    if (req.success) {
                        statsByProvider[provider].success++
                    } else {
                        statsByProvider[provider].errors++
                    }
                }
            })

            // Calculer les totaux globaux
            const totals = {
                total: requests.length,
                success: requests.filter(r => r.success).length,
                errors: requests.filter(r => !r.success).length
            }

            // Compter les utilisateurs uniques
            const uniqueSessions = new Set(requests.map(r => r.sessionId).filter(Boolean))
            const uniqueUsers = new Set(requests.map(r => r.userName).filter(Boolean))

            res.json({
                success: true,
                data: {
                    stats: statsByProvider,
                    totals,
                    history: requests.slice(-1000), // Dernières 1000 requêtes
                    maptilerReferences,
                    uniqueSessions: uniqueSessions.size,
                    uniqueUsers: uniqueUsers.size,
                    totalRequests: requests.length
                }
            })
        } catch (error) {
            console.error('❌ Erreur récupération stats agrégées:', error)
            res.status(500).json({
                success: false,
                error: error.message
            })
        }
    }
}

module.exports = AnalyticsController

