/**
 * Get Session ID - Identifiant unique par session/utilisateur
 * 
 * Utilisé pour identifier les analytics de chaque utilisateur
 * 
 * @author FOMO MVP Team
 */

/**
 * Obtenir un identifiant de session unique pour les analytics
 * Utilise l'ID utilisateur si disponible, sinon génère un ID de session
 */
export function getSessionId(): string {
    // Essayer d'obtenir l'ID utilisateur depuis localStorage (utilisateur authentifié)
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

    // Essayer d'obtenir l'ID visiteur depuis sessionStorage
    try {
        const visitorId = sessionStorage.getItem('fomo-visit-user-id')
        if (visitorId) {
            return visitorId
        }
    } catch (error) {
        // Ignorer si sessionStorage n'est pas disponible
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
 * Obtenir le nom d'utilisateur si disponible
 */
export function getUserName(): string | null {
    try {
        // Utilisateur authentifié
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

    try {
        // Visiteur
        const visitorName = sessionStorage.getItem('fomo-visit-name')
        if (visitorName) {
            return visitorName
        }
    } catch (error) {
        // Ignorer
    }

    return null
}

/**
 * Obtenir la ville depuis toutes les sources possibles
 * Vérifie dans l'ordre :
 * 1. sessionStorage 'fomo-visit-city' (visitor)
 * 2. localStorage 'modalname' (modal name avec ville)
 * 3. localStorage 'fomo-user' (utilisateur authentifié)
 */
export function getCity(): string | null {
    try {
        // 1. Ville du visitor depuis sessionStorage
        const visitorCity = sessionStorage.getItem('fomo-visit-city')
        if (visitorCity && visitorCity.trim()) {
            return visitorCity.trim()
        }
    } catch (error) {
        // Ignorer
    }

    try {
        // 2. Ville depuis localStorage modalname (peut contenir la ville)
        const modalName = localStorage.getItem('modalname')
        if (modalName && modalName.trim()) {
            // Si modalname contient une ville (format à déterminer selon l'implémentation)
            // Pour l'instant, on assume que modalname peut être la ville directement
            // ou un objet JSON avec une propriété city
            try {
                const parsed = JSON.parse(modalName)
                if (parsed && typeof parsed === 'object' && parsed.city && typeof parsed.city === 'string') {
                    return parsed.city.trim()
                }
            } catch {
                // Si ce n'est pas du JSON, traiter comme une chaîne simple (peut être la ville)
                // On retourne la valeur si elle semble être une ville (plus de 2 caractères)
                if (modalName.trim().length > 2) {
                    return modalName.trim()
                }
            }
        }
    } catch (error) {
        // Ignorer
    }

    try {
        // 3. Ville de l'utilisateur authentifié
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

