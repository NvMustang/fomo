/**
 * Analytics Tracker - Backend
 * 
 * Tracke les requêtes API côté backend (Mapbox, Google Sheets)
 * Envoie les stats au frontend via localStorage simulé ou via une API
 * 
 * Pour simplifier, on log les stats et on peut les exposer via une route API
 */

class AnalyticsTracker {
    constructor() {
        this.stats = {
            mapbox: {
                provider: 'mapbox',
                total: 0,
                success: 0,
                errors: 0,
                lastRequest: null,
                requests: []
            },
            googlesheets: {
                provider: 'googlesheets',
                total: 0,
                success: 0,
                errors: 0,
                lastRequest: null,
                requests: []
            }
        }
        this.maxRequests = 100
    }

    trackRequest(provider, endpoint, success, options = {}) {
        const request = {
            provider,
            endpoint,
            method: options.method || 'GET',
            timestamp: Date.now(),
            success,
            error: options.error
        }

        const stat = this.stats[provider]
        if (!stat) {
            console.warn(`⚠️ [Analytics] Provider inconnu: ${provider}`)
            return
        }

        stat.total++
        if (success) {
            stat.success++
        } else {
            stat.errors++
        }
        stat.lastRequest = request.timestamp

        stat.requests.push(request)
        if (stat.requests.length > this.maxRequests) {
            stat.requests.shift()
        }

        // Log pour debug
        if (process.env.NODE_ENV === 'development') {
            console.log(`📊 [Analytics] ${provider} ${endpoint}: ${success ? '✅' : '❌'}`)
        }
    }

    getStats() {
        return { ...this.stats }
    }

    getStatsByProvider(provider) {
        return this.stats[provider] ? { ...this.stats[provider] } : null
    }

    reset() {
        this.stats.mapbox = {
            provider: 'mapbox',
            total: 0,
            success: 0,
            errors: 0,
            lastRequest: null,
            requests: []
        }
        this.stats.googlesheets = {
            provider: 'googlesheets',
            total: 0,
            success: 0,
            errors: 0,
            lastRequest: null,
            requests: []
        }
    }
}

// Instance singleton
const analyticsTracker = new AnalyticsTracker()

module.exports = analyticsTracker

