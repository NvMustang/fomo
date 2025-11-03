import React, { useEffect, useRef, useState } from 'react'
import type { Event, UserResponseValue } from '@/types/fomoTypes'
import { Button } from '@/components'
import ButtonGroup from '@/components/ui/ButtonGroup'
import { ShareContent } from '@/components/ui/ShareContent'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { fr } from 'date-fns/locale'

import { useFomoDataContext } from '@/contexts/FomoDataProvider'
import { useAuth } from '@/contexts/AuthContext'
import { setUserResponseFeatureState } from '@/map/featureStateController'

// notifyResponseChange supprimé : LastActivities lit directement initialResponse/finalResponse depuis le contexte

// Options de réponses affichées sous la carte
const RESPONSE_OPTIONS = [
    { type: 'going' as const, label: "J'y vais" },
    { type: 'interested' as const, label: 'Intéressé' },
    { type: 'not_interested' as const, label: 'Pas intéressé' }
]

interface EventCardProps {
    event: Event
    showToggleResponse?: boolean
    isProfilePage?: boolean // Si true, affiche automatiquement le bouton d'édition pour l'organisateur
    isMyEventsPage?: boolean // Pour distinguer le comportement sur My Events
    onEdit?: (event: Event) => void // Callback pour éditer l'événement
    onVisitorFormCompleted?: (organizerName: string) => void // Callback quand le formulaire visitor est complété
}

