/**
 * HTTP Interceptor - Intercepte les requêtes HTTP pour analytics
 * 
 * Intercepte les requêtes fetch et XMLHttpRequest pour tracker les appels API
 * vers MapTiler, Mapbox, etc.
 */

import { analyticsTracker } from './analyticsTracker'

let isIntercepted = false

// Cache local pour éviter de tracker les mêmes requêtes plusieurs fois dans la même frame
// Réduit le bruit en développement (rechargements rapides)
// IMPORTANT: Les requêtes depuis le cache (304) comptent dans le quota MapTiler, donc on les tracke aussi
const requestCache = new Map<string, number>()
const CACHE_DURATION_MS = 1000 // 1 seconde - évite seulement les doublons dans la même frame
// Note: Réduit de 60s à 1s car les requêtes depuis le cache (304) doivent être trackées

/**
 * Vérifier si une requête a déjà été trackée très récemment (même frame)
 * Permet d'éviter les doublons lors de rechargements rapides sans masquer les requêtes légitimes
 */
function isRecentlyTracked(url: string, endpoint: string): boolean {
    const key = `${url}|${endpoint}`
    const now = Date.now()
    const lastTracked = requestCache.get(key)
    
    if (lastTracked && (now - lastTracked) < CACHE_DURATION_MS) {
        return true // Déjà trackée dans la même frame
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

                // IMPORTANT: Les requêtes depuis le cache (304) comptent dans le quota MapTiler
                // On doit les tracker aussi pour avoir un compteur précis
                // response.type === 'opaque' peut être ignoré (CORS, mais rare pour MapTiler)
                const isFromCache = response.status === 304
                const isOpaque = response.type === 'opaque'
                
                // Déterminer l'endpoint pour le cache
                const endpoint = isTile ? 'tile' : isFont ? 'font' : 'api'
                
                // Vérifier si cette requête a déjà été trackée très récemment (même frame)
                // Permet d'éviter les doublons lors de rechargements rapides
                const alreadyTracked = isRecentlyTracked(url, endpoint)
                
                // Tracker toutes les requêtes MapTiler, y compris celles depuis le cache (304)
                // car elles comptent dans le quota MapTiler
                if (!isOpaque && !alreadyTracked) {
                    if (isTile) {
                        analyticsTracker.trackRequest('maptiler', 'tile', success, {
                            method: init?.method || 'GET',
                            error: success ? undefined : `HTTP ${response.status}${isFromCache ? ' (cached)' : ''}`
                        })
                    } else if (isFont) {
                        // Les fonts sont gratuites, mais on peut les tracker
                        analyticsTracker.trackRequest('maptiler', 'font', success, {
                            method: init?.method || 'GET'
                        })
                    } else {
                        analyticsTracker.trackRequest('maptiler', 'api', success, {
                            method: init?.method || 'GET',
                            error: success ? undefined : `HTTP ${response.status}${isFromCache ? ' (cached)' : ''}`
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

