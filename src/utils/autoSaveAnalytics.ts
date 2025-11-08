/**
 * Auto-Save Analytics Service
 * 
 * Service de sauvegarde automatique des analytics indépendant du dashboard
 * Fonctionne même si le dashboard n'est pas ouvert
 * 
 * @author FOMO MVP Team
 */

import { analyticsTracker } from './analyticsTracker'
import { getApiBaseUrl } from '@/config/env'
import { getSessionId, getUserName } from './getSessionId'

class AutoSaveAnalyticsService {
    private saveInterval: NodeJS.Timeout | null = null
    private debounceTimeout: NodeJS.Timeout | null = null
    private isInitialized = false

    /**
     * Initialiser le service de sauvegarde automatique
     */
    init(): void {
        if (this.isInitialized) {
            console.warn('⚠️ [AutoSave] Service déjà initialisé')
            return
        }

        console.log('✅ [AutoSave] Service de sauvegarde automatique initialisé')

        // Sauvegarde automatique toutes les 5 minutes
        this.saveInterval = setInterval(() => {
            this.saveToBackend()
        }, 5 * 60 * 1000) // 5 minutes

        // Sauvegarder avant de quitter la page
        const handleBeforeUnload = () => {
            // Sauvegarder immédiatement (sans debounce)
            this.saveToBackend(true)
        }
        window.addEventListener('beforeunload', handleBeforeUnload)

        // Écouter les événements de mise à jour analytics
        const handleAnalyticsUpdate = () => {
            // Annuler la sauvegarde précédente si elle n'a pas encore été exécutée
            if (this.debounceTimeout) {
                clearTimeout(this.debounceTimeout)
            }

            // Sauvegarder après un délai (debounce) pour éviter trop de requêtes
            this.debounceTimeout = setTimeout(() => {
                this.saveToBackend()
                this.debounceTimeout = null
            }, 30000) // 30 secondes après la dernière mise à jour
        }

        window.addEventListener('analytics-updated', handleAnalyticsUpdate)

        // Nettoyer à la destruction
        const cleanup = () => {
            if (this.saveInterval) {
                clearInterval(this.saveInterval)
                this.saveInterval = null
            }
            if (this.debounceTimeout) {
                clearTimeout(this.debounceTimeout)
                this.debounceTimeout = null
            }
            window.removeEventListener('beforeunload', handleBeforeUnload)
            window.removeEventListener('analytics-updated', handleAnalyticsUpdate)
        }

        // Nettoyer si la page est déchargée (mais beforeunload gère déjà ça)
        // Pour React strict mode en dev
        if (typeof window !== 'undefined') {
            // @ts-ignore - pour compatibilité
            window.__autoSaveAnalyticsCleanup = cleanup
        }

        this.isInitialized = true
    }

    /**
     * Sauvegarder les analytics dans le backend
     */
    private async saveToBackend(immediate = false): Promise<void> {
        try {
            const stats = analyticsTracker.getStats()

            // Ne sauvegarder que s'il y a des données à sauvegarder
            if (stats.history.length === 0 && stats.maptilerReferences.length === 0) {
                if (immediate) {
                    console.log('ℹ️ [AutoSave] Aucune donnée à sauvegarder')
                }
                return
            }

            const apiUrl = getApiBaseUrl()

            const sessionId = getSessionId()
            const userName = getUserName()

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
                sessionId,
                userName,
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
                console.warn(`⚠️ [AutoSave] Payload trop volumineux (${Math.round(payloadSize / 1024)} KB), réduction à ${furtherLimitedHistory.length} requêtes`)
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
                    console.warn('⚠️ [AutoSave] Payload trop volumineux (413), données tronquées')
                    return
                }
                const errorText = await response.text()
                let errorData
                try {
                    errorData = JSON.parse(errorText)
                } catch {
                    errorData = { error: errorText }
                }
                console.warn('⚠️ [AutoSave] Erreur sauvegarde:', errorData.error || `HTTP ${response.status}`)
                return
            }

            const result = await response.json()
            if (result.success) {
                // Vider le cache après sauvegarde réussie
                analyticsTracker.clearSavedHistory()
                if (immediate) {
                    console.log('✅ [AutoSave] Analytics sauvegardées (avant fermeture) et cache vidé')
                } else {
                    console.log('✅ [AutoSave] Analytics sauvegardées automatiquement et cache vidé')
                }
            } else {
                console.warn('⚠️ [AutoSave] Erreur sauvegarde:', result.error)
            }
        } catch (error) {
            // Ne pas logger en cas d'erreur réseau (page qui se ferme)
            if (!immediate) {
                const errorMessage = error instanceof Error ? error.message : String(error)
                if (errorMessage.includes('413') || errorMessage.includes('Payload Too Large')) {
                    console.warn('⚠️ [AutoSave] Payload trop volumineux, données non sauvegardées')
                } else {
                    console.warn('⚠️ [AutoSave] Erreur sauvegarde analytics:', errorMessage)
                }
            }
        }
    }

    /**
     * Détruire le service (cleanup)
     */
    destroy(): void {
        if (this.saveInterval) {
            clearInterval(this.saveInterval)
            this.saveInterval = null
        }
        if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout)
            this.debounceTimeout = null
        }
        this.isInitialized = false
    }
}

// Instance singleton
export const autoSaveAnalytics = new AutoSaveAnalyticsService()

