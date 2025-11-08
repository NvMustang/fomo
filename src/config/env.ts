export function isProd(): boolean {
    return import.meta.env.PROD === true
}

/**
 * Vérifier si on est en production Vercel
 * Utilisé pour déterminer si on doit sauvegarder les stats d'onboarding
 * (on ne veut pas polluer les stats avec les tests locaux)
 */
export function isVercelProduction(): boolean {
    if (typeof window === 'undefined') return false
    const hostname = window.location.hostname
    return hostname.includes('vercel.app') || hostname.includes('vercel.com')
}

export function getApiBaseUrl(): string {
    const explicit = import.meta.env.VITE_API_URL?.trim()
    if (explicit) return explicit

    if (isProd()) {
        // En production (ex: Vercel), utiliser un chemin relatif
        // pour profiter des rewrites / API Routes sans CORS
        return '/api'
    }

    // En développement: utiliser l'hôte courant (LAN), pas localhost
    const host = window.location.hostname
    const port = (import.meta.env.VITE_API_PORT?.toString().trim()) || '3001'
    return `http://${host}:${port}/api`
}

export default {
    isProd,
    isVercelProduction,
    getApiBaseUrl,
}


