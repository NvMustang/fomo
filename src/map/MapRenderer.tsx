/**
 * FOMO MVP - MapRenderer
 *
 * Composant de rendu de carte utilisant MapLibre GL JS + react-map-gl
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import Map, { MapRef, Source, Layer } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { MapViewProps } from './types'
import { attachFeatureStateController, detachFeatureStateController } from '@/map/featureStateController'
import type { Event } from '@/types/fomoTypes'
import { usePrivacy } from '@/contexts/PrivacyContext'


// ===== UTILITAIRES DE COULEURS =====
const warnedCssVars = new Set<string>()
/**
 * Récupère une variable CSS du root avec log si fallback utilisé
 */
const getCSSVariable = (varName: string, fallback: string): string => {
  const color = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  if (!color) {
    if (!warnedCssVars.has(varName)) {
      console.warn(`[MapRenderer] CSS variable "${varName}" not found, using fallback`)
      warnedCssVars.add(varName)
    }
    return fallback
  }
  return color
}

/**
 * Récupère la couleur selon le mode public/private
 * Utilisée par les pins et les clusters
 */
const getPrivacyColor = (isPublicMode: boolean, varSuffix: string = ''): string => {
  const colorVar = isPublicMode ? `--pin-color-public${varSuffix}` : `--pin-color-private${varSuffix}`
  const fallback = isPublicMode ? '#ed4141' : '#3b82f6'
  return getCSSVariable(colorVar, fallback)
}


// Position par défaut de la carte (Belgique)
const defaultViewState = {
  latitude: 50.5,
  longitude: 5,
  zoom: 7,
  bearing: 0,
  pitch: 0,
}



