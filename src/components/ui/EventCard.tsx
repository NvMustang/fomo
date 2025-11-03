import React, { useEffect, useRef, useState } from 'react'
import type { Event, UserResponseValue } from '@/types/fomoTypes'
import { Button, VisitorNameModal } from '@/components'
import { ShareContent } from '@/components/ui/ShareContent'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { fr } from 'date-fns/locale'
import { useEventResponses } from '@/hooks'
import { useFomoDataContext } from '@/contexts/FomoDataProvider'
import { useAuth } from '@/contexts/AuthContext'

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
    isFading?: boolean // Si true, applique l'animation fade-out
    isVisitorMode?: boolean // Si true, mode visitor (pas authentifié)
    onClose?: () => void // Callback de fermeture pour notifier le parent
    onEdit?: (event: Event) => void // Callback pour éditer l'événement
    onVisitorFormCompleted?: (organizerName: string) => void // Callback quand le formulaire visitor est complété
}

export const EventCard = React.memo<EventCardProps>(({
    event,
    showToggleResponse,
    isProfilePage = false,
    isMyEventsPage = false,
    isFading = false,
    isVisitorMode = false,
    onClose,
    onEdit,
    onVisitorFormCompleted,
}: EventCardProps) => {
    // État pour l'expansion des détails
    const [isExpanded, setIsExpanded] = useState(false)
    // État pour l'animation fade-out quand not_interested
    const [shouldFade, setShouldFade] = useState(false)
    // État pour l'expansion de la zone de partage (uniquement sur page profile)
    const [isShareExpanded, setIsShareExpanded] = useState(false)
    // État pour le modal de nom visitor
    const [isVisitorNameModalOpen, setIsVisitorNameModalOpen] = useState(false)
    // État pour le nom visitor (stocké en session)
    const [visitorName, setVisitorName] = useState<string | null>(() => {
        // Charger depuis sessionStorage si présent
        try {
            return sessionStorage.getItem('fomo-visit-name')
        } catch {
            return null
        }
    })
    // État pour la réponse en attente (pendant la saisie du nom)
    const [pendingResponse, setPendingResponse] = useState<'going' | 'interested' | 'not_interested' | null>(null)

    const { getEventResponse, toggleResponse } = useEventResponses()
    const { addEventResponse, responses, updateEvent, users } = useFomoDataContext()
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

    // Timeout pour l'action différée de suppression (not_interested ou cleared)
    const pendingRemovalTimeoutRef = useRef<number | null>(null)

    // Ref pour accéder aux dernières valeurs de responses et user dans le cleanup
    const responsesRef = useRef(responses)
    const userIdRef = useRef(user?.id)

    // Synchroniser les refs avec les valeurs actuelles
    useEffect(() => {
        responsesRef.current = responses
        userIdRef.current = user?.id
    }, [responses, user?.id])

    const toggleExpanded = () => {
        setIsExpanded(!isExpanded)
    }

    // Handler pour confirmer le nom visitor
    const handleVisitorNameConfirm = (name: string, email?: string) => {
        const wasFirstTime = !visitorName // Vérifier si c'était la première fois
        setVisitorName(name)
        try {
            sessionStorage.setItem('fomo-visit-name', name)
            if (email) {
                sessionStorage.setItem('fomo-visit-email', email)
            }
        } catch {
            // Ignore si sessionStorage indisponible
        }

        // Exécuter la réponse en attente en utilisant addEventResponse du context
        if (pendingResponse) {
            const current = getEventResponse(event.id)
            const newResponse = current === pendingResponse ? 'cleared' : pendingResponse
            // Utiliser le même système que les users : addEventResponse du context (optimiste + batch)
            addEventResponse(event.id, newResponse)
        }
        setPendingResponse(null)

        // Si c'était la première fois (formulaire complété), notifier le parent
        if (wasFirstTime && onVisitorFormCompleted) {
            onVisitorFormCompleted(event.organizerName || 'L\'organisateur')
        }
    }

    const handleOpen = () => {
        try {
            const current = getEventResponse(event.id)
            // Capturer systématiquement l'état initial
            initialResponseRef.current = current
        } catch (e) { }
    }

    const handleClose = () => {
        try {
            // Lire directement depuis le ref (toujours à jour, pas de closure stale)
            const latestResponses = responsesRef.current
            const latestUserId = userIdRef.current

            const match = latestUserId
                ? latestResponses.find(r => r.userId === latestUserId && r.eventId === event.id)
                : null
            const current = match ? match.finalResponse : null
            const initial = initialResponseRef.current

            // Cas 1: null → null → envoie 'seen'
            if ((initial == null || initial === undefined) && (current == null || current === undefined)) {
                addEventResponse(event.id, 'seen')
                return
            }

            // Cas 2: 'invited' → 'invited' (sans changement) → envoie 'seen'
            if (initial === 'invited' && current === 'invited') {
                addEventResponse(event.id, 'seen')
                return
            }

            // Cas 3: 'invited' → autre chose (going/interested/not_interested/cleared)
            // Ne rien faire, la réponse a déjà été envoyée par toggleResponse
            // (pas de 'seen' car l'utilisateur a interagi)
        } catch (e) {
            // Ne pas bloquer la fermeture en cas d'erreur
        }
    }

    // Appeler handleOpen au montage, handleClose au démontage
    // Note: sur ProfilePage, on ne track pas "seen" car ce sont les événements de l'utilisateur
    useEffect(() => {
        handleOpen()
        // Cleanup: appeler handleClose quand le composant se démonte
        return () => {
            // Nettoyer un éventuel timeout en attente
            if (pendingRemovalTimeoutRef.current) {
                clearTimeout(pendingRemovalTimeoutRef.current)
                pendingRemovalTimeoutRef.current = null
            }
            // Ne pas tracker "seen" sur ProfilePage (événements créés par l'utilisateur)
            if (!isProfilePage) {
                handleClose()
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isProfilePage])


    // Combiner isFading (prop) et shouldFade (état local pour not_interested)
    const isFadingActive = isFading || shouldFade

    // Sur la page profil, afficher le bouton d'édition si l'utilisateur est l'organisateur
    const shouldShowEdit = isProfilePage && user?.id && (event.organizerId === user.id || event.organizerId === `amb_${user.id}`)

    // Gestion du toggle Online/Offline (mise à jour optimiste comme addEventResponse)
    const handleToggleOnline = () => {
        // Ne pas appeler updateEvent en mode visitor (n'est pas disponible)
        if (isVisitorMode || !updateEvent) return

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
                isFadingActive && 'fade-out-2s',
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
                    className={`circular-button circular-button--xs ${!isExpanded ? 'expand-rotated' : ''}`}
                    onClick={(e) => {
                        e.stopPropagation()
                        toggleExpanded()
                    }}
                    aria-label={isExpanded ? 'Réduire les détails' : 'Voir plus de détails'}
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
            {isExpanded && (
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
            {showToggleResponse && !event.isPast && (
                <div className="event-response-buttons-container">
                    {RESPONSE_OPTIONS.map(({ type, label }) => {
                        const current = getEventResponse(event.id)
                        const variant = current === type ? 'primary' : 'secondary'

                        const onClick = () => {
                            // Capturer la réponse précédente avant le changement
                            const previousResponse = current

                            // Mode visitor : vérifier si nom saisi
                            if (isVisitorMode) {
                                if (!visitorName) {
                                    // Pas de nom, ouvrir modal et stocker réponse en attente
                                    setPendingResponse(type)
                                    setIsVisitorNameModalOpen(true)
                                    return
                                }
                                // Nom présent, procéder avec la réponse visitor
                                const newResponse = current === type ? 'cleared' : type

                                // Utiliser le même système que les users : addEventResponse du context (optimiste + batch)
                                // LastActivities lit directement initialResponse/finalResponse depuis le contexte
                                addEventResponse(event.id, newResponse)
                                return
                            }

                            // Déterminer la nouvelle réponse
                            const newResponse = current === type ? 'cleared' : type

                            // LastActivities lit directement initialResponse/finalResponse depuis le contexte

                            // Cas 1: bouton "Pas intéressé" → toujours animé + différé 2s (sauf en mode visitor)
                            if (type === 'not_interested') {
                                if (!shouldFade) setShouldFade(true)
                                if (pendingRemovalTimeoutRef.current) {
                                    clearTimeout(pendingRemovalTimeoutRef.current)
                                    pendingRemovalTimeoutRef.current = null
                                }
                                pendingRemovalTimeoutRef.current = window.setTimeout(() => {
                                    toggleResponse(event.id, 'not_interested')
                                    pendingRemovalTimeoutRef.current = null
                                    // Fermer l'EventCard après l'animation et la mise à jour de la réponse
                                    onClose?.()
                                }, 2000)
                                return
                            }

                            // Cas 2: sur Calendar (isMyEventsPage) si on reclique sur la même réponse (toggle -> cleared),
                            // on applique le même pattern de fade + délai 2s pour permettre l'effondrement visuel
                            if (isMyEventsPage && current === type) {
                                if (!shouldFade) setShouldFade(true)
                                if (pendingRemovalTimeoutRef.current) {
                                    clearTimeout(pendingRemovalTimeoutRef.current)
                                    pendingRemovalTimeoutRef.current = null
                                }
                                pendingRemovalTimeoutRef.current = window.setTimeout(() => {
                                    // Appeler toggle avec le même type provoquera "cleared" via le hook
                                    toggleResponse(event.id, type)
                                    pendingRemovalTimeoutRef.current = null
                                }, 2000)
                                return
                            }

                            // Cas 3: autres interactions immédiates
                            if (pendingRemovalTimeoutRef.current) {
                                clearTimeout(pendingRemovalTimeoutRef.current)
                                pendingRemovalTimeoutRef.current = null
                            }
                            if (shouldFade) setShouldFade(false)
                            toggleResponse(event.id, type)
                        }

                        return (
                            <Button
                                key={type}
                                variant={variant}
                                onClick={onClick}
                                className="response-button"
                            >
                                {label}
                            </Button>
                        )
                    })}
                </div>
            )}

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
            <VisitorNameModal
                isOpen={isVisitorNameModalOpen}
                onClose={() => {
                    setIsVisitorNameModalOpen(false)
                    setPendingResponse(null)
                }}
                onConfirm={handleVisitorNameConfirm}
                organizerName={event.organizerName}
            />
        </>
    )
})

EventCard.displayName = 'EventCard'

export default EventCard

