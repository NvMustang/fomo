/**
 * FOMO MVP - MapRenderer
 *
 * Composant de rendu de carte utilisant MapLibre GL JS + react-map-gl
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import Map, { MapRef, Source, Layer } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { MapViewProps } from './types'
import type { Event } from '@/types/fomoTypes'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { useDataContext } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { userResponsesMapper, groupAndCountEventsByPeriod, groupAndCountEventsByResponse } from '@/utils/filterTools'
import { PREDEFINED_FAKE_EVENTS } from '@/utils/fakeEventsData'
import { getDefaultViewState } from './utils'
import { MAP_CONFIG } from './config'
import { createEventsSource, createEventsGeoJSON, addTemporaryEvent } from './geoData'
import { getEventLayers } from './layers'
import { initializePulseAnimation } from './animations'


// ===== COMPOSANT =====
const MapRendererComponent: React.FC<MapViewProps> = (
  {
    events,
    filteredEvents,
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

  // Récupérer les réponses utilisateur UNIQUEMENT pour la ref initiale (pas pour le render)
  // Les mises à jour instantanées sont gérées via window.setStylingPin (feature-state)
  const { responses, currentUserId } = useDataContext()

  // Récupérer l'utilisateur pour la position par défaut de la carte
  const { user } = useAuth()

  const mapRef = useRef<MapRef>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const pulseAnimationFrameRef = useRef<number | null>(null)
  const pulseAnimationStartedRef = useRef<boolean>(false) // Track si l'animation a déjà été démarrée
  const mapReadyCalledRef = useRef(false) // Garde pour n'appeler onMapReady qu'une seule fois

  // Fonction helper pour calculer les events initiaux (sans "past" ou fake events selon le mode)
  const getInitialEvents = useCallback((): Event[] => {
    if (user.isVisitor && isPublicMode) {
      return PREDEFINED_FAKE_EVENTS
    }
    if (!events || events.length === 0) return []

    // Grouper les événements par période et exclure "past" (comportement par défaut)
    const { groups } = groupAndCountEventsByPeriod(events)
    const eventsWithoutPast: Event[] = []
    Object.entries(groups).forEach(([periodKey, periodEvents]) => {
      if (periodKey !== 'past') {
        eventsWithoutPast.push(...periodEvents)
      }
    })
    return eventsWithoutPast
  }, [events, user.isVisitor, isPublicMode])

  // ⚠️ Créer la source GeoJSON UNE SEULE FOIS au montage (statique)
  // Les mises à jour dynamiques sont gérées par setData() dans le useEffect
  // Ne pas dépendre de userResponsesMapForSource qui change avec responses
  // Les réponses seront mises à jour via setData() dans le useEffect
  const [eventsSource] = useState(() => {
    const initialEvents = getInitialEvents()
    if (initialEvents.length > 0) {
      return createEventsSource(initialEvents, {}, initialEvents.length === 1)
    }
    return null
  })


  // Fonction helper pour centrer sur un événement avec flyTo
  // flyTo crée une animation de "vol" avec arc qui gère automatiquement la séquence
  // Zoom à 15 pour éviter les conflits avec le clustering (maxZoom: 13)
  // Une marge de 2 niveaux de zoom évite les instabilités visuelles pendant l'animation
  const centerOnPin = useCallback((event: Event, duration?: number) => {
    if (mapRef.current?.getMap && event.venue) {
      const map = mapRef.current.getMap()
      const targetZoom = 15 // Marge de 2 niveaux par rapport au maxZoom du clustering (13) pour stabilité
      const targetCenter: [number, number] = [event.venue.lng, event.venue.lat - targetZoom / 5000]

      map.flyTo({
        center: targetCenter,
        zoom: targetZoom,
        pitch: 0, // Maintenir la vue zénithale
        bearing: 0, // Maintenir l'orientation nord
        duration: duration ?? 3000, // 3s par défaut pour visitor mode
      })
    }
  }, [])



  // Fonction helper pour zoom out avec easing ease-out (appelée à la fermeture d'une EventCard)
  const zoomOutOnPin = useCallback((zoomLevels?: number, duration?: number) => {
    if (mapRef.current?.getMap) {
      const map = mapRef.current.getMap()
      const currentZoom = map.getZoom()
      // Réduire de quelques niveaux (par défaut 2-3 niveaux)
      const levelsToReduce = zoomLevels ?? 2.5
      const newZoom = Math.max(10, currentZoom - levelsToReduce)
      map.easeTo({
        zoom: newZoom,
        pitch: 0, // Maintenir la vue zénithale
        bearing: 0, // Maintenir l'orientation nord
        duration: duration ?? 2000, // 2s par défaut
        easing: (t: number) => t * (2 - t) // Ease-out
      })
    }
  }, [])



  // Exposer les fonctions globalement
  useEffect(() => {
    if (mapLoaded && mapRef.current) {
      const map = mapRef.current.getMap()

        // Exposer la fonction globalement pour que CreateEventModal puisse l'utiliser
        ; (window.addTemporaryEventToMap = (event: Event, isPublicMode: boolean) => {
          addTemporaryEvent(map, event, isPublicMode)
        })
        // Exposer la fonction zoomOutOnPin pour DiscoverPage (fermeture EventCard)
        ; (window.zoomOutOnPin = (zoomLevels?: number, duration?: number) => {
          zoomOutOnPin(zoomLevels, duration)
        })
        // Exposer la fonction centerOnEvent pour LastActivities
        ; (window.centerMapOnEvent = (event: Event, duration?: number) => {
          centerOnPin(event, duration)
        })
        // Exposer getMap pour DiscoverPage
        ; (window.getMap = () => map)
        // Exposer setStylingPin pour EventCard
        ; (window.setStylingPin = (eventId: string, response: string | null) => {
          if (!map) return
          try {
            if (!response) {
              // Supprimer la réponse
              map.removeFeatureState({ source: 'events', id: eventId }, 'userResponse')
              // Définir pulse à 1.0 (opacité normale) pour éviter les erreurs MapLibre
              map.setFeatureState({ source: 'events', id: eventId }, { pulse: 1.0 })
            } else {
              // Définir la réponse
              map.setFeatureState({ source: 'events', id: eventId }, { userResponse: response })
              // Si la réponse n'est plus "linked" ou "invited", définir pulse à 1.0 (opacité normale)
              if (response !== 'linked' && response !== 'invited') {
                map.setFeatureState({ source: 'events', id: eventId }, { pulse: 1.0 })
              }
            }
          } catch (error) {
            // Ignorer silencieusement si la source/feature n'existe pas encore
          }
        })
        // Exposer startPublicModeSequence pour DiscoverPage
        ; (window.startPublicModeSequence = (targetZoom: number, duration: number) => {
          if (map) {
            map.flyTo({
              zoom: targetZoom,
              pitch: 0, // Maintenir la vue zénithale
              bearing: 0, // Maintenir l'orientation nord
              duration: duration,
              easing: (t: number) => t * (2 - t) // Ease-out
            })
          }
        })
    }
  }, [mapLoaded, zoomOutOnPin, centerOnPin, events])






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
            if (err) return;
            map.easeTo({
              center: feature.geometry.coordinates as [number, number],
              zoom,
              pitch: 0, // Maintenir la vue zénithale
              bearing: 0, // Maintenir l'orientation nord
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

        if (event && onPinClick) {
          // Animer la carte vers l'événement (réutiliser la fonction helper)
          centerOnPin(event)
          onPinClick(event)
        }
      }
    },
    [events, onPinClick, onClusterClick, centerOnPin]
  )




  const handleMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap()
    if (!map) return

    // Désactiver la rotation et le pitch pour garder une vue zénithale
    // Mais garder le zoom par pincement activé
    try {
      map.dragRotate?.disable()
      map.touchPitch?.disable()
      // Ne pas désactiver touchZoomRotate pour garder le zoom par pincement
      // Mais empêcher la rotation en forçant le bearing à 0
      map.on('rotate', () => {
        map.setBearing(0)
      })
      // Forcer le pitch à 0 (vue zénithale)
      map.setPitch(0)
      map.setBearing(0)
    } catch {
      // Ignorer si les méthodes ne sont pas disponibles
    }


    // Note: Les requêtes MapTiler sont interceptées automatiquement via httpInterceptor
    // qui est initialisé dans main.tsx. Pas besoin d'instrumentation supplémentaire ici.

    // Charger l'icône 'pin' si elle n'existe pas déjà
    const markMapAsReady = () => {
      setMapLoaded(true)
      if (!mapReadyCalledRef.current) {
        mapReadyCalledRef.current = true
        onMapReady?.()
      }
    }

    try {
      if (map.hasImage && map.hasImage('pin')) {
        markMapAsReady()
        return
      }

      map.loadImage('/pin.png', (err: any, img: any) => {
        if (!err && img) {
          try {
            if (!map.hasImage('pin')) {
              map.addImage('pin', img, { sdf: true })
            }
          } catch { /* noop */ }
        }
        // Quoi qu'il arrive, marquer comme prêt
        markMapAsReady()
      })
    } catch {
      markMapAsReady()
    }
  }, [onMapReady])

  // Initialiser le pulse une seule fois au montage (après que la source soit créée)
  useEffect(() => {
    if (!mapLoaded || !eventsSource || pulseAnimationStartedRef.current) return

    const map = mapRef.current?.getMap()
    if (!map) return

    // Attendre que le style soit chargé et que la source MapLibre existe
    setTimeout(() => {
      if (pulseAnimationStartedRef.current) return

      const source = map.getSource('events')
      if (!source) {
        pulseAnimationStartedRef.current = true
        return
      }

      // Récupérer les events initiaux (statique, créée au montage)
      const initialEvents = getInitialEvents()

      if (initialEvents.length === 0) {
        pulseAnimationStartedRef.current = true
        return
      }

      // Grouper les events par réponse pour obtenir les "invited" et "linked"
      const effectiveUserId = currentUserId || user?.id
      if (!effectiveUserId) {
        pulseAnimationStartedRef.current = true
        return
      }

      const { groups } = groupAndCountEventsByResponse(initialEvents, responses, effectiveUserId)

      // Combiner "invited" et "linked"
      const linkedOrInvitedEvents = [...(groups.invited || []), ...(groups.linked || [])]

      if (linkedOrInvitedEvents.length > 0) {
        // initializePulseAnimation gère les erreurs si la source n'existe pas encore (try/catch)
        initializePulseAnimation(linkedOrInvitedEvents, map, pulseAnimationStartedRef, pulseAnimationFrameRef)
      } else {
        pulseAnimationStartedRef.current = true
      }
    }, 100)

    return () => {
      // Cleanup : arrêter l'animation pulse si le composant est démonté
      if (pulseAnimationFrameRef.current !== null) {
        cancelAnimationFrame(pulseAnimationFrameRef.current)
        pulseAnimationFrameRef.current = null
      }
    }
  }, [mapLoaded, eventsSource, getInitialEvents, responses, currentUserId, user?.id])


  // Appliquer les filtres et mettre à jour la source avec les événements filtrés
  // Les clusters doivent être recalculés avec seulement les événements filtrés (via setData())
  // setFilter() ne suffit pas car les clusters sont calculés à partir des données de la source
  // Note: setData() déclenche un re-rendu MapLibre (pas React), nécessaire pour mettre à jour la carte
  // ⚠️ Les dépendances doivent être stables pour éviter les appels setData() inutiles
  useEffect(() => {
    // setData() n'est appelé que lorsque l'utilisateur utilise la FilterBar
    // À ce moment, la map et les données sont déjà chargées
    const map = mapRef.current?.getMap()
    const source = map?.getSource('events') as any
    if (!source?.setData) return

    // Utiliser directement les events filtrés depuis la prop
    const eventsToDisplay = filteredEvents

    // Mapper les réponses pour les événements à afficher
    const userResponsesMapForDisplay = userResponsesMapper(eventsToDisplay, responses, currentUserId || undefined)

    // Créer le GeoJSON avec seulement les événements à afficher (pour recalculer les clusters)
    const geoJsonToDisplay = createEventsGeoJSON(eventsToDisplay, userResponsesMapForDisplay)

    try {
      // Mettre à jour la source avec les événements à afficher (MapLibre recalcule automatiquement les clusters)
      // Cela déclenche un re-rendu MapLibre (pas React) pour afficher les nouvelles données
      source.setData(geoJsonToDisplay)
    } catch (error) {
      console.error('[MapRenderer] setData error:', error)
    }
  }, [filteredEvents, responses])


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
          /* Désactiver la rotation et le pitch pour garder une vue zénithale */
          dragRotate={false}
          pitch={0}
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

// Export direct sans React.memo pour permettre les re-renders quand les filtres changent
// Les filtres sont gérés via useFilters() à l'intérieur du composant
// React.memo bloquait les re-renders nécessaires pour la mise à jour du filtersSnapshot
export const MapRenderer = MapRendererComponent

export { addTemporaryEvent }
