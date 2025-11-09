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

import { isProd } from '@/config/env'

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

// Différencier les clés de storage selon l'environnement (test vs prod)
// pour éviter de mélanger les analytics entre environnements
const MAX_HISTORY = 1000 // Limiter l'historique pour éviter de surcharger localStorage
const MAX_STATS_REQUESTS = 100 // Limiter les requêtes dans les stats détaillées

class AnalyticsTracker {
    private data: AnalyticsData

    /**
     * Obtenir la clé de storage selon l'environnement (évaluée dynamiquement)
     * Détection: import.meta.env.PROD OU vércel.com dans l'URL
     */
    private getStorageKey(): string {
        // Vérifier si on est en production
        // 1. Via Vite (import.meta.env.PROD)
        // 2. Via l'URL (vercel.app ou vercel.com)
        const isVercelProd = typeof window !== 'undefined' &&
            (window.location.hostname.includes('vercel.app') ||
                window.location.hostname.includes('vercel.com'))
        const prod = isProd() || isVercelProd
        const key = prod ? 'fomo_analytics_prod' : 'fomo_analytics_test'
        // Log pour debug (seulement la première fois)
        if (!this._storageKeyLogged) {
            const envSource = isVercelProd ? 'URL (Vercel)' : (isProd() ? 'Vite PROD' : 'DEV')
            console.log(`📊 [Analytics] Environnement: ${prod ? 'PRODUCTION' : 'TEST'} - Source: ${envSource} - Clé storage: ${key}`)
            this._storageKeyLogged = true
        }
        return key
    }

    private _storageKeyLogged = false

    constructor() {
        this.data = this.loadFromStorage()
    }

    private loadFromStorage(): AnalyticsData {
        const storageKey = this.getStorageKey()
        try {
            const stored = localStorage.getItem(storageKey)
            if (stored) {
                const parsed = JSON.parse(stored)
                // Vérifier que la structure est valide
                if (parsed && parsed.stats && parsed.history && parsed.startTime) {
                    // Ne plus créer automatiquement de référence avec valeur hardcodée
                    // Les références doivent être ajoutées manuellement via le dashboard
                    // Ne plus mettre à jour automatiquement les valeurs - tout vient du sheet
                    if (!parsed.maptilerReferences || parsed.maptilerReferences.length === 0) {
                        // Laisser vide - les références seront chargées depuis le backend
                        parsed.maptilerReferences = []
                    }
                    return parsed
                }
            }
        } catch (error) {
            console.warn('⚠️ [Analytics] Erreur chargement localStorage:', error)
        }

        // Initialiser avec des stats vides
        // Ne plus créer de référence initiale automatique - tout doit venir du sheet
        const now = Date.now()

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
            maptilerReferences: [] // Vide - les références seront chargées depuis le backend/sheet uniquement
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

            const storageKey = this.getStorageKey()
            localStorage.setItem(storageKey, JSON.stringify(this.data))
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
     * Vider l'historique sauvegardé (après sauvegarde réussie)
     * Garde les stats agrégées mais vide l'historique détaillé
     * Vide aussi les références MapTiler pour éviter les doublons
     */
    clearSavedHistory(): void {
        // Vider l'historique global
        this.data.history = []
        
        // Vider les requêtes détaillées dans chaque provider (garder les stats agrégées)
        Object.keys(this.data.stats).forEach(provider => {
            const stats = this.data.stats[provider as ApiProvider]
            stats.requests = []
        })
        
        // Vider les références MapTiler sauvegardées pour éviter les doublons
        // Les références sont déjà dans Google Sheets, le dashboard les charge depuis le backend
        this.data.maptilerReferences = []
        
        this.data.lastUpdate = Date.now()
        this.saveToStorage()
        console.log('🧹 [AnalyticsTracker] Historique et références MapTiler vidés du cache')
    }

    /**
     * Vider complètement le cache localStorage
     * Utilisé lors d'une réinitialisation complète des analytics
     * Vide les deux clés (prod et test) pour être sûr
     */
    clearAllCache(): void {
        try {
            // Vider les deux clés (prod et test) pour être sûr
            const prodKey = 'fomo_analytics_prod'
            const testKey = 'fomo_analytics_test'
            
            localStorage.removeItem(prodKey)
            localStorage.removeItem(testKey)
            
            console.log(`🧹 [AnalyticsTracker] Caches localStorage vidés (${prodKey} et ${testKey})`)
            
            // Réinitialiser les données en mémoire
            this.reset()
        } catch (error) {
            console.warn('⚠️ [AnalyticsTracker] Erreur vidage cache:', error)
        }
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
            maptilerReferences: [] // Ne plus créer de référence par défaut - chargée depuis le backend
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

        // Trouver la valeur initiale - la première référence (tout doit venir du sheet)
        const sortedReferences = references.sort((a, b) => a.timestamp - b.timestamp)
        const initialReference = sortedReferences.length > 0 ? sortedReferences[0] : null

        // Si aucune référence n'est présente, on ne peut pas calculer les données de comparaison
        // Retourner un tableau vide - les références doivent venir du sheet
        if (!initialReference || initialReference.value === undefined) {
            return []
        }

        const initialValue = initialReference.value
        const initialDate = new Date(initialReference.timestamp).toISOString().split('T')[0]

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

