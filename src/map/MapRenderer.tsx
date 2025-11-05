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
import { attachStylingPinsController, detachStylingPinsController } from '@/map/stylingPinsController'
import type { Event } from '@/types/fomoTypes'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { useFilters } from '@/contexts/FiltersContext'
import { useFomoDataContext } from '@/contexts/FomoDataProvider'
import { useAuth } from '@/contexts/AuthContext'
import { userResponsesMapper } from '@/utils/filterTools'


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


// Position par défaut de la carte (Belgique ou ville de l'utilisateur si définie)
const getDefaultViewState = (userLat?: number | null, userLng?: number | null) => {
  if (userLat && userLng) {
    return {
      latitude: userLat,
      longitude: userLng,
      zoom: 10, // Zoom plus proche pour la ville de l'utilisateur
      bearing: 0,
      pitch: 0,
    }
  }
  // Fallback : Belgique
  return {
    latitude: 50.5,
    longitude: 5,
    zoom: 7,
    bearing: 0,
    pitch: 0,
  }
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
/**
 * Crée une source GeoJSON avec les événements et leurs réponses utilisateur initiales.
 * Les réponses sont incluses dans properties.userResponse pour le styling initial des pins.
 */
const createEventsSource = (eventsToShow: Event[], userResponsesMap: Record<string, string> = {}, disableClustering: boolean = false) => {

  const features = eventsToShow.map((e) => {
    // Récupérer la réponse initiale depuis le mapping (ou '' si aucune)
    const initialResponse = userResponsesMap[e.id] || ''

    const feature = {
      type: "Feature" as const,
      id: e.id, // nécessaire pour setFeatureState
      properties: {
        id: e.id,
        score: (e.stats?.going || 0) + (e.stats?.interested || 0),
        isPublic: e.isPublic || 'false',
        // Réponse initiale pour le styling au montage (priorité inférieure à feature-state)
        userResponse: initialResponse,
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
    cluster: !disableClustering && CLUSTER_CONFIG.source.enabled,
    ...(!disableClustering && {
      clusterRadius: CLUSTER_CONFIG.source.radius,
      clusterMaxZoom: CLUSTER_CONFIG.source.maxZoom,
      clusterProperties: CLUSTER_CONFIG.source.properties,
    }),
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
 * Configuration commune pour les clusters (layers ET sources)
 */
const CLUSTER_CONFIG = {
  // Configuration de la source GeoJSON
  source: {
    enabled: true,
    radius: 60,      // Rayon réduit : les pins doivent être très proches pour se clusteriser
    maxZoom: 12,      // Zoom maximum : les clusters disparaissent plus tôt, les pins individuels apparaissent plus vite
    properties: {
      scoreSum: ["+", ["get", "score"]], // Cumule un indicateur d'intérêt
    },
  },
  // Configuration des layers de rendu
  layers: {
    radius: [
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
    opacity: 0.3,
    blur: 0.6,
    textSize: 14,
  },
}

/**
 * Génère les 3 layers pour une source de clustering (cluster, cluster-count, unclustered)
 * @param sourceId - ID de la source GeoJSON (ex: "events", "fake-events")
 * @param layerPrefix - Préfixe pour les IDs des layers (ex: "events", "fake-events")
 * @param clusterColor - Couleur pour les clusters
 * @param pinColor - Expression MapLibre pour la couleur des pins (ou couleur simple)
 * @param pinOpacity - Expression MapLibre pour l'opacité des pins (ou valeur simple)
 * @param pinIconSize - Taille de l'icône des pins (défaut: 1)
 * @returns Tableau de 3 layers : [cluster, cluster-count, unclustered]
 */
const createClusterLayers = (
  sourceId: string,
  layerPrefix: string,
  clusterColor: string,
  pinColor: any,
  pinOpacity: any,
  pinIconSize: number = 1
): Layer[] => {
  return [
    // CLUSTERS (cercles)
    {
      id: `${layerPrefix}-cluster`,
      type: "circle",
      source: sourceId,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": ['step', ['get', 'point_count'], clusterColor, 100, clusterColor, 750, clusterColor],
        "circle-radius": CLUSTER_CONFIG.layers.radius,
        "circle-opacity": CLUSTER_CONFIG.layers.opacity,
        "circle-blur": CLUSTER_CONFIG.layers.blur,
      },
      layout: {},
      ...(layerPrefix === "events" && {
        "icon-opacity-transition": { duration: 5000, delay: 0 },
        "circle-opacity-transition": { duration: 5000, delay: 0 },
      }),
    },
    // TEXTE DES CLUSTERS
    {
      id: `${layerPrefix}-cluster-count`,
      type: "symbol",
      source: sourceId,
      filter: ["has", "point_count"],
      paint: {
        "text-color": "#FFFFFF",
        "text-halo-color": "rgba(0, 0, 0, 0.5)",
        "text-halo-width": 1,
      },
      layout: {
        "text-field": "{point_count}",
        "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        "text-size": CLUSTER_CONFIG.layers.textSize,
        "text-allow-overlap": true,
        "text-ignore-placement": true
      },
    },
    // PINS individuels (non clusterisés)
    // Note: "unclustered" signifie "pins qui ne sont pas dans un cluster", pas "éléments qui ne clusterisent pas"
    {
      id: `${layerPrefix}-${layerPrefix === "events" ? "unclustered" : "pins"}`,
      type: "symbol",
      source: sourceId,
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": "pin",
        "icon-size": pinIconSize,
        "icon-anchor": layerPrefix === "fake-events" ? "bottom" : undefined,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true
      },
      paint: {
        "icon-color": pinColor,
        "icon-opacity": pinOpacity,
      }
    },
  ]
}

/**
 * Génère les couches pour les événements réels (avec gestion des réponses utilisateur)
 */
const getEventLayers = (
  isPublicMode: boolean = true
): Layer[] => {
  const clusterColor = getPrivacyColor(isPublicMode)
  const basePinColor = getPrivacyColor(isPublicMode)

  // Couleur des pins avec logique de réponses utilisateur
  // Supporte les deux formats : ancien (not_interested) et nouveau (not_there)
  const pinColor = [
    "case",
    [
      "any",
      ["==", ["coalesce", ["feature-state", "userResponse"], ["get", "userResponse"]], "seen"],
      ["==", ["coalesce", ["feature-state", "userResponse"], ["get", "userResponse"]], "cleared"],
      ["==", ["coalesce", ["feature-state", "userResponse"], ["get", "userResponse"]], "not_there"],
      ["==", ["coalesce", ["feature-state", "userResponse"], ["get", "userResponse"]], "not_interested"]
    ],
    getCSSVariable('--pin-color-seen', '#64748b'),
    basePinColor
  ]

  // Opacité des pins avec logique de réponses utilisateur
  // Supporte les deux formats : ancien (going/interested/not_interested) et nouveau (participe/maybe/not_there)
  const pinOpacity = [
    "case",
    // Format nouveau : participe
    ["==", ["coalesce", ["feature-state", "userResponse"], ["get", "userResponse"]], "participe"], 0.8,
    // Format ancien : going
    ["==", ["coalesce", ["feature-state", "userResponse"], ["get", "userResponse"]], "going"], 0.8,
    // Format nouveau : maybe
    ["==", ["coalesce", ["feature-state", "userResponse"], ["get", "userResponse"]], "maybe"], 0.6,
    // Format ancien : interested
    ["==", ["coalesce", ["feature-state", "userResponse"], ["get", "userResponse"]], "interested"], 0.6,
    // seen et cleared
    [
      "any",
      ["==", ["coalesce", ["feature-state", "userResponse"], ["get", "userResponse"]], "seen"],
      ["==", ["coalesce", ["feature-state", "userResponse"], ["get", "userResponse"]], "cleared"]
    ], 0.8,
    // Format nouveau : not_there
    ["==", ["coalesce", ["feature-state", "userResponse"], ["get", "userResponse"]], "not_there"], 0.2,
    // Format ancien : not_interested
    ["==", ["coalesce", ["feature-state", "userResponse"], ["get", "userResponse"]], "not_interested"], 0.2,
    1.0
  ]

  return createClusterLayers("events", "events", clusterColor, pinColor, pinOpacity, 1)
}

/**
 * Génère les couches pour les fake pins (sans logique de réponses utilisateur)
 * Utilise feature-state 'pop' pour l'animation de pulsation via icon-opacity
 */
const getFakeEventLayers = (
  isPublicMode: boolean = true
): Layer[] => {
  const clusterColor = getPrivacyColor(isPublicMode)
  const pinColor = getPrivacyColor(isPublicMode)

  // Pour les fake pins, utiliser createClusterLayers puis personnaliser le layer pins
  const baseLayers = createClusterLayers("fake-events", "fake-events", clusterColor, pinColor, 1.0, 1.0)

  // Modifier le layer pins pour utiliser feature-state 'pop' dans icon-opacity pour l'animation
  // pop varie de 0 à 1 (cosinus), on l'utilise pour animer l'opacité avec un effet très marqué
  const pinsLayer = baseLayers.find(l => l.id === 'fake-events-pins')
  if (pinsLayer && pinsLayer.paint) {
    // Animation d'opacité très marquée : de 0.15 à 1.0 avec maintien de l'opacité max plus longtemps
    // Plateau à 1.0 entre 0.3 et 0.7 (40% du cycle reste à opacité maximale)
    pinsLayer.paint['icon-opacity'] = [
      'interpolate',
      ['linear'],
      ['feature-state', 'pop'],
      0, 0.15,   // pop = 0 → opacity = 0.15 (très faible)
      0.3, 1.0,  // pop = 0.3 → opacity = 1.0 (début du plateau)
      0.7, 1.0,  // pop = 0.7 → opacity = 1.0 (fin du plateau - maintien à 1.0 pendant 40% du cycle)
      1, 0.15    // pop = 1 → opacity = 0.15 (retour au minimum)
    ]
  }

  return baseLayers
}


// ===== IMPLÉMENTATION WEB =====
const MapRendererComponent: React.FC<MapViewProps> = (
  {
    events,
    onPinClick,
    onClusterClick,
    onMapReady,
    style = {},

  }
) => {
  // Ne pas monter la carte si la clé MapTiler est manquante pour éviter des 403
  const mapTilerKey = import.meta.env.VITE_MAPLIBRE_ACCESS_TOKEN
  const isKeyMissing = !mapTilerKey || mapTilerKey.trim().length === 0
  // Récupérer isPublicMode du contexte PrivacyContext
  const { isPublicMode } = usePrivacy()
  const { getMapFilterIds } = useFilters()

  // Récupérer les réponses utilisateur pour mapper les réponses initiales dans les properties
  // (seulement pour les valeurs initiales au montage, les mises à jour sont gérées par stylingPinsController)
  const { responses, currentUserId } = useFomoDataContext()

  // Récupérer l'utilisateur pour la position par défaut de la carte
  const { user } = useAuth()

  const mapRef = useRef<MapRef>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const popAnimationFrameRef = useRef<number | null>(null)
  const popPhasesRef = useRef<globalThis.Map<string, number>>(new globalThis.Map<string, number>())
  const fakePinsSourceRef = useRef<any>(null)

  // Ref pour capturer les réponses initiales une seule fois (quand events ou currentUserId change)
  // La source ne sera recréée que si events ou currentUserId change, pas si responses change
  const initialResponsesRef = useRef<typeof responses>(responses)
  const prevEventsRef = useRef(events)
  const prevUserIdRef = useRef(currentUserId)

  if (events !== prevEventsRef.current || currentUserId !== prevUserIdRef.current) {
    initialResponsesRef.current = responses
    prevEventsRef.current = events
    prevUserIdRef.current = currentUserId
  }

  // Source stable : créer une fois avec TOUS les événements de getDiscoverEvents() et leurs réponses initiales
  // Le filtrage se fait uniquement via setFilter() sur les layers, pas via setData()
  // Exclure les fake events de la source principale (ils ont leur propre source)
  const realEventsOnly = events?.filter((e: Event) => !(e as any).isFake && !e.id.startsWith('fake-')) || []
  const userResponsesMapForSource = userResponsesMapper(realEventsOnly, initialResponsesRef.current, currentUserId || undefined)

  // Désactiver le clustering en mode visitor (un seul événement réel)
  const isVisitorMode = realEventsOnly.length === 1
  const eventsSource = realEventsOnly && realEventsOnly.length > 0 ? createEventsSource(realEventsOnly, userResponsesMapForSource, isVisitorMode) : null

  // Fonction helper pour centrer sur un événement avec flyTo
  // flyTo crée une animation de "vol" avec arc qui gère automatiquement la séquence
  const centerOnPin = useCallback((event: Event) => {
    if (mapRef.current?.getMap && event.venue) {
      const map = mapRef.current.getMap()
      const targetZoom = 13
      const targetCenter: [number, number] = [event.venue.lng, event.venue.lat - targetZoom / 1200]

      map.flyTo({
        center: targetCenter,
        zoom: targetZoom,
        duration: 2000,
      })
    }
  }, [])



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

  // Gérer les fake pins pour la séquence Public Mode
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return

    const map = mapRef.current.getMap()
    if (!map || !map.isStyleLoaded()) return

    // Vérifier que l'icône 'pin' est disponible avant d'ajouter les fake pins
    try {
      if (!map.hasImage || !map.hasImage('pin')) {
        return
      }
    } catch {
      return
    }

    // Séparer fake events
    const fakeEvents = events?.filter((e: Event) => (e as any).isFake || e.id.startsWith('fake-')) || []

    // Si on a des fake pins, créer une source séparée (sans cluster)
    if (fakeEvents.length > 0) {
      const fakeFeatures = fakeEvents.map((e: Event) => ({
        type: "Feature" as const,
        id: e.id,
        properties: {
          id: e.id,
          isFake: true,
          score: (e.stats?.going || 0) + (e.stats?.interested || 0), // Score pour le clustering
        },
        geometry: {
          type: "Point" as const,
          coordinates: [e.venue?.lng || 0, e.venue?.lat || 0]
        },
      }))

      const fakeGeoJSON = {
        type: "FeatureCollection" as const,
        features: fakeFeatures
      }

      // Ajouter ou mettre à jour la source fake-events
      try {
        if (map.getSource('fake-events')) {
          console.info('[Map] Updating fake-events source with setData', { features: fakeFeatures.length })
            ; (map.getSource('fake-events') as any).setData(fakeGeoJSON)
        } else {
          console.info('[Map] Adding fake-events source with clustering')
          map.addSource('fake-events', {
            type: 'geojson',
            data: fakeGeoJSON,
            promoteId: 'id',
            cluster: CLUSTER_CONFIG.source.enabled,
            clusterRadius: CLUSTER_CONFIG.source.radius,
            clusterMaxZoom: CLUSTER_CONFIG.source.maxZoom,
            clusterProperties: CLUSTER_CONFIG.source.properties,
          })

          // Ajouter les layers pour fake pins avec clustering - seulement si l'icône est disponible
          console.info('[Map] Adding fake-events layers (cluster + pins)')
          try {
            // Utiliser la fonction unifiée pour générer les layers
            const fakeLayers = getFakeEventLayers(isPublicMode)

            // Ajouter chaque layer à la map
            fakeLayers.forEach((layer) => {
              map.addLayer({
                id: layer.id,
                type: layer.type as any,
                source: layer.source,
                filter: layer.filter as any,
                paint: layer.paint,
                layout: layer.layout,
              })
            })

            console.info('[Map] fake-events layers added successfully')
          } catch (err: any) {
            console.error('[Map] Error adding fake-events layers', {
              name: err?.name || 'UnknownError',
              message: err?.message || String(err),
              stack: err?.stack
            })
          }
        }
      } catch (err: any) {
        console.error('[Map] Error in fake pins source/layer management', {
          name: err?.name || 'UnknownError',
          message: err?.message || String(err),
          stack: err?.stack
        })
      }

      fakePinsSourceRef.current = map.getSource('fake-events')

      // Initialiser les phases aléatoires pour l'animation pop
      fakeFeatures.forEach((f) => {
        if (!popPhasesRef.current.has(f.id)) {
          const POP_PERIOD = 5000 // Augmenté à 3 secondes pour une pulsation plus lente
          popPhasesRef.current.set(f.id, Math.random() * POP_PERIOD)
        }
      })

      // Démarrer l'animation pop si prefers-reduced-motion est false
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!prefersReducedMotion && popAnimationFrameRef.current === null) {
        const POP_PERIOD = 5000 // Augmenté à 3 secondes pour une pulsation plus lente
        let startTime = performance.now()

        const tick = (now: number) => {
          if (!map || !map.getSource('fake-events')) {
            popAnimationFrameRef.current = null
            return
          }

          fakeFeatures.forEach((f) => {
            const phase = popPhasesRef.current.get(f.id) || 0
            const elapsed = (now - startTime + phase) % POP_PERIOD
            const pop = 0.5 - 0.5 * Math.cos((elapsed / POP_PERIOD) * 2 * Math.PI) // 0..1..0

            try {
              map.setFeatureState({ source: 'fake-events', id: f.id }, { pop })
            } catch (e) {
              // Ignorer les erreurs si la source/layer n'existe plus
            }
          })

          popAnimationFrameRef.current = requestAnimationFrame(tick)
        }

        popAnimationFrameRef.current = requestAnimationFrame(tick)
      } else if (prefersReducedMotion) {
        // Fallback : fade-in simple pour reduced motion
        try {
          const layer = map.getLayer('fake-events-pins')
          if (layer) {
            map.setPaintProperty('fake-events-pins', 'icon-opacity', 1.0)
          }
        } catch (e) {
          // Ignorer
        }
      }
    } else {
      // Supprimer la source fake-events si plus de fake pins
      if (map.getSource('fake-events')) {
        // Supprimer tous les layers fake-events (clusters + pins)
        if (map.getLayer('fake-events-cluster-count')) {
          map.removeLayer('fake-events-cluster-count')
        }
        if (map.getLayer('fake-events-cluster')) {
          map.removeLayer('fake-events-cluster')
        }
        if (map.getLayer('fake-events-pins')) {
          map.removeLayer('fake-events-pins')
        }
        map.removeSource('fake-events')
        fakePinsSourceRef.current = null
      }

      // Arrêter l'animation
      if (popAnimationFrameRef.current !== null) {
        cancelAnimationFrame(popAnimationFrameRef.current)
        popAnimationFrameRef.current = null
      }
    }

    return () => {
      // Cleanup : arrêter l'animation si le composant est démonté
      if (popAnimationFrameRef.current !== null) {
        cancelAnimationFrame(popAnimationFrameRef.current)
        popAnimationFrameRef.current = null
      }
    }
  }, [mapLoaded, events, isPublicMode])

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
          centerOnPin(event)
        }
        // Exposer getMap pour DiscoverPage
        ; (window as any).getMap = () => map
        // Exposer startPublicModeSequence pour DiscoverPage
        ; (window as any).startPublicModeSequence = (targetZoom: number, duration: number) => {
          console.info('[Map] startPublicModeSequence called', { targetZoom, duration, mapAvailable: !!map })
          if (map) {
            const currentZoom = map.getZoom()
            const currentCenter = map.getCenter()
            console.info('[Map] Current map state before flyTo', { currentZoom, currentCenter: currentCenter ? [currentCenter.lng, currentCenter.lat] : null })

            map.flyTo({
              zoom: targetZoom,
              duration: duration,
              easing: (t: number) => t * (2 - t) // Ease-out
            })

            console.info('[Map] flyTo called for Public Mode zoom-out', { targetZoom, duration })

            // Tracking après injection fake pins
            setTimeout(() => {
              console.log('🎯 [Analytics] fake_pins_shown', { count: events?.filter((e: Event) => (e as any).isFake || e.id.startsWith('fake-')).length || 0 })
            }, 500)
          } else {
            console.warn('[Map] startPublicModeSequence: map not available')
          }
        }
        // Exposer fadeOutFakePins pour DiscoverPage
        ; (window as any).fadeOutFakePins = () => {
          if (map && map.getLayer('fake-events-pins')) {
            // Animation fade-out de l'opacity
            map.setPaintProperty('fake-events-pins', 'icon-opacity', [
              'interpolate',
              ['linear'],
              ['get', 'fadeOut'],
              0, 1.0,
              1, 0.0
            ])

            // Fade-out progressif des clusters aussi
            if (map.getLayer('fake-events-cluster')) {
              let clusterOpacity = 0.3
              const clusterFadeInterval = setInterval(() => {
                clusterOpacity -= 0.015
                if (clusterOpacity <= 0) {
                  clearInterval(clusterFadeInterval)
                } else {
                  try {
                    map.setPaintProperty('fake-events-cluster', 'circle-opacity', clusterOpacity)
                  } catch (e) {
                    clearInterval(clusterFadeInterval)
                  }
                }
              }, 50)
            }
            if (map.getLayer('fake-events-cluster-count')) {
              let textOpacity = 1.0
              const textFadeInterval = setInterval(() => {
                textOpacity -= 0.05
                if (textOpacity <= 0) {
                  clearInterval(textFadeInterval)
                } else {
                  try {
                    map.setPaintProperty('fake-events-cluster-count', 'text-opacity', textOpacity)
                  } catch (e) {
                    clearInterval(textFadeInterval)
                  }
                }
              }, 50)
            }

            // Fade-out progressif
            let opacity = 1.0
            const fadeInterval = setInterval(() => {
              opacity -= 0.05
              if (opacity <= 0) {
                clearInterval(fadeInterval)
                // Supprimer tous les layers fake-events après fade-out
                if (map.getSource('fake-events')) {
                  if (map.getLayer('fake-events-cluster-count')) {
                    map.removeLayer('fake-events-cluster-count')
                  }
                  if (map.getLayer('fake-events-cluster')) {
                    map.removeLayer('fake-events-cluster')
                  }
                  if (map.getLayer('fake-events-pins')) {
                    map.removeLayer('fake-events-pins')
                  }
                  map.removeSource('fake-events')
                  fakePinsSourceRef.current = null
                }
              } else {
                const features = (map.getSource('fake-events') as any)?.data?.features || []
                features.forEach((f: any) => {
                  try {
                    map.setFeatureState({ source: 'fake-events', id: f.id }, { fadeOut: 1 - opacity })
                  } catch (e) {
                    // Ignorer
                  }
                })
              }
            }, 50)
          }
        }
    }
  }, [mapLoaded, zoomOut, centerOnPin, events])






  // ===== HANDLERS =====
  const handleClick = useCallback(
    (evt: any) => {
      const features = evt.features
      if (!features || features.length === 0) {
        // Clic en dehors d'un pin/cluster - masquer la carte d'événement
        onPinClick?.(null as any)
        return
      }

      const feature = features[0]

      if (feature.properties.cluster) {
        // Handle cluster click - zoom intelligent
        const map = mapRef.current?.getMap();
        if (!map) return;

        // Déterminer la source (events ou fake-events)
        // Essayer d'abord fake-events, puis events
        let src: any = map.getSource('fake-events')
        if (!src) {
          src = map.getSource('events')
        }
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

        // Vérifier si c'est un fake event (commence par fake- ou a isFake dans properties)
        const isFakeEvent = eventId?.toString().startsWith('fake-') || feature.properties.isFake === true

        const event = isFakeEvent
          ? events.find((e: Event) => e.id === eventId && ((e as any).isFake || e.id.startsWith('fake-')))
          : events.find((e: Event) => e.id === eventId)

        console.log('🔍 [MapRenderer] handleClick event:', {
          eventId,
          eventFound: !!event,
          eventsCount: events.length,
          hasOnPinClick: !!onPinClick
        })

        if (event && onPinClick) {
          // Animer la carte vers l'événement (réutiliser la fonction helper)
          centerOnPin(event)
          onPinClick(event)
        } else {
          console.warn('⚠️ [MapRenderer] Event non trouvé ou onPinClick manquant:', {
            eventId,
            eventFound: !!event,
            hasOnPinClick: !!onPinClick
          })
        }
      }
    },
    [events, onPinClick, onClusterClick, centerOnPin]
  )




  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    // Note: Les requêtes MapTiler sont interceptées automatiquement via httpInterceptor
    // qui est initialisé dans main.tsx. Pas besoin d'instrumentation supplémentaire ici.

    // Enregistrer l'icône 'pin' dès le chargement de la carte puis marquer mapLoaded
    try {
      const has = map.hasImage && map.hasImage('pin')
      if (has) {
        setMapLoaded(true)
        onMapReady?.()
        return
      }
    } catch { /* noop */ }

    try {
      map.loadImage('/pin.png', (err: any, img: any) => {
        if (!err && img) {
          try {
            if (!map.hasImage('pin')) {
              map.addImage('pin', img, { sdf: true })
            }
          } catch { /* noop */ }
        }
        // Quoi qu'il arrive, marquer la carte comme prête pour déclencher le rendu
        setMapLoaded(true)
        onMapReady?.()
      })
    } catch {
      setMapLoaded(true)
      onMapReady?.()
    }
  }, [onMapReady])


  // Appliquer les filtres et mettre à jour la source avec les événements filtrés
  // Les clusters doivent être recalculés avec seulement les événements filtrés (via setData())
  // setFilter() ne suffit pas car les clusters sont calculés à partir des données de la source
  // Note: setData() déclenche un re-rendu MapLibre (pas React), nécessaire pour mettre à jour la carte
  const prevFilteredIdsRef = useRef<string[]>([])

  useEffect(() => {
    if (!mapLoaded || !events || events.length === 0) return

    const map = mapRef.current?.getMap()
    if (!map || !map.isStyleLoaded()) return

    const source = map.getSource('events') as any
    if (!source || source.setData === undefined) return

    // Récupérer les IDs filtrés
    const filteredIds = getMapFilterIds()

    // Vérifier si les IDs ont changé (éviter les appels setData() inutiles)
    const idsChanged =
      filteredIds.length !== prevFilteredIdsRef.current.length ||
      !filteredIds.every(id => prevFilteredIdsRef.current.includes(id))

    if (!idsChanged) {
      // Les filtres n'ont pas changé, pas besoin de mettre à jour la source
      return
    }

    prevFilteredIdsRef.current = filteredIds
    const filteredIdsSet = new Set(filteredIds)

    // Filtrer les événements pour ne garder que ceux qui passent les filtres
    const filteredEvents = events.filter(e => filteredIdsSet.has(e.id))

    // Mapper les réponses initiales pour les événements filtrés
    const userResponsesMapForFiltered = userResponsesMapper(filteredEvents, initialResponsesRef.current, currentUserId || undefined)

    // Créer le GeoJSON avec seulement les événements filtrés (pour recalculer les clusters)
    const filteredGeoJson = {
      type: "FeatureCollection" as const,
      features: filteredEvents.map((e) => {
        const initialResponse = userResponsesMapForFiltered[e.id] || ''
        return {
          type: "Feature" as const,
          id: e.id,
          properties: {
            id: e.id,
            score: (e.stats?.going || 0) + (e.stats?.interested || 0),
            isPublic: e.isPublic || 'false',
            userResponse: initialResponse,
          },
          geometry: {
            type: "Point" as const,
            coordinates: [e.venue?.lng || 0, e.venue?.lat || 0]
          },
        }
      })
    }

    try {
      // Mettre à jour la source avec les événements filtrés (MapLibre recalcule automatiquement les clusters)
      // Cela déclenche un re-rendu MapLibre (pas React) pour afficher les nouvelles données
      source.setData(filteredGeoJson)
    } catch (error) {
      console.debug('[MapRenderer] setData error:', error)
    }
  }, [mapLoaded, events, getMapFilterIds, currentUserId])



  // Note: Le styling des pins est maintenant géré par stylingPinsController
  // Les réponses initiales sont incluses dans properties.userResponse au montage
  // Les mises à jour instantanées utilisent feature-state via setUserResponseFeatureState()

  // Attacher/détacher le contrôleur de styling des pins
  useEffect(() => {
    attachStylingPinsController(() => mapRef.current?.getMap())
    return () => detachStylingPinsController()
  }, [])

  // Note: Les filtres sont appliqués via setData() (mise à jour des données) ET setFilter() (filtrage des layers)
  // pour maintenir le filtrage même après re-render ou fermeture d'EventCard




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
          initialViewState={getDefaultViewState(user?.lat, user?.lng)}
          mapStyle={MAP_CONFIG.defaultStyle}
          /* Limiter la navigation pour réduire les appels de tuiles */
          minZoom={6}
          maxZoom={18}
          maxBounds={[[2.2, 49.2], [6.7, 51.7]]}
          /* Désactiver le préchargement de tuiles hors écran (prop non supportée par react-map-gl vBêta) */
          interactiveLayerIds={['events-unclustered', 'events-cluster', 'events-cluster-count', 'fake-events-pins', 'fake-events-cluster', 'fake-events-cluster-count']}
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

            // Éviter d'ajouter les layers tant que l'icône 'pin' n'est pas enregistrée
            if (!map || !map.hasImage || !map.hasImage('pin')) {
              return null
            }

            // Si clustering désactivé (mode visitor), ajuster les layers pour afficher tous les pins
            const hasClustering = eventsSource.cluster === true
            const eventLayers = getEventLayers(isPublicMode)

            return (
              <Source id="events" {...eventsSource}>
                {eventLayers.map(layer => {
                  // Si pas de clustering et c'est le layer unclustered, ne pas ajouter le filter
                  // Sinon, utiliser le filter normal
                  const layerProps: any = {
                    id: layer.id,
                    type: layer.type,
                    source: layer.source,
                    paint: layer.paint,
                    layout: { ...layer.layout },
                  }

                  // Ajouter le filter seulement si nécessaire (ou si clustering activé)
                  if (hasClustering || layer.id !== 'events-unclustered') {
                    if (layer.filter) {
                      layerProps.filter = layer.filter
                    }
                  }

                  // Nettoyer layout pour retirer les valeurs undefined
                  Object.keys(layerProps.layout).forEach(key => {
                    if (layerProps.layout[key] === undefined) {
                      delete layerProps.layout[key]
                    }
                  })

                  return (
                    <Layer
                      key={layer.id}
                      {...layerProps}
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
