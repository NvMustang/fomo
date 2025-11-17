/**
 * Map geo data - GeoJSON creation and MapLibre source utilities for events
 */

import type { Event } from '@/types/fomoTypes'
import { CLUSTER_CONFIG } from './config'
import { getPrivacyColor } from './utils'

/**
 * Crée un GeoJSON FeatureCollection à partir d'événements et d'un map de réponses.
 * Fonction générique utilisée pour la création initiale de la source et pour setData().
 */
export const createEventsGeoJSON = (
  events: Event[],
  userResponsesMap: Record<string, string> = {}
) => {
  const features = events.map((e) => {
    const initialResponse = userResponsesMap[e.id] || ''

    return {
      type: "Feature" as const,
      id: e.id,
      properties: {
        id: e.id,
        score: (e.stats?.going || 0) + (e.stats?.interested || 0),
        isPublic: e.isPublic || 'false',
        userResponse: initialResponse,
        tags: e.tags || [],
        organizerId: e.organizerId || '',
        startsAt: e.startsAt || '',
        endsAt: e.endsAt || '',
        title: e.title || '',
        description: e.description || '',
      },
      geometry: {
        type: "Point" as const,
        coordinates: [e.venue?.lng || 0, e.venue?.lat || 0]
      },
    }
  })

  return {
    type: "FeatureCollection" as const,
    features
  }
}

/**
 * Crée une source GeoJSON avec les événements et leurs réponses utilisateur initiales.
 * Les réponses sont incluses dans properties.userResponse pour le styling initial des pins.
 */
export const createEventsSource = (
  eventsToShow: Event[],
  userResponsesMap: Record<string, string> = {},
  disableClustering: boolean = false
) => {
  const geoJSON = createEventsGeoJSON(eventsToShow, userResponsesMap)

  return {
    type: "geojson" as const,
    data: geoJSON,
    promoteId: 'id',
    cluster: !disableClustering && CLUSTER_CONFIG.source.enabled,
    ...(!disableClustering && {
      clusterRadius: CLUSTER_CONFIG.source.radius,
      clusterMaxZoom: CLUSTER_CONFIG.source.maxZoom,
      clusterProperties: CLUSTER_CONFIG.source.properties,
    }),
  }
}

/**
 * Ajoute un événement temporaire à la map
 */
export const addTemporaryEvent = (map: any, event: Event, isPublicMode: boolean = true) => {
  if (!map || !map.isStyleLoaded()) return
  try {
    if (!map.hasImage?.('pin')) return
  } catch { /* noop */ }

  // Ajouter la source temporaire
  map.addSource(`temp-${event.id}`, {
    type: 'geojson',
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature" as const,
          id: event.id,
          properties: {
            id: event.id,
            score: (event.stats?.going ?? 0) + (event.stats?.interested ?? 0),
          },
          geometry: {
            type: "Point" as const,
            coordinates: [event.venue?.lng ?? 0, event.venue?.lat ?? 0]
          },
        }
      ]
    }
  })

  // Ajouter le layer temporaire
  map.addLayer({
    id: 'tempLayer',
    type: 'symbol',
    source: `temp-${event.id}`,
    layout: {
      "icon-image": "pin",
      "icon-anchor": "bottom",
      "icon-allow-overlap": true,
      "icon-ignore-placement": true
    },
    paint: {
      "icon-color": getPrivacyColor(isPublicMode),
      "icon-opacity": 1.0
    }
  })
}

