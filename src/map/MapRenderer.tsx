/**
 * FOMO MVP - MapRenderer
 *
 * Composant de rendu de carte utilisant MapLibre GL JS + react-map-gl
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
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
import { userResponsesMapper } from '@/utils/filterTools'
import { getDefaultViewState } from './utils'
import { MAP_CONFIG, CLUSTER_CONFIG } from './config'
import { createEventsSource, addTemporaryEvent } from './sources'
import { getEventLayers, getFakeEventLayers } from './layers'


// ===== COMPOSANT =====
const MapRendererComponent: React.FC<MapViewProps> = (
  {
    events,
    filteredEventIds,
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
  const { responses, currentUserId, dataReady } = useDataContext()

  // Récupérer l'utilisateur pour la position par défaut de la carte
  const { user } = useAuth()

  const mapRef = useRef<MapRef>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const popAnimationFrameRef = useRef<number | null>(null)
  const popPhasesRef = useRef<globalThis.Map<string, number>>(new globalThis.Map<string, number>())
  const pulseAnimationFrameRef = useRef<number | null>(null)
  const pulseAnimationStartedRef = useRef<boolean>(false) // Track si l'animation a déjà été démarrée
  const fakePinsSourceRef = useRef<any>(null)
  const mapReadyCalledRef = useRef(false) // Garde pour n'appeler onMapReady qu'une seule fois

  // Comparer events par IDs (pas par référence) pour éviter les recréations inutiles
  const eventsIds = useMemo(() => {
    return events?.map(e => e.id).sort().join(',') || ''
  }, [events])

  // Ref pour stocker events
  const eventsRef = useRef(events)
  eventsRef.current = events

  // Capturer les réponses initiales (snapshot stable)
  const initialResponsesRef = useRef(responses)

  // Mettre à jour le snapshot des réponses uniquement quand events ou user change
  useEffect(() => {
    initialResponsesRef.current = responses
  }, [eventsIds, currentUserId, responses])

  // Séparer les vrais événements des fake events
  const realEventsOnly = useMemo(() => {
    return events?.filter((e: Event) => !(e as any).isFake && !e.id.startsWith('fake-')) || []
  }, [eventsIds, events])

  // Mapper les réponses utilisateur pour la source
  // Utiliser responses directement (pas la ref) pour que le useMemo se recalcule quand responses change
  const userResponsesMapForSource = useMemo(() => {
    return userResponsesMapper(realEventsOnly, responses, currentUserId || undefined)
  }, [realEventsOnly, currentUserId, responses])

  // Désactiver le clustering en mode visitor (un seul événement réel)
  const isVisitorMode = useMemo(() => realEventsOnly.length === 1, [realEventsOnly.length])

  // Créer la source GeoJSON pour MapLibre
  const eventsSource = useMemo(() => {
    return realEventsOnly.length > 0
      ? createEventsSource(realEventsOnly, userResponsesMapForSource, isVisitorMode)
      : null
  }, [realEventsOnly, userResponsesMapForSource, isVisitorMode])

  // Fonction helper pour centrer sur un événement avec flyTo
  // flyTo crée une animation de "vol" avec arc qui gère automatiquement la séquence
  // Zoom à 12 pour éviter les conflits avec le clustering (maxZoom: 10)
  // Une marge de 2 niveaux de zoom évite les instabilités visuelles pendant l'animation
  const centerOnPin = useCallback((event: Event, duration?: number) => {
    if (mapRef.current?.getMap && event.venue) {
      const map = mapRef.current.getMap()
      const targetZoom = 12 // Marge de 2 niveaux par rapport au maxZoom du clustering (10) pour stabilité
      const targetCenter: [number, number] = [event.venue.lng, event.venue.lat - targetZoom / 500]

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
          userResponse: '', // Initialiser userResponse à vide (sera mis à jour via feature-state)
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
          ; (map.getSource('fake-events') as any).setData(fakeGeoJSON)
        } else {
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

      // Démarrer l'animation pop
      if (popAnimationFrameRef.current === null) {
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
          const sourceName = eventId.startsWith('fake-') ? 'fake-events' : 'events'
          try {
            if (!response) {
              // Supprimer la réponse
              map.removeFeatureState({ source: sourceName, id: eventId }, 'userResponse')
              // Définir pulse à 1.0 (opacité normale) pour éviter les erreurs MapLibre
              map.setFeatureState({ source: sourceName, id: eventId }, { pulse: 1.0 })
            } else {
              // Définir la réponse
              map.setFeatureState({ source: sourceName, id: eventId }, { userResponse: response })
              // Si la réponse n'est plus "linked" ou "invited", définir pulse à 1.0 (opacité normale)
              if (response !== 'linked' && response !== 'invited') {
                map.setFeatureState({ source: sourceName, id: eventId }, { pulse: 1.0 })
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
        // Exposer fadeOutFakePins pour DiscoverPage
        ; (window.fadeOutFakePins = () => {
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

    // Helper pour marquer la carte comme prête (évite duplication)
    // Ne pas appeler onMapReady plusieurs fois même si handleMapLoad est appelé plusieurs fois
    const markMapAsReady = () => {
      setMapLoaded(true)
      if (!mapReadyCalledRef.current) {
        mapReadyCalledRef.current = true
        onMapReady?.()
      }
    }

    // Enregistrer l'icône 'pin' dès le chargement de la carte puis marquer mapLoaded
    try {
      const has = map.hasImage && map.hasImage('pin')
      if (has) {
        markMapAsReady()
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
        // Quoi qu'il arrive, marquer la carte comme prête
        markMapAsReady()
      })
    } catch {
      markMapAsReady()
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

    // Attendre que dataReady soit true avant d'initialiser le pulse
    if (!dataReady) return

    // Récupérer les IDs filtrés depuis la prop (ou tous les IDs si pas de filtre)
    const currentEvents = eventsRef.current || []
    const idsToFilter = filteredEventIds || currentEvents.map(e => e.id)

    // Vérifier si les IDs ont changé (éviter les appels setData() inutiles)
    const idsChanged =
      idsToFilter.length !== prevFilteredIdsRef.current.length ||
      !idsToFilter.every(id => prevFilteredIdsRef.current.includes(id))

    if (!idsChanged) {
      // Les filtres n'ont pas changé, pas besoin de mettre à jour la source
      return
    }

    prevFilteredIdsRef.current = idsToFilter
    const filteredIdsSet = new Set(idsToFilter)

    // Filtrer les événements pour ne garder que ceux qui passent les filtres
    const filteredEvents = currentEvents.filter(e => filteredIdsSet.has(e.id))

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

      // Initialiser le pulse pour les événements "linked" ou "invited"
      // dataReady garantit que la map et les données sont prêtes
      if (!pulseAnimationStartedRef.current && filteredEvents.length > 0) {
        const linkedOrInvitedEvents = filteredEvents.filter((e: Event) => {
          const response = userResponsesMapForFiltered[e.id]
          return response === 'linked' || response === 'invited'
        })

        if (linkedOrInvitedEvents.length > 0) {
          pulseAnimationStartedRef.current = true

          // Attendre un court délai après setData pour que MapLibre traite les features
          setTimeout(() => {
            // Initialiser le feature-state pulse
            linkedOrInvitedEvents.forEach((event: Event) => {
              try {
                map.setFeatureState({ source: 'events', id: event.id }, { pulse: 0.2 })
              } catch (e) {
                // Ignorer si le feature-state n'existe pas encore
              }
            })

            // Démarrer l'animation pulse avec requestAnimationFrame (boucle infinie)
            if (pulseAnimationFrameRef.current === null) {
              const PULSE_PERIOD = 1000 // 1 seconde
              let startTime = performance.now()

              const tick = (now: number) => {
                if (!map || !map.getSource('events')) {
                  pulseAnimationFrameRef.current = null
                  return
                }

                // Utiliser le modulo pour faire boucler l'animation indéfiniment
                const elapsed = (now - startTime) % PULSE_PERIOD

                // Calculer l'opacité avec une fonction sinusoïdale qui boucle (plage 0.2 à 1.0)
                const normalizedPulse = 0.5 - 0.5 * Math.cos((elapsed / PULSE_PERIOD) * 2 * Math.PI)
                const opacity = 0.2 + 0.8 * normalizedPulse

                // Mettre à jour tous les événements linked/invited
                linkedOrInvitedEvents.forEach((event: Event) => {
                  try {
                    map.setFeatureState({ source: 'events', id: event.id }, { pulse: opacity })
                  } catch (e) {
                    // Ignorer si le feature-state n'existe pas
                  }
                })

                // Continuer l'animation en boucle
                pulseAnimationFrameRef.current = requestAnimationFrame(tick)
              }

              pulseAnimationFrameRef.current = requestAnimationFrame(tick)
            }
          }, 100) // Délai de 100ms pour laisser MapLibre traiter setData
        } else {
          pulseAnimationStartedRef.current = true
        }
      }
    } catch (error) {
      console.error('[MapRenderer] setData error:', error)
    }

    return () => {
      // Cleanup : arrêter l'animation pulse si le composant est démonté ou les dépendances changent
      if (pulseAnimationFrameRef.current !== null) {
        cancelAnimationFrame(pulseAnimationFrameRef.current)
        pulseAnimationFrameRef.current = null
      }
    }
  }, [mapLoaded, events, filteredEventIds, currentUserId, dataReady])

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
