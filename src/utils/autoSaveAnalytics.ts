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

            const response = await fetch(`${apiUrl}/analytics/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId,
                    userName,
                    stats: stats.stats,
                    history: stats.history,
                    maptilerReferences: stats.maptilerReferences
                })
            })

            const result = await response.json()
            if (result.success) {
                if (immediate) {
                    console.log('✅ [AutoSave] Analytics sauvegardées (avant fermeture)')
                } else {
                    console.log('✅ [AutoSave] Analytics sauvegardées automatiquement')
                }
            } else {
                console.warn('⚠️ [AutoSave] Erreur sauvegarde:', result.error)
            }
        } catch (error) {
            // Ne pas logger en cas d'erreur réseau (page qui se ferme)
            if (!immediate) {
                console.warn('⚠️ [AutoSave] Erreur sauvegarde analytics:', error)
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

