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

// ===== TYPES =====
interface DiscoverPageProps {
  isModalOpen: (modalID: string) => boolean
  onMapReady?: () => void
  isVisitorMode?: boolean
  visitorEvent?: Event | null
  onEventCardMount?: () => void
  onVisitorFormCompleted?: (organizerName: string) => void
  autoCenterEvent?: Event
  onEventCentered?: () => void
}

// ===== COMPOSANT =====
const DiscoverPage: React.FC<DiscoverPageProps> = ({
  isModalOpen,
  onMapReady,
  isVisitorMode = false,
  visitorEvent = null,
  onEventCardMount,
  onVisitorFormCompleted,
  autoCenterEvent,
  onEventCentered
}) => {
  // ===== HOOKS CONTEXTUELS =====
  const { getLocalDiscoverEvents } = useFilters()
  const { getLatestResponsesByEvent } = useFomoDataContext()
  const { user, isAuthenticated } = useAuth()
  const { isPublicMode } = usePrivacy()

  // ===== ÉTATS LOCAUX =====
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [showTeaserPins, setShowTeaserPins] = useState(false)
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false)
  const prevIsPublicModeRef = useRef(isPublicMode)

  // Exposer setSelectedEvent globalement pour LastActivities
  useEffect(() => {
    if (!isVisitorMode) {
      window.setSelectedEventFromProfile = (event: Event) => {
        setSelectedEvent(event)
        // Si on est sur la page Discover, centrer sur l'événement
        if (event.venue) {
          setTimeout(() => {
            if ((window as any).centerMapOnEvent) {
              (window as any).centerMapOnEvent(event)
            }
          }, 100)
        }
      }
    }
    return () => {
      delete (window as any).setSelectedEventFromProfile
    }
  }, [isVisitorMode])

  // ===== CONSTANTES ET CALCULS SIMPLES =====
  const filteredEvents = isVisitorMode && visitorEvent ? [visitorEvent] : getLocalDiscoverEvents().events

  // ===== FONCTIONS UTILITAIRES =====
  const generateRandomPointsInRadius = useCallback((centerLat: number, centerLng: number, radiusKm: number, count: number): Array<{ lat: number; lng: number }> => {
    const points: Array<{ lat: number; lng: number }> = []
    const degreesPerKm = 1 / 111 // 1 degré de latitude ≈ 111 km

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * 2 * Math.PI
      const distanceKm = Math.random() * radiusKm

      const latOffset = distanceKm * degreesPerKm * Math.cos(angle)
      const lngOffset = distanceKm * degreesPerKm * Math.sin(angle) / Math.cos(centerLat * Math.PI / 180)

      points.push({
        lat: centerLat + latOffset,
        lng: centerLng + lngOffset
      })
    }

    return points
  }, [])

  // ===== HANDLERS =====
  // Handlers de la carte
  const handleEventClick = useCallback((event: Event | null) => {
    if (event) {
      setSelectedEvent(event)
    }
  }, [])

  const handleClusterClick = useCallback((_feature: unknown) => {
    if (isVisitorMode) {
      return // Désactiver les clics sur cluster en mode visitor
    }
    setSelectedEvent(null) // Fermer l'EventCard si ouvert
  }, [isVisitorMode])


  // ===== CALCULS MÉMORISÉS =====
  const userResponses = useMemo(() => {
    // NOUVEAU SYSTÈME : Utiliser les helpers pour obtenir les dernières réponses
    if (!user?.id) return {}
    const latestResponsesMap = getLatestResponsesByEvent(user.id)
    const responsesWithUserId = Array.from(latestResponsesMap.values()).map(r => ({
      eventId: r.eventId,
      userId: r.userId,
      response: r.finalResponse // Utiliser finalResponse pour compatibilité avec userResponsesMapper
    }))
    return userResponsesMapper(filteredEvents, responsesWithUserId, user.id)
  }, [filteredEvents, user?.id, getLatestResponsesByEvent])

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

  const allEventsToDisplay = useMemo(() => {
    if (showTeaserPins && fakeEvents.length > 0) {
      return [...filteredEvents, ...fakeEvents]
    }
    return filteredEvents
  }, [filteredEvents, fakeEvents, showTeaserPins])

  // ===== EFFETS =====
  // Notifier le parent que l'EventCard est monté (mode visitor)
  useEffect(() => {
    if (isVisitorMode && selectedEvent && onEventCardMount) {
      onEventCardMount()
    }
  }, [isVisitorMode, selectedEvent, onEventCardMount])


  // Fermer l'EventCard lors de l'ouverture du modal CreateEvent
  useEffect(() => {
    if (isModalOpen('createEvent') && selectedEvent) {
      setSelectedEvent(null)
    }
  }, [isModalOpen, selectedEvent])

  // Gérer autoCenterEvent depuis ProfilePage (legacy, maintenant géré par setSelectedEventFromProfile)
  useEffect(() => {
    if (autoCenterEvent && !isVisitorMode) {
      setSelectedEvent(autoCenterEvent)
      onEventCentered?.()
    }
  }, [autoCenterEvent, isVisitorMode, onEventCentered])

  // Détecter le changement de privacy et fermer l'EventCard
  // Logique spécifique pour les pins fantômes en mode visitor
  useEffect(() => {
    if (prevIsPublicModeRef.current !== isPublicMode) {
      prevIsPublicModeRef.current = isPublicMode
      // Fermer l'EventCard lors du changement de privacy
      if (selectedEvent) {
        setSelectedEvent(null)
      }
      // En mode visiteur, activer les pins fantômes après toggle privacy
      if (isVisitorMode) {
        setShowTeaserPins(true)
        setTimeout(() => {
          if ((window as any).zoomOutMap) {
            (window as any).zoomOutMap(8, 20000)
          }
        }, 100)
      }
    }
  }, [isPublicMode, isVisitorMode, selectedEvent])

  // Fermer WelcomeScreen si l'utilisateur se connecte
  useEffect(() => {
    if (isAuthenticated && showWelcomeScreen) {
      setShowWelcomeScreen(false)
      setShowTeaserPins(false)
    }
  }, [isAuthenticated, showWelcomeScreen])

  return (
    <>
      <div className="map-container">
        <MapRenderer
          events={allEventsToDisplay}
          userResponses={userResponses}
          onEventClick={handleEventClick}
          onClusterClick={handleClusterClick}
          onMapReady={onMapReady}
          autoCenterEvent={
            autoCenterEvent || (isVisitorMode && visitorEvent ? visitorEvent : undefined)
          }
          onEventCentered={onEventCentered}
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

      {selectedEvent && (
        <div className="event-card-container">
          <EventCard
            key={selectedEvent.id}
            event={selectedEvent}
            showToggleResponse={true}
            isFading={false}
            isVisitorMode={isVisitorMode}
            onClose={() => setSelectedEvent(null)}
            onVisitorFormCompleted={onVisitorFormCompleted}
          />
        </div>
      )}
    </>
  )
}


export default DiscoverPage
