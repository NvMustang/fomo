/**
 * FOMO MVP - Calendar Page
 *
 * Page de gestion calendaire des événements auxquels l'utilisateur participe
 */

import React, { useRef, useEffect } from 'react'
import { EventCard } from '@/components'
import { useFilters } from '@/contexts/FiltersContext'

const CalendarPage: React.FC = () => {
  // 🔄 RÉFÉRENCES POUR LE SCROLL
  const periodRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

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
  useEffect(() => {
    if (filteredCalendarGrouping.length > 0 && !isLoading) {
      // Attendre un peu pour que le DOM soit rendu
      const timer = setTimeout(() => {
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

        // Scroll vers la période cible avec gap
        if (targetPeriod) {
          const targetElement = periodRefs.current[targetPeriod.key]
          if (targetElement) {
            // Utiliser scrollIntoView avec block: 'start' puis ajuster avec scrollBy
            targetElement.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            })
          } else {
            console.log('❌ Élément non trouvé pour:', targetPeriod.key)
          }
        } else {
          console.log('❌ Aucune période cible trouvée')
        }
      }, 100)

      return () => clearTimeout(timer)
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