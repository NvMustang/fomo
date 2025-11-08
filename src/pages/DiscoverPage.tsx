/**
 * FOMO MVP - Discover Page
 *
 * Page de découverte d'événements autour de l'utilisateur
 */

import React, { useCallback, useState, useEffect, useRef } from 'react'
import { MapRenderer } from '@/map/MapRenderer'
import { EventCard } from '@/components/ui/EventCard'
import { useFilters } from '@/contexts/FiltersContext'

import { usePrivacy } from '@/contexts/PrivacyContext'
import type { Event } from '@/types/fomoTypes'
import { FilterBar } from '@/components/ui/FilterBar'

import { useStarsAnimation } from '@/onboarding/hooks/useStarsAnimation'
import { useDevice } from '@/contexts/DeviceContext'
import { useToast } from '@/hooks'

// ===== TYPES =====
interface VisitorModeProps {
  enabled: boolean
  event?: Event | null
  fakeEvents?: Event[]
  onResponseClick?: (responseType: import('@/types/fomoTypes').UserResponseValue) => void
  onEventCardClose?: () => void
  starsAnimation?: React.ReactNode
  responseButtonsDisabled?: boolean
  onLabelClick?: () => void
  onEventCardOpened?: (event: Event) => void
  onPinClick?: () => void
  onFakeEventCardOpened?: (event: Event) => void
  getSelectedEvent?: (getter: () => Event | null) => void // Callback pour exposer getSelectedEvent
}

interface DiscoverPageProps {
  isModalOpen: (modalID: string) => boolean
  onMapReady?: () => void
  visitorMode?: VisitorModeProps
}

