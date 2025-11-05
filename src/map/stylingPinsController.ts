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
 * Utilise directement les valeurs brutes (participe, maybe, not_there, etc.)
 */
export function setUserResponseFeatureState(eventId: string, response: string | null) {
    const getMap = getMapRef
    if (!getMap) return
    const map = getMap()
    if (!map || !map.isStyleLoaded?.()) return
    const src = map.getSource?.('events')
    if (!src) return

    // null ou 'invited' -> supprimer la feature-state (retour à l'état initial via properties)
    // Sinon, utiliser la valeur brute directement (participe, maybe, not_there, going, interested, not_interested, etc.)
    const shouldRemove = !response || response === 'invited'

    try {
        console.info('[Pins] setUserResponseFeatureState', { eventId, response })
        if (shouldRemove) {
            map.removeFeatureState({ source: 'events', id: eventId }, 'userResponse')
            console.info('[Pins] removeFeatureState done', { eventId })
        } else {
            map.setFeatureState({ source: 'events', id: eventId }, { userResponse: response })
            console.info('[Pins] setFeatureState done', { eventId, userResponse: response })
        }
    } catch {
        // ignore missing feature errors
    }
}


/**
 * Alias public simple pour mettre à jour le style d'un pin selon la réponse.
 * Utilise directement les valeurs brutes pour le feature-state MapLibre.
 */
export function setStylingPin(eventId: string, response: string | null) {
    return setUserResponseFeatureState(eventId, response)
}


