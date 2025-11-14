import React, { useEffect, useRef, useState } from 'react'
import type { Event, UserResponseValue } from '@/types/fomoTypes'
import { Button } from '@/components'
import ButtonGroup from '@/components/ui/ButtonGroup'
import { ShareContent } from '@/components/ui/ShareContent'
import { format, isPast } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { fr } from 'date-fns/locale'

import { useDataContext } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { getUser } from '@/utils/filterTools'
import { useStarsAnimation } from '@/onboarding/hooks/useStarsAnimation'
import type { Venue } from '@/types/fomoTypes'

// notifyResponseChange supprimé : LastActivities lit directement initialResponse/finalResponse depuis le contexte

/**
 * Formate l'adresse du venue de manière concise pour l'affichage
 * Affiche : venue name OU (rue, numéro, ville)
 * Exclut : région et pays
 */
function formatVenueAddress(venue: Venue | undefined): string {
    if (!venue) {
        return 'Lieu non spécifié'
    }

    // Priorité 1 : Utiliser venue.name si disponible
    if (venue.name && venue.name.trim()) {
        return venue.name.trim()
    }

    // Priorité 2 : Utiliser les composants structurés si disponibles
    if (venue.components) {
        const parts: string[] = []

        // Ajouter la rue et le numéro
        if (venue.components.street) {
            const street = venue.components.street.trim()
            const number = venue.components.address_number?.trim()
            if (number) {
                parts.push(`${number} ${street}`)
            } else {
                parts.push(street)
            }
        }

        // Ajouter la ville
        if (venue.components.place) {
            parts.push(venue.components.place.trim())
        }

        if (parts.length > 0) {
            return parts.join(', ')
        }
    }

    // Priorité 3 : Parser l'adresse complète pour extraire seulement rue, numéro, ville
    if (venue.address && venue.address.trim()) {
        const address = venue.address.trim()

        // Si l'adresse contient des virgules, prendre les 2-3 premières parties
        // Format typique : "rue, ville, région, pays" ou "rue, numéro, ville, région, pays"
        if (address.includes(',')) {
            const parts = address.split(',').map(p => p.trim())

            // Prendre les 2-3 premières parties (généralement rue, numéro, ville)
            // Exclure les parties qui ressemblent à des régions ou pays (généralement les dernières)
            const filteredParts: string[] = []
            const regionPattern = /^(Île-de-France|Hauts-de-France|Normandie|Bretagne|Pays de la Loire|Centre-Val de Loire|Bourgogne-Franche-Comté|Grand Est|Auvergne-Rhône-Alpes|Nouvelle-Aquitaine|Occitanie|Provence-Alpes-Côte d'Azur|Corse|Belgique|France|Belgium)$/i

            // Parcourir les parties de gauche à droite, s'arrêter à la première région/pays
            for (const part of parts) {
                if (regionPattern.test(part)) {
                    // Rencontré une région/pays, arrêter
                    break
                }
                filteredParts.push(part)
                // Limiter à 3 parties max (rue, numéro, ville)
                if (filteredParts.length >= 3) {
                    break
                }
            }

            if (filteredParts.length > 0) {
                return filteredParts.join(', ')
            }
        }

        // Si pas de virgules, retourner l'adresse telle quelle
        return address
    }

    // Fallback
    return 'Lieu non spécifié'
}

interface EventCardProps {
    event: Event
    showToggleResponse?: boolean
    isProfilePage?: boolean // Si true, affiche automatiquement le bouton d'édition pour l'organisateur
    isMyEventsPage?: boolean // Pour distinguer le comportement sur My Events
    onEdit?: (event: Event) => void // Callback pour éditer l'événement
    onResponseClick?: (response: UserResponseValue) => void // Callback quand une réponse est cliquée (pour déclencher les étoiles)
    responseButtonsDisabled?: boolean // Désactive les boutons réponse initialement (visuellement et animations)
    onLabelClick?: () => void // Callback quand l'étiquette est cliquée (pour déclencher le toast impatience en visitor mode)
    isDetailsExpanded?: boolean // Si fourni, contrôle l'état d'expansion des détails (mode contrôlé)
    onToggleExpanded?: () => void // Callback pour gérer le toggle d'expansion (mode contrôlé)
}

export const EventCard = React.memo<EventCardProps>(({
    event,
    showToggleResponse,
    isProfilePage = false,
    onEdit,
    onResponseClick,
    responseButtonsDisabled = false,
    onLabelClick,
    isDetailsExpanded: isDetailsExpandedProp,
    onToggleExpanded,
}: EventCardProps) => {
    // État interne pour l'expansion (uncontrolled)
    const [isDetailsExpandedInternal, setIsDetailsExpandedInternal] = useState(false)

    // Utiliser le prop isDetailsExpanded si fourni (controlled), sinon utiliser l'état interne
    const isDetailsExpanded = isDetailsExpandedProp !== undefined ? isDetailsExpandedProp : isDetailsExpandedInternal

    // Synchroniser l'état interne si le prop change
    useEffect(() => {
        if (isDetailsExpandedProp !== undefined) {
            setIsDetailsExpandedInternal(isDetailsExpandedProp)
        }
    }, [isDetailsExpandedProp])

    // Activation des boutons : directement basée sur la prop (pas d'état local)
    const buttonsActivated = !responseButtonsDisabled

    // Animation des étoiles pour les réponses
    const { triggerStars, StarsAnimation } = useStarsAnimation({
        duration: 2000
    })

    // État pour l'expansion de la zone de partage (uniquement sur page profile)
    const [isShareExpanded, setIsShareExpanded] = useState(false)

    // Réponse choisie pendant l'ouverture de la carte (en attente de sauvegarde) - stockée en ref pour éviter re-render
    const pendingResponseRef = useRef<UserResponseValue>(null)


    const { responses, updateEvent, users, addEventResponse, currentUserId, getInitialResponseSource } = useDataContext()
    const { user } = useAuth()
    const { isPublicMode } = usePrivacy()

    // Calculer si l'événement est passé (basé sur endsAt)
    const eventIsPast = (() => {
        if (event.endsAt) {
            const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
            const endDate = toZonedTime(event.endsAt, userTimezone)
            return isPast(endDate)
        }
        return false
    })()

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
        if (onToggleExpanded) {
            // Si onToggleExpanded est fourni, le parent contrôle l'état
            onToggleExpanded()
        } else {
            // Sinon, gérer l'état en interne
            setIsDetailsExpandedInternal(!isDetailsExpandedInternal)
        }

        // Appeler le callback au clic sur l'étiquette (pour déclencher le toast impatience en visitor mode)
        // Indépendant de l'état des boutons - juste un clic sur l'étiquette
        onLabelClick?.()
    }

    // Handler pour confirmer le nom visitor
    // Suppression du flux visitor: un userId doit exister en amont

    /**
     * Helper: récupérer la réponse courante avec ordre de priorité
     * 
     * ORDRE DE PRIORITÉ (du plus récent au plus ancien) :
     * 
     * 1. pendingResponseRef : Réponse choisie pendant l'ouverture de l'EventCard (en attente de sauvegarde)
     *    → Priorité absolue : c'est l'intention actuelle de l'utilisateur
     *    → Exemple : utilisateur vient de cliquer "J'y vais" → retourne "participe"
     * 
     * 2. responses : Réponses sauvegardées dans le backend (état persisté)
     *    → Si l'utilisateur a déjà répondu, retourne sa dernière réponse
     *    → Exemple : utilisateur a déjà répondu "maybe" → retourne "maybe"
     * 
     * 3. getInitialResponseSource : Source d'origine (linked/invited) non sauvegardée
     *    → Fallback : indique comment l'utilisateur est arrivé, mais pas encore ce qu'il a fait
     *    → Exemple : visitor arrive via lien → retourne "linked"
     * 
     * Cette fonction est utilisée par :
     * - handleOpen() : pour capturer l'état initial (initialResponseRef)
     * - handleClose() : pour comparer initial vs current et décider quoi envoyer
     * - Rendu des boutons : pour afficher le bon bouton sélectionné
     */
    const getLocalResponse = (): UserResponseValue => {
        // PRIORITÉ 1 : Réponse en attente (choisie pendant l'ouverture, pas encore sauvegardée)
        // C'est la valeur la plus "fraîche" - l'utilisateur vient de cliquer
        if (pendingResponseRef.current !== null && pendingResponseRef.current !== undefined) {
            return pendingResponseRef.current
        }

        // PRIORITÉ 2 : Réponses sauvegardées dans le backend (état persisté)
        // Si l'utilisateur a déjà répondu à cet événement, on retourne sa dernière réponse
        const uid = currentUserId || user?.id
        if (uid) {
            const latest = responses
                .filter(r => r.userId === uid && r.eventId === event.id)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

            if (latest) {
                return latest.finalResponse
            }
        }

        // PRIORITÉ 3 : Source d'origine (linked/invited) - fallback temporaire
        // Indique comment l'utilisateur est arrivé, mais pas encore ce qu'il a fait
        // Cette valeur sera utilisée comme initialResponse lors de la création de la réponse
        const initialSource = getInitialResponseSource(event.id)
        if (initialSource) {
            return initialSource
        }

        // Aucune réponse trouvée
        return null
    }

    const handleOpen = () => {
        try {
            const current = getLocalResponse()
            // Capturer systématiquement l'état initial
            // Normaliser : convertir undefined en null pour cohérence (pas d'entrée = null)
            initialResponseRef.current = current ?? null
            // Initialiser la réponse en attente à l'état initial (brut)
            const initialForLocal: UserResponseValue = initialResponseRef.current ?? null
            pendingResponseRef.current = initialForLocal
        } catch (e) {
            // En cas d'erreur, initialiser à null (pas d'entrée dans l'historique)
            initialResponseRef.current = null
            pendingResponseRef.current = null
        }
    }

    const handleClose = () => {
        // Pour les fake events, ne pas envoyer de réponses au backend (purement visuel)
        const isFake = (event.id || '').startsWith('fake-') || (event as any).isFake
        if (isFake) {
            return
        }

        // Comparer initial (à l'ouverture) avec current (à la fermeture)
        // pour déterminer si on doit envoyer 'seen'
        const current = getLocalResponse()

        // Normaliser initial : convertir undefined en null (pas d'entrée = null)
        // initial peut être undefined si handleOpen n'a pas été appelé
        const initial = initialResponseRef.current ?? null

        // LOGIQUE : Envoyer 'seen' uniquement si l'utilisateur n'a pas interagi (initial === current)
        // et que l'état est null (pas d'entrée dans l'historique), 'invited', ou 'linked' (pas d'interaction confirmée)

        // Cas 1: pas d'entrée → pas d'entrée → envoie 'seen' (pas d'interaction)
        // initial et current sont tous les deux null (aucune entrée dans l'historique)
        // initialResponse='new', finalResponse='seen' (première fois que l'utilisateur voit l'événement)
        if (initial === null && current === null) {
            addEventResponse(event.id, 'seen', {
                initialResponse: 'new'
            })
            // Mettre à jour le feature-state de la carte pour colorer le pin
            window.setStylingPin?.(event.id, 'seen')
            return
        }

        // Cas 2: 'invited' → 'invited' (sans changement) → envoie 'seen' (a vu l'invitation mais n'a pas répondu)
        // initialResponse='invited', finalResponse='seen'
        if (initial === 'invited' && current === 'invited') {
            addEventResponse(event.id, 'seen', {
                initialResponse: 'invited'
            })
            // Mettre à jour le feature-state de la carte pour colorer le pin
            window.setStylingPin?.(event.id, 'seen')
            return
        }

        // Cas 3: 'linked' → 'linked' (sans changement) → envoie 'seen' (a vu via lien mais n'a pas répondu)
        // 'linked' = visitor arrivé via URL d'un event, mais n'a pas encore interagi
        // initialResponse='linked', finalResponse='seen'
        if (initial === 'linked' && current === 'linked') {
            addEventResponse(event.id, 'seen', {
                initialResponse: 'linked'
            })
            // Mettre à jour le feature-state de la carte pour colorer le pin
            window.setStylingPin?.(event.id, 'seen')
            return
        }

        // Cas 4: initial !== current → l'utilisateur a interagi → envoyer la réponse finale maintenant
        // IMPORTANT : Si initial === null (première fois), utiliser 'new' comme initialResponse
        // Exemples :
        // - initial="maybe", current="participe" → initialResponse="maybe", finalResponse="participe"
        // - initial="linked", current="participe" → initialResponse="linked", finalResponse="participe"
        // - initial=null, current="participe" → initialResponse="new", finalResponse="participe" (première réponse)
        // IMPORTANT : La réponse est sauvegardée avec l'ID visitor existant (même si le visitor n'a pas encore de nom).
        // Cela permet à l'hôte de voir la réponse immédiatement, et le nom peut être ajouté plus tard via le formulaire.
        // C'est le "meilleur des deux mondes" : réponse sauvegardée + pas de frustration UX (le visitor peut continuer).
        if (current !== initial) {
            // Si c'est la première fois (initial === null), utiliser 'new' comme initialResponse
            const effectiveInitial = initial === null ? 'new' : initial
            // Envoyer la réponse finale avec initialResponse pour tracker le changement
            addEventResponse(event.id, current, {
                initialResponse: effectiveInitial
            })
            // Mettre à jour le feature-state de la carte pour colorer le pin
            // Note: current peut être null, dans ce cas on ne met pas à jour (le pin garde sa couleur de base)
            if (current !== null) {
                window.setStylingPin?.(event.id, current)
            }
            return
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
        // Toggle la zone expandable (disponible partout)
        setIsShareExpanded(!isShareExpanded)
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
            onClick={(e) => {
                // Ne pas stopper la propagation si le clic est sur la zone cliquable
                const target = e.target as HTMLElement
                if (!target.closest('.event-card-clickable-area')) {
                    e.stopPropagation()
                }
            }}
            onMouseDown={(e) => {
                // Ne pas stopper la propagation si le clic est sur la zone cliquable
                const target = e.target as HTMLElement
                if (!target.closest('.event-card-clickable-area')) {
                    e.stopPropagation()
                }
            }}
        >
            {/* Container cliquable pour toggle les détails */}
            <div
                className="event-card-clickable-area"
                role="button"
                tabIndex={0}
                aria-expanded={isDetailsExpanded}
                onClick={(e) => {
                    e.stopPropagation() // Empêcher la propagation vers les parents
                    toggleExpanded()
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        toggleExpanded()
                    }
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
                    {/* Bouton de fermeture */}
                    <button
                        className="event-card-banner-close"
                        onClick={(e) => {
                            e.stopPropagation()
                            // Utiliser la fonction globale de fermeture (logique centralisée)
                            if (window.closeEventCard) {
                                window.closeEventCard()
                            }
                        }}
                        aria-label="Fermer"
                        title="Fermer"
                    >
                        ×
                    </button>
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
                <div className="event-card-meta" style={{ flexShrink: 0, display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: 'var(--sm)' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--xs)' }}>
                        <div className="meta-row">📍 {formatVenueAddress(event.venue)} </div>
                        <div className="meta-row">📅 {format(toZonedTime(event.startsAt, Intl.DateTimeFormat().resolvedOptions().timeZone), 'PPP à p', { locale: fr })}</div>
                    </div>
                    {/* Bouton de partage (mode user + mode public, événement non passé) */}
                    {!user?.isVisitor && isPublicMode && !eventIsPast && (
                        <Button
                            variant="ghost"
                            onClick={handleShare}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: 'var(--xs)',
                                minWidth: 'auto',
                                flexShrink: 0
                            }}
                            title="Partager l'événement"
                            aria-label="Partager l'événement"
                        >
                            <img
                                src="/share-icon.svg"
                                alt="Partager"
                                width="16"
                                height="16"
                                className={isShareExpanded ? 'share-icon-rotated' : ''}
                            />
                        </Button>
                    )}
                </div>

                {/* Zone scrollable - contenu expandable */}
                <div
                    className={`event-details-section ${isDetailsExpanded ? 'expanded' : ''}`}
                    style={{
                        overflowY: isDetailsExpanded ? 'auto' : 'hidden',
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
                        👤 {(() => {
                            const organizer = getUser(users || [], event.organizerId)
                            return organizer?.name || event.organizerName || event.organizerId || 'Organisateur inconnu'
                        })()}
                    </div>

                    {/* Lien source (Facebook, etc.) - affiché seulement si source existe */}
                    {event.source && event.source.trim() && (
                        <div style={{ marginTop: 'var(--xs)' }}>
                            <Button
                                as="a"
                                href={event.source}
                                target="_blank"
                                rel="noopener noreferrer"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    fontSize: 'var(--text-sm)',
                                    padding: 'var(--xs) var(--sm)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 'var(--xs)'
                                }}
                            >
                                🔗 Facebook
                            </Button>
                        </div>
                    )}

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

                    {/* Tags de l'événement */}
                    {event.tags && event.tags.length > 0 && (
                        <div className="event-tags-container">
                            {event.tags.map((tag, index) => (
                                <span key={index} className="event-tag-chip">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Zone fixe 4 - boutons de réponses toujours visibles */}
            {showToggleResponse && !eventIsPast && (() => {
                const current = getLocalResponse()
                // Vérifier que la réponse courante est dans les options disponibles
                const availableTypes = RESPONSE_OPTIONS.map(opt => opt.type)
                const groupValue: 'going' | 'participe' | 'interested' | 'maybe' | 'not_interested' | 'not_there' | null =
                    (current && availableTypes.includes(current as any))
                        ? current as 'going' | 'participe' | 'interested' | 'maybe' | 'not_interested' | 'not_there'
                        : null

                return (
                    <>
                        <div
                            className="event-response-buttons-container"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                        >
                            <ButtonGroup
                                items={RESPONSE_OPTIONS.map(({ type, label }) => ({
                                    value: type,
                                    label,
                                    disabled: !buttonsActivated
                                }))}
                                defaultValue={groupValue}
                                onChange={(next) => {
                                    // Si les boutons ne sont pas activés, ne rien faire (pas d'animation stars)
                                    if (!buttonsActivated) {
                                        return
                                    }
                                    const nextFinal: 'going' | 'participe' | 'interested' | 'maybe' | 'not_interested' | 'not_there' | 'cleared' =
                                        next === null ? 'cleared' : next
                                    pendingResponseRef.current = nextFinal
                                    // Mettre à jour le style du pin instantanément (UI)
                                    window.setStylingPin?.(event.id, nextFinal)

                                    // Si une réponse est sélectionnée (pas cleared)
                                    if (next !== null) {
                                        // Déclencher l'animation des étoiles
                                        const responseType = next === 'going' ? 'participe' :
                                            next === 'interested' ? 'maybe' :
                                                next === 'not_interested' ? 'not_there' :
                                                    next as 'participe' | 'maybe' | 'not_there'
                                        triggerStars(responseType)

                                        // Notifier le parent (si callback fourni)
                                        onResponseClick?.(next)
                                    }
                                    // Ne pas envoyer ici. L'envoi est géré dans handleClose (au démontage)
                                }}
                                className="event-response-button-group"
                                buttonClassName="response-button"
                                ariaLabel="Choix de réponse"
                            />
                        </div>
                    </>
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
                        onClick={(e) => {
                            e.stopPropagation()
                            handleToggleOnline()
                        }}
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
                    {isShareExpanded && (
                        <div
                            className={`event-share-section ${isShareExpanded ? 'expanded' : ''}`}
                            style={{
                                overflowY: isShareExpanded ? 'auto' : 'hidden',
                                minHeight: 0 // Important pour que flex: 1 fonctionne correctement
                            }}
                        >
                            <ShareContent event={event} onClose={handleShareClose} />
                        </div>
                    )}
                </div>
            )}

            {/* Zone expandable de partage (disponible partout) */}
            {isShareExpanded && (
                <div
                    className={`event-share-section ${isShareExpanded ? 'expanded' : ''}`}
                    style={{
                        overflowY: isShareExpanded ? 'auto' : 'hidden',
                        minHeight: 0 // Important pour que flex: 1 fonctionne correctement
                    }}
                >
                    <ShareContent event={event} onClose={handleShareClose} />
                </div>
            )}

            {/* Animation des étoiles */}
            {StarsAnimation}
        </div>
    )

    // Rendu unifié (le parent gère le conteneur/overlay si besoin)
    return cardContent
})

EventCard.displayName = 'EventCard'

export default EventCard

