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

const Analytics: React.FC<AnalyticsProps> = ({ onClose }) => {
    const [aggregatedData, setAggregatedData] = useState<AggregatedData | null>(null)
    const [selectedProvider, setSelectedProvider] = useState<ApiProvider | 'all'>('all')
    const [maptilerInputValue, setMapTilerInputValue] = useState<string>('')
    const [maptilerNote, setMapTilerNote] = useState<string>('')
    const [loading, setLoading] = useState<boolean>(false)

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

    useEffect(() => {
        loadData()

        // Auto-refresh toutes les heures
        const interval = setInterval(() => {
            loadData()
        }, 60 * 60 * 1000) // 1 heure

        // Note: La sauvegarde automatique est gérée par autoSaveAnalytics dans main.tsx
        // Elle fonctionne même si le dashboard n'est pas ouvert

        return () => {
            clearInterval(interval)
        }
    }, [loadData])

    const handleAddMapTilerReference = async () => {
        const value = parseInt(maptilerInputValue, 10)
        if (isNaN(value) || value < 0) {
            alert('Veuillez entrer un nombre valide')
            return
        }

        analyticsTracker.addMapTilerReference(value, maptilerNote || undefined)
        setMapTilerInputValue('')
        setMapTilerNote('')
        loadData()

        // Sauvegarder dans Google Sheets
        await saveAnalyticsToBackend()
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
                console.log('✅ Analytics sauvegardées dans Google Sheets (automatique)')
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
                    <div className="analytics-comparison-chart">
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

                            // Calculer les variations en pourcentage pour chaque jour
                            const dataWithPercentages = comparisonData.map((item) => {
                                const variation = item.referenceCumulative !== null
                                    ? item.referenceCumulative - item.trackedCumulative
                                    : null

                                // Calculer le pourcentage de variation par rapport à notre compteur
                                const percentage = item.trackedCumulative > 0 && variation !== null
                                    ? (variation / item.trackedCumulative) * 100
                                    : null

                                return {
                                    ...item,
                                    variation,
                                    percentage
                                }
                            })

                            // Trouver la valeur max de pourcentage absolue pour l'échelle
                            const percentages = dataWithPercentages
                                .map(d => d.percentage !== null ? Math.abs(d.percentage) : 0)
                                .filter(p => p > 0)
                            const maxPercentage = Math.max(...percentages, 1)

                            return dataWithPercentages.map((item, index) => {
                                const { variation, percentage } = item

                                // Hauteur de la barre = pourcentage absolu
                                const barHeight = percentage !== null && maxPercentage > 0
                                    ? (Math.abs(percentage) / maxPercentage) * 100
                                    : 0

                                // Couleur : vert si positif (MapTiler > nous), rouge si négatif (nous > MapTiler)
                                const isPositive = percentage !== null && percentage > 0
                                const isNegative = percentage !== null && percentage < 0

                                return (
                                    <div key={index} className="analytics-comparison-bar-container">
                                        <div className="analytics-comparison-bars">
                                            {percentage !== null ? (
                                                <div
                                                    className={`analytics-comparison-bar ${isPositive ? 'analytics-comparison-bar-positive' :
                                                        isNegative ? 'analytics-comparison-bar-negative' :
                                                            'analytics-comparison-bar-zero'
                                                        }`}
                                                    style={{ height: `${barHeight}%` }}
                                                    title={`Variation: ${percentage > 0 ? '+' : ''}${percentage.toFixed(2)}%\nÉcart: ${variation !== null ? (variation > 0 ? '+' : '') + variation.toLocaleString() : 'N/A'} requêtes\nMapTiler: ${item.referenceCumulative?.toLocaleString()}\nNotre compteur: ${item.trackedCumulative.toLocaleString()}`}
                                                />
                                            ) : (
                                                <div
                                                    className="analytics-comparison-bar analytics-comparison-bar-no-data"
                                                    style={{ height: '2px' }}
                                                    title="Pas de valeur MapTiler pour ce jour"
                                                />
                                            )}
                                        </div>
                                        <div className="analytics-comparison-label">
                                            <div className="analytics-comparison-date">
                                                {new Date(item.date).toLocaleDateString('fr-FR', {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    weekday: 'short'
                                                })}
                                            </div>
                                            <div className="analytics-comparison-values">
                                                {percentage !== null ? (
                                                    <span className={
                                                        isPositive ? 'analytics-comparison-value-positive' :
                                                            isNegative ? 'analytics-comparison-value-negative' :
                                                                'analytics-comparison-value-zero'
                                                    }>
                                                        {percentage > 0 ? '+' : ''}{percentage.toFixed(1)}%
                                                    </span>
                                                ) : (
                                                    <span className="analytics-comparison-value-no-data">-</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        })()}
                    </div>
                    <div className="analytics-comparison-legend">
                        <div className="analytics-legend-item">
                            <div className="analytics-legend-color analytics-legend-positive"></div>
                            <span>MapTiler &gt; Notre compteur (+%)</span>
                        </div>
                        <div className="analytics-legend-item">
                            <div className="analytics-legend-color analytics-legend-negative"></div>
                            <span>Notre compteur &gt; MapTiler (-%)</span>
                        </div>
                        <div className="analytics-legend-item">
                            <div className="analytics-legend-color analytics-legend-zero"></div>
                            <span>Égalité (0%)</span>
                        </div>
                        <div className="analytics-legend-note">
                            <small>Pourcentage calculé par rapport à notre compteur cumulé</small>
                        </div>
                    </div>
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

