/**
 * LastActivities - Composant pour afficher l'activité récente de l'utilisateur
 * Affiche les 5 dernières réponses aux événements avec détection des changements
 */

import React, { useMemo, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useAuth } from '@/contexts/AuthContext'
import { useFomoDataContext } from '@/contexts/FomoDataProvider'
import type { Event, UserResponseValue } from '@/types/fomoTypes'

declare global {
    interface Window {
        setSelectedEventFromProfile?: (event: Event) => void
        navigateToMapPage?: () => void
    }
}

interface ActivityItem {
    event: Event
    response: 'going' | 'interested' | 'cleared' | 'not_interested'
    previousResponse?: UserResponseValue
    timeAgo: string
    createdAt: Date
    responseId: string // ID unique de la réponse pour la clé React
}

const getResponseLabel = (response: UserResponseValue): string => {
    switch (response) {
        case 'going':
        case 'participe':
            return "J'y vais"
        case 'interested':
            return 'Intéressé'
        case 'not_interested':
            return 'Pas intéressé'
        case 'cleared':
            return 'Vu'
        default:
            return 'Inconnu'
    }
}

export const LastActivities: React.FC = () => {
    const { user } = useAuth()
    const { responses, events, dataReady } = useFomoDataContext()

    // Calculer l'activité récente en utilisant initialResponse/finalResponse du système d'historique
    const recentActivity = useMemo(() => {
        if (!user?.id || !dataReady) return []

        // Récupérer toutes les réponses de l'utilisateur avec changements (initialResponse !== finalResponse)
        const userResponsesWithChanges = responses
            .filter(r =>
                r.userId === user.id &&
                r.initialResponse !== r.finalResponse && // Afficher uniquement les changements
                (r.finalResponse === 'going' ||
                    r.finalResponse === 'participe' ||
                    r.finalResponse === 'interested' ||
                    r.finalResponse === 'cleared' ||
                    r.finalResponse === 'not_interested')
            )
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5) // 5 plus récents

        return userResponsesWithChanges.map(response => {
            const event = events.find(e => e.id === response.eventId)
            if (!event) return null

            const createdAt = new Date(response.createdAt)
            const timeAgo = formatDistanceToNow(createdAt, { addSuffix: true, locale: fr })

            // Si initialResponse est null, on ne l'affiche pas (c'est une première réponse)
            const hasChange = response.initialResponse !== null &&
                response.initialResponse !== response.finalResponse &&
                (response.initialResponse === 'going' ||
                    response.initialResponse === 'participe' ||
                    response.initialResponse === 'interested' ||
                    response.initialResponse === 'not_interested' ||
                    response.initialResponse === 'cleared')

            // Normaliser participe -> going pour l'affichage
            const displayResponse = response.finalResponse === 'participe' ? 'going' : response.finalResponse
            const displayPreviousResponse = response.initialResponse === 'participe' ? 'going' : response.initialResponse

            return {
                event,
                response: displayResponse as 'going' | 'interested' | 'cleared' | 'not_interested',
                previousResponse: hasChange ? displayPreviousResponse : undefined,
                timeAgo,
                createdAt,
                responseId: response.id // ID unique de la réponse
            }
        }).filter(Boolean) as ActivityItem[]
    }, [responses, events, user?.id, dataReady])

    // Handler pour clic sur activité
    const handleActivityClick = useCallback((event: Event) => {
        // Naviguer vers la page map d'abord
        if (window.navigateToMapPage) {
            window.navigateToMapPage()
        }
        // Puis sélectionner l'événement (avec un petit délai pour laisser la page se charger)
        setTimeout(() => {
            if (window.setSelectedEventFromProfile) {
                window.setSelectedEventFromProfile(event)
            }
        }, 100)
    }, [])

    if (recentActivity.length === 0) {
        return null
    }

    return (
        <div className="profile-section recent-activity-section">
            <h3 className="recent-activity-title">Activité récente</h3>
            <div className="recent-activity-list">
                {recentActivity.map(({ event, response, previousResponse, timeAgo, responseId }) => {
                    const hasChange = previousResponse !== undefined && previousResponse !== null

                    return (
                        <div
                            key={responseId}
                            className="recent-activity-item"
                            onClick={() => handleActivityClick(event)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    handleActivityClick(event)
                                }
                            }}
                        >
                            <div className="recent-activity-content">
                                <div className="recent-activity-title-text">{event.title}</div>
                                <div className="recent-activity-meta">
                                    {hasChange ? (
                                        <>
                                            <span className="recent-activity-badge" data-response={previousResponse}>
                                                {getResponseLabel(previousResponse)}
                                            </span>
                                            <span className="recent-activity-arrow">→</span>
                                            <span className="recent-activity-badge" data-response={response}>
                                                {getResponseLabel(response)}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="recent-activity-badge" data-response={response}>
                                            {getResponseLabel(response)}
                                        </span>
                                    )}
                                    <span className="recent-activity-time">{timeAgo}</span>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

