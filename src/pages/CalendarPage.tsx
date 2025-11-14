/**
 * FOMO MVP - Calendar Page
 *
 * Page de gestion calendaire des événements auxquels l'utilisateur participe
 */

import React, { useRef, useEffect, useState, useMemo } from 'react'
import { EventCard } from '@/components/ui/EventCard'
import { useFilters } from '@/hooks'
import { useDataContext } from '@/contexts/DataContext'
import { animateWindowScrollTo } from '@/hooks/useModalScrollHint'
import { getLatestResponsesByEvent } from '@/utils/filterTools'
import type { Event, CalendarPeriod, UserResponseValue } from '@/types/fomoTypes'

const CalendarPage: React.FC = () => {
  // 🔄 RÉFÉRENCES POUR LE SCROLL
  const periodRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  // Référence pour tracker si l'animation de scroll initiale a déjà été jouée
  const hasScrolledToTodayRef = useRef(false)

  // État pour suivre quel EventCard a ses détails ouverts (un seul à la fois)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  // Désactiver le scroll du viewport quand une EventCard est ouverte
  // IMPORTANT : Utiliser seulement overflow: hidden, pas position: fixed
  // position: fixed sur body cause une réduction du viewport sur mobile (barre d'adresse)
  // Voir commentaire dans src/styles/components/_modals.css ligne 6
  const savedScrollPositionRef = useRef<number>(0)
  useEffect(() => {
    if (selectedCardId) {
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
  }, [selectedCardId])

  // Sources de données
  const { events, responses, currentUserId, dataReady } = useDataContext()
  const { groupByPeriods } = useFilters()

  // Filtrer les événements pour ne garder que ceux avec réponses positives
  // Réponses positives : "participe", "going", "maybe", "interested"
  const calendarEvents = useMemo(() => {
    if (!currentUserId || !responses || responses.length === 0) {
      return []
    }

    // Réponses positives acceptées
    const positiveResponseValues: UserResponseValue[] = ['participe', 'going', 'maybe', 'interested']

    // Utiliser getLatestResponsesByEvent de filterTools pour obtenir les dernières réponses
    const latestResponsesMap = getLatestResponsesByEvent(responses, currentUserId)

    // Filtrer les événements : ne garder que ceux avec une réponse positive
    return events.filter(event => {
      const latestResponse = latestResponsesMap.get(event.id)
      if (!latestResponse) return false
      return positiveResponseValues.includes(latestResponse.finalResponse)
    })
  }, [events, responses, currentUserId])

  // Grouper les événements filtrés par périodes
  const calendarGrouping = useMemo(() => groupByPeriods(calendarEvents).periods, [groupByPeriods, calendarEvents])

  // Filtrer les périodes pour ne garder que celles contenant des événements du calendrier
  const calendarEventIds = useMemo(() => new Set(calendarEvents.map((e: Event) => e.id)), [calendarEvents])
  const filteredCalendarGrouping = useMemo(() =>
    calendarGrouping.map((period: CalendarPeriod) => ({
      ...period,
      events: period.events.filter((e: Event) => calendarEventIds.has(e.id))
    })).filter((period: CalendarPeriod) => period.events.length > 0)
    , [calendarGrouping, calendarEventIds])

  const isLoading = !dataReady

  // 🔄 POSITIONNEMENT SUR LE PROCHAIN ÉVÉNEMENT PAR RAPPORT À L'HEURE ACTUELLE
  // Ne s'exécute qu'une seule fois lors du premier chargement de la page
  useEffect(() => {
    // Ne jouer l'animation qu'une seule fois
    if (hasScrolledToTodayRef.current) {
      return
    }

    if (filteredCalendarGrouping.length > 0 && !isLoading) {
      // Timer pour le scroll
      let scrollTimer: NodeJS.Timeout | null = null
      let animationFrameId: number | null = null

      // Attendre un peu pour que le DOM soit rendu
      scrollTimer = setTimeout(() => {
        let targetPeriod = null

        // Chercher le prochain événement par rapport à l'heure actuelle
        for (const period of filteredCalendarGrouping) {
          if (period.key === 'past') {
            continue
          }
          if (period.events.length > 0) {
            targetPeriod = period
            break
          }
        }

        // Scroll vers la période cible
        if (targetPeriod) {
          const targetElement = periodRefs.current[targetPeriod.key]
          if (targetElement) {
            // Marquer que l'animation a été jouée
            hasScrolledToTodayRef.current = true

            // Calculer la position cible (top de l'élément)
            const targetRect = targetElement.getBoundingClientRect()
            const targetY = window.scrollY + targetRect.top

            // Animation avec durée personnalisable (1200ms) - fonction unifiée depuis useModalScrollHint
            animationFrameId = animateWindowScrollTo(targetY, 1200)
          } else {
            console.log('❌ Élément non trouvé pour:', targetPeriod.key)
          }
        } else {
          console.log('❌ Aucune période cible trouvée')
        }
      }, 100)

      return () => {
        if (scrollTimer) {
          clearTimeout(scrollTimer)
        }
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId)
        }
      }
    }
  }, [filteredCalendarGrouping, isLoading])

  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Chargement des événements...</p>
      </div>
    )
  }

  return (
    <div className="calendar-page-container">

      {/* Calendrier scrollable */}
      <div className="calendar-timeline">
        {filteredCalendarGrouping.length > 0 ? (
          filteredCalendarGrouping.map((period: CalendarPeriod) => (
            <div
              key={period.key}
              className="calendar-period"
              ref={(el) => {
                periodRefs.current[period.key] = el
              }}
            >


              {/* Barre de division */}
              <div className="calendar-period-divider"></div>
              {/* Label sticky de période */}

              <div className="calendar-period-label">
                {period.label}
              </div>

              {/* Événements de la période */}
              <div className="calendar-period-events">
                {period.events.map((event: Event) => (
                  <div key={event.id} className="event-list-item">
                    <EventCard
                      event={event}
                      showToggleResponse={true}
                      isMyEventsPage={true}
                      isDetailsExpanded={selectedCardId === event.id}
                      onToggleExpanded={() => {
                        // Si cette carte est déjà ouverte, la fermer, sinon l'ouvrir (et fermer les autres)
                        setSelectedCardId(selectedCardId === event.id ? null : event.id)
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="calendar-period-events">
            <div className="event-card" style={{ top: '100px', textAlign: 'center' }}>
              <div className="empty-state-icon">📅</div>
              <div className="empty-state-title">Aucun événement dans votre calendrier</div>
              <div className="empty-state-subtext">Explorer la carte pour découvrir les événements autour de vous.</div>
              <div className="empty-state-subtext">Répondez aux événements pour les voir apparaître ici.</div>
            </div>
          </div>
        )}
      </div>



      {/* Spacer pour éviter que le contenu soit caché par la navbar */}
      <div style={{ height: '80px' }}></div>
    </div>
  )
}

export default CalendarPage