export const EventCard = React.memo<EventCardProps>(({
    event,
    showToggleResponse,
    isProfilePage = false,
    onEdit,
}: EventCardProps) => {
    // État pour l'expansion des détails
    const [isDetailsExpanded, setIsDetailsExpanded] = useState(false)

    // État pour l'expansion de la zone de partage (uniquement sur page profile)
    const [isShareExpanded, setIsShareExpanded] = useState(false)
    // Réponse choisie pendant l'ouverture de la carte (finalResponse local, non envoyée) - stockée en ref (synchrone)
    const localFinalResponseRef = useRef<'going' | 'interested' | 'not_interested' | 'cleared' | null>(null)


    const { responses, updateEvent, users, addEventResponse } = useFomoDataContext()
    const { user } = useAuth()

    // Récupérer la réponse de l'utilisateur pour cet événement et extraire l'invitateur
    const userResponse = user?.id
        ? responses.find(r => r.userId === user.id && r.eventId === event.id)
        : null
    const inviter = userResponse?.invitedByUserId
        ? users.find(u => u.id === userResponse.invitedByUserId)
        : null


    // Mémorise la réponse utilisateur à l'ouverture
    const initialResponseRef = useRef<UserResponseValue | undefined>(undefined)



    // Ref pour accéder aux dernières valeurs de responses et user dans le cleanup
    const responsesRef = useRef(responses)
    const userIdRef = useRef(user?.id)

    // Synchroniser les refs avec les valeurs actuelles
    useEffect(() => {
        responsesRef.current = responses
        userIdRef.current = user?.id
    }, [responses, user?.id])

    const toggleExpanded = () => {
        setIsDetailsExpanded(!isDetailsExpanded)
    }

    // Handler pour confirmer le nom visitor
    // Suppression du flux visitor: un userId doit exister en amont

    // Helper: récupérer la réponse courante (local si défini, sinon dernière du contexte)
    const getLocalResponse = (): UserResponseValue => {
        if (localFinalResponseRef.current !== null && localFinalResponseRef.current !== undefined) return localFinalResponseRef.current
        const uid = user?.id
        if (!uid) return null
        const latest = responses
            .filter(r => r.userId === uid && r.eventId === event.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
        return latest ? latest.finalResponse : null
    }

    const handleOpen = () => {
        try {
            const current = getLocalResponse()
            // Capturer systématiquement l'état initial
            // Normaliser : convertir undefined en null pour cohérence (pas d'entrée = null)
            initialResponseRef.current = current ?? null
            // Initialiser le final local à l'état initial
            const initialForLocal: UserResponseValue = initialResponseRef.current ?? null
            // Le local final n'accepte pas 'seen' ou 'invited' → normaliser à null
            const normalizedLocal = initialForLocal === 'seen' || initialForLocal === 'invited' ? null : initialForLocal
            localFinalResponseRef.current = (normalizedLocal as any)
        } catch (e) {
            // En cas d'erreur, initialiser à null (pas d'entrée dans l'historique)
            initialResponseRef.current = null
            localFinalResponseRef.current = null
        }
    }

    const handleClose = () => {
        try {
            // NOUVEAU SYSTÈME : Comparer initial (à l'ouverture) avec current (à la fermeture)
            // pour déterminer si on doit envoyer 'seen'
            // Prendre d'abord le final local, sinon relire depuis le contexte
            const current = getLocalResponse()

            // Normaliser initial : convertir undefined en null (pas d'entrée = null)
            // initial peut être undefined si handleOpen n'a pas été appelé ou a échoué
            const initial = initialResponseRef.current ?? null


            // LOGIQUE : Envoyer 'seen' uniquement si l'utilisateur n'a pas interagi (initial === current)
            // et que l'état est null (pas d'entrée dans l'historique) ou 'invited' (pas d'interaction visible)

            // Cas 1: pas d'entrée → pas d'entrée → envoie 'seen' (pas d'interaction)
            // initial et current sont tous les deux null (aucune entrée dans l'historique)
            if (initial === null && current === null) {
                addEventResponse(event.id, 'seen')
                return
            }

            // Cas 2: 'invited' → 'invited' (sans changement) → envoie 'seen' (a vu l'invitation mais n'a pas répondu)
            if (initial === 'invited' && current === 'invited') {
                addEventResponse(event.id, 'seen')
                return
            }

            // Cas 3: initial !== current → l'utilisateur a interagi → envoyer la réponse finale maintenant
            if (current !== initial) {
                // Envoyer la réponse finale
                addEventResponse(event.id, current)
                return
            }
        } catch (e) {
            // Ne pas bloquer la fermeture en cas d'erreur
        }
    }

    // Appeler handleOpen au montage, handleClose au démontage
    useEffect(() => {
        handleOpen()
        return () => {
            handleClose()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])




    // Sur la page profil, afficher le bouton d'édition si l'utilisateur est l'organisateur
    const shouldShowEdit = isProfilePage && user?.id && (event.organizerId === user.id || event.organizerId === `amb_${user.id}`)

    // Gestion du toggle Online/Offline (mise à jour optimiste comme addEventResponse)
    const handleToggleOnline = () => {
        // Ne pas appeler updateEvent en mode visitor (n'est pas disponible)
        if (!updateEvent) return

        // Lire l'état actuel directement depuis l'événement (comme getEventResponse pour les réponses)
        const currentIsOnline = event.isOnline !== false // true si undefined ou true, false si explicitement false
        const newIsOnline = !currentIsOnline

        // Si on passe en offline et que la zone de partage est affichée, la masquer
        if (!newIsOnline && isShareExpanded) {
            setIsShareExpanded(false)
        }

        // Mise à jour optimiste immédiate (l'UI se met à jour instantanément)
        updateEvent(event.id, {
            ...event,
            isOnline: newIsOnline
        }).catch(error => {
            console.error('Erreur lors de la mise à jour du statut online/offline:', error)
            // Le rollback est géré automatiquement dans updateEvent
        })
    }

    // Gestion du partage de l'événement
    const handleShare = (e: React.MouseEvent) => {
        e.stopPropagation()
        // Empêcher l'ouverture si l'événement est offline
        if (event.isOnline === false) {
            return
        }
        // Toggle la zone expandable (uniquement sur page profile)
        if (isProfilePage) {
            setIsShareExpanded(!isShareExpanded)
        }
    }

    // Fermer la zone de partage quand on ferme via ShareContent
    const handleShareClose = () => {
        setIsShareExpanded(false)
    }

    const cardContent = (
        <div
            className={[
                'event-card',

                event.isOnline === false && 'event-card--offline'
            ].filter(Boolean).join(' ')}
            data-profile-page={isProfilePage ? 'true' : undefined}
            style={{
                height: '100%'
            }}
        >
            {/* Zone fixe 1 - Photo (hauteur fixe) */}
            <div className="event-card-banner">
                {event.coverUrl && (
                    <img
                        src={event.coverUrl}
                        alt={event.title}
                        style={{
                            objectPosition: event.coverImagePosition
                                ? `${event.coverImagePosition.x}% ${event.coverImagePosition.y}%`
                                : undefined
                        }}
                    />
                )}
            </div>

            {/* Zone fixe 2 - Titre + bouton expand (hauteur fixe) */}
            <div className="event-card-header" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--sm) var(--sm) 0',
                flexShrink: 0
            }}>
                <h3 className="event-card-title">{event.title}</h3>

                {/* Bouton d'expansion à côté du titre */}
                <button
                    className={`circular-button circular-button--xs ${!isDetailsExpanded ? 'expand-rotated' : ''}`}
                    onClick={(e) => {
                        e.stopPropagation()
                        toggleExpanded()
                    }}
                    aria-label={isDetailsExpanded ? 'Réduire les détails' : 'Voir plus de détails'}
                >
                    <div className="icon-container">
                        <div className="plus-bar plus-bar-horizontal arrow-bar-left"></div>
                        <div className="plus-bar plus-bar-horizontal arrow-bar-right"></div>
                    </div>
                </button>
            </div>

            {/* Badge invité par (si applicable) */}
            {inviter && (
                <div style={{
                    padding: 'var(--xs) var(--sm)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-muted)',
                    fontStyle: 'italic',
                    flexShrink: 0
                }}>
                    Vous avez été invité par {inviter.name || inviter.email || inviter.id}
                </div>
            )}

            {/* Zone fixe 3 - Meta (hauteur fixe) */}
            <div className="event-card-meta" style={{ flexShrink: 0 }}>
                <div className="meta-row">📍 {event.venue?.address || 'Lieu non spécifié'} </div>
                <div className="meta-row">📅 {format(toZonedTime(event.startsAt, Intl.DateTimeFormat().resolvedOptions().timeZone), 'PPP à p', { locale: fr })}</div>
            </div>

            {/* Zone scrollable - contenu expandable */}
            {isDetailsExpanded && (
                <div
                    className="event-details-section"
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        minHeight: 0 // Important pour que flex: 1 fonctionne correctement
                    }}
                >
                    {event.description && (
                        <div className="event-description">
                            <p>{event.description}</p>
                        </div>
                    )}

                    {/* Organisateur - affiché seulement lors de l'expansion, après la description */}
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                        👤 {event.organizerName || 'Organisateur inconnu'}
                    </div>

                    <div className="event-info-grid">
                        {event.price && (
                            <div className="info-item">
                                <strong>Prix:</strong> {event.price}
                            </div>
                        )}
                        {event.capacity && (
                            <div className="info-item">
                                <strong>Capacité:</strong> {event.capacity} personnes
                            </div>
                        )}
                    </div>

                    {/* Statistiques de participation */}
                    <div style={{ display: 'flex', gap: 'var(--md)', alignItems: 'center', fontSize: 'var(--text-sm)' }}>
                        <span style={{ color: 'var(--success)' }}>
                            <strong>{event.stats?.goingCount || 0}</strong> participent
                        </span>
                        <span style={{ color: 'var(--warning)' }}>
                            <strong>{event.stats?.interestedCount || 0}</strong> intéressés
                        </span>
                    </div>
                </div>
            )}

            {/* Zone fixe 4 - boutons de réponses toujours visibles */}
            {showToggleResponse && !event.isPast && (() => {
                const current = getLocalResponse()
                const groupValue: 'going' | 'interested' | 'not_interested' | null =
                    current === 'going' || current === 'interested' || current === 'not_interested'
                        ? current
                        : null

                return (
                    <ButtonGroup
                        items={RESPONSE_OPTIONS.map(({ type, label }) => ({ value: type, label }))}
                        defaultValue={groupValue}
                        onChange={(next) => {
                            const nextFinal: 'going' | 'interested' | 'not_interested' | 'cleared' =
                                next === null ? 'cleared' : next
                            localFinalResponseRef.current = nextFinal
                            setUserResponseFeatureState(event.id, nextFinal)

                        }}
                        className="event-response-buttons-container"
                        buttonClassName="response-button"
                        ariaLabel="Choix de réponse"
                    />
                )
            })()}

            {/* Zone fixe 5 - bouton d'édition et toggle Online/Offline pour l'organisateur (sur page profil uniquement) */}
            {shouldShowEdit && (
                <div className="event-edit-buttons-container">
                    <Button
                        variant="secondary"
                        onClick={(e) => {
                            e.stopPropagation()
                            onEdit?.(event)
                        }}
                        className="response-button"
                    >
                        Modifier
                    </Button>
                    {/* Toggle Online/Offline */}
                    <Button
                        variant={event.isOnline === false ? 'secondary' : 'primary'}
                        onClick={handleToggleOnline}
                        className="response-button"
                        style={{
                            backgroundColor: event.isOnline === false ? 'var(--text-muted)' : 'var(--current-color)',
                            borderColor: event.isOnline === false ? 'var(--text-muted)' : 'var(--current-color)',
                            color: 'var(--white)'
                        }}
                    >
                        {event.isOnline === false ? 'Offline' : 'Online'}
                    </Button>
                    {/* Bouton de partage */}
                    <Button
                        variant="secondary"
                        onClick={handleShare}
                        className="response-button"
                        disabled={event.isOnline === false}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 'var(--sm)',
                            minWidth: 'auto'
                        }}
                        title={event.isOnline === false ? "Le partage n'est pas disponible pour les événements offline" : "Partager l'événement"}
                        aria-label={event.isOnline === false ? "Le partage n'est pas disponible pour les événements offline" : "Partager l'événement"}
                    >
                        <img
                            src="/share-icon.svg"
                            alt="Partager"
                            width="16"
                            height="16"
                            className={isShareExpanded ? 'share-icon-rotated' : ''}
                            style={{ marginRight: 0, opacity: event.isOnline === false ? 0.5 : 1 }}
                        />
                    </Button>
                </div>
            )}

            {/* Zone expandable de partage (uniquement sur page profile) */}
            {isProfilePage && shouldShowEdit && (
                <div className={`event-share-section ${isShareExpanded ? 'expanded' : ''}`}>
                    {isShareExpanded && (
                        <ShareContent event={event} onClose={handleShareClose} />
                    )}
                </div>
            )}
        </div>
    )

    // Rendu unifié (le parent gère le conteneur/overlay si besoin)
    return (
        <>
            {cardContent}

        </>
    )
})

EventCard.displayName = 'EventCard'

export default EventCard

