// Simple singleton controller to update MapLibre feature-state without React props or event bus

type MapGetter = () => any | undefined

let getMapRef: MapGetter | null = null

export function attachFeatureStateController(getMap: MapGetter) {
    getMapRef = getMap
}

export function detachFeatureStateController() {
    getMapRef = null
}

export function setUserResponseFeatureState(eventId: string, response: string | null) {
    const getMap = getMapRef
    if (!getMap) return
    const map = getMap()
    if (!map || !map.isStyleLoaded?.()) return
    const src = map.getSource?.('events')
    if (!src) return

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


