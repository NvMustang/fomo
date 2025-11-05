/**
 * HTTP Interceptor - Intercepte les requêtes HTTP pour analytics
 * 
 * Intercepte les requêtes fetch et XMLHttpRequest pour tracker les appels API
 * vers MapTiler, Mapbox, etc.
 */

import { analyticsTracker } from './analyticsTracker'

let isIntercepted = false

/**
 * Intercepter les requêtes fetch
 */
function interceptFetch(): void {
    if (typeof window === 'undefined' || isIntercepted) return

    const originalFetch = window.fetch

    window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

        // Détecter MapTiler
        if (url.includes('api.maptiler.com')) {
            const isTile = (url.includes('/maps/') || url.includes('/tiles/')) &&
                (url.includes('/{z}/{x}/{y}') || url.match(/\/\d+\/\d+\/\d+\.png/))
            const isFont = url.includes('/fonts/')

            try {
                const response = await originalFetch(input, init)
                const success = response.ok

                if (isTile) {
                    analyticsTracker.trackRequest('maptiler', 'tile', success, {
                        method: init?.method || 'GET',
                        error: success ? undefined : `HTTP ${response.status}`
                    })
                } else if (isFont) {
                    // Les fonts sont gratuites, mais on peut les tracker
                    analyticsTracker.trackRequest('maptiler', 'font', success, {
                        method: init?.method || 'GET'
                    })
                } else {
                    analyticsTracker.trackRequest('maptiler', 'api', success, {
                        method: init?.method || 'GET'
                    })
                }

                return response
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error)
                analyticsTracker.trackRequest('maptiler', 'api', false, {
                    method: init?.method || 'GET',
                    error: errorMsg
                })
                throw error
            }
        }

        // Détecter Mapbox (backend fait les appels, mais on peut tracker côté frontend si nécessaire)
        if (url.includes('api.mapbox.com')) {
            try {
                const response = await originalFetch(input, init)
                const success = response.ok
                analyticsTracker.trackRequest('mapbox', url, success, {
                    method: init?.method || 'GET',
                    error: success ? undefined : `HTTP ${response.status}`
                })
                return response
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error)
                analyticsTracker.trackRequest('mapbox', url, false, {
                    method: init?.method || 'GET',
                    error: errorMsg
                })
                throw error
            }
        }

        // Appel normal, pas d'interception
        return originalFetch(input, init)
    }

    isIntercepted = true
}

/**
 * Initialiser l'intercepteur
 */
export function initHttpInterceptor(): void {
    if (typeof window === 'undefined') return

    interceptFetch()

    // Note: XMLHttpRequest n'est pas utilisé par MapLibre GL moderne (utilise fetch)
    // Mais on peut l'ajouter si nécessaire
}

