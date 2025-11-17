/**
 * FOMO MVP - Discover Page
 *
 * Page de découverte d'événements autour de l'utilisateur
 */

import React, { useCallback, useState, useEffect, useRef, useMemo } from 'react'
import { MapRenderer } from '@/map/MapRenderer'
import { EventCard } from '@/components/ui/EventCard'
import { FilterBar } from '@/components/ui/FilterBar'
import { useDataContext } from '@/contexts/DataContext'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { useAuth } from '@/contexts/AuthContext'
import { useFilters } from '@/hooks'
import type { Event, UserResponseValue } from '@/types/fomoTypes'
import { useStarsAnimation } from '@/onboarding/hooks/useStarsAnimation'
import { useDevice } from '@/contexts/DeviceContext'
import { useToast } from '@/hooks'
import { PREDEFINED_FAKE_EVENTS } from '@/utils/fakeEventsData'

// ===== TYPES =====
interface VisitorModeProps {
  enabled: boolean
  responseButtonsDisabled?: boolean // Désactive les boutons réponse (avant response_enabled)
  onLabelClick?: () => void
  onPinClick?: () => void // Callback quand un pin est cliqué (pour transition event_loaded → show_details)
  onResponseClick?: (response: UserResponseValue) => void // Callback quand une réponse est cliquée (pour transition response_enabled → response_given)
  onEventCardClose?: () => void // Callback quand l'EventCard est fermée (pour transition response_given → eventcard_closed)
}

interface DiscoverPageProps {
  isModalOpen?: (modalID: string) => boolean // Optionnel : uniquement utilisé en mode normal (pas visitor)
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
  const { events, eventFromUrl } = useDataContext()
  const { isPublicMode } = usePrivacy()
  const { user } = useAuth()
  const { platformInfo } = useDevice()
  const { showToast, hideToast } = useToast()
  const { applyCurrentFilters } = useFilters()

  // ===== ÉTATS LOCAUX =====
  // Unifier les sources visitor via visitorMode si fourni
  const vmEnabled = !!visitorMode?.enabled
  const vmResponseButtonsDisabled = visitorMode?.responseButtonsDisabled ?? false
  const vmOnLabelClick = visitorMode?.onLabelClick
  const vmOnPinClick = visitorMode?.onPinClick
  const vmOnResponseClick = visitorMode?.onResponseClick
  const vmOnEventCardClose = visitorMode?.onEventCardClose

  // Note: eventFromUrl est déjà inclus dans events par DataContext, pas besoin de le récupérer séparément

