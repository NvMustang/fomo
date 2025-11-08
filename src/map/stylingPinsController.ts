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
 * Avec retry automatique si la source n'est pas encore prête.
 */
export function setUserResponseFeatureState(eventId: string, response: string | null, retryCount = 0) {
    const getMap = getMapRef
    if (!getMap) {
        // Retry si le getter n'est pas encore attaché (carte en cours de chargement)
        if (retryCount < 5) {
            setTimeout(() => setUserResponseFeatureState(eventId, response, retryCount + 1), 100)
        }
        return
    }
    const map = getMap()
    if (!map || !map.isStyleLoaded?.()) {
        // Retry si la carte n'est pas encore chargée
        if (retryCount < 5) {
            setTimeout(() => setUserResponseFeatureState(eventId, response, retryCount + 1), 100)
        }
        return
    }

    // Déterminer la source selon l'ID : fake pins utilisent 'fake-events', vrais events utilisent 'events'
    const sourceName = eventId.startsWith('fake-') ? 'fake-events' : 'events'
    const src = map.getSource?.(sourceName)
    if (!src) {
        // Retry si la source n'existe pas encore
        if (retryCount < 5) {
            setTimeout(() => setUserResponseFeatureState(eventId, response, retryCount + 1), 100)
        }
        return
    }

    // null ou 'invited' -> supprimer la feature-state (retour à l'état initial via properties)
    // Sinon, utiliser la valeur brute directement (participe, maybe, not_there, going, interested, not_interested, etc.)
    const shouldRemove = !response || response === 'invited'

    try {
        // Vérifier que la feature existe dans la source avant de mettre à jour le feature-state
        // Pour les sources GeoJSON, on peut vérifier via queryRenderedFeatures ou directement via la source
        const sourceData = (src as any)?.data
        let featureExists = false
        if (sourceData && sourceData.type === 'FeatureCollection') {
            featureExists = sourceData.features?.some((f: any) => f.id === eventId || f.properties?.id === eventId) ?? false
        }
        
        // Si la feature n'existe pas dans la source, elle peut être :
        // 1. Filtrée (pas dans la source filtrée)
        // 2. Dans un cluster (mais le feature-state peut quand même être mis à jour)
        // 3. Pas encore chargée
        // On essaie quand même de mettre à jour le feature-state (MapLibre le gère même si la feature est dans un cluster)
        // Mais on retry si la source n'a pas encore de données
        
        if (!sourceData && retryCount < 5) {
            // La source n'a pas encore de données, retry
            setTimeout(() => setUserResponseFeatureState(eventId, response, retryCount + 1), 100)
            return
        }

        console.info('[Pins] setUserResponseFeatureState', { eventId, response, sourceName, retryCount, featureExists })
        
        // MapLibre permet de mettre à jour le feature-state même si la feature est dans un cluster
        // Le feature-state est stocké au niveau de la source, pas au niveau du rendu
        if (shouldRemove) {
            map.removeFeatureState({ source: sourceName, id: eventId }, 'userResponse')
            console.info('[Pins] removeFeatureState done', { eventId, sourceName })
        } else {
            map.setFeatureState({ source: sourceName, id: eventId }, { userResponse: response })
            console.info('[Pins] setFeatureState done', { eventId, userResponse: response, sourceName })
        }
    } catch (error) {
        // Retry en cas d'erreur (feature peut ne pas exister encore ou être dans un cluster)
        if (retryCount < 5) {
            setTimeout(() => setUserResponseFeatureState(eventId, response, retryCount + 1), 100)
        } else {
            console.warn('[Pins] setUserResponseFeatureState failed after retries', { eventId, response, error })
        }
    }
}


/**
 * Alias public simple pour mettre à jour le style d'un pin selon la réponse.
 * Utilise directement les valeurs brutes pour le feature-state MapLibre.
 */
export function setStylingPin(eventId: string, response: string | null) {
    return setUserResponseFeatureState(eventId, response)
}
