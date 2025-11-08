/**
 * FOMO MVP - Calendar Page
 *
 * Page de gestion calendaire des événements auxquels l'utilisateur participe
 */

import React, { useRef, useEffect, useState } from 'react'
import { EventCard } from '@/components/ui/EventCard'
import { useFilters } from '@/contexts/FiltersContext'
import { animateWindowScrollTo } from '@/hooks/useModalScrollHint'

const CalendarPage: React.FC = () => {
  // 🔄 RÉFÉRENCES POUR LE SCROLL
  const periodRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  // Référence pour tracker si l'animation de scroll initiale a déjà été jouée
  const hasScrolledToTodayRef = useRef(false)

  // État pour suivre quel EventCard a ses détails ouverts (un seul à la fois)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)

  // Données pour Calendar: getCalendarEvents() + getOnlineEventsGroupedByPeriods()
  const { getCalendarEvents, getOnlineEventsGroupedByPeriods } = useFilters()
  const { events: calendarEvents, isLoading } = getCalendarEvents()
  const { periods: calendarGrouping } = getOnlineEventsGroupedByPeriods()

  // Filtrer les périodes pour ne garder que celles contenant des événements du calendrier
  const calendarEventIds = new Set(calendarEvents.map(e => e.id))
  const filteredCalendarGrouping = calendarGrouping.map(period => ({
    ...period,
    events: period.events.filter(e => calendarEventIds.has(e.id))
  })).filter(period => period.events.length > 0)

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
          filteredCalendarGrouping.map((period) => (
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
                {period.events.map((event) => (
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