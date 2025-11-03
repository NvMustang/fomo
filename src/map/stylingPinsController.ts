// Simple singleton controller to update MapLibre feature-state and style pins based on user responses

type MapGetter = () => any | undefined

let getMapRef: MapGetter | null = null

/**
 * Enregistre un getter vers l'instance MapLibre.
 */
export function attachStylingPinsController(getMap: MapGetter) {
    getMapRef = getMap
}

/**
 * Nettoie la référence au getter de carte.
 */
export function detachStylingPinsController() {
    getMapRef = null
}

/**
 * Met à jour le feature-state userResponse pour un événement donné.
 * Utilisé pour les mises à jour instantanées après interaction utilisateur.
 */
export function setUserResponseFeatureState(eventId: string, response: string | null) {
    const getMap = getMapRef
    if (!getMap) return
    const map = getMap()
    if (!map || !map.isStyleLoaded?.()) return
    const src = map.getSource?.('events')
    if (!src) return

    // Normalisation: null ou 'invited' -> supprimer la feature-state (retour à l'état initial via properties)
    const normalized: string | null = !response || response === 'invited' ? null : response

    try {
        if (normalized === null) {
            map.removeFeatureState({ source: 'events', id: eventId }, 'userResponse')
        } else {
            map.setFeatureState({ source: 'events', id: eventId }, { userResponse: normalized })
        }
    } catch {
        // ignore missing feature errors
    }
}


