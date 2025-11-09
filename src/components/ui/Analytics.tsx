/**
 * Analytics Dashboard - Suivi des requêtes API
 * 
 * Dashboard desktop pour visualiser les statistiques d'utilisation des APIs
 * 
 * @author FOMO MVP Team
 */

import { useState, useEffect, useCallback } from 'react'
import { analyticsTracker, type ApiProvider } from '@/utils/analyticsTracker'
import { getApiBaseUrl } from '@/config/env'
import { getSessionId, getUserName } from '@/utils/getSessionId'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface AnalyticsProps {
    onClose?: () => void
}

interface AggregatedData {
    stats: Record<ApiProvider, { total: number; success: number; errors: number; requests: any[] }>
    totals: { total: number; success: number; errors: number }
    history: Array<{
        timestamp: string
        provider: string
        endpoint: string
        method: string
        success: boolean
        error: string
        sessionId: string
        userName: string
    }>
    maptilerReferences: Array<{
        timestamp: number
        value: number
        note: string
        sessionId: string
        userName: string
    }>
    uniqueSessions: number
    uniqueUsers: number
    totalRequests: number
}

interface OnboardingStats {
    totalSessions: number
    completedSessions: number
    abandonedSessions: number
    averageDuration: number | null
    averageSteps: number
    abandonmentRate: number
    stepAverages: Record<string, number>
    abandonmentPoints: Record<string, number>
    sessions: Array<{
        sessionId: string
        startTime: string
        endTime: string | null
        completed: boolean
        abandonedAt: string | null
        totalDuration: string | null
        stepsCount: string
        lastStep: string | null
    }>
    steps: Array<{
        sessionId: string
        step: string
        timestamp: string
        timeSinceStart: string
        timeSinceLastStep: string | null
    }>
}

