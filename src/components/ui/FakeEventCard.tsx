/**
 * FakeEventCard - Carte d'événement floutée pour les fake pins
 * 
 * Affiche une EventCard floutée avec un message teaser pour inciter à rejoindre FOMO
 */

import React, { useState } from 'react'
import type { Event, UserResponseValue } from '@/types/fomoTypes'
import ButtonGroup from '@/components/ui/ButtonGroup'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { setStylingPin } from '@/map/stylingPinsController'

interface FakeEventCardProps {
    event: Event
    onJoinClick?: () => void
}


export const FakeEventCard: React.FC<FakeEventCardProps> = React.memo(({
    event,
    onJoinClick
}) => {
    const { isPublicMode } = usePrivacy()
    
    // État local pour la réponse sélectionnée (purement visuel, pas connecté au backend)
    const [selectedResponse, setSelectedResponse] = useState<UserResponseValue | null>(null)

    // Options de réponses affichées sous la carte (selon le mode privé/public)
    const RESPONSE_OPTIONS = isPublicMode
        ? [
            { type: 'going' as const, label: "J'y vais" },
            { type: 'interested' as const, label: 'Intéressé' },
            { type: 'not_interested' as const, label: 'Pas intéressé' }
        ]
        : [
            { type: 'participe' as const, label: "J'y vais" },
            { type: 'maybe' as const, label: 'Peut-être' },
            { type: 'not_there' as const, label: 'Pas là' }
        ]

    // Formater la date pour l'affichage
    const formatDate = (dateString: string): string => {
        try {
            const date = new Date(dateString)
            const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
            const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
            return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`
        } catch {
            return ''
        }
    }

    const formatTime = (dateString: string): string => {
        try {
            const date = new Date(dateString)
            return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
        } catch {
            return ''
        }
    }

    const venueName = event.venue?.name || event.venue?.address || 'Lieu à confirmer'
    const dateStr = formatDate(event.startsAt)
    const timeStr = formatTime(event.startsAt)

    // Handler pour le changement de réponse (purement visuel)
    const handleResponseChange = (next: UserResponseValue) => {
        const nextFinal: 'going' | 'participe' | 'interested' | 'maybe' | 'not_interested' | 'not_there' | 'cleared' =
            next === null ? 'cleared' : next
        
        setSelectedResponse(next)
        
        // Mettre à jour le style du pin instantanément (UI uniquement)
        setStylingPin(event.id, nextFinal)
    }

    // Vérifier que la réponse courante est dans les options disponibles
    const availableTypes = RESPONSE_OPTIONS.map(opt => opt.type)
    const groupValue: 'going' | 'participe' | 'interested' | 'maybe' | 'not_interested' | 'not_there' | null =
        (selectedResponse && availableTypes.includes(selectedResponse as any))
            ? selectedResponse as 'going' | 'participe' | 'interested' | 'maybe' | 'not_interested' | 'not_there'
            : null

    return (
        <div className="event-card fake-event-card" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
            {/* Zone cliquable (similaire à EventCard) - sans blur ni CTA */}
            <div className="event-card-clickable-area fake-event-card-content">
                {/* Zone fixe 1 - Photo (hauteur fixe) */}
                <div className="event-card-banner">
                    {event.coverUrl && (
                        <img
                            src={event.coverUrl}
                            alt={event.title}
                            style={{
                                objectPosition: 'center'
                            }}
                        />
                    )}
                </div>

                {/* Zone fixe 2 - Titre (hauteur fixe) */}
                <div className="event-card-header" style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: 'var(--sm) var(--sm) 0',
                    flexShrink: 0
                }}>
                    <h3 className="event-card-title">{event.title}</h3>
                </div>

                {/* Zone fixe 3 - Meta (hauteur fixe) */}
                <div className="event-card-meta" style={{
                    flexShrink: 0
                }}>
                    <div className="meta-row">📍 {venueName}</div>
                    {dateStr && timeStr && (
                        <div className="meta-row">📅 {dateStr} à {timeStr}</div>
                    )}
                </div>
            </div>

            {/* Zone fixe 4 - boutons de réponses toujours visibles (purement visuel) */}
            {!event.isPast && (
                <div 
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    <ButtonGroup
                        items={RESPONSE_OPTIONS.map(({ type, label }) => ({ 
                            value: type, 
                            label
                        }))}
                        defaultValue={groupValue}
                        onChange={(next) => {
                            handleResponseChange(next)
                        }}
                        className="event-response-buttons-container"
                        buttonClassName="response-button"
                        ariaLabel="Choix de réponse"
                    />
                </div>
            )}
        </div>
    )
})

FakeEventCard.displayName = 'FakeEventCard'

export default FakeEventCard

