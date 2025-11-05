/**
 * Analytics Tracker - Suivi des requêtes API
 * 
 * Tracke toutes les requêtes vers :
 * - MapTiler (tuiles de carte)
 * - Mapbox (géocodage)
 * - Google Sheets (backend)
 * - Backend API interne
 * 
 * @author FOMO MVP Team
 */

export type ApiProvider = 'maptiler' | 'mapbox' | 'googlesheets' | 'backend'

export interface ApiRequest {
    provider: ApiProvider
    endpoint: string
    method?: string
    timestamp: number
    success: boolean
    error?: string
}

export interface ApiStats {
    provider: ApiProvider
    total: number
    success: number
    errors: number
    lastRequest: number | null
    requests: ApiRequest[]
}

export interface MapTilerReference {
    timestamp: number
    value: number
    note?: string
}

export interface AnalyticsData {
    stats: Record<ApiProvider, ApiStats>
    history: ApiRequest[]
    startTime: number
    lastUpdate: number
    maptilerReferences: MapTilerReference[]
}

const STORAGE_KEY = 'fomo_analytics'
const MAX_HISTORY = 1000 // Limiter l'historique pour éviter de surcharger localStorage
const MAX_STATS_REQUESTS = 100 // Limiter les requêtes dans les stats détaillées

class AnalyticsTracker {
    private data: AnalyticsData

    constructor() {
        this.data = this.loadFromStorage()
    }