const Analytics: React.FC<AnalyticsProps> = ({ onClose }) => {
    const [aggregatedData, setAggregatedData] = useState<AggregatedData | null>(null)
    const [onboardingStats, setOnboardingStats] = useState<OnboardingStats | null>(null)
    const [selectedProvider, setSelectedProvider] = useState<ApiProvider | 'all'>('all')
    const [maptilerInputValue, setMapTilerInputValue] = useState<string>('')
    const [maptilerNote, setMapTilerNote] = useState<string>('')
    const [loading, setLoading] = useState<boolean>(false)
    const [onboardingLoading, setOnboardingLoading] = useState<boolean>(false)

    const loadData = useCallback(async () => {
        // Charger les données agrégées depuis Google Sheets
        setLoading(true)
        try {
            const apiUrl = getApiBaseUrl()
            const response = await fetch(`${apiUrl}/analytics/aggregated`)
            const result = await response.json()
            if (result.success) {
                setAggregatedData(result.data)
            } else {
                console.warn('⚠️ Erreur chargement données agrégées:', result.error)
            }
        } catch (error) {
            console.warn('⚠️ Erreur chargement données agrégées:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    const loadOnboardingData = useCallback(async () => {
        // Charger les données d'onboarding depuis Google Sheets
        setOnboardingLoading(true)
        try {
            const apiUrl = getApiBaseUrl()
            const response = await fetch(`${apiUrl}/onboarding/aggregated`)
            const result = await response.json()
            if (result.success) {
                setOnboardingStats(result.data)
            } else {
                console.warn('⚠️ Erreur chargement données onboarding:', result.error)
            }
        } catch (error) {
            console.warn('⚠️ Erreur chargement données onboarding:', error)
        } finally {
            setOnboardingLoading(false)
        }
    }, [])

    useEffect(() => {
        loadData()
        loadOnboardingData()

        // Auto-refresh toutes les heures
        const interval = setInterval(() => {
            loadData()
            loadOnboardingData()
        }, 60 * 60 * 1000) // 1 heure

        // Note: La sauvegarde automatique est gérée par autoSaveAnalytics dans main.tsx
        // Elle fonctionne même si le dashboard n'est pas ouvert

        return () => {
            clearInterval(interval)
        }
    }, [loadData, loadOnboardingData])

    const handleAddMapTilerReference = async () => {
        const value = parseInt(maptilerInputValue, 10)
        if (isNaN(value) || value < 0) {
            alert('Veuillez entrer un nombre valide')
            return
        }

        analyticsTracker.addMapTilerReference(value, maptilerNote || undefined)
        setMapTilerInputValue('')
        setMapTilerNote('')

        // Sauvegarder dans Google Sheets d'abord
        await saveAnalyticsToBackend()
        
        // Puis recharger les données depuis le backend
        await loadData()
    }

    const saveAnalyticsToBackend = useCallback(async () => {
        try {
            const stats = analyticsTracker.getStats()

            // Ne sauvegarder que s'il y a des données à sauvegarder
            if (stats.history.length === 0 && stats.maptilerReferences.length === 0) {
                return
            }

            const apiUrl = getApiBaseUrl()

            // Limiter la taille du payload pour éviter l'erreur 413 (Payload Too Large)
            // Garder seulement les 500 dernières requêtes de l'historique
            const MAX_HISTORY_TO_SEND = 500
            const limitedHistory = stats.history.length > MAX_HISTORY_TO_SEND
                ? stats.history.slice(-MAX_HISTORY_TO_SEND)
                : stats.history

            // Réduire aussi les requêtes détaillées dans les stats pour chaque provider
            const limitedStats = { ...stats.stats }
            Object.keys(limitedStats).forEach(provider => {
                const providerStats = limitedStats[provider as keyof typeof limitedStats]
                if (providerStats.requests && providerStats.requests.length > 50) {
                    limitedStats[provider as keyof typeof limitedStats] = {
                        ...providerStats,
                        requests: providerStats.requests.slice(-50)
                    }
                }
            })

            const payload = {
                sessionId: getSessionId(),
                userName: getUserName(),
                stats: limitedStats,
                history: limitedHistory,
                maptilerReferences: stats.maptilerReferences
            }

            // Vérifier la taille approximative du payload (en bytes)
            const payloadSize = new Blob([JSON.stringify(payload)]).size
            const MAX_PAYLOAD_SIZE = 500 * 1024 // 500 KB

            if (payloadSize > MAX_PAYLOAD_SIZE) {
                // Réduire encore plus l'historique si nécessaire
                const targetHistorySize = Math.floor((MAX_PAYLOAD_SIZE * 0.7) / 200) // ~200 bytes par requête
                const furtherLimitedHistory = limitedHistory.slice(-targetHistorySize)
                payload.history = furtherLimitedHistory
                console.warn(`⚠️ [Analytics] Payload trop volumineux (${Math.round(payloadSize / 1024)} KB), réduction à ${furtherLimitedHistory.length} requêtes`)
            }

            const response = await fetch(`${apiUrl}/analytics/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            })

            if (!response.ok) {
                if (response.status === 413) {
                    console.warn('⚠️ [Analytics] Payload trop volumineux (413), données tronquées')
                    return
                }
                const errorText = await response.text()
                let errorData
                try {
                    errorData = JSON.parse(errorText)
                } catch {
                    errorData = { error: errorText }
                }
                console.warn('⚠️ [Analytics] Erreur sauvegarde:', errorData.error || `HTTP ${response.status}`)
                return
            }

            const result = await response.json()
            if (result.success) {
                // Vider le cache après sauvegarde réussie
                analyticsTracker.clearSavedHistory()
                console.log('✅ Analytics sauvegardées dans Google Sheets et cache vidé')
            } else {
                console.warn('⚠️ Erreur sauvegarde:', result.error)
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            if (errorMessage.includes('413') || errorMessage.includes('Payload Too Large')) {
                console.warn('⚠️ [Analytics] Payload trop volumineux, données non sauvegardées')
            } else {
                console.warn('⚠️ Erreur sauvegarde analytics dans Google Sheets:', errorMessage)
            }
        }
    }, [])

    // Note: La sauvegarde automatique avec debounce est gérée par autoSaveAnalytics dans main.tsx

    if (loading) {
        return (
            <div className="analytics-container">
                <div className="analytics-loading">Chargement des statistiques...</div>
            </div>
        )
    }

    if (!aggregatedData) {
        return (
            <div className="analytics-container">
                <div className="analytics-loading">Aucune donnée disponible</div>
            </div>
        )
    }

    const providers: ApiProvider[] = ['maptiler', 'mapbox', 'googlesheets', 'backend']
    const providerLabels: Record<ApiProvider, string> = {
        maptiler: 'MapTiler',
        mapbox: 'Mapbox',
        googlesheets: 'Google Sheets',
        backend: 'Backend API'
    }

    const providerColors: Record<ApiProvider, string> = {
        maptiler: '#3B82F6',
        mapbox: '#4269F1',
        googlesheets: '#10B981',
        backend: '#8B5CF6'
    }

    // Calculer les totaux
    const totals = aggregatedData.totals

    // Filtrer l'historique
    const history = selectedProvider === 'all'
        ? aggregatedData.history.slice(-50)
        : aggregatedData.history.filter(r => r.provider === selectedProvider).slice(-50)

    // Stats par provider
    const getProviderStats = (provider: ApiProvider) => {
        return aggregatedData.stats[provider] || { total: 0, success: 0, errors: 0, requests: [] }
    }

    return (
        <div className="analytics-container">
            <div className="analytics-header">
                <h2 className="analytics-title">
                    📊 Analytics Dashboard
                </h2>
                <div className="analytics-header-actions">
                    <button
                        className="analytics-btn-secondary"
                        onClick={loadData}
                        title="Actualiser"
                    >
                        🔄 Actualiser
                    </button>
                    <button
                        className="analytics-btn-secondary"
                        onClick={saveAnalyticsToBackend}
                        title="Sauvegarder dans Google Sheets"
                    >
                        💾 Sauvegarder
                    </button>
                    {onClose && (
                        <button
                            className="analytics-btn-close"
                            onClick={onClose}
                            title="Fermer"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Stats globales */}
            <div className="analytics-stats-grid">
                <div className="analytics-stat-card">
                    <div className="analytics-stat-label">Total Requêtes</div>
                    <div className="analytics-stat-value">{totals.total.toLocaleString()}</div>
                </div>
                <div className="analytics-stat-card analytics-stat-success">
                    <div className="analytics-stat-label">Succès</div>
                    <div className="analytics-stat-value">{totals.success.toLocaleString()}</div>
                    <div className="analytics-stat-percent">
                        {totals.total > 0 ? ((totals.success / totals.total) * 100).toFixed(1) : 0}%
                    </div>
                </div>
                <div className="analytics-stat-card analytics-stat-error">
                    <div className="analytics-stat-label">Erreurs</div>
                    <div className="analytics-stat-value">{totals.errors.toLocaleString()}</div>
                    <div className="analytics-stat-percent">
                        {totals.total > 0 ? ((totals.errors / totals.total) * 100).toFixed(1) : 0}%
                    </div>
                </div>
                <div className="analytics-stat-card">
                    <div className="analytics-stat-label">Utilisateurs Uniques</div>
                    <div className="analytics-stat-value">{aggregatedData.uniqueUsers}</div>
                </div>
                <div className="analytics-stat-card">
                    <div className="analytics-stat-label">Sessions Uniques</div>
                    <div className="analytics-stat-value">{aggregatedData.uniqueSessions}</div>
                </div>
            </div>

            {/* Stats par provider */}
            <div className="analytics-section">
                <h3 className="analytics-section-title">Par Provider</h3>
                <div className="analytics-providers-grid">
                    {providers.map(provider => {
                        const stats = getProviderStats(provider)
                        const successRate = stats.total > 0 ? (stats.success / stats.total) * 100 : 0

                        return (
                            <div
                                key={provider}
                                className="analytics-provider-card"
                                style={{ borderLeftColor: providerColors[provider] }}
                                onClick={() => setSelectedProvider(selectedProvider === provider ? 'all' : provider)}
                            >
                                <div className="analytics-provider-header">
                                    <div className="analytics-provider-name">
                                        {providerLabels[provider]}
                                    </div>
                                    <div className="analytics-provider-badge" style={{ backgroundColor: providerColors[provider] }}>
                                        {stats.total}
                                    </div>
                                </div>
                                <div className="analytics-provider-stats">
                                    <div className="analytics-provider-stat">
                                        <span className="analytics-provider-stat-label">Succès:</span>
                                        <span className="analytics-provider-stat-value analytics-success">
                                            {stats.success}
                                        </span>
                                    </div>
                                    <div className="analytics-provider-stat">
                                        <span className="analytics-provider-stat-label">Erreurs:</span>
                                        <span className="analytics-provider-stat-value analytics-error">
                                            {stats.errors}
                                        </span>
                                    </div>
                                    <div className="analytics-provider-stat">
                                        <span className="analytics-provider-stat-label">Taux:</span>
                                        <span className="analytics-provider-stat-value">
                                            {successRate.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                                {(() => {
                                    const lastRequest = 'lastRequest' in stats ? stats.lastRequest : null
                                    return lastRequest && typeof lastRequest === 'number' ? (
                                        <div className="analytics-provider-last">
                                            Dernière: {new Date(lastRequest).toLocaleTimeString()}
                                        </div>
                                    ) : null
                                })()}
                            </div>
                        )
                    })}
                </div>
            </div>


            {/* Comparaison MapTiler */}
            <div className="analytics-section">
                <h3 className="analytics-section-title">Comparaison MapTiler</h3>

                <div className="analytics-comparison-controls">
                    <div className="analytics-input-group">
                        <label htmlFor="maptiler-value" className="analytics-input-label">
                            Valeur MapTiler (depuis leur dashboard)
                        </label>
                        <div className="analytics-input-row">
                            <input
                                id="maptiler-value"
                                type="number"
                                min="0"
                                value={maptilerInputValue}
                                onChange={(e) => setMapTilerInputValue(e.target.value)}
                                placeholder="Ex: 1250"
                                className="analytics-input"
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        handleAddMapTilerReference()
                                    }
                                }}
                            />
                            <input
                                type="text"
                                value={maptilerNote}
                                onChange={(e) => setMapTilerNote(e.target.value)}
                                placeholder="Note (optionnel)"
                                className="analytics-input analytics-input-note"
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        handleAddMapTilerReference()
                                    }
                                }}
                            />
                            <button
                                onClick={handleAddMapTilerReference}
                                className="analytics-btn-primary"
                                disabled={!maptilerInputValue}
                            >
                                Enregistrer
                            </button>
                        </div>
                    </div>
                </div>

                {/* Graphique de comparaison */}
                <div className="analytics-comparison-chart-container">
                    {(() => {
                        // Recalculer la comparaison avec les données globales
                        const maptilerRequests = aggregatedData.history.filter(r => r.provider === 'maptiler')
                        const sortedRefs = [...aggregatedData.maptilerReferences].sort((a, b) => a.timestamp - b.timestamp)
                        const initialRef = sortedRefs[0]
                        const initialValue = initialRef?.value || 104684
                        const initialDate = initialRef
                            ? new Date(initialRef.timestamp).toISOString().split('T')[0]
                            : new Date().toISOString().split('T')[0]

                        // Grouper par date
                        const dailyData = new Map<string, { tracked: number; reference: number | null }>()
                        maptilerRequests.forEach(req => {
                            const reqDate = new Date(req.timestamp).toISOString().split('T')[0]
                            if (reqDate >= initialDate) {
                                const existing = dailyData.get(reqDate) || { tracked: 0, reference: null }
                                existing.tracked++
                                dailyData.set(reqDate, existing)
                            }
                        })

                        sortedRefs.forEach(ref => {
                            const date = new Date(ref.timestamp).toISOString().split('T')[0]
                            const existing = dailyData.get(date) || { tracked: 0, reference: null }
                            existing.reference = ref.value
                            dailyData.set(date, existing)
                        })

                        let cumulativeTracked = 0
                        const comparisonData = Array.from(dailyData.entries())
                            .map(([date, data]) => {
                                cumulativeTracked += data.tracked
                                const trackedCumulative = initialValue + cumulativeTracked
                                const referenceCumulative = data.reference !== null ? data.reference : null

                                return {
                                    date,
                                    dateTime: new Date(date).getTime(),
                                    tracked: data.tracked,
                                    reference: data.reference,
                                    trackedCumulative,
                                    referenceCumulative
                                }
                            })
                            .sort((a, b) => a.dateTime - b.dateTime)

                        if (comparisonData.length === 0) {
                            return (
                                <div className="analytics-empty">
                                    Aucune donnée de comparaison. Enregistrez une valeur MapTiler pour commencer.
                                </div>
                            )
                        }

                        // Préparer les données pour le graphique XY
                        const chartData = comparisonData.map((item) => {
                            const dateObj = new Date(item.date)
                            return {
                                date: item.date,
                                dateLabel: dateObj.toLocaleDateString('fr-FR', {
                                    day: '2-digit',
                                    month: '2-digit'
                                }),
                                notreCompteur: item.trackedCumulative,
                                maptiler: item.referenceCumulative !== null ? item.referenceCumulative : null
                            }
                        })

                        return (
                            <>
                                <div className="analytics-comparison-chart">
                                    <ResponsiveContainer width="100%" height={400}>
                                        <LineChart
                                            data={chartData}
                                            margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                            <XAxis
                                                dataKey="dateLabel"
                                                angle={-45}
                                                textAnchor="end"
                                                height={80}
                                                stroke="var(--text-secondary)"
                                                style={{ fontSize: '12px' }}
                                            />
                                            <YAxis
                                                stroke="var(--text-secondary)"
                                                style={{ fontSize: '12px' }}
                                                tickFormatter={(value) => value.toLocaleString()}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'var(--surface)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 'var(--radius)',
                                                    color: 'var(--text)'
                                                }}
                                                formatter={(value: unknown, name: string) => {
                                                    if (value === null || value === undefined) return ['N/A', name]
                                                    const numValue = typeof value === 'number' ? value : Number(value)
                                                    if (isNaN(numValue)) return ['N/A', name]
                                                    return [numValue.toLocaleString(), name]
                                                }}
                                                labelFormatter={(label) => {
                                                    const item = chartData.find(d => d.dateLabel === label)
                                                    return item ? new Date(item.date).toLocaleDateString('fr-FR', {
                                                        weekday: 'long',
                                                        day: '2-digit',
                                                        month: 'long',
                                                        year: 'numeric'
                                                    }) : label
                                                }}
                                            />
                                            <Legend
                                                wrapperStyle={{ paddingTop: '20px' }}
                                                formatter={(value) => {
                                                    if (value === 'notreCompteur') return 'Notre compteur'
                                                    if (value === 'maptiler') return 'MapTiler'
                                                    return value
                                                }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="notreCompteur"
                                                stroke="var(--primary)"
                                                strokeWidth={2}
                                                dot={{ r: 4 }}
                                                name="notreCompteur"
                                                connectNulls={false}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="maptiler"
                                                stroke="var(--success)"
                                                strokeWidth={2}
                                                dot={{ r: 4 }}
                                                name="maptiler"
                                                connectNulls={false}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="analytics-comparison-legend">
                                    <div className="analytics-legend-item">
                                        <div className="analytics-legend-color" style={{ backgroundColor: 'var(--primary)' }}></div>
                                        <span>Notre compteur (cumulatif)</span>
                                    </div>
                                    <div className="analytics-legend-item">
                                        <div className="analytics-legend-color" style={{ backgroundColor: 'var(--success)' }}></div>
                                        <span>MapTiler (valeurs enregistrées)</span>
                                    </div>
                                </div>
                            </>
                        )
                    })()}
                </div>

                {/* Liste des valeurs de référence */}
                {(() => {
                    const references = aggregatedData.maptilerReferences

                    if (references.length === 0) return null

                    return (
                        <div className="analytics-references-list">
                            <h4 className="analytics-references-title">Valeurs enregistrées</h4>
                            <table className="analytics-history-table">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Valeur MapTiler</th>
                                        <th>Notre compteur</th>
                                        <th>Différence</th>
                                        <th>Note</th>
                                        <th>Utilisateur</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {references.slice().reverse().map((ref) => {
                                        const date = new Date(ref.timestamp)

                                        // Trouver la valeur initiale (première référence)
                                        const sortedRefs = references.sort((a, b) => a.timestamp - b.timestamp)
                                        const initialRef = sortedRefs[0]
                                        const initialValue = initialRef?.value || 104684
                                        const initialDate = initialRef
                                            ? new Date(initialRef.timestamp).toISOString().split('T')[0]
                                            : new Date().toISOString().split('T')[0]

                                        // Compter les requêtes depuis la date initiale jusqu'à cette référence
                                        const refDate = new Date(ref.timestamp).toISOString().split('T')[0]
                                        const trackedSinceStart = aggregatedData.history.filter(r => {
                                            if (r.provider !== 'maptiler') return false
                                            const reqDate = new Date(r.timestamp).toISOString().split('T')[0]
                                            return reqDate >= initialDate && reqDate <= refDate
                                        }).length

                                        // Valeur cumulée trackée = valeur initiale + requêtes trackées
                                        const trackedCumulative = initialValue + trackedSinceStart

                                        // Différence = valeur MapTiler officielle - notre valeur cumulée
                                        const diff = ref.value - trackedCumulative

                                        return (
                                            <tr key={ref.timestamp}>
                                                <td>{date.toLocaleString('fr-FR')}</td>
                                                <td className="analytics-reference-value">{ref.value.toLocaleString()}</td>
                                                <td className="analytics-reference-tracked">{trackedCumulative.toLocaleString()}</td>
                                                <td className={diff !== 0 ? 'analytics-reference-diff' : ''}>
                                                    {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                                                </td>
                                                <td className="analytics-reference-note">{ref.note || '-'}</td>
                                                <td className="analytics-reference-user">
                                                    {(ref as any).userName || (ref as any).sessionId || '-'}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                })()}
            </div>

            {/* Section Onboarding */}
            <div className="analytics-section">
                <h3 className="analytics-section-title">📈 Onboarding - Parcours d'intégration</h3>
                
                {onboardingLoading ? (
                    <div className="analytics-loading">Chargement des statistiques d'onboarding...</div>
                ) : onboardingStats ? (
                    <>
                        {/* Stats globales onboarding */}
                        <div className="analytics-stats-grid">
                            <div className="analytics-stat-card">
                                <div className="analytics-stat-label">Total Sessions</div>
                                <div className="analytics-stat-value">{onboardingStats.totalSessions.toLocaleString()}</div>
                            </div>
                            <div className="analytics-stat-card analytics-stat-success">
                                <div className="analytics-stat-label">Sessions Complétées</div>
                                <div className="analytics-stat-value">{onboardingStats.completedSessions.toLocaleString()}</div>
                                <div className="analytics-stat-percent">
                                    {onboardingStats.totalSessions > 0 
                                        ? ((onboardingStats.completedSessions / onboardingStats.totalSessions) * 100).toFixed(1) 
                                        : 0}%
                                </div>
                            </div>
                            <div className="analytics-stat-card analytics-stat-error">
                                <div className="analytics-stat-label">Sessions Abandonnées</div>
                                <div className="analytics-stat-value">{onboardingStats.abandonedSessions.toLocaleString()}</div>
                                <div className="analytics-stat-percent">
                                    {onboardingStats.abandonmentRate.toFixed(1)}%
                                </div>
                            </div>
                            <div className="analytics-stat-card">
                                <div className="analytics-stat-label">Durée Moyenne</div>
                                <div className="analytics-stat-value">
                                    {onboardingStats.averageDuration !== null
                                        ? `${Math.round(onboardingStats.averageDuration / 1000)}s`
                                        : 'N/A'}
                                </div>
                            </div>
                            <div className="analytics-stat-card">
                                <div className="analytics-stat-label">Étapes Moyennes</div>
                                <div className="analytics-stat-value">{onboardingStats.averageSteps.toFixed(1)}</div>
                            </div>
                        </div>

                        {/* Graphique des temps moyens par étape */}
                        {Object.keys(onboardingStats.stepAverages).length > 0 && (
                            <div className="analytics-comparison-chart-container" style={{ marginTop: 'var(--lg)' }}>
                                <h4 className="analytics-references-title" style={{ marginBottom: 'var(--md)' }}>
                                    Temps moyen par étape (en secondes)
                                </h4>
                                <div className="analytics-comparison-chart">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart
                                            data={Object.entries(onboardingStats.stepAverages)
                                                .map(([step, time]) => ({
                                                    step: step.replace(/_/g, ' '),
                                                    time: Math.round(time / 1000) // Convertir en secondes
                                                }))
                                                .sort((a, b) => a.time - b.time)}
                                            margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                            <XAxis
                                                dataKey="step"
                                                angle={-45}
                                                textAnchor="end"
                                                height={100}
                                                stroke="var(--text-secondary)"
                                                style={{ fontSize: '11px' }}
                                            />
                                            <YAxis
                                                stroke="var(--text-secondary)"
                                                style={{ fontSize: '12px' }}
                                                label={{ value: 'Temps (s)', angle: -90, position: 'insideLeft' }}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'var(--surface)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 'var(--radius)',
                                                    color: 'var(--text)'
                                                }}
                                                formatter={(value: unknown) => [`${value}s`, 'Temps moyen']}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="time"
                                                stroke="var(--primary)"
                                                strokeWidth={2}
                                                dot={{ r: 4 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* Points d'abandon */}
                        {Object.keys(onboardingStats.abandonmentPoints).length > 0 && (
                            <div className="analytics-comparison-chart-container" style={{ marginTop: 'var(--lg)' }}>
                                <h4 className="analytics-references-title" style={{ marginBottom: 'var(--md)' }}>
                                    Points d'abandon (où les utilisateurs quittent)
                                </h4>
                                <div className="analytics-comparison-chart">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart
                                            data={Object.entries(onboardingStats.abandonmentPoints)
                                                .map(([step, count]) => ({
                                                    step: step.replace(/_/g, ' '),
                                                    count
                                                }))
                                                .sort((a, b) => b.count - a.count)}
                                            margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                            <XAxis
                                                dataKey="step"
                                                angle={-45}
                                                textAnchor="end"
                                                height={100}
                                                stroke="var(--text-secondary)"
                                                style={{ fontSize: '11px' }}
                                            />
                                            <YAxis
                                                stroke="var(--text-secondary)"
                                                style={{ fontSize: '12px' }}
                                                label={{ value: 'Nombre d\'abandons', angle: -90, position: 'insideLeft' }}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'var(--surface)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 'var(--radius)',
                                                    color: 'var(--text)'
                                                }}
                                                formatter={(value: unknown) => {
                                                    const numValue = typeof value === 'number' ? value : Number(value)
                                                    return [isNaN(numValue) ? 'N/A' : numValue.toString(), 'Abandons']
                                                }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="count"
                                                stroke="var(--error)"
                                                strokeWidth={2}
                                                dot={{ r: 4 }}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        )}

                        {/* Graphique évolution du temps de session dans le temps */}
                        {onboardingStats.sessions.length > 0 && (
                            <div className="analytics-comparison-chart-container" style={{ marginTop: 'var(--lg)' }}>
                                <h4 className="analytics-references-title" style={{ marginBottom: 'var(--md)' }}>
                                    Évolution des durées de session (dernières sessions)
                                </h4>
                                <div className="analytics-comparison-chart">
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart
                                            data={(() => {
                                                const lastSessions = onboardingStats.sessions.slice(-50)
                                                const startIndex = Math.max(0, onboardingStats.sessions.length - 50)
                                                return lastSessions.map((session, index) => ({
                                                    session: `#${startIndex + index + 1}`,
                                                    duration: session.totalDuration ? Math.round(parseFloat(session.totalDuration) / 1000) : null,
                                                    completed: session.completed
                                                }))
                                            })()}
                                            margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                            <XAxis
                                                dataKey="session"
                                                angle={-45}
                                                textAnchor="end"
                                                height={80}
                                                stroke="var(--text-secondary)"
                                                style={{ fontSize: '11px' }}
                                            />
                                            <YAxis
                                                stroke="var(--text-secondary)"
                                                style={{ fontSize: '12px' }}
                                                label={{ value: 'Durée (s)', angle: -90, position: 'insideLeft' }}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'var(--surface)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: 'var(--radius)',
                                                    color: 'var(--text)'
                                                }}
                                                formatter={(value: unknown) => {
                                                    if (value === null || value === undefined) return ['N/A', 'Durée']
                                                    const numValue = typeof value === 'number' ? value : Number(value)
                                                    return [isNaN(numValue) ? 'N/A' : `${numValue}s`, 'Durée']
                                                }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="duration"
                                                stroke="var(--primary)"
                                                strokeWidth={2}
                                                dot={(props: any) => {
                                                    const { payload } = props
                                                    return (
                                                        <circle
                                                            cx={props.cx}
                                                            cy={props.cy}
                                                            r={4}
                                                            fill={payload.completed ? 'var(--success)' : 'var(--error)'}
                                                        />
                                                    )
                                                }}
                                                connectNulls={false}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                                <div className="analytics-comparison-legend" style={{ marginTop: 'var(--md)' }}>
                                    <div className="analytics-legend-item">
                                        <div className="analytics-legend-color" style={{ backgroundColor: 'var(--success)' }}></div>
                                        <span>Sessions complétées</span>
                                    </div>
                                    <div className="analytics-legend-item">
                                        <div className="analytics-legend-color" style={{ backgroundColor: 'var(--error)' }}></div>
                                        <span>Sessions abandonnées</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="analytics-empty">Aucune donnée d'onboarding disponible</div>
                )}
            </div>

            {/* Historique récent */}
            <div className="analytics-section">
                <h3 className="analytics-section-title">
                    Historique récent {selectedProvider !== 'all' && `(${providerLabels[selectedProvider]})`}
                </h3>
                <div className="analytics-history-container">
                    {history.length === 0 ? (
                        <div className="analytics-empty">Aucune requête récente</div>
                    ) : (
                        <table className="analytics-history-table">
                            <thead>
                                <tr>
                                    <th>Heure</th>
                                    <th>Provider</th>
                                    <th>Endpoint</th>
                                    <th>Méthode</th>
                                    <th>Statut</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((request, index) => (
                                    <tr key={index}>
                                        <td>{new Date(request.timestamp).toLocaleTimeString()}</td>
                                        <td>
                                            <span
                                                className="analytics-history-provider"
                                                style={{ backgroundColor: providerColors[request.provider as ApiProvider] || '#666' }}
                                            >
                                                {providerLabels[request.provider as ApiProvider] || request.provider}
                                            </span>
                                        </td>
                                        <td className="analytics-history-endpoint">
                                            {request.endpoint.length > 40
                                                ? `${request.endpoint.substring(0, 40)}...`
                                                : request.endpoint}
                                        </td>
                                        <td>{request.method || 'GET'}</td>
                                        <td>
                                            {request.success ? (
                                                <span className="analytics-status-success">✅</span>
                                            ) : (
                                                <span className="analytics-status-error" title={request.error}>
                                                    ❌
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Analytics

