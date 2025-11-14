/**
 * Get Session ID - Identifiant unique par session/utilisateur
 * 
 * Utilisé pour identifier les analytics de chaque utilisateur
 * 
 * @author FOMO MVP Team
 */

/**
 * Obtenir un identifiant de session unique pour les analytics
 * Utilise l'ID utilisateur depuis fomo-user (visitor ou user authentifié), sinon génère un ID de session
 */
export function getSessionId(): string {
    // Essayer d'obtenir l'ID utilisateur depuis localStorage (visitor ou user authentifié)
    try {
        const savedUser = localStorage.getItem('fomo-user')
        if (savedUser) {
            const userData = JSON.parse(savedUser)
            if (userData.id && typeof userData.id === 'string') {
                return userData.id
            }
        }
    } catch (error) {
        // Ignorer les erreurs de parsing
    }

    // Créer un ID de session temporaire (une seule fois par session)
    if (typeof window !== 'undefined') {
        const sessionKey = 'fomo-analytics-session-id'
        let sessionId = sessionStorage.getItem(sessionKey)

        if (!sessionId) {
            // Créer un nouvel ID de session
            sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
            try {
                sessionStorage.setItem(sessionKey, sessionId)
            } catch (error) {
                // Si sessionStorage n'est pas disponible, utiliser un ID temporaire
                // qui sera recréé à chaque fois (mais ça devrait être rare)
            }
        }

        return sessionId
    }

    // Fallback si window n'est pas disponible
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
}

/**
 * Obtenir le nom d'utilisateur si disponible (visitor ou user authentifié)
 */
export function getUserName(): string | null {
    try {
        // User (visitor ou authentifié) depuis fomo-user
        const savedUser = localStorage.getItem('fomo-user')
        if (savedUser) {
            const userData = JSON.parse(savedUser)
            if (userData.name && typeof userData.name === 'string') {
                return userData.name
            }
        }
    } catch (error) {
        // Ignorer
    }

    return null
}

/**
 * Obtenir la ville depuis l'utilisateur (visitor ou authentifié)
 */
export function getCity(): string | null {
    try {
        const savedUser = localStorage.getItem('fomo-user')
        if (savedUser) {
            const userData = JSON.parse(savedUser)
            if (userData.city && typeof userData.city === 'string' && userData.city.trim()) {
                return userData.city.trim()
            }
        }
    } catch (error) {
        // Ignorer
    }

    return null
}