    private loadFromStorage(): AnalyticsData {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) {
                const parsed = JSON.parse(stored)
                // Vérifier que la structure est valide
                if (parsed && parsed.stats && parsed.history && parsed.startTime) {
                    // Migrer les anciennes données sans maptilerReferences
                    if (!parsed.maptilerReferences || parsed.maptilerReferences.length === 0) {
                        const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime()
                        parsed.maptilerReferences = [
                            {
                                timestamp: todayStart,
                                value: 104684,
                                note: 'Valeur initiale relevée sur le dashboard MapTiler'
                            }
                        ]
                    } else {
                        // Mettre à jour la valeur initiale si elle existe avec l'ancienne valeur (99340)
                        const sortedRefs = parsed.maptilerReferences.sort((a: any, b: any) => a.timestamp - b.timestamp)
                        const firstRef = sortedRefs[0]
                        if (firstRef && firstRef.value === 99340 && firstRef.note?.includes('Valeur initiale')) {
                            // Mettre à jour la valeur initiale à 104684
                            firstRef.value = 104684
                            firstRef.note = 'Valeur initiale relevée sur le dashboard MapTiler'
                            // Sauvegarder la mise à jour
                            try {
                                localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
                            } catch (error) {
                                console.warn('⚠️ [Analytics] Erreur sauvegarde mise à jour valeur initiale:', error)
                            }
                        }
                    }
                    return parsed
                }
            }
        } catch (error) {
            console.warn('⚠️ [Analytics] Erreur chargement localStorage:', error)
        }

        // Initialiser avec des stats vides
        const now = Date.now()
        // Date du jour à minuit pour la valeur initiale
        const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime()

        return {
            stats: {
                maptiler: this.createEmptyStats('maptiler'),
                mapbox: this.createEmptyStats('mapbox'),
                googlesheets: this.createEmptyStats('googlesheets'),
                backend: this.createEmptyStats('backend')
            },
            history: [],
            startTime: now,
            lastUpdate: now,
            maptilerReferences: [
                {
                    timestamp: todayStart,
                    value: 104684,
                    note: 'Valeur initiale relevée sur le dashboard MapTiler'
                }
            ]
        }
    }

    private createEmptyStats(provider: ApiProvider): ApiStats {
        return {
            provider,
            total: 0,
            success: 0,
            errors: 0,
            lastRequest: null,
            requests: []
        }
    }

    private saveToStorage(): void {
        try {
            // Limiter l'historique avant sauvegarde
            if (this.data.history.length > MAX_HISTORY) {
                this.data.history = this.data.history.slice(-MAX_HISTORY)
            }

            // Limiter les requêtes dans les stats détaillées
            Object.values(this.data.stats).forEach(stat => {
                if (stat.requests.length > MAX_STATS_REQUESTS) {
                    stat.requests = stat.requests.slice(-MAX_STATS_REQUESTS)
                }
            })

            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data))
        } catch (error) {
            console.warn('⚠️ [Analytics] Erreur sauvegarde localStorage:', error)
        }
    }

    /**
     * Enregistrer une requête API
     */
    trackRequest(
        provider: ApiProvider,
        endpoint: string,
        success: boolean,
        options?: {
            method?: string
            error?: string
        }
    ): void {
        const request: ApiRequest = {
            provider,
            endpoint,
            method: options?.method,
            timestamp: Date.now(),
            success,
            error: options?.error
        }

        // Ajouter à l'historique
        this.data.history.push(request)
        if (this.data.history.length > MAX_HISTORY) {
            this.data.history.shift()
        }

        // Mettre à jour les stats
        const stats = this.data.stats[provider]
        stats.total++
        if (success) {
            stats.success++
        } else {
            stats.errors++
        }
        stats.lastRequest = request.timestamp

        // Ajouter aux requêtes détaillées
        stats.requests.push(request)
        if (stats.requests.length > MAX_STATS_REQUESTS) {
            stats.requests.shift()
        }

        this.data.lastUpdate = Date.now()
        this.saveToStorage()

        // Déclencher un événement pour sauvegarde automatique si nécessaire
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('analytics-updated'))
        }
    }

    /**
     * Récupérer les stats complètes
     */
    getStats(): AnalyticsData {
        return { ...this.data }
    }

    /**
     * Récupérer les stats par provider
     */
    getStatsByProvider(provider: ApiProvider): ApiStats {
        return { ...this.data.stats[provider] }
    }

    /**
     * Récupérer les stats agrégées pour tous les providers
     */
    getAllStats(): Record<ApiProvider, ApiStats> {
        return { ...this.data.stats }
    }

    /**
     * Récupérer l'historique filtré
     */
    getHistory(filters?: {
        provider?: ApiProvider
        since?: number
        limit?: number
    }): ApiRequest[] {
        let history = [...this.data.history]

        if (filters?.provider) {
            history = history.filter(r => r.provider === filters.provider)
        }

        if (filters?.since) {
            history = history.filter(r => r.timestamp >= filters.since!)
        }

        if (filters?.limit) {
            history = history.slice(-filters.limit)
        }

        return history
    }

    /**
     * Obtenir les requêtes par période (pour graphiques)
     */
    getRequestsByPeriod(periodMs: number = 60000): Array<{ time: number; count: number; providers: Record<ApiProvider, number> }> {
        const now = Date.now()
        const periods: Array<{ time: number; count: number; providers: Record<ApiProvider, number> }> = []
        const periodCount = Math.floor((now - this.data.startTime) / periodMs) + 1

        // Initialiser les périodes
        for (let i = 0; i < periodCount; i++) {
            const time = this.data.startTime + (i * periodMs)
            periods.push({
                time,
                count: 0,
                providers: {
                    maptiler: 0,
                    mapbox: 0,
                    googlesheets: 0,
                    backend: 0
                }
            })
        }

        // Compter les requêtes par période
        this.data.history.forEach(request => {
            const periodIndex = Math.floor((request.timestamp - this.data.startTime) / periodMs)
            if (periodIndex >= 0 && periodIndex < periods.length) {
                periods[periodIndex].count++
                periods[periodIndex].providers[request.provider]++
            }
        })

        return periods
    }

    /**
     * Réinitialiser les stats
     */
    reset(): void {
        const now = Date.now()
        // Date du jour à minuit pour la valeur initiale
        const todayStart = new Date(new Date().setHours(0, 0, 0, 0)).getTime()

        this.data = {
            stats: {
                maptiler: this.createEmptyStats('maptiler'),
                mapbox: this.createEmptyStats('mapbox'),
                googlesheets: this.createEmptyStats('googlesheets'),
                backend: this.createEmptyStats('backend')
            },
            history: [],
            startTime: now,
            lastUpdate: now,
            maptilerReferences: [
                {
                    timestamp: todayStart,
                    value: 104684,
                    note: 'Valeur initiale relevée sur le dashboard MapTiler'
                }
            ]
        }
        this.saveToStorage()
    }

    /**
     * Obtenir le temps d'exécution depuis le début
     */
    getUptime(): number {
        return Date.now() - this.data.startTime
    }

    /**
     * Ajouter une valeur de référence MapTiler
     */
    addMapTilerReference(value: number, note?: string): void {
        const reference: MapTilerReference = {
            timestamp: Date.now(),
            value,
            note
        }
        this.data.maptilerReferences.push(reference)
        this.data.lastUpdate = Date.now()
        this.saveToStorage()

        // Déclencher un événement pour sauvegarde automatique
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('analytics-updated'))
        }
    }

    /**
     * Récupérer toutes les valeurs de référence MapTiler
     */
    getMapTilerReferences(): MapTilerReference[] {
        return [...this.data.maptilerReferences]
    }

    /**
     * Supprimer une valeur de référence MapTiler
     */
    removeMapTilerReference(timestamp: number): void {
        const beforeCount = this.data.maptilerReferences.length
        this.data.maptilerReferences = this.data.maptilerReferences.filter(
            ref => ref.timestamp !== timestamp
        )
        const afterCount = this.data.maptilerReferences.length

        if (beforeCount === afterCount) {
            console.warn(`⚠️ [Analytics] Référence avec timestamp ${timestamp} non trouvée pour suppression`)
            return
        }

        this.data.lastUpdate = Date.now()
        this.saveToStorage()
        console.log(`✅ [Analytics] Référence supprimée (timestamp: ${timestamp})`)

        // Déclencher un événement pour sauvegarde automatique
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('analytics-updated'))
        }
    }

    /**
     * Obtenir les données de comparaison pour le graphique
     * Retourne les valeurs trackées et les valeurs de référence par date
     * Les valeurs sont calculées par rapport à la valeur initiale (104684)
     */
    getComparisonData(): Array<{
        date: string
        dateTime: number
        tracked: number
        reference: number | null
        trackedCumulative: number
        referenceCumulative: number | null
    }> {
        const references = this.getMapTilerReferences()
        const trackedHistory = this.getHistory({ provider: 'maptiler' })

        // Trouver la valeur initiale (104684) - la première référence
        const initialReference = references.length > 0
            ? references.sort((a, b) => a.timestamp - b.timestamp)[0]
            : null

        const initialValue = initialReference?.value || 104684
        const initialDate = initialReference
            ? new Date(initialReference.timestamp).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0]

        // Grouper par jour
        const dailyData = new Map<string, { tracked: number; reference: number | null }>()

        // Ajouter les valeurs trackées par jour (seulement après la date initiale)
        trackedHistory.forEach(request => {
            const requestDate = new Date(request.timestamp).toISOString().split('T')[0]
            // Ne compter que les requêtes après la date initiale
            if (requestDate >= initialDate) {
                const existing = dailyData.get(requestDate) || { tracked: 0, reference: null }
                existing.tracked++
                dailyData.set(requestDate, existing)
            }
        })

        // Ajouter les valeurs de référence
        references.forEach(ref => {
            const date = new Date(ref.timestamp).toISOString().split('T')[0]
            const existing = dailyData.get(date) || { tracked: 0, reference: null }
            existing.reference = ref.value
            dailyData.set(date, existing)
        })

        // Convertir en array et trier par date
        const sortedData = Array.from(dailyData.entries())
            .map(([date, data]) => ({
                date,
                dateTime: new Date(date).getTime(),
                tracked: data.tracked,
                reference: data.reference
            }))
            .sort((a, b) => a.dateTime - b.dateTime)

        // Calculer les valeurs cumulatives (par rapport à la valeur initiale)
        let cumulativeTracked = 0
        return sortedData.map(item => {
            cumulativeTracked += item.tracked
            const trackedCumulative = initialValue + cumulativeTracked
            const referenceCumulative = item.reference !== null ? item.reference : null

            return {
                ...item,
                trackedCumulative,
                referenceCumulative
            }
        })
    }
}

// Instance singleton
export const analyticsTracker = new AnalyticsTracker()

// Export pour usage direct
export default analyticsTracker

