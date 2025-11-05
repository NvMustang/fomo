/**
 * FOMO MVP - Discover Page
 *
 * Page de découverte d'événements autour de l'utilisateur
 */

import React, { useCallback, useState, useMemo, useEffect, useRef } from 'react'
import { MapRenderer } from '@/map/MapRenderer'
import { EventCard } from '@/components'
import { FakeEventCard } from '@/components/ui/FakeEventCard'
import { useFilters } from '@/contexts/FiltersContext'

import { usePrivacy } from '@/contexts/PrivacyContext'
import type { Event } from '@/types/fomoTypes'
import { FilterBar } from '@/components/ui/FilterBar'

import { WelcomeScreen } from '@/components/modals/WelcomeScreen'
import { useStarsAnimation } from '@/components/visitorIntegration'

// ===== TYPES =====
interface VisitorModeProps {
  enabled: boolean
  event?: Event | null
  onEventCardMount?: () => void
  fakePinsLogic?: import('@/components/visitorIntegration').FakePinsLogic
  onResponseClick?: (responseType: import('@/types/fomoTypes').UserResponseValue) => void
  onEventCardClose?: () => void
  starsAnimation?: React.ReactNode
}

interface DiscoverPageProps {
  isModalOpen: (modalID: string) => boolean
  onMapReady?: () => void
  visitorMode?: VisitorModeProps
  onEventCentered?: () => void
}

