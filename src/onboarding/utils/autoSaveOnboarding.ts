/**
 * Auto-Save Onboarding Service
 * 
 * Service de sauvegarde automatique des données d'onboarding
 * Fonctionne même si le dashboard n'est pas ouvert
 * 
 * @author FOMO MVP Team
 */

import { onboardingTracker } from './onboardingTracker'
import { getApiBaseUrl, isVercelProduction } from '@/config/env'
import { getSessionId, getUserName } from '@/utils/getSessionId'

class AutoSaveOnboardingService {
    private saveInterval: NodeJS.Timeout | null = null
    private debounceTimeout: NodeJS.Timeout | null = null
    private isInitialized = false

    /**
     * Initialiser le service de sauvegarde automatique
     */
    init(): void {
        if (this.isInitialized) {
            console.warn('⚠️ [AutoSaveOnboarding] Service déjà initialisé')
            return
        }

        const isVercel = isVercelProduction()
        console.log(`✅ [AutoSaveOnboarding] Service initialisé (${isVercel ? 'PRODUCTION - sauvegarde activée' : 'LOCAL - tracking uniquement, pas de sauvegarde'})`)

        // Sauvegarde automatique toutes les 10 minutes (moins fréquent que analytics)
        this.saveInterval = setInterval(() => {
            this.saveToBackend()
        }, 10 * 60 * 1000) // 10 minutes

        // Sauvegarder avant de quitter la page
        const handleBeforeUnload = () => {
            // Sauvegarder immédiatement (sans debounce)
            this.saveToBackend(true)
        }
        window.addEventListener('beforeunload', handleBeforeUnload)

        // Sauvegarder quand une session est finalisée
        const handleSessionFinished = () => {
            // Sauvegarder après un délai (debounce) pour éviter trop de requêtes
            if (this.debounceTimeout) {
                clearTimeout(this.debounceTimeout)
            }

            this.debounceTimeout = setTimeout(() => {
                this.saveToBackend()
            }, 5000) // 5 secondes après la fin d'une session
        }

        // Écouter les événements personnalisés (on peut les déclencher depuis onboardingTracker)
        window.addEventListener('onboarding-session-finished', handleSessionFinished)

        this.isInitialized = true
    }

    /**
     * Sauvegarder les données d'onboarding dans le backend
     * Ne sauvegarde qu'en production Vercel pour éviter de polluer les stats avec les tests locaux
     */
    private async saveToBackend(immediate = false): Promise<void> {
        // Ne sauvegarder qu'en production Vercel
        if (!isVercelProduction()) {
            if (immediate) {
                console.log('ℹ️ [AutoSaveOnboarding] Sauvegarde désactivée en local (production Vercel uniquement)')
            }
            return
        }

        try {
            const exportedData = onboardingTracker.exportData()

            // Ne sauvegarder que s'il y a des sessions à sauvegarder
            if (exportedData.sessions.length === 0) {
                if (immediate) {
                    console.log('ℹ️ [AutoSaveOnboarding] Aucune session à sauvegarder')
                }
                return
            }

            const apiUrl = getApiBaseUrl()
            const sessionId = getSessionId()
            const userName = getUserName()

            const payload = {
                sessionId,
                userName,
                sessions: exportedData.sessions,
                stats: exportedData.stats
            }

            // Vérifier la taille approximative du payload (en bytes)
            const payloadSize = new Blob([JSON.stringify(payload)]).size
            const MAX_PAYLOAD_SIZE = 500 * 1024 // 500 KB

            if (payloadSize > MAX_PAYLOAD_SIZE) {
                // Limiter le nombre de sessions si nécessaire
                const maxSessions = Math.floor((MAX_PAYLOAD_SIZE * 0.7) / 5000) // ~5KB par session
                const limitedSessions = exportedData.sessions.slice(-maxSessions)
                payload.sessions = limitedSessions
                console.warn(`⚠️ [AutoSaveOnboarding] Payload trop volumineux (${Math.round(payloadSize / 1024)} KB), réduction à ${limitedSessions.length} sessions`)
            }

            const response = await fetch(`${apiUrl}/onboarding/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            })

            if (!response.ok) {
                if (response.status === 413) {
                    console.warn('⚠️ [AutoSaveOnboarding] Payload trop volumineux (413), données tronquées')
                    return
                }
                const errorText = await response.text()
                let errorData
                try {
                    errorData = JSON.parse(errorText)
                } catch {
                    errorData = { error: errorText }
                }
                console.warn('⚠️ [AutoSaveOnboarding] Erreur sauvegarde:', errorData.error || `HTTP ${response.status}`)
                return
            }

            const result = await response.json()
            if (result.success) {
                // Vider le cache après sauvegarde réussie
                onboardingTracker.clearSavedSessions()
                if (immediate) {
                    console.log('✅ [AutoSaveOnboarding] Données sauvegardées dans Google Sheets et cache vidé')
                }
            } else {
                console.warn('⚠️ [AutoSaveOnboarding] Erreur sauvegarde:', result.error)
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            if (errorMessage.includes('413') || errorMessage.includes('Payload Too Large')) {
                console.warn('⚠️ [AutoSaveOnboarding] Payload trop volumineux, données non sauvegardées')
            } else {
                console.warn('⚠️ [AutoSaveOnboarding] Erreur sauvegarde dans Google Sheets:', errorMessage)
            }
        }
    }

    /**
     * Désactiver le service
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
        console.log('🛑 [AutoSaveOnboarding] Service désactivé')
    }
}

// Instance singleton
export const autoSaveOnboarding = new AutoSaveOnboardingService()

