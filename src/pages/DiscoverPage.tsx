/**
 * FOMO MVP - Discover Page
 *
 * Page de découverte d'événements autour de l'utilisateur
 */


import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react'
import { MapRenderer } from '@/map/MapRenderer'
import { EventCard, Button } from '@/components'
import { useFilters } from '@/contexts/FiltersContext'
import { useFomoDataContext } from '@/contexts/FomoDataProvider'
import { useAuth } from '@/contexts/AuthContext'
import { usePrivacy } from '@/contexts/PrivacyContext'
import type { Event } from '@/types/fomoTypes'
import { FilterBar } from '@/components/ui/FilterBar'
import { userResponsesMapper } from '@/utils/filterTools'
import { WelcomeScreen } from '@/components/modals/WelcomeScreen'

interface DiscoverPageProps {
  isModalOpen: (modalID: string) => boolean
  onMapReady?: () => void
  isVisitorMode?: boolean
  visitorEvent?: Event | null
  onEventCardMount?: () => void
  onVisitorFormCompleted?: (organizerName: string) => void
  visitorSelectedEvent?: Event | null // EventCard contrôlée depuis le parent en mode visitor
  onVisitorSelectedEventChange?: (event: Event | null) => void // Callback pour changer l'événement sélectionné
}

const DiscoverPage: React.FC<DiscoverPageProps> = ({
  isModalOpen,
  onMapReady,
  isVisitorMode = false,
  visitorEvent = null,
  onEventCardMount,
  onVisitorFormCompleted,
  visitorSelectedEvent = null,
  onVisitorSelectedEventChange
}) => {
  const { getLocalDiscoverEvents } = useFilters()
  const { responses } = useFomoDataContext()
  const { user, isAuthenticated } = useAuth()
  const { isPublicMode } = usePrivacy()

  // État local pour l'événement sélectionné (affiché en overlay)
  // En mode visitor, utiliser l'état contrôlé depuis le parent si fourni
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

  // En mode visitor, utiliser l'état contrôlé si le callback est fourni
  const actualSelectedEvent = isVisitorMode && onVisitorSelectedEventChange && visitorSelectedEvent !== undefined
    ? visitorSelectedEvent
    : selectedEvent
  // État pour afficher les pins fantômes (teaser) en mode visiteur
  const [showTeaserPins, setShowTeaserPins] = useState(false)
  // État pour afficher WelcomeScreen depuis le bouton CTA
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false)
  // Ref pour suivre l'ancienne valeur de isPublicMode
  const prevIsPublicModeRef = useRef(isPublicMode)

  // En mode visitor, utiliser directement visitorEvent
  const filteredEvents = isVisitorMode && visitorEvent ? [visitorEvent] : getLocalDiscoverEvents().events

  // En mode visitor, l'EventCard est géré par le parent (VisitorModeContent)
  // On ne l'ouvre plus automatiquement ici


  // Notifier le parent que l'EventCard est monté
  useEffect(() => {
    if (isVisitorMode && actualSelectedEvent && onEventCardMount) {
      onEventCardMount()
    }
  }, [isVisitorMode, actualSelectedEvent, onEventCardMount])

  // Construire userResponses pour MapRenderer (seulement ici car utilisé uniquement pour le styling des markers)
  const userResponses = useMemo(() => {
    const responsesWithUserId = responses.map(r => ({
      eventId: r.eventId,
      userId: r.userId,
      response: r.response
    }))
    return userResponsesMapper(filteredEvents, responsesWithUserId, user?.id)
  }, [filteredEvents, responses, user?.id])

  // Fermer l'EventCard si ouvert lors de l'ouverture d'un modal
  useEffect(() => {
    if (isModalOpen('createEvent') && selectedEvent) {
      setSelectedEvent(null)
    }
  }, [isModalOpen, selectedEvent])

  // Fonction pour générer des points aléatoires dans un rayon de 50km
  const generateRandomPointsInRadius = useCallback((centerLat: number, centerLng: number, radiusKm: number, count: number): Array<{ lat: number; lng: number }> => {
    const points: Array<{ lat: number; lng: number }> = []
    // 1 degré de latitude ≈ 111 km
    const degreesPerKm = 1 / 111

    for (let i = 0; i < count; i++) {
      // Angle aléatoire (0 à 2π)
      const angle = Math.random() * 2 * Math.PI
      // Distance aléatoire (0 à radiusKm)
      const distanceKm = Math.random() * radiusKm

      // Conversion en degrés
      const latOffset = distanceKm * degreesPerKm * Math.cos(angle)
      const lngOffset = distanceKm * degreesPerKm * Math.sin(angle) / Math.cos(centerLat * Math.PI / 180)

      points.push({
        lat: centerLat + latOffset,
        lng: centerLng + lngOffset
      })
    }

    return points
  }, [])

  // Générer les fake events (pins fantômes) quand showTeaserPins est activé
  const fakeEvents = useMemo(() => {
    if (!showTeaserPins || !visitorEvent?.venue?.lat || !visitorEvent?.venue?.lng) {
      return []
    }

    const points = generateRandomPointsInRadius(
      visitorEvent.venue.lat,
      visitorEvent.venue.lng,
      50, // 50km de rayon
      50  // 50 pins
    )

    return points.map((point, index) => ({
      id: `fake-${index}`,
      venue: {
        lat: point.lat,
        lng: point.lng,
        name: '',
        address: ''
      },
      title: '',
      isPublic: true,
      isOnline: true
    } as Event))
  }, [showTeaserPins, visitorEvent, generateRandomPointsInRadius])

  // Fermer WelcomeScreen si l'utilisateur se connecte
  useEffect(() => {
    if (isAuthenticated && showWelcomeScreen) {
      setShowWelcomeScreen(false)
      setShowTeaserPins(false)
    }
  }, [isAuthenticated, showWelcomeScreen])

  // Détecter le toggle privacy et activer les pins fantômes en mode visiteur
  useEffect(() => {
    if (prevIsPublicModeRef.current !== isPublicMode) {
      prevIsPublicModeRef.current = isPublicMode
      // En mode visiteur, activer les pins fantômes après toggle privacy
      if (isVisitorMode) {
        setShowTeaserPins(true)
        // Faire un zoom out modéré pour voir plus d'événements
        setTimeout(() => {
          if ((window as any).zoomOutMap) {
            (window as any).zoomOutMap(8, 20000)
          }
        }, 100)
      }
      // Note: on ne ferme plus automatiquement l'EventCard au toggle privacy en mode visitor
      // car il se ferme déjà automatiquement après complétion du formulaire
    }
  }, [isPublicMode, isVisitorMode])

  // Combiner les vrais events avec les fake events
  const allEventsToDisplay = useMemo(() => {
    if (showTeaserPins && fakeEvents.length > 0) {
      return [...filteredEvents, ...fakeEvents]
    }
    return filteredEvents
  }, [filteredEvents, fakeEvents, showTeaserPins])

  // Handlers de la carte
  const handleEventClick = useCallback((event: Event | null) => {
    // En mode visitor, désactiver les clics (mais permettre navigation/zoom)
    if (isVisitorMode) {
      return
    }
    setSelectedEvent(event)
  }, [isVisitorMode])

  const handleClusterClick = useCallback((_feature: unknown) => {
    // En mode visitor, désactiver les clics sur cluster
    if (isVisitorMode) {
      return
    }
    // Fermer l'EventCard si ouvert lors d'un clic sur cluster
    setSelectedEvent(null)
  }, [isVisitorMode])

  return (
    <>
      <div className="map-container">
        <MapRenderer
          events={allEventsToDisplay}
          userResponses={userResponses}
          onEventClick={handleEventClick}
          onClusterClick={handleClusterClick}
          onMapReady={onMapReady}
          autoCenterEvent={isVisitorMode && visitorEvent ? visitorEvent : undefined}
        />

        {/* FilterBar en overlay centré - masquée en mode visitor */}
        {!isVisitorMode && (
          <div className="filterbar-overlay">
            <div className="filterbar-card">
              <FilterBar />
            </div>
          </div>
        )}
      </div>

      {/* Teaser en bas de page (mode visiteur après toggle privacy) */}
      {showTeaserPins && (
        <div className="modal_container">
          <div className="modal modal-teaser">
            <div className="modal-content">
              <p className="map-teaser-message">
                Rejoins-nous et découvre les événements autour de toi !
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={() => setShowWelcomeScreen(true)}
                className="map-teaser-cta"
              >
                <span className="map-teaser-text" data-size="xs">
                  <span className="map-teaser-word"> G
                    <img
                      src="/globe-icon.svg"
                      alt="O"
                      style={{
                        height: '1em',
                        width: '1em',
                        display: 'block',
                        filter: 'brightness(0) invert(1)',
                        transform: 'translateY(-0.05em)'
                      }}
                    />
                  </span>
                  <span className="map-teaser-word">
                    <img
                      src="/lock-icon.svg"
                      alt="O"
                      style={{
                        height: '1em',
                        width: '1em',
                        display: 'block',
                        filter: 'brightness(0) invert(1)',
                        transform: 'translateY(-0.05em)'
                      }}
                    />N
                  </span>
                  <span className="map-teaser-word">F
                    <img
                      src="/globe-icon.svg"
                      alt="O"
                      style={{
                        height: '1em',
                        width: '1em',
                        display: 'block',
                        filter: 'brightness(0) invert(1)',
                        transform: 'translateY(-0.05em)'
                      }}
                    />
                    M
                    <img
                      src="/lock-icon.svg"
                      alt="O"
                      style={{
                        height: '1em',
                        width: '1em',
                        display: 'block',
                        filter: 'brightness(0) invert(1)',
                        transform: 'translateY(-0.05em)'
                      }}
                    />
                  </span>
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* WelcomeScreen en fondu par-dessus la carte */}
      {showWelcomeScreen && (
        <WelcomeScreen />
      )}

      {actualSelectedEvent && (
        <div className="event-card-container">
          <EventCard
            key={actualSelectedEvent.id}
            event={actualSelectedEvent}
            showToggleResponse={true}
            isFading={false}
            isVisitorMode={isVisitorMode}
            onClose={() => {
              // En mode visitor, utiliser le callback du parent si fourni
              if (isVisitorMode && onVisitorSelectedEventChange) {
                onVisitorSelectedEventChange(null)
              } else if (!isVisitorMode) {
                setSelectedEvent(null)
              }
            }}
            onVisitorFormCompleted={onVisitorFormCompleted}
          />
        </div>
      )}
    </>
  )
}


export default DiscoverPage