// ===== COMPOSANT =====
const DiscoverPage: React.FC<DiscoverPageProps> = ({
  isModalOpen,
  onMapReady,
  visitorMode
}) => {
  // ===== HOOKS CONTEXTUELS =====
  const { getAllMapEvents } = useFilters()
  const { isPublicMode } = usePrivacy()
  const { platformInfo } = useDevice()
  const { showToast, hideToast } = useToast()

  // ===== ÉTATS LOCAUX =====
  // Unifier les sources visitor via visitorMode si fourni
  const vmEnabled = !!visitorMode?.enabled
  const vmEvent = visitorMode?.event || null
  const vmFakeEvents = visitorMode?.fakeEvents ?? []
  const vmOnResponseClick = visitorMode?.onResponseClick
  const vmOnEventCardClose = visitorMode?.onEventCardClose
  const vmStarsAnimation = visitorMode?.starsAnimation
  const vmResponseButtonsDisabled = visitorMode?.responseButtonsDisabled ?? false
  const vmOnLabelClick = visitorMode?.onLabelClick
  const vmOnEventCardOpened = visitorMode?.onEventCardOpened
  const vmOnPinClick = visitorMode?.onPinClick
  const vmOnFakeEventCardOpened = visitorMode?.onFakeEventCardOpened

  // En mode visitor, ne pas ouvrir EventCard automatiquement au démarrage
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  
  // Exposer getSelectedEvent pour visitorMode
  const getSelectedEvent = useCallback(() => selectedEvent, [selectedEvent])
  
  // Exposer getSelectedEvent via visitorMode.getSelectedEvent
  useEffect(() => {
    if (vmEnabled && visitorMode?.getSelectedEvent) {
      visitorMode.getSelectedEvent(getSelectedEvent)
    }
  }, [vmEnabled, visitorMode, getSelectedEvent])
  
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
            if (window.centerMapOnEvent) {
              window.centerMapOnEvent(event)
            }
          }, 100)
        }
      }
    }
    return () => {
      delete window.setSelectedEventFromProfile
    }
  }, [vmEnabled])

  // ===== CONSTANTES ET CALCULS SIMPLES =====
  // Source stable pour la carte: utiliser getAllMapEvents (logique unifiée selon mode privacy)
  // Cette fonction gère automatiquement :
  // - Mode public : fakeEvents filtrés (si présents) OU tous les événements réels
  // - Mode privé : visitorEvent + événements avec réponse (pas de fake pins, filtrés automatiquement avec matchPublic)
  const filteredEvents = getAllMapEvents({
    visitorEvent: vmEvent,
    fakeEvents: vmFakeEvents
  })

  // ===== HANDLERS =====
  // Fonction helper pour fermer toutes les EventCards
  // En mode visitor, le callback onEventCardClose est géré par le useEffect qui surveille selectedEvent
  const closeAllEventCards = useCallback(() => {
    setSelectedEvent(null)
  }, [])

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
      // Mode visitor : fermer le toast invitation immédiatement lors du clic sur le pin
      if (vmOnPinClick) {
        vmOnPinClick()
      }
      // Mode visitor : mettre à jour selectedEvent pour afficher l'EventCard
      setSelectedEvent(event)
    } else {
      // Mode normal : utiliser setSelectedEvent directement
      setSelectedEvent(event)
    }
  }, [vmEnabled, closeAllEventCards])

  // Handler pour quand la carte est prête
  const handleMapReady = useCallback(() => {
    // Appeler le callback original si fourni
    onMapReady?.()

    // En mode visitor, le flyTo est géré dans visitorOnboarding.tsx
    // Pas besoin de centrer ici car le flyTo est déjà déclenché
  }, [onMapReady])

  const handleClusterClick = useCallback((_feature: unknown) => {
    if (vmEnabled) {
      return // Désactiver les clics sur cluster en mode visitor
    }
    setSelectedEvent(null) // Fermer l'EventCard si ouvert
  }, [vmEnabled])


  // ===== CALCULS =====

  // Utiliser directement filteredEvents qui contient déjà la logique unifiée
  const allEventsToDisplay = filteredEvents

  // ===== EFFETS =====
  // Plus besoin de synchronisation avec selectedFakeEvent : on utilise uniquement selectedEvent
  // Notifier l'ouverture de l'EventCard (visitor mode) - une seule fois par événement
  const lastNotifiedEventRef = useRef<string | null>(null)
  useEffect(() => {
    if (vmEnabled && selectedEvent && selectedEvent.id !== lastNotifiedEventRef.current) {
      lastNotifiedEventRef.current = selectedEvent.id
      const isFake = (selectedEvent.id || '').startsWith('fake-') || (selectedEvent as any).isFake
      if (isFake && vmOnFakeEventCardOpened) {
        vmOnFakeEventCardOpened(selectedEvent)
      } else if (!isFake && vmOnEventCardOpened) {
        vmOnEventCardOpened(selectedEvent)
      }
    }
    // Reset quand selectedEvent devient null
    if (!selectedEvent) {
      lastNotifiedEventRef.current = null
    }
  }, [vmEnabled, selectedEvent])

  // Appeler onEventCardClose quand selectedEvent passe de non-null à null en mode visitor
  const prevSelectedEventRef = useRef<Event | null>(null)
  useEffect(() => {
    if (vmEnabled && vmOnEventCardClose) {
      // Si selectedEvent passe de non-null à null, appeler onEventCardClose
      if (prevSelectedEventRef.current && !selectedEvent) {
        vmOnEventCardClose()
      }
      prevSelectedEventRef.current = selectedEvent
    }
  }, [vmEnabled, selectedEvent, vmOnEventCardClose])

  // Fermer l'EventCard lors de l'ouverture du modal CreateEvent
  useEffect(() => {
    if (isModalOpen('createEvent') && selectedEvent) {
      setSelectedEvent(null)
    }
  }, [isModalOpen, selectedEvent])

  // Détecter le changement de privacy et fermer l'EventCard
  // (La séquence Public Mode est gérée dans visitorOnboarding.tsx)
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




  // Les fonctions de fermeture/ouverture EventCard sont maintenant gérées directement via setSelectedEvent



  // Pop FilterBar lors de la transition VM → normal ou à l'ouverture de l'app
  const [shouldPopFilterBar, setShouldPopFilterBar] = useState(false)
  const hasTriggeredPopRef = useRef(false)

  useEffect(() => {
    if (vmEnabled) return // Ne pas jouer en mode visitor

    try {
      const shouldPop = sessionStorage.getItem('fomo-pop-filterbar') === 'true'
      if (shouldPop && !hasTriggeredPopRef.current) {
        hasTriggeredPopRef.current = true
        // Nettoyer immédiatement le flag pour éviter les re-déclenchements
        sessionStorage.removeItem('fomo-pop-filterbar')
        setShouldPopFilterBar(true)
        // Nettoyer l'état après animation (3s)
        setTimeout(() => {
          setShouldPopFilterBar(false)
          hasTriggeredPopRef.current = false // Reset pour permettre de rejouer si nécessaire
        }, 3000)
      }
    } catch {
      // Ignorer si sessionStorage indisponible
    }
  }, [vmEnabled]) // Se déclenche au montage (vmEnabled initial) et lors des changements

  // ===== SURVEILLANCE DU VIEWPORT (MOBILE UNIQUEMENT) =====
  // Timer de 30s au montage, puis affichage toast si viewport < seuil
  // Le seuil est défini une fois (viewportHeight * 0.95) quand le viewport augmente
  const viewportThresholdRef = useRef<number | null>(null)
  const initialTimerRef = useRef<number | null>(null)
  const monitoringTimerRef = useRef<number | null>(null)
  const autoHideTimerRef = useRef<number | null>(null)
  const lastViewportHeightRef = useRef<number | null>(null)
  const isToastVisibleRef = useRef(false)
  const [showScrollOverlay, setShowScrollOverlay] = useState(false)

  useEffect(() => {
    // Ne pas surveiller en mode visitor
    if (visitorMode?.enabled) {
      return
    }

    // Ne surveiller que sur mobile avec visualViewport disponible
    if (!platformInfo?.isMobile || !window.visualViewport) {
      return
    }

    // Réinitialiser le seuil et les timers au montage
    viewportThresholdRef.current = null
    lastViewportHeightRef.current = null
    isToastVisibleRef.current = false
    setShowScrollOverlay(false)

    // Fonction pour masquer le toast proprement
    const hideToastSafely = () => {
      if (isToastVisibleRef.current) {
        hideToast()
        isToastVisibleRef.current = false
        setShowScrollOverlay(false)
      }
      if (autoHideTimerRef.current !== null) {
        clearTimeout(autoHideTimerRef.current)
        autoHideTimerRef.current = null
      }
    }

    // Fonction pour afficher le toast
    const displayToast = () => {
      if (isToastVisibleRef.current) return // Éviter les doublons

      isToastVisibleRef.current = true
      setShowScrollOverlay(true)

      // Faire remonter la page tout en haut pour permettre le scroll et masquer les barres
      window.scrollTo({ top: 0, behavior: 'smooth' })

      showToast({
        title: '💡 Conseil',
        message: 'Scroll légèrement vers le haut pour agrandir l\'interface',
        type: 'info',
        position: 'top',
        duration: 5000 // Auto-masquage après 5 secondes
      })

      // Masquer le toast après 5 secondes
      autoHideTimerRef.current = window.setTimeout(() => {
        hideToastSafely()
      }, 5000)
    }

    // Fonction pour vérifier le viewport et gérer le seuil
    const checkViewport = () => {
      const vp = window.visualViewport
      if (!vp) return

      const currentHeight = vp.height
      const previousHeight = lastViewportHeightRef.current

      // Si le viewport a augmenté
      if (previousHeight !== null && currentHeight > previousHeight) {
        // Si on n'a pas encore de seuil, l'enregistrer
        if (viewportThresholdRef.current === null) {
          viewportThresholdRef.current = currentHeight * 0.95
        }
        // Annuler le timer initial si encore actif
        if (initialTimerRef.current !== null) {
          clearTimeout(initialTimerRef.current)
          initialTimerRef.current = null
        }
        // Masquer le toast si visible (même pendant les 5 secondes)
        hideToastSafely()
      }

      // Mettre à jour la dernière hauteur
      lastViewportHeightRef.current = currentHeight

      // Si le seuil est défini, vérifier si on est en dessous
      if (viewportThresholdRef.current !== null) {
        if (currentHeight < viewportThresholdRef.current) {
          // Viewport en dessous du seuil : relancer le timer de 30s si pas déjà lancé
          if (monitoringTimerRef.current === null && !isToastVisibleRef.current) {
            monitoringTimerRef.current = window.setTimeout(() => {
              monitoringTimerRef.current = null
              displayToast()
            }, 30000)
          }
        } else {
          // Viewport au-dessus du seuil : annuler le timer et masquer le toast
          if (monitoringTimerRef.current !== null) {
            clearTimeout(monitoringTimerRef.current)
            monitoringTimerRef.current = null
          }
          hideToastSafely()
        }
      }
    }

    // Lancer le timer initial de 30 secondes au montage
    initialTimerRef.current = window.setTimeout(() => {
      initialTimerRef.current = null
      displayToast()
    }, 30000)

    // Écouter les changements du viewport
    const vp = window.visualViewport
    vp.addEventListener('resize', checkViewport)

    // Vérifier immédiatement pour initialiser lastViewportHeightRef
    checkViewport()

    // Nettoyage au démontage
    return () => {
      if (initialTimerRef.current !== null) {
        clearTimeout(initialTimerRef.current)
        initialTimerRef.current = null
      }
      if (monitoringTimerRef.current !== null) {
        clearTimeout(monitoringTimerRef.current)
        monitoringTimerRef.current = null
      }
      if (autoHideTimerRef.current !== null) {
        clearTimeout(autoHideTimerRef.current)
        autoHideTimerRef.current = null
      }
      if (vp) {
        vp.removeEventListener('resize', checkViewport)
      }
      hideToastSafely()
    }
  }, [platformInfo?.isMobile, showToast, hideToast, visitorMode?.enabled])

  return (
    <>
      <div className="map-container">
        <MapRenderer
          events={allEventsToDisplay}
          onPinClick={handleEventClick}
          onClusterClick={handleClusterClick}
          onMapReady={handleMapReady}
        />

        {/* FilterBar en overlay centré - masquée en mode visitor */}
        {!vmEnabled && (
          <div className={`filterbar-overlay ${shouldPopFilterBar ? 'filterbar-pop' : ''}`}>
            <div 
              className="filterbar-card"
              onClick={(e) => {
                // Fermer l'EventCard lors du clic sur l'input de recherche (filterbar__query)
                const target = e.target as HTMLElement
                if (target.id === 'filterbar-search' || target.closest('.filterbar__query')) {
                  if (selectedEvent) {
                    setSelectedEvent(null)
                  }
                }
              }}
            >
              <FilterBar />
            </div>
          </div>
        )}
      </div>

      {/* WelcomeScreen est maintenant géré dans visitorDiscoverPublicMode */}

      {/* EventCard unifiée (vraie ou fake) */}
      {selectedEvent && (
        <div
          className={`event-card-container ${(selectedEvent.id || '').startsWith('fake-') || (selectedEvent as any).isFake ? 'fade-in-500ms' : ''}`}
          style={vmEnabled ? { bottom: '5%' } : undefined}
        >
          <EventCard
            key={selectedEvent.id}
            event={selectedEvent}
            showToggleResponse={true}
            responseButtonsDisabled={vmEnabled ? vmResponseButtonsDisabled : false}
            onLabelClick={vmEnabled ? vmOnLabelClick : undefined}
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
      )}
      {/* Animation étoiles scintillantes - rendue dans un portail */}
      {StarsAnimation}

      {/* Overlay pour permettre le scroll et réduire les barres du navigateur */}
      {showScrollOverlay && (
        <div className="viewport-scroll-overlay" />
      )}
    </>
  )
}

export default DiscoverPage
