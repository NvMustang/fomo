/**
 * FOMO MVP - Share Content Component
 * 
 * Composant réutilisable pour le contenu de partage d'événement
 * Peut être utilisé dans une zone expandable ou dans un modal
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Button, ToggleLabelsWithExpendableList } from '@/components'
import { useAuth } from '@/contexts/AuthContext'
import { useFomoDataContext } from '@/contexts/FomoDataProvider'
import { useFilters } from '@/contexts/FiltersContext'
import type { Event } from '@/types/fomoTypes'
import { useToast } from '@/hooks'
import { format } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { fr } from 'date-fns/locale'

interface ShareContentProps {
    event: Event
    onClose?: () => void
}

export const ShareContent: React.FC<ShareContentProps> = ({ event, onClose }) => {
    const { showToast } = useToast()
    const { user } = useAuth()
    const { responses, addEventResponse, users, getLatestResponsesByUser } = useFomoDataContext()
    const { getFriends, getGuestsGroupedByResponse } = useFilters()
    const [eventUrl, setEventUrl] = useState('')
    const [shareMessage, setShareMessage] = useState('')
    const [activeTab, setActiveTab] = useState<'invite' | 'share'>('invite')

    // État pour l'invitation d'amis
    const [friendsSearchQuery, setFriendsSearchQuery] = useState('')
    const [invitedFriendIds, setInvitedFriendIds] = useState<Set<string>>(new Set())
    const [isInviting, setIsInviting] = useState(false)

    // États pour les sections expandables des guests
    const [isGoingExpanded, setIsGoingExpanded] = useState(true)
    const [isInterestedExpanded, setIsInterestedExpanded] = useState(true)
    const [isInvitedExpanded, setIsInvitedExpanded] = useState(true)
    const [isNotInterestedExpanded, setIsNotInterestedExpanded] = useState(false)
    const [isSeenExpanded, setIsSeenExpanded] = useState(false)
    const [isClearedExpanded, setIsClearedExpanded] = useState(false)

    // Obtenir les amis actifs
    const friends = useMemo(() => {
        if (!user?.id) return []
        return getFriends(user.id)
    }, [user?.id, getFriends])

    // Obtenir les guests groupés par réponse
    const guestsGrouped = useMemo(() => {
        if (!event?.id) {
            return {
                invited: [] as typeof responses,
                going: [] as typeof responses,
                interested: [] as typeof responses,
                not_interested: [] as typeof responses,
                seen: [] as typeof responses,
                cleared: [] as typeof responses,
                null: [] as typeof responses
            }
        }
        return getGuestsGroupedByResponse(event.id)
    }, [event?.id, getGuestsGroupedByResponse])

    // Convertir les UserResponse en User
    const guestsUsers = useMemo(() => {
        const convertToUsers = (responses: typeof guestsGrouped.going) => {
            return responses
                .map(response => users.find(u => u.id === response.userId))
                .filter((u): u is NonNullable<typeof u> => u !== undefined)
        }

        return {
            going: convertToUsers(guestsGrouped.going),
            interested: convertToUsers(guestsGrouped.interested),
            invited: convertToUsers(guestsGrouped.invited),
            not_interested: convertToUsers(guestsGrouped.not_interested),
            seen: convertToUsers(guestsGrouped.seen),
            cleared: convertToUsers(guestsGrouped.cleared)
        }
    }, [guestsGrouped, users])

    // Charger les invitations existantes
    useEffect(() => {
        if (!event || !user?.id || !responses) return

        // NOUVEAU SYSTÈME : Utiliser les helpers pour obtenir les dernières réponses
        const latestResponsesMap = getLatestResponsesByUser(event.id)
        const existingInvitations = Array.from(latestResponsesMap.values()).filter(r =>
            r.finalResponse === 'invited' &&
            r.invitedByUserId === user.id
        )

        const invitedIds = new Set(existingInvitations.map(r => r.userId))
        setInvitedFriendIds(invitedIds)
    }, [event, user?.id, responses, getLatestResponsesByUser])

    // Trouver les amis non participants
    const notParticipatingFriends = useMemo(() => {
        const guestUserIds = new Set([
            ...guestsUsers.going.map(u => u.id),
            ...guestsUsers.interested.map(u => u.id),
            ...guestsUsers.invited.map(u => u.id),
            ...guestsUsers.not_interested.map(u => u.id),
            ...guestsUsers.seen.map(u => u.id),
            ...guestsUsers.cleared.map(u => u.id)
        ])

        const nonParticipants = friends.filter(friend => !guestUserIds.has(friend.id))

        if (!friendsSearchQuery.trim()) return nonParticipants

        const query = friendsSearchQuery.toLowerCase().trim()
        return nonParticipants.filter(friend => {
            const name = friend.name?.toLowerCase() || ''
            const email = friend.email?.toLowerCase() || ''
            const city = friend.city?.toLowerCase() || ''
            return name.includes(query) || email.includes(query) || city.includes(query)
        })
    }, [friends, guestsUsers, friendsSearchQuery])

    // Générer l'URL et le message de partage
    useEffect(() => {
        if (event) {
            const url = `${window.location.origin}/?event=${event.id}`
            setEventUrl(url)

            const eventDate = format(
                toZonedTime(event.startsAt, Intl.DateTimeFormat().resolvedOptions().timeZone),
                'PPP à p',
                { locale: fr }
            )
            const message = `Rejoins-moi à "${event.title}" !\n📅 ${eventDate}\n📍 ${event.venue?.address || 'Lieu à confirmer'}\n\n${url}`
            setShareMessage(message)
        }
    }, [event])

    // Gestion du toggle d'invitation
    const handleToggleFriendInvite = useCallback((friendId: string, isAlreadyInvited: boolean) => {
        if (isAlreadyInvited) return

        setInvitedFriendIds(prev => {
            const next = new Set(prev)
            if (next.has(friendId)) {
                next.delete(friendId)
            } else {
                next.add(friendId)
            }
            return next
        })
    }, [])

    // Gestion de l'enregistrement des invitations
    const handleSaveInvitations = useCallback(async () => {
        if (!event || !user?.id || isInviting || !addEventResponse) return

        setIsInviting(true)

        try {
            // Filtrer uniquement les amis sélectionnés qui sont dans notParticipatingFriends
            const selectedNotParticipatingFriendIds = notParticipatingFriends
                .filter(friend => invitedFriendIds.has(friend.id))
                .map(friend => friend.id)

            const invitationsToCreate: Array<{ friendId: string; invitedByUserId: string }> = []

            selectedNotParticipatingFriendIds.forEach(friendId => {
                invitationsToCreate.push({ friendId, invitedByUserId: user.id })
            })

            invitationsToCreate.forEach(({ friendId, invitedByUserId }) => {
                addEventResponse(event.id, 'invited', {
                    targetUserId: friendId,
                    invitedByUserId
                })
            })

            showToast({
                type: 'success',
                title: 'Invitations envoyées',
                message: `${invitationsToCreate.length} invitation(s) envoyée(s)`,
                duration: 1000
            })

            // Réinitialiser après succès (uniquement les sélections de notParticipatingFriends)
            const newInvitedIds = new Set(invitedFriendIds)
            selectedNotParticipatingFriendIds.forEach(id => newInvitedIds.delete(id))
            setInvitedFriendIds(newInvitedIds)
            onClose?.()
        } catch (error) {
            console.error('Erreur lors de l\'envoi des invitations:', error)
            showToast({
                type: 'error',
                title: 'Erreur',
                message: 'Impossible d\'envoyer les invitations',
                duration: 1000
            })
        } finally {
            setIsInviting(false)
        }
    }, [event, user?.id, invitedFriendIds, notParticipatingFriends, addEventResponse, isInviting, showToast, onClose])

    const handleCopyLink = async () => {
        if (!eventUrl) {
            showToast({
                type: 'error',
                title: 'Erreur',
                message: 'URL non disponible'
            })
            return
        }

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(eventUrl)
            } else {
                const textArea = document.createElement('textarea')
                textArea.value = eventUrl
                textArea.style.position = 'fixed'
                textArea.style.left = '-999999px'
                document.body.appendChild(textArea)
                textArea.select()
                document.execCommand('copy')
                document.body.removeChild(textArea)
            }

            showToast({
                type: 'success',
                title: 'Partage',
                message: 'Adresse de l\'événement copiée dans votre presse-papiers'
            })
        } catch (error) {
            console.error('Erreur lors de la copie:', error)
            showToast({
                type: 'error',
                title: 'Erreur',
                message: 'Impossible de copier le lien'
            })
        }
    }

    const handleCopyMessage = async () => {
        try {
            await navigator.clipboard.writeText(shareMessage)
            showToast({
                type: 'success',
                title: 'Partage',
                message: 'Message copié dans le presse-papiers'
            })
        } catch (error) {
            showToast({
                type: 'error',
                title: 'Erreur',
                message: 'Impossible de copier le message'
            })
        }
    }

    const handleNativeShare = async () => {
        if (!event) return

        const shareData = {
            title: event.title,
            text: shareMessage,
            url: eventUrl
        }

        try {
            if (typeof navigator !== 'undefined' && typeof navigator.share === 'function' && navigator.canShare && navigator.canShare(shareData)) {
                await navigator.share(shareData)
            } else {
                await handleCopyMessage()
            }
        } catch (error) {
            if ((error as Error).name !== 'AbortError') {
                console.error('Erreur lors du partage:', error)
                await handleCopyMessage()
            }
        }
    }

    // Compter uniquement les amis sélectionnés dans la liste "Inviter des amis" (notParticipatingFriends)
    const selectedNotParticipatingCount = useMemo(() => {
        return notParticipatingFriends.filter(friend => invitedFriendIds.has(friend.id)).length
    }, [notParticipatingFriends, invitedFriendIds])

    // Fonction helper pour obtenir les initiales
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2)
    }

    return (
        <div className="share-content">
            {/* Onglets */}
            <div className="modal-tabs">
                <button
                    type="button"
                    onClick={() => setActiveTab('invite')}
                    className={`modal-tab-button ${activeTab === 'invite' ? 'active' : ''}`}
                >
                    👥 Inviter des amis
                    {selectedNotParticipatingCount > 0 && (
                        <span className="friends-count-badge">
                            {selectedNotParticipatingCount}
                        </span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab('share')}
                    className={`modal-tab-button ${activeTab === 'share' ? 'active' : ''}`}
                >
                    🔗 Partager le lien
                </button>
            </div>

            {/* Contenu avec flex */}
            <div className="share-content-scrollable">
                <div className="modal-content-inner">
                    {activeTab === 'invite' ? (
                        <>
                            {friends.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-icon">👥</div>
                                    <p className="empty-title">
                                        Aucun ami pour le moment
                                    </p>
                                    <p className="empty-description">
                                        Ajoutez des amis depuis votre profil pour pouvoir les inviter à vos événements.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {/* Barre de recherche */}
                                    <div className="form-section">
                                        <input
                                            type="text"
                                            placeholder="🔍 Rechercher un ami..."
                                            value={friendsSearchQuery}
                                            onChange={(e) => setFriendsSearchQuery(e.target.value)}
                                            className="form-input"
                                        />
                                    </div>

                                    {/* Sections guests groupées par réponse */}
                                    <div className="friends-section">
                                        {guestsUsers.going.length > 0 && (
                                            <ToggleLabelsWithExpendableList
                                                label="J'y vais"
                                                count={guestsUsers.going.length}
                                                isExpanded={isGoingExpanded}
                                                onToggle={() => setIsGoingExpanded(!isGoingExpanded)}
                                            >
                                                <div className="friends-list-xs">
                                                    {guestsUsers.going.map((guestUser) => {
                                                        const friendName = guestUser.name || guestUser.email || guestUser.id
                                                        return (
                                                            <div
                                                                key={guestUser.id}
                                                                className="friends-toggle-container"
                                                            >
                                                                <div className="friend-avatar">
                                                                    {friendName ? getInitials(friendName) : '?'}
                                                                </div>
                                                                <div className="friend-info">
                                                                    <div className="friend-name">
                                                                        {friendName}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </ToggleLabelsWithExpendableList>
                                        )}

                                        {guestsUsers.interested.length > 0 && (
                                            <ToggleLabelsWithExpendableList
                                                label="Intéressés"
                                                count={guestsUsers.interested.length}
                                                isExpanded={isInterestedExpanded}
                                                onToggle={() => setIsInterestedExpanded(!isInterestedExpanded)}
                                            >
                                                <div className="friends-list-xs">
                                                    {guestsUsers.interested.map((guestUser) => {
                                                        const friendName = guestUser.name || guestUser.email || guestUser.id
                                                        return (
                                                            <div
                                                                key={guestUser.id}
                                                                className="friends-toggle-container"
                                                            >
                                                                <div className="friend-avatar">
                                                                    {friendName ? getInitials(friendName) : '?'}
                                                                </div>
                                                                <div className="friend-info">
                                                                    <div className="friend-name">
                                                                        {friendName}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </ToggleLabelsWithExpendableList>
                                        )}

                                        {guestsUsers.invited.length > 0 && (
                                            <ToggleLabelsWithExpendableList
                                                label="Invités"
                                                count={guestsUsers.invited.length}
                                                isExpanded={isInvitedExpanded}
                                                onToggle={() => setIsInvitedExpanded(!isInvitedExpanded)}
                                            >
                                                <div className="friends-list-xs">
                                                    {guestsUsers.invited.map((guestUser) => {
                                                        const friendName = guestUser.name || guestUser.email || guestUser.id
                                                        return (
                                                            <div
                                                                key={guestUser.id}
                                                                className="friends-toggle-container"
                                                            >
                                                                <div className="friend-avatar">
                                                                    {friendName ? getInitials(friendName) : '?'}
                                                                </div>
                                                                <div className="friend-info">
                                                                    <div className="friend-name">
                                                                        {friendName}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </ToggleLabelsWithExpendableList>
                                        )}

                                        {guestsUsers.not_interested.length > 0 && (
                                            <ToggleLabelsWithExpendableList
                                                label="Pas intéressés"
                                                count={guestsUsers.not_interested.length}
                                                isExpanded={isNotInterestedExpanded}
                                                onToggle={() => setIsNotInterestedExpanded(!isNotInterestedExpanded)}
                                            >
                                                <div className="friends-list-xs">
                                                    {guestsUsers.not_interested.map((guestUser) => {
                                                        const friendName = guestUser.name || guestUser.email || guestUser.id
                                                        return (
                                                            <div
                                                                key={guestUser.id}
                                                                className="friends-toggle-container"
                                                            >
                                                                <div className="friend-avatar">
                                                                    {friendName ? getInitials(friendName) : '?'}
                                                                </div>
                                                                <div className="friend-info">
                                                                    <div className="friend-name">
                                                                        {friendName}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </ToggleLabelsWithExpendableList>
                                        )}

                                        {guestsUsers.seen.length > 0 && (
                                            <ToggleLabelsWithExpendableList
                                                label="Vus"
                                                count={guestsUsers.seen.length}
                                                isExpanded={isSeenExpanded}
                                                onToggle={() => setIsSeenExpanded(!isSeenExpanded)}
                                            >
                                                <div className="friends-list-xs">
                                                    {guestsUsers.seen.map((guestUser) => {
                                                        const friendName = guestUser.name || guestUser.email || guestUser.id
                                                        return (
                                                            <div
                                                                key={guestUser.id}
                                                                className="friends-toggle-container"
                                                            >
                                                                <div className="friend-avatar">
                                                                    {friendName ? getInitials(friendName) : '?'}
                                                                </div>
                                                                <div className="friend-info">
                                                                    <div className="friend-name">
                                                                        {friendName}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </ToggleLabelsWithExpendableList>
                                        )}

                                        {guestsUsers.cleared.length > 0 && (
                                            <ToggleLabelsWithExpendableList
                                                label="Effacés"
                                                count={guestsUsers.cleared.length}
                                                isExpanded={isClearedExpanded}
                                                onToggle={() => setIsClearedExpanded(!isClearedExpanded)}
                                            >
                                                <div className="friends-list-xs">
                                                    {guestsUsers.cleared.map((guestUser) => {
                                                        const friendName = guestUser.name || guestUser.email || guestUser.id
                                                        return (
                                                            <div
                                                                key={guestUser.id}
                                                                className="friends-toggle-container"
                                                            >
                                                                <div className="friend-avatar">
                                                                    {friendName ? getInitials(friendName) : '?'}
                                                                </div>
                                                                <div className="friend-info">
                                                                    <div className="friend-name">
                                                                        {friendName}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </ToggleLabelsWithExpendableList>
                                        )}

                                        {notParticipatingFriends.length > 0 && (
                                            <ToggleLabelsWithExpendableList
                                                label="Inviter des amis"
                                                count={selectedNotParticipatingCount}
                                                isExpanded={true}
                                                onToggle={() => { }}
                                                alwaysVisible={true}
                                            >
                                                <div className="friends-list-xs">
                                                    {notParticipatingFriends.map((friend) => {
                                                        const isSelected = invitedFriendIds.has(friend.id)
                                                        const friendName = friend.name || friend.email || friend.id

                                                        return (
                                                            <button
                                                                key={friend.id}
                                                                type="button"
                                                                onClick={() => handleToggleFriendInvite(friend.id, false)}
                                                                className={`friends-toggle-container ${isSelected ? 'selected' : ''}`}
                                                            >
                                                                <div className={`friend-avatar ${isSelected ? 'bg-current-color' : 'bg-text-muted'}`}>
                                                                    {friendName ? getInitials(friendName) : '?'}
                                                                </div>
                                                                <div className="friend-info">
                                                                    <div className="friend-name">
                                                                        {friendName}
                                                                    </div>
                                                                    {friend.city && (
                                                                        <div className="friend-location">
                                                                            📍 {friend.city}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {isSelected && (
                                                                    <span className="text-sm text-white">✓</span>
                                                                )}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </ToggleLabelsWithExpendableList>
                                        )}

                                        {guestsUsers.going.length === 0 &&
                                            guestsUsers.interested.length === 0 &&
                                            guestsUsers.invited.length === 0 &&
                                            guestsUsers.not_interested.length === 0 &&
                                            guestsUsers.seen.length === 0 &&
                                            guestsUsers.cleared.length === 0 &&
                                            notParticipatingFriends.length === 0 && (
                                                <div className="empty-state">
                                                    <p className="empty-title">
                                                        Aucun ami pour cet événement
                                                    </p>
                                                    <p className="empty-description">
                                                        {friendsSearchQuery.trim()
                                                            ? `Aucun ami trouvé pour "${friendsSearchQuery}"`
                                                            : 'Invitez vos amis pour qu\'ils rejoignent cet événement'}
                                                    </p>
                                                </div>
                                            )}
                                    </div>
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            {/* Section Partager le lien */}
                            <div className="form-section">
                                <label htmlFor="share-link" className="form-label">
                                    Lien de l'événement
                                </label>
                                <div className="form-input-group">
                                    <input
                                        id="share-link"
                                        type="text"
                                        className="form-input form-input-monospace text-xs"
                                        value={eventUrl}
                                        readOnly
                                        onClick={(e) => {
                                            (e.target as HTMLInputElement).select()
                                        }}
                                    />
                                    <Button
                                        variant="secondary"
                                        onClick={handleCopyLink}
                                        className="flex-shrink-0"
                                    >
                                        📋 Copier
                                    </Button>
                                </div>
                                <p className="form-help">
                                    Ce lien permet à quelqu'un de voir l'événement sans être inscrit
                                </p>
                            </div>

                            {/* Message de partage */}
                            <div className="form-section">
                                <label htmlFor="share-message" className="form-label">
                                    Message de partage
                                </label>
                                <textarea
                                    id="share-message"
                                    className="form-input form-textarea"
                                    value={shareMessage}
                                    onChange={(e) => setShareMessage(e.target.value)}
                                    rows={8}
                                    placeholder="Personnalisez votre message de partage..."
                                />
                            </div>

                            {/* Actions de partage */}
                            <div className="form-actions form-actions-column">
                                {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                                    <Button
                                        variant="primary"
                                        onClick={handleNativeShare}
                                        className="width-full"
                                    >
                                        📤 Partager
                                    </Button>
                                )}
                                <Button
                                    variant="secondary"
                                    onClick={handleCopyMessage}
                                    className="width-full"
                                >
                                    📋 Copier le message
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Bouton Enregistrer (pour les invitations) */}
            {activeTab === 'invite' && friends.length > 0 && (
                <div className="modal-footer">
                    <Button
                        variant="primary"
                        onClick={handleSaveInvitations}
                        disabled={isInviting || selectedNotParticipatingCount === 0}
                        className="width-full"
                    >
                        {isInviting ? 'Enregistrement...' : selectedNotParticipatingCount === 0 ? 'Sélectionner des amis' : `Inviter ${selectedNotParticipatingCount} ami${selectedNotParticipatingCount > 1 ? 's' : ''}`}
                    </Button>
                </div>
            )}
        </div>
    )
}

export default ShareContent

