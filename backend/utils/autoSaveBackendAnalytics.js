/**
 * Auto-Save Backend Analytics Service
 * 
 * Service de sauvegarde automatique des analytics backend (Mapbox, Google Sheets)
 * Fonctionne en arrière-plan même si personne n'utilise l'app
 * 
 * @author FOMO MVP Team
 */

const analyticsTracker = require('./analyticsTracker')
const AnalyticsController = require('../controllers/analyticsController')

class AutoSaveBackendAnalyticsService {
    constructor() {
        this.saveInterval = null
        this.isInitialized = false
        this.lastSaveTime = null
    }

    /**
     * Initialiser le service de sauvegarde automatique
     */
    init() {
        if (this.isInitialized) {
            console.warn('⚠️ [AutoSave Backend] Service déjà initialisé')
            return
        }

        console.log('✅ [AutoSave Backend] Service de sauvegarde automatique initialisé')

        // Sauvegarde automatique toutes les 10 minutes
        // Plus long que le frontend car le backend a moins de requêtes
        this.saveInterval = setInterval(() => {
            this.saveToSheets()
        }, 10 * 60 * 1000) // 10 minutes

        // Sauvegarder immédiatement au démarrage (après 1 minute pour laisser le temps au serveur de démarrer)
        setTimeout(() => {
            this.saveToSheets()
        }, 60 * 1000) // 1 minute

        this.isInitialized = true
    }

    /**
     * Sauvegarder les analytics backend dans Google Sheets
     */
    async saveToSheets() {
        try {
            const stats = analyticsTracker.getStats()

            // Convertir les stats backend en format compatible avec le contrôleur
            const history = []
            
            // Extraire toutes les requêtes de tous les providers
            Object.entries(stats).forEach(([providerKey, stat]) => {
                if (stat && stat.requests && Array.isArray(stat.requests)) {
                    stat.requests.forEach(request => {
                        history.push({
                            provider: request.provider || providerKey,
                            endpoint: request.endpoint || '',
                            method: request.method || 'GET',
                            timestamp: request.timestamp,
                            success: request.success !== undefined ? request.success : true,
                            error: request.error || ''
                        })
                    })
                }
            })

            // Ne sauvegarder que s'il y a des données
            if (history.length === 0) {
                return
            }

            // Créer un objet de requête simulé pour le contrôleur
            // Le contrôleur attend un format avec stats, history, maptilerReferences
            const statsFormatted = {}
            Object.entries(stats).forEach(([key, stat]) => {
                statsFormatted[key] = stat
            })
            
            const mockReq = {
                body: {
                    stats: statsFormatted,
                    history: history,
                    maptilerReferences: [] // Pas de références MapTiler côté backend
                }
            }

            const mockRes = {
                json: (data) => {
                    if (data.success) {
                        console.log(`✅ [AutoSave Backend] ${history.length} requêtes sauvegardées`)
                        this.lastSaveTime = Date.now()
                    } else {
                        console.warn(`⚠️ [AutoSave Backend] Erreur:`, data.error)
                    }
                },
                status: (code) => ({
                    json: (data) => {
                        console.error(`❌ [AutoSave Backend] Erreur ${code}:`, data.error)
                    }
                })
            }

            await AnalyticsController.saveAnalytics(mockReq, mockRes)
        } catch (error) {
            console.error('❌ [AutoSave Backend] Erreur sauvegarde:', error)
        }
    }

    /**
     * Détruire le service (cleanup)
     */
    destroy() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval)
            this.saveInterval = null
        }
        this.isInitialized = false
    }

    /**
     * Obtenir le temps de la dernière sauvegarde
     */
    getLastSaveTime() {
        return this.lastSaveTime
    }
}

// Instance singleton
const autoSaveBackendAnalytics = new AutoSaveBackendAnalyticsService()

module.exports = autoSaveBackendAnalytics

