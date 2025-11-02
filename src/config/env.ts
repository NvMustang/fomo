export function isProd(): boolean {
    return import.meta.env.PROD === true
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
    getApiBaseUrl,
}


