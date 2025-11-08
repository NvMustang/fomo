/**
 * HTTP Interceptor - Intercepte les requêtes HTTP pour analytics
 * 
 * Intercepte les requêtes fetch et XMLHttpRequest pour tracker les appels API
 * vers MapTiler, Mapbox, etc.
 */

import { analyticsTracker } from './analyticsTracker'

let isIntercepted = false

// Cache local pour éviter de tracker les mêmes requêtes plusieurs fois
// Utile en développement pour éviter de tracker les rechargements depuis le cache
// Les tiles MapTiler sont statiques, donc on peut avoir un cache plus long
const requestCache = new Map<string, number>()
const CACHE_DURATION_MS = 60000 // 60 secondes - ignore les mêmes requêtes dans cette fenêtre
// Pour les tiles statiques, 1 minute est raisonnable et réduit le bruit en développement

/**
 * Vérifier si une requête a déjà été trackée récemment
 */
function isRecentlyTracked(url: string, endpoint: string): boolean {
    const key = `${url}|${endpoint}`
    const now = Date.now()
    const lastTracked = requestCache.get(key)
    
    if (lastTracked && (now - lastTracked) < CACHE_DURATION_MS) {
        return true // Déjà trackée récemment
    }
    
    // Mettre à jour le cache
    requestCache.set(key, now)
    
    // Nettoyer le cache périodiquement (garder seulement les entrées récentes)
    if (requestCache.size > 1000) {
        const cutoff = now - CACHE_DURATION_MS
        for (const [k, v] of requestCache.entries()) {
            if (v < cutoff) {
                requestCache.delete(k)
            }
        }
    }
    
    return false
}

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

                // Ne tracker que les requêtes qui partent vraiment vers le serveur
                // Ignorer les requêtes servies depuis le cache (status 304 ou response.type === 'opaque')
                const isFromCache = response.status === 304 || response.type === 'opaque'
                
                // Déterminer l'endpoint pour le cache
                const endpoint = isTile ? 'tile' : isFont ? 'font' : 'api'
                
                // Vérifier si cette requête a déjà été trackée récemment (évite les doublons en dev)
                const alreadyTracked = isRecentlyTracked(url, endpoint)
                
                if (!isFromCache && !alreadyTracked) {
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
                }
                // Note: Même si on ne track pas, on retourne la réponse pour que MapLibre fonctionne

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

        // Note: Mapbox n'est plus utilisé (migré vers MapTiler)
        // Le géocodage passe maintenant par MapTiler via le backend

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