  // En mode visitor, ne pas ouvrir EventCard automatiquement au démarrage
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)

  // État pour contrôler l'animation d'entrée de la FilterBar (identique à la réapparition)
  const [shouldShowFilterBar, setShouldShowFilterBar] = useState(false)

  // Animation des étoiles pour les réponses (mode normal uniquement)
  const { triggerStars, StarsAnimation } = useStarsAnimation()

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

  // Désactiver le scroll du viewport quand une EventCard est ouverte
  // IMPORTANT : Utiliser seulement overflow: hidden, pas position: fixed
  // position: fixed sur body cause une réduction du viewport sur mobile (barre d'adresse)
  // Voir commentaire dans src/styles/components/_modals.css ligne 6
  const savedScrollPositionRef = useRef<number>(0)
  useEffect(() => {
    if (selectedEvent) {
      // Sauvegarder la position de scroll actuelle dans une ref
      // (on ne peut plus utiliser body.style.top car on n'utilise pas position: fixed)
      savedScrollPositionRef.current = window.scrollY

      // Désactiver le scroll du body avec seulement overflow: hidden
      // Cela évite la réduction du viewport sur mobile
      document.body.style.overflow = 'hidden'
      // NE PAS utiliser position: fixed car cela retire le body du flux normal
      // et cause des problèmes de recalcul du viewport sur mobile
    } else {
      // Réactiver le scroll du body
      document.body.style.overflow = ''

      // Restaurer la position de scroll sauvegardée
      // Utiliser requestAnimationFrame pour s'assurer que le DOM est prêt
      requestAnimationFrame(() => {
        window.scrollTo(0, savedScrollPositionRef.current)
      })
    }
    // Cleanup : réactiver le scroll si le composant est démonté
    return () => {
      document.body.style.overflow = ''
      // Restaurer la position de scroll sauvegardée (sera 0 si jamais sauvegardée)
      // Utiliser requestAnimationFrame pour s'assurer que le DOM est prêt
      requestAnimationFrame(() => {
        window.scrollTo(0, savedScrollPositionRef.current)
      })
    }
  }, [selectedEvent])

  // Détecter la fermeture de l'EventCard en mode visitor et notifier OnboardingStateContext
  const prevSelectedEventRef = useRef<Event | null>(null)
  useEffect(() => {
    // Détecter quand selectedEvent passe de non-null à null (fermeture de l'EventCard)
    if (vmEnabled && vmOnEventCardClose && prevSelectedEventRef.current !== null && selectedEvent === null) {
      vmOnEventCardClose()
    }
    prevSelectedEventRef.current = selectedEvent
  }, [vmEnabled, vmOnEventCardClose, selectedEvent])

  // ===== CALCUL DES EVENTS À AFFICHER =====
  // Le backend filtre déjà les événements selon mode/privacy (visitor/user, public/private)
  // DataContext ajoute déjà eventFromUrl à events (si présent)
  // + Ajout de fake events (visitor + public uniquement, protection données)
  const mapEvents = useMemo(() => {
    // Cas spécial : Visitor + public → ajouter fake events (protection données)
    // Le backend retourne un tableau vide pour ce cas
    if (user.isVisitor && isPublicMode) {
      return PREDEFINED_FAKE_EVENTS
    }

    // Tous les autres cas : passer TOUS les événements à MapRenderer
    return events
  }, [user.isVisitor, isPublicMode, events])

  // ===== CALCUL DES EVENTS FILTRÉS =====
  // Calculer les events filtrés pour MapRenderer
  // MapRenderer utilisera setData() pour mettre à jour la source et recalculer les clusters
  const filteredEvents = useMemo(() => {
    if (user.isVisitor) {
      return mapEvents
    }
    return applyCurrentFilters(mapEvents)
  }, [mapEvents, applyCurrentFilters])

  // ===== TOAST POUR EXISTING VISITOR =====
  // Afficher un toast personnalisé pour l'existing visitor sans event dans l'URL
  useEffect(() => {
    // Vérifier si c'est un existing visitor (visitor mais pas nouveau)
    const isExistingVisitor = user.isVisitor && !user.isNewVisitor

    // Vérifier qu'il n'y a pas de paramètre ?event= dans l'URL
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const hasEventParam = urlParams?.get('event') !== null

    // Afficher le toast uniquement si existing visitor sans event
    if (isExistingVisitor && !hasEventParam && !vmEnabled) {
      // Récupérer le nom du visitor depuis user
      const visitorName = user.name && user.name.trim() ? user.name.trim() : 'visiteur'

      // Afficher le toast après un court délai pour laisser la carte se charger
      const timer = setTimeout(() => {
        showToast({
          title: `Bonjour ${visitorName} ! Comment ça va aujourd'hui ?`,
          message: 'Voici les events pour lesquels tu as été invité, pour changer ta réponse, tap sur le pin !',
          type: 'info',
          position: 'top',
          duration: 4000 // 8 secondes pour laisser le temps de lire
        })
      }, 2000) // Délai de 2s après le chargement

      return () => {
        clearTimeout(timer)
      }
    }
  }, [user.isVisitor, user.isNewVisitor, vmEnabled, showToast])

  // ===== TOAST POUR MODE PRIVÉ SANS ÉVÉNEMENTS =====
  // Afficher un toast si mode privé et aucun événement privé disponible
  // Note: Si le composant est rendu, DataReadyGuard a déjà validé que les données sont prêtes
  useEffect(() => {
    // Ne pas afficher en mode visitor ou en mode visitor onboarding
    if (user.isVisitor || vmEnabled) {
      return
    }

    // Ne pas afficher en mode public
    if (isPublicMode) {
      return
    }

    // Vérifier si aucun événement privé (événements de la source, pas filtrés)
    if (events.length === 0) {
      const timer = setTimeout(() => {
        showToast({
          title: '📅 Tu n\'as pas d\'événements privés actuellement.',
          message: 'Crées-en un (➕) et invite des amis à y participer ! 🤗',
          type: 'info',
          position: 'top',
          duration: 4000
        })
      }, 4000) // Délai de 4s après le chargement

      return () => {
        clearTimeout(timer)
      }
    }
  }, [user.isVisitor, vmEnabled, isPublicMode, events.length, showToast])

  // ===== HANDLERS =====

  // Fonction helper pour fermer toutes les EventCards
  const closeAllEventCards = useCallback(() => {
    // Zoom out avec easing ease-out à la fermeture de l'EventCard
    if (window.zoomOutOnPin) {
      window.zoomOutOnPin()
    }
    setSelectedEvent(null)
  }, [])

  // Exposer la fonction de fermeture globalement (utilisée par EventCard et clics en dehors)
  useEffect(() => {
    window.closeEventCard = () => {
      closeAllEventCards()
    }
    return () => {
      delete window.closeEventCard
    }
  }, [closeAllEventCards])

  // Handler commun pour les clics sur les événements (mode normal et visitor)
  const handleEventClick = useCallback((event: Event | null) => {
    // Clic sur la carte (sans features) - fermer toutes les EventCards
    if (!event) {
      closeAllEventCards()
      // En mode visitor, la fermeture est détectée via selectedEvent dans OnboardingStateContext
      return
    }

    // Utiliser un seul état selectedEvent pour tous les événements (vrais et fake)
    setSelectedEvent(event)

    // En mode visitor, notifier l'ouverture d'un pin
    if (vmEnabled && vmOnPinClick) {
      vmOnPinClick()
    }
  }, [vmEnabled, closeAllEventCards, vmOnPinClick])

  // Handler pour quand la carte est prête
  const handleMapReady = useCallback(() => {
    onMapReady?.()
  }, [onMapReady])

  // Centrer la carte sur eventFromUrl pour user authentifié avec paramètre event dans l'URL
  const [mapReady, setMapReady] = useState(false)
  useEffect(() => {
    if (onMapReady) {
      setMapReady(true)
    }
  }, [onMapReady])

  useEffect(() => {
    // Centrer uniquement pour user authentifié (pas visitor) avec eventFromUrl
    if (!user.isVisitor && mapReady && eventFromUrl && typeof window !== 'undefined') {
      const centerMapOnEvent = window.centerMapOnEvent
      if (centerMapOnEvent) {
        const timer = setTimeout(() => {
          centerMapOnEvent(eventFromUrl, 3000)
        }, 500)

        return () => clearTimeout(timer)
      }
    }
  }, [user.isVisitor, mapReady, eventFromUrl])

  const handleClusterClick = useCallback((_feature: unknown) => {
    if (vmEnabled) {
      return // Désactiver les clics sur cluster en mode visitor
    }
    setSelectedEvent(null) // Fermer l'EventCard si ouvert
  }, [vmEnabled])


  // ===== CALCULS =====
  // (mapEvents déjà défini ligne 90)

  // ===== EFFETS =====

  // Fermer l'EventCard lors de l'ouverture du modal CreateEvent
  // (uniquement en mode normal, pas en mode visitor)
  useEffect(() => {
    if (!vmEnabled && isModalOpen && isModalOpen('createEvent') && selectedEvent) {
      setSelectedEvent(null)
    }
  }, [vmEnabled, isModalOpen, selectedEvent])

  // Détecter le changement de privacy et fermer l'EventCard
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

  // Déclencher l'animation d'entrée de la FilterBar après un court délai (identique à la réapparition)
  useEffect(() => {
    if (user.isVisitor) return
    const timer = setTimeout(() => setShouldShowFilterBar(true), 1000)
    return () => clearTimeout(timer)
  }, [user.isVisitor])


  // Les fonctions de fermeture/ouverture EventCard sont maintenant gérées directement via setSelectedEvent

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
      {/* FilterBar - affichée uniquement pour les users authentifiés (pas visitor) */}
      {/* Masquer la FilterBar quand un EventCard est ouvert (selectedEvent !== null) */}
      {/* Animation d'entrée identique à la réapparition après fermeture EventCard */}
      {!user.isVisitor && (
        <div className={`filterbar-overlay ${selectedEvent ? 'filterbar-overlay--hidden' : ''} ${shouldShowFilterBar ? 'filterbar-overlay--visible' : ''}`}>
          <FilterBar />
        </div>
      )}

      <div className="map-container">
        <MapRenderer
          events={mapEvents}
          filteredEvents={filteredEvents}
          onPinClick={handleEventClick}
          onClusterClick={handleClusterClick}
          onMapReady={handleMapReady}
        />
      </div>

      {/* EventCard unifiée */}
      {selectedEvent && (
        <div
          className={`event-card-container ${(selectedEvent.id || '').startsWith('fake-') || (selectedEvent as any).isFake ? 'fade-in-500ms' : ''}`}
          style={vmEnabled ? { bottom: '5%' } : undefined}
        >
          <EventCard
            key={selectedEvent.id}
            event={selectedEvent}
            showToggleResponse={true}
            showCloseButton={true}
            responseButtonsDisabled={vmEnabled ? vmResponseButtonsDisabled : false}
            onLabelClick={vmEnabled ? vmOnLabelClick : undefined}
            onResponseClick={vmEnabled ? vmOnResponseClick : (responseType) => {
              // Afficher les étoiles quand une réponse est cliquée (mode normal uniquement)
              // En mode visitor, l'animation est gérée par OnboardingStateContext
              let normalizedResponseType: 'participe' | 'maybe' | 'not_there' | undefined
              if (responseType === 'going' || responseType === 'participe') {
                normalizedResponseType = 'participe'
              } else if (responseType === 'interested' || responseType === 'maybe') {
                normalizedResponseType = 'maybe'
              } else if (responseType === 'not_interested' || responseType === 'not_there') {
                normalizedResponseType = 'not_there'
              }
              triggerStars(normalizedResponseType)
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
