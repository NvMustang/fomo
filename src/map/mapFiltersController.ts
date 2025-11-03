// Simple singleton controller to apply MapLibre filters without tying into React re-renders

type MapGetter = () => any | undefined

let getMapRef: MapGetter | null = null

/**
 * Enregistre un getter vers l'instance MapLibre.
 * Pattern identique à stylingPinsController pour rester cohérent.
 */
export function attachMapFilters(getMap: MapGetter) {
    getMapRef = getMap
}

/**
 * Nettoie la référence au getter de carte.
 */
export function detachMapFilters() {
    getMapRef = null
}

/**
 * Applique un filtre par IDs sur la couche des événements non clusterisés.
 * Utilise une expression MapLibre de type: ["in", ["get","id"], ["literal", ids]]
 * Ne touche pas aux clusters (choix UX/perf).
 */
export function applyFiltersToMap(filteredIds: string[]) {
    const getMap = getMapRef
    if (!getMap) return
    const map = getMap()
    if (!map || !map.isStyleLoaded?.()) return

    const layerId = 'events-unclustered'
    if (!map.getLayer?.(layerId)) {
        // couche pas encore prête → ne rien faire
        return
    }

    // Si pas d'IDs, masquer tout en appliquant un filtre qui ne matche rien
    const ids = Array.isArray(filteredIds) ? filteredIds : []
    const expression = ids.length > 0
        ? ["in", ["get", "id"], ["literal", ids]]
        : ["in", ["get", "id"], ["literal", []]]

    try {
        map.setFilter(layerId, expression)
    } catch {
        // ignorer les erreurs liées à un style/layer transitoirement indisponible
    }
}