// ===== CONFIGURATION =====
const MAP_CONFIG = {
  // Configuration simple et directe
  defaultStyle: {
    version: 8 as const,
    name: "FOMO Winter",
    sources: {
      "maptiler-winter": {
        type: "raster" as const,
        tiles: [
          `https://api.maptiler.com/maps/pastel/{z}/{x}/{y}.png?key=${import.meta.env.VITE_MAPLIBRE_ACCESS_TOKEN}`
        ],
        tileSize: 256,
        attribution: "© MapTiler © OpenStreetMap contributors",
      },
    },
    layers: [
      {
        id: "maptiler-winter",
        type: "raster" as const,
        source: "maptiler-winter",
        paint: {
          "raster-opacity": 1,
        },
      },
    ],
    glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${import.meta.env.VITE_MAPLIBRE_ACCESS_TOKEN}`,
  },

  defaultRegion: {
    latitude: 50.5000, // Bastogne, Belgique
    longitude: 5,
    latitudeDelta: 1,
    longitudeDelta: 1,
  },
}

// ===== CRÉATION DE SOURCE EN GEOJSON===== 
const createEventsSource = (eventsToShow: Event[]) => {

  const features = eventsToShow.map((e) => {
    const feature = {
      type: "Feature" as const,
      id: e.id, // nécessaire pour setFeatureState
      properties: {
        id: e.id,
        score: (e.stats?.going || 0) + (e.stats?.interested || 0),
        isPublic: e.isPublic || 'false',
      },
      geometry: {
        type: "Point" as const,
        coordinates: [e.venue?.lng || 0, e.venue?.lat || 0]
      },
    }

    return feature
  });

  const source = {
    type: "geojson" as const,
    data: { type: "FeatureCollection" as const, features },
    promoteId: 'id',
    cluster: true,
    clusterRadius: 80,      // un poil plus doux que 50
    clusterMaxZoom: 14,
    clusterProperties: {
      scoreSum: ["+", ["get", "score"]], // cumule un indicateur d'intérêt
    },
  }

  return source
}
// ===== DÉFINITION DES COUCHES =====
interface Layer {
  id: string
  type: string
  source: string
  filter?: any[]
  paint?: Record<string, any>
  layout?: Record<string, any>
  [key: string]: any
}

// ===== FONCTIONS UTILITAIRES =====
/**
 * Ajoute un événement temporaire à la map
 */
const addTemporaryEvent = (map: any, event: Event, isPublicMode: boolean = true) => {
  if (!map || !map.isStyleLoaded()) return

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

  // Ajouter le layer temporaire (copie de events-unclustered)
  map.addLayer({
    id: 'tempLayer',
    type: 'symbol',
    source: `temp-${event.id}`,
    layout: {
      "icon-image": "pin",
      "icon-size": 1,
      "icon-allow-overlap": true,
      "icon-ignore-placement": true
    },
    paint: {
      "icon-color": getPrivacyColor(isPublicMode),
      "icon-opacity": 1.0,
      "icon-halo-color": "#ffffff",
      "icon-halo-width": 5
    }
  })

  // silence: éviter le bruit de logs à chaque ajout temporaire
}

// ===== GÉNÉRATION DES COUCHES =====
/**
 * Génère les couches pour les événements
 */
const getEventLayers = (
  isPublicMode: boolean = true
): Layer[] => {

  const clusterColor = getPrivacyColor(isPublicMode)


  const layers = [
    // CLUSTERS
    {
      id: "events-cluster",
      type: "circle",
      source: "events",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": ['step', ['get', 'point_count'], clusterColor, 100, clusterColor, 750, clusterColor],
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "point_count"],
          2, 16,    // 2 événements = 16px
          5, 20,    // 5 événements = 20px
          10, 28,   // 10 événements = 28px
          25, 36,   // 25 événements = 36px
          50, 44,   // 50 événements = 44px
          100, 52,  // 100+ événements = 52px
          250, 60   // 250+ événements = 60px
        ],
        "circle-opacity": 0.3,
        "circle-blur": 0.6
      },
      layout: {},
      "icon-opacity-transition": { duration: 5000, delay: 0 },
      "circle-opacity-transition": { duration: 5000, delay: 0 },
    },
    // TEXTE DES CLUSTERS
    {
      id: "events-cluster-count",
      type: "symbol",
      source: "events",
      filter: ["has", "point_count"],
      paint: {
        "text-color": "#FFFFFF",
        "text-halo-color": "rgba(0, 0, 0, 0.5)",
        "text-halo-width": 1,
      },
      layout: {
        "text-field": "{point_count}",
        "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        "text-size": 14,
        "text-allow-overlap": true,
        "text-ignore-placement": true
      },
    },
    // PINS non clusterisés - test visuel forcé
    {
      id: "events-unclustered",
      type: "symbol",
      source: "events",
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": "pin",
        "icon-size": 1,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true
      },
      paint: {
        "icon-color": [
          "case",
          [
            "any",
            ["==", ["feature-state", "userResponse"], "seen"],
            ["==", ["feature-state", "userResponse"], "cleared"],
            ["==", ["feature-state", "userResponse"], "not_interested"]
          ],
          getCSSVariable('--pin-color-seen', '#64748b'),
          getPrivacyColor(isPublicMode)
        ],
        "icon-opacity": [
          "case",
          ["==", ["feature-state", "userResponse"], "going"], 0.8,
          ["==", ["feature-state", "userResponse"], "interested"], 0.6,
          ["any",
            ["==", ["feature-state", "userResponse"], "seen"],
            ["==", ["feature-state", "userResponse"], "cleared"]
          ], 0.8,
          ["==", ["feature-state", "userResponse"], "not_interested"], 0.2,
          1.0
        ],

      }
    },
  ]

  return layers
}


// ===== IMPLÉMENTATION WEB =====
const MapRendererComponent: React.FC<MapViewProps> = (
  {
    events,
    onEventClick,
    onClusterClick,
    onMapReady,
    style = {},
    autoCenterEvent,
    onEventCentered,
  }
) => {
  // Ne pas monter la carte si la clé MapTiler est manquante pour éviter des 403
  const mapTilerKey = import.meta.env.VITE_MAPLIBRE_ACCESS_TOKEN
  const isKeyMissing = !mapTilerKey || mapTilerKey.trim().length === 0
  // Récupérer isPublicMode du contexte PrivacyContext
  const { isPublicMode } = usePrivacy()

  const mapRef = useRef<MapRef>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  // Fonction helper pour centrer sur un événement (réutilise la logique existante)
  const centerOnEvent = useCallback((event: Event) => {
    if (mapRef.current?.getMap && event.venue) {
      const map = mapRef.current.getMap()
      const targetZoom = 13
      map.easeTo({
        center: [event.venue.lng, event.venue.lat - targetZoom / 1200],
        zoom: targetZoom,
        duration: 4000,
      })
    }
  }, [])

  // Auto-centrer sur l'événement si demandé
  useEffect(() => {
    if (autoCenterEvent && mapLoaded) {
      setTimeout(() => {
        centerOnEvent(autoCenterEvent)
        // Appeler aussi onEventClick pour ouvrir l'EventCard si nécessaire
        onEventClick?.(autoCenterEvent)
        // Notifier que le centrage est terminé
        setTimeout(() => {
          onEventCentered?.()
        }, 4500) // Après la durée de l'animation (4000ms)
      }, 500)
    }
  }, [autoCenterEvent, mapLoaded, centerOnEvent, onEventClick, onEventCentered])

  // Fonction helper pour zoom out
  const zoomOut = useCallback((targetZoom?: number, duration?: number) => {
    if (mapRef.current?.getMap) {
      const map = mapRef.current.getMap()
      const currentZoom = map.getZoom()
      // Si targetZoom fourni, l'utiliser, sinon réduire de 1 niveau seulement
      const newZoom = targetZoom ?? Math.max(10, currentZoom - 1)
      map.easeTo({
        zoom: newZoom,
        duration: duration,
      })
    }
  }, [])

  // Exposer les fonctions globalement
  useEffect(() => {
    if (mapLoaded && mapRef.current) {
      const map = mapRef.current.getMap()
        // Exposer la fonction globalement pour que CreateEventModal puisse l'utiliser
        ; (window as any).addTemporaryEventToMap = (event: Event, isPublicMode: boolean) => {
          addTemporaryEvent(map, event, isPublicMode)
        }
        // Exposer la fonction zoomOut pour DiscoverPage
        ; (window as any).zoomOutMap = zoomOut
        // Exposer la fonction centerOnEvent pour LastActivities
        ; (window as any).centerMapOnEvent = (event: Event) => {
          centerOnEvent(event)
        }
    }
  }, [mapLoaded, zoomOut, centerOnEvent])



  // Création de la source des événements
  const eventsSource = events && events.length > 0 ? createEventsSource(events) : null



  // ===== HANDLERS =====
  const handleClick = useCallback(
    (evt: any) => {
      const features = evt.features
      if (!features || features.length === 0) {
        // Clic en dehors d'un pin/cluster - masquer la carte d'événement
        onEventClick?.(null as any)
        return
      }

      const feature = features[0]

      if (feature.properties.cluster) {
        // Handle cluster click - zoom intelligent
        const map = mapRef.current?.getMap();
        if (!map) return;

        const src: any = map.getSource("events");
        const clusterId = feature.properties.cluster_id;

        if (src && src.getClusterExpansionZoom) {
          src.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
            if (err) {
              console.debug('[MapRenderer] Cluster expansion zoom error', err);
              return;
            }
            map.easeTo({
              center: feature.geometry.coordinates as [number, number],
              zoom,
              duration: 500,
            });
          });
        }

        onClusterClick?.(feature);
        return;
      } else {
        // Handle event click
        const eventId = feature.properties.id
        const event = events.find((e: Event) => e.id === eventId)

        if (event && onEventClick) {
          // Animer la carte vers l'événement (réutiliser la fonction helper)
          centerOnEvent(event)
          onEventClick(event)
        } else {
        }
      }
    },
    [events, onEventClick, onClusterClick, centerOnEvent]
  )




  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (map) {
      // Charger l'image pin
      map.loadImage('/pin.png', (err: any, img: any) => {
        if (!err && img) {
          map.addImage('pin', img, { sdf: true })
        }
      })

      setMapLoaded(true)
      onMapReady?.()
    }
  }, [onMapReady])



  // (plus de cache userResponses local)

  // ===== FeatureState Controller (local à MapRenderer) =====
  const featureStateControllerRef = useRef<{ setUserResponse: (eventId: string, response: string | null) => void }>()

  if (!featureStateControllerRef.current) {
    featureStateControllerRef.current = {
      setUserResponse: (eventId: string, response: string | null) => {
        const map = mapRef.current?.getMap()
        if (!map || !mapLoaded || !map.isStyleLoaded()) return
        const src = map.getSource('events') as any
        if (!src) return

        // Normalisation: null ou 'invited' -> supprimer la feature-state (ne rien faire visuellement)
        const normalized: string | null = !response || response === 'invited' ? null : response

        try {
          if (normalized === null) {
            map.removeFeatureState({ source: 'events', id: eventId }, 'userResponse')
          } else {
            map.setFeatureState({ source: 'events', id: eventId }, { userResponse: normalized })
          }
        } catch (e) {
          console.debug('[MapRenderer] controller feature-state update skipped (feature missing)', { eventId })
        }
      }
    }
  }

  // Attacher/détacher le contrôleur global
  useEffect(() => {
    attachFeatureStateController(() => mapRef.current?.getMap())
    return () => detachFeatureStateController()
  }, [])




  // ===== RENDER =====

  return (
    <div
      id="map-container"
      className="map-container"
      style={style}
    >
      {isKeyMissing ? (
        <div style={{ padding: 12 }}>
          <span style={{ fontSize: 14 }}>
            Carte désactivée: clé MapTiler manquante (VITE_MAPLIBRE_ACCESS_TOKEN).
          </span>
        </div>
      ) : (
        <Map
          ref={mapRef}
          mapLib={maplibregl}
          initialViewState={defaultViewState}
          mapStyle={MAP_CONFIG.defaultStyle}
          /* Limiter la navigation pour réduire les appels de tuiles */
          minZoom={6}
          maxZoom={18}
          maxBounds={[[2.2, 49.2], [6.7, 51.7]]}
          /* Désactiver le préchargement de tuiles hors écran */
          prefetchZoomDelta={0}
          interactiveLayerIds={['events-unclustered', 'events-cluster', 'events-cluster-count']}
          onClick={handleClick}
          onLoad={handleMapLoad}
          attributionControl={false}
        >
          {eventsSource && eventsSource.data && eventsSource.data.features && eventsSource.data.features.length > 0 && (() => {
            // Nettoyer le tempLayer avant de créer les autres layers
            const map = mapRef.current?.getMap()
            if (map && mapLoaded && map.isStyleLoaded()) {
              try {
                if (map.getLayer('tempLayer')) {
                  map.removeLayer('tempLayer')
                }
              } catch (e) {
                // Ignorer les erreurs
              }
            }

            return (
              <Source id="events" {...eventsSource}>
                {getEventLayers(isPublicMode).map(layer => {
                  return (
                    <Layer
                      key={layer.id}
                      id={layer.id}
                      type={layer.type as any}
                      source={layer.source}
                      filter={layer.filter as any}
                      paint={layer.paint}
                      layout={layer.layout}
                    />
                  )
                })}
              </Source>
            )
          })()}
        </Map>
      )}

    </div>
  )
}

MapRendererComponent.displayName = 'MapRendererComponent'

export const MapRenderer = MapRendererComponent
export { addTemporaryEvent }