// ===== COMPOSANT =====
const DiscoverPage: React.FC<DiscoverPageProps> = ({
  isModalOpen,
  onMapReady,
  visitorMode,
  onEventCentered
}) => {
  // ===== HOOKS CONTEXTUELS =====
  const { getMapEvents } = useFilters()
  const { isPublicMode } = usePrivacy()

  // ===== ÉTATS LOCAUX =====
  // Unifier les sources visitor via visitorMode si fourni
  const vmEnabled = !!visitorMode?.enabled
  const vmEvent = visitorMode?.event || null
  const vmFakePins = visitorMode?.fakePinsLogic
  const vmOnResponseClick = visitorMode?.onResponseClick
  const vmOnEventCardMount = visitorMode?.onEventCardMount
  const vmStarsAnimation = visitorMode?.starsAnimation

  // En mode visitor, définir selectedEvent immédiatement pour afficher l'EventCard et masquer l'écran de chargement
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(
    vmEnabled && vmEvent ? vmEvent : null
  )

  // La logique de clic sur les événements est unifiée dans handleEventClick (mode normal et visitor)

  // Utiliser fakePinsLogic si fourni, sinon créer des états locaux (pour compatibilité)
  const showTeaserPins = vmFakePins?.showTeaserPins ?? false
  const showWelcomeScreen = vmFakePins?.showWelcomeScreen ?? false
  const setShowWelcomeScreen = vmFakePins?.setShowWelcomeScreen ?? (() => { })
  const fakeEvents = vmFakePins?.fakeEvents ?? []

  // Synchroniser selectedFakeEvent de fakePinsLogic avec selectedEvent unifié
  const selectedFakeEventFromLogic = vmFakePins?.selectedFakeEvent ?? null

  // Animation des étoiles pour les réponses (mode normal)
  // En mode visitor, utiliser l'animation fournie par visitorMode
  const { triggerStars, StarsAnimation: normalStarsAnimation } = useStarsAnimation()
  const StarsAnimation = vmEnabled && vmStarsAnimation ? vmStarsAnimation : normalStarsAnimation

  // Exposer setSelectedEvent globalement pour LastActivities
  useEffect(() => {
    if (!vmEnabled) {
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
  }, [vmEnabled])

  // ===== CONSTANTES ET CALCULS SIMPLES =====
  // Source stable pour la carte: utiliser getMapEvents (source de vérité selon mode privacy)
  // Mode public : tous les événements de getDiscoverEvents()
  // Mode private : uniquement les événements avec une réponse (exclut null/inexistant)
  const filteredEvents = vmEnabled && vmEvent ? [vmEvent] : getMapEvents()

  // ===== HANDLERS =====
  // Fonction helper pour fermer toutes les EventCards
  const closeAllEventCards = useCallback(() => {
    setSelectedEvent(null)
    // Synchroniser avec fakePinsLogic si en mode visitor
    if (vmEnabled && vmFakePins) {
      vmFakePins.setSelectedFakeEvent(null)
    }
    // En mode visitor, synchroniser selectedEventRef et fermer via la fonction globale
    if (vmEnabled) {
      if ((window as any).__updateVisitorSelectedEventRef) {
        (window as any).__updateVisitorSelectedEventRef(null)
      }
      if ((window as any).__closeEventCard) {
        (window as any).__closeEventCard()
      }
    }
  }, [vmEnabled, vmFakePins])

  // Handler commun pour les clics sur les événements (mode normal et visitor)
  const handleEventClick = useCallback((event: Event | null) => {
    // Clic sur la carte (sans features) - fermer toutes les EventCards
    if (!event) {
      closeAllEventCards()
      return
    }

    // Utiliser un seul état selectedEvent pour tous les événements (vrais et fake)
    // La synchronisation avec fakePinsLogic se fait via useEffect
    if (vmEnabled) {
      // Mode visitor : synchroniser selectedEventRef et utiliser setSelectedEvent via __openEventCard
      if ((window as any).__updateVisitorSelectedEventRef) {
        (window as any).__updateVisitorSelectedEventRef(event)
      }
      if ((window as any).__openEventCard) {
        (window as any).__openEventCard(event)
      }
    } else {
      // Mode normal : utiliser setSelectedEvent directement
      setSelectedEvent(event)
    }
  }, [vmEnabled, closeAllEventCards])

  // Handler pour quand la carte est prête
  const handleMapReady = useCallback(() => {
    // Appeler le callback original si fourni
    onMapReady?.()

    // En mode visitor, centrer sur le pin de l'événement
    if (vmEnabled && vmEvent && vmEvent.venue) {
      // Petit délai pour laisser la carte se stabiliser
      setTimeout(() => {
        if ((window as any).centerMapOnEvent) {
          (window as any).centerMapOnEvent(vmEvent)
          // Appeler onEventCentered après le centrage
          onEventCentered?.()
        }
      }, 100)
    }
  }, [vmEnabled, vmEvent, onMapReady, onEventCentered])

  const handleClusterClick = useCallback((_feature: unknown) => {
    if (vmEnabled) {
      return // Désactiver les clics sur cluster en mode visitor
    }
    setSelectedEvent(null) // Fermer l'EventCard si ouvert
  }, [vmEnabled])


  // ===== CALCULS =====

  const allEventsToDisplay = useMemo(() => {
    if (showTeaserPins && fakeEvents.length > 0) {
      // En mode visitor avec fake pins, afficher uniquement les fake events (pas de vrais events)
      return fakeEvents
    }
    return filteredEvents
  }, [filteredEvents, fakeEvents, showTeaserPins])

  // ===== EFFETS =====
  // Synchroniser selectedFakeEvent de fakePinsLogic avec selectedEvent unifié
  // selectedEvent est la source de vérité principale
  // On synchronise seulement si fakePinsLogic change indépendamment (cas rare)
  useEffect(() => {
    // Si fakePinsLogic a un fake event et que selectedEvent n'est pas déjà ce fake event
    if (selectedFakeEventFromLogic && selectedFakeEventFromLogic !== selectedEvent) {
      const currentIsFake = selectedEvent && ((selectedEvent.id || '').startsWith('fake-') || (selectedEvent as any).isFake)
      // Ne synchroniser que si selectedEvent n'est pas déjà un fake event (pour éviter d'écraser un vrai event)
      if (!currentIsFake) {
        setSelectedEvent(selectedFakeEventFromLogic)
      }
    }
  }, [selectedFakeEventFromLogic])

  // Synchroniser fakePinsLogic quand selectedEvent change et que c'est un fake event
  useEffect(() => {
    if (vmEnabled && vmFakePins) {
      const isFake = selectedEvent && ((selectedEvent.id || '').startsWith('fake-') || (selectedEvent as any).isFake)
      if (isFake && selectedEvent !== selectedFakeEventFromLogic) {
        // Mettre à jour fakePinsLogic seulement si selectedEvent est différent
        vmFakePins.setSelectedFakeEvent(selectedEvent)
      } else if (!selectedEvent && selectedFakeEventFromLogic) {
        // Si selectedEvent est null et que fakePinsLogic a encore un fake event, le réinitialiser
        vmFakePins.setSelectedFakeEvent(null)
      }
    }
  }, [selectedEvent, vmEnabled, vmFakePins, selectedFakeEventFromLogic])
  // Notifier le parent que l'EventCard est monté (mode visitor)
  // Appel immédiat pour masquer l'écran de chargement - l'animation flyTo attendra 2 secondes
  useEffect(() => {
    if (vmEnabled && selectedEvent && vmOnEventCardMount) {
      vmOnEventCardMount()
    }
  }, [vmEnabled, selectedEvent, vmOnEventCardMount])

  // Fermer l'EventCard lors de l'ouverture du modal CreateEvent
  useEffect(() => {
    if (isModalOpen('createEvent') && selectedEvent) {
      setSelectedEvent(null)
    }
  }, [isModalOpen, selectedEvent])

  // Détecter le changement de privacy et fermer l'EventCard
  // (La séquence Public Mode est gérée dans visitorIntegration.tsx)
  const prevIsPublicModeRef = useRef(isPublicMode)
  useEffect(() => {
    // Ne fermer l'EventCard que lors d'un VRAI changement de isPublicMode
    // (pas lors du changement de selectedEvent)
    if (prevIsPublicModeRef.current !== isPublicMode) {
      prevIsPublicModeRef.current = isPublicMode
      // Fermer l'EventCard lors du changement de privacy
      if (selectedEvent) {
        setSelectedEvent(null)
      }
    }
  }, [isPublicMode, selectedEvent])

  // Le toast a été supprimé car le teaser sur la FakeEventCard remplit ce rôle

  // Exposer la fonction de fermeture EventCard pour visitorIntegration
  useEffect(() => {
    if (vmEnabled) {
      const closeEventCard = () => {
        setSelectedEvent(null)
      }
      const openEventCard = (event: Event | null) => {
        if (event) {
          setSelectedEvent(event)
        }
      }
        ; (window as any).__closeEventCard = closeEventCard
        ; (window as any).__openEventCard = openEventCard
      return () => {
        delete (window as any).__closeEventCard
        delete (window as any).__openEventCard
      }
    }
  }, [vmEnabled])

  // Fade-in des pins réels lors de la transition VM → normal
  const [shouldFadeInRealEvents, setShouldFadeInRealEvents] = useState(false)
  const prevVmEnabledRef = useRef(vmEnabled)
  useEffect(() => {
    // Détecter la transition VM désactivé → normal (user connecté)
    if (prevVmEnabledRef.current && !vmEnabled) {
      // Délai de 200ms pour laisser le fade-out des fake pins se terminer
      const t = setTimeout(() => setShouldFadeInRealEvents(true), 200)
      const t2 = setTimeout(() => setShouldFadeInRealEvents(false), 1000)
      return () => { clearTimeout(t); clearTimeout(t2) }
    }
    prevVmEnabledRef.current = vmEnabled
  }, [vmEnabled])

  // Pop FilterBar lors de la transition VM → normal
  const [shouldPopFilterBar, setShouldPopFilterBar] = useState(false)
  useEffect(() => {
    try {
      const shouldPop = sessionStorage.getItem('fomo-pop-filterbar') === 'true'
      if (shouldPop && !vmEnabled) {
        setShouldPopFilterBar(true)
        // Nettoyer après animation
        setTimeout(() => {
          sessionStorage.removeItem('fomo-pop-filterbar')
          setShouldPopFilterBar(false)
        }, 600)
      }
    } catch {
      // Ignorer si sessionStorage indisponible
    }
  }, [vmEnabled])

  return (
    <>
      <div className={`map-container${shouldFadeInRealEvents ? ' map-container--fade-in-real-events' : ''}`}>
        <MapRenderer
          events={allEventsToDisplay}
          onPinClick={handleEventClick}
          onClusterClick={handleClusterClick}
          onMapReady={handleMapReady}
        />

        {/* FilterBar en overlay centré - masquée en mode visitor */}
        {!vmEnabled && (
          <div className={`filterbar-overlay ${shouldPopFilterBar ? 'filterbar-pop' : ''}`}>
            <div className="filterbar-card">
              <FilterBar />
            </div>
          </div>
        )}
      </div>


      {/* WelcomeScreen en fondu par-dessus la carte */}
      {showWelcomeScreen && (
        <WelcomeScreen partialHeight={true} />
      )}

      {/* EventCard unifiée (vraie ou fake) */}
      {selectedEvent && (() => {
        // Détecter si c'est un fake event
        const isFake = (selectedEvent.id || '').startsWith('fake-') || (selectedEvent as any).isFake

        if (isFake) {
          // Afficher FakeEventCard pour les fake events
          return (
            <div className="event-card-container fade-in-500ms">
              <FakeEventCard
                event={selectedEvent}
                variantIndex={vmFakePins?.fakeEventVariantIndex ?? 0}
                onJoinClick={() => {
                  setShowWelcomeScreen(true)
                  // Tracking
                  console.info('🎯 [Analytics] auth_modal_opened')
                }}
              />
            </div>
          )
        } else {
          // Afficher EventCard pour les vrais events
          return (
            <div className="event-card-container">
              <EventCard
                key={selectedEvent.id}
                event={selectedEvent}
                showToggleResponse={true}
                onResponseClick={(responseType) => {
                  // En mode visitor, utiliser le handler visitor
                  if (vmEnabled && vmOnResponseClick) {
                    vmOnResponseClick(responseType)
                  } else {
                    // Afficher les étoiles quand une réponse est cliquée (mode normal)
                    // Normaliser le responseType pour les animations (participe/going, maybe/interested, not_there/not_interested)
                    let normalizedResponseType: 'participe' | 'maybe' | 'not_there' | undefined
                    if (responseType === 'going' || responseType === 'participe') {
                      normalizedResponseType = 'participe'
                    } else if (responseType === 'interested' || responseType === 'maybe') {
                      normalizedResponseType = 'maybe'
                    } else if (responseType === 'not_interested' || responseType === 'not_there') {
                      normalizedResponseType = 'not_there'
                    }
                    triggerStars(normalizedResponseType)
                  }
                }}
              />
            </div>
          )
        }
      })()}
      {/* Animation étoiles scintillantes - rendue dans un portail */}
      {StarsAnimation}
    </>
  )
}

export default DiscoverPage
