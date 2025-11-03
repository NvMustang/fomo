/**
 * FOMO MVP - Profile Page Web
 *
 * Version web du ProfileScreen React Native
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Button, UserCard, EventCard, CreateEventModal, ToggleLabelsWithExpendableList, AddFriendModal } from '@/components'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { LastActivities } from '@/components/ui/LastActivities'
import { useAuth } from '@/contexts/AuthContext'
import { useFomoDataContext } from '@/contexts/FomoDataProvider'
import { useFilters } from '@/contexts/FiltersContext'
import { filterQuery } from '@/utils/filterTools'
import type { Event } from '@/types/fomoTypes'

export const ProfilePageWeb: React.FC = () => {
  const { user, logout, updateUser } = useAuth()
  const { getLatestResponsesByEvent } = useFomoDataContext()
  const { getFriendsGroupedByFrienship } = useFilters()
  const {
    relationsError,
    addFriendshipAction,
    refreshUserRelations
  } = useFomoDataContext()

  // État pour les paramètres
  const [allowFriendshipRequests, setAllowFriendshipRequests] = useState(
    user?.allowRequests ?? true // Par défaut autoriser les demandes
  )
  const [editingCity, setEditingCity] = useState(false)
  const [newCity, setNewCity] = useState(user?.city || '')

  // État pour le modal d'édition d'événement
  const [isEditEventModalOpen, setIsEditEventModalOpen] = useState(false)
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null)

  // États pour les relations d'amitié
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false)
  const [isPendingFriendsExpanded, setIsPendingFriendsExpanded] = useState(false)
  const [isSentRequestsExpanded, setIsSentRequestsExpanded] = useState(false)
  const [isActiveFriendsExpanded, setIsActiveFriendsExpanded] = useState(false)
  const [expandedPendingCardId, setExpandedPendingCardId] = useState<string | null>(null)
  const [friendsSearchQuery, setFriendsSearchQuery] = useState('')

  // Récupérer les événements créés par l'utilisateur via FiltersContext
  const { getProfileEventsGroupedByPeriods } = useFilters()
  const profileEventsGrouped = useMemo(() => getProfileEventsGroupedByPeriods(), [getProfileEventsGroupedByPeriods])
  const userEvents = profileEventsGrouped.periods.flatMap(p => p.events)
  const isLoadingUserEvents = false // getProfileEventsGroupedByPeriods n'a pas d'état de chargement pour l'instant

  // Calculer les statistiques
  const stats = useMemo(() => {
    if (!user?.id) {
      return { created: 0, going: 0, interested: 0 }
    }

    const created = userEvents.length
    const latestResponsesMap = getLatestResponsesByEvent(user.id)
    const going = Array.from(latestResponsesMap.values()).filter(r => r.finalResponse === 'going').length
    const interested = Array.from(latestResponsesMap.values()).filter(r => r.finalResponse === 'interested').length

    return { created, going, interested }
  }, [userEvents, user?.id, getLatestResponsesByEvent])



  // Calculer les relations d'amitié
  const { activeFriends, pendingFriends, sentRequests } = useMemo(() => {
    if (!user?.id) {
      return { activeFriends: [], pendingFriends: [], sentRequests: [] }
    }
    return getFriendsGroupedByFrienship(user.id)
  }, [user?.id, getFriendsGroupedByFrienship])

  // Filtrer les amis actifs selon la recherche
  const filteredActiveFriends = useMemo(() => {
    if (!friendsSearchQuery.trim()) {
      return activeFriends
    }
    return activeFriends.filter(friend => filterQuery(friend, friendsSearchQuery))
  }, [activeFriends, friendsSearchQuery])

  // Handlers pour les actions d'amitié
  const handleAccept = useCallback(async (friendshipId: string, toUserId: string) => {
    await addFriendshipAction('accept', friendshipId, toUserId)
  }, [addFriendshipAction])

  const handleBlock = useCallback(async (friendshipId: string, toUserId: string) => {
    await addFriendshipAction('block', friendshipId, toUserId)
  }, [addFriendshipAction])

  // Gestion des actions utilisateur
  // Note: L'invitation d'amis se fait maintenant depuis la zone de partage sur chaque événement (page profile uniquement)

  const handleSignOut = () => {
    logout()
  }

  // Mettre à jour allowFriendshipRequests quand user change
  useEffect(() => {
    if (user) {
      setAllowFriendshipRequests(user.allowRequests ?? true)
      setNewCity(user.city || '')
    }
  }, [user])

  // Gestion du toggle showAttendanceToFriends
  const handleToggleShowAttendance = async () => {
    if (!user) return

    const newValue = !user.showAttendanceToFriends

    try {
      await updateUser({ showAttendanceToFriends: newValue })
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la préférence:', error)
      // On pourrait afficher un toast d'erreur ici
    }
  }

  // Gestion du toggle autoriser les demandes d'amitié
  const handleToggleAllowFriendshipRequests = async () => {
    if (!user) return

    const newValue = !allowFriendshipRequests
    setAllowFriendshipRequests(newValue)

    try {
      await updateUser({ allowRequests: newValue })
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la préférence:', error)
      setAllowFriendshipRequests(!newValue) // Rollback
    }
  }


  // Gestion du changement de ville
  const handleCityChange = async (address: string) => {
    if (!user) return

    setNewCity(address)

    try {
      await updateUser({ city: address })
      setEditingCity(false)
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la ville:', error)
      setNewCity(user.city || '') // Rollback
    }
  }

  const handleCitySelect = (address: { address: string; lat: number; lng: number }) => {
    handleCityChange(address.address)
  }

  const handleStartEditingCity = () => {
    setEditingCity(true)
    setNewCity(user?.city || '')
  }

  const handleCancelEditingCity = () => {
    setEditingCity(false)
    setNewCity(user?.city || '')
  }

  // Gestion de l'édition d'événement
  const handleEditEvent = (event: Event) => {
    setEventToEdit(event)
    setIsEditEventModalOpen(true)
  }

  const handleCloseEditEventModal = () => {
    setIsEditEventModalOpen(false)
    setEventToEdit(null)
  }




  if (!user) {
    return (
      <div className="page-container-fullscreen list-page">
        <div className="profile-section">
          <p>Chargement du profil...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container-fullscreen list-page" style={{ paddingTop: '30px' }}>
      {/* UserCard - Informations utilisateur */}
      <div className="profile-section" style={{ marginBottom: 'var(--md)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <div className="user-card-container">
          <UserCard
            user={user}
            showEditButton={false}
          />
        </div>
      </div>

      {/* Statistiques */}
      <div className="stats-section">
        <div className="stats-grid">
          <div className="stat">
            <div className="stat-value">{stats.created}</div>
            <div className="stat-label">Créés</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.going}</div>
            <div className="stat-label">Participe</div>
          </div>
          <div className="stat">
            <div className="stat-value">{stats.interested}</div>
            <div className="stat-label">Intéressé</div>
          </div>
        </div>
      </div>

      {/* Activité récente */}
      <LastActivities />

      {/* Relations d'amitié (amis actifs + demandes en attente) */}
      <div className="profile-section" style={{ marginBottom: 'var(--md)' }}>
        <div className="friends-section-container">
          {/* Section principale : Mes amis */}
          <div className="friends-section">
            {/* Header avec titre et bouton d'ajout */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--md)' }}>
              <h3 className="friends-title" style={{ margin: 0 }}>
                Mes amis
              </h3>
              <Button
                onClick={() => setIsAddFriendModalOpen(true)}
                size="sm"
                title="Ajouter un ami"
                className="friends-add-button"
              >
                + Ajouter un ami
              </Button>
            </div>

            {/* Affichage de l'erreur si présente */}
            {relationsError && (
              <div className="error">Erreur: {relationsError}</div>
            )}

            {/* Invitations reçues - Toggle */}
            {pendingFriends.length > 0 && (
              <ToggleLabelsWithExpendableList
                label="Invitations reçues"
                count={pendingFriends.length}
                isExpanded={isPendingFriendsExpanded}
                onToggle={() => setIsPendingFriendsExpanded(!isPendingFriendsExpanded)}
              >
                <div className="friends-grid">
                  {pendingFriends.map((friend, index) => (
                    <UserCard
                      key={`${friend.id}-${index}`}
                      user={friend}
                      isExpanded={expandedPendingCardId === friend.id}
                      onExpandChange={(userId, expanded) => {
                        setExpandedPendingCardId(expanded ? userId : null)
                      }}
                      actionButtons={
                        <div className="friend-actions">
                          <button
                            className="button primary"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleAccept(friend.friendship.id, friend.id)
                            }}
                          >
                            Accepter
                          </button>
                          <button
                            className="button secondary"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleBlock(friend.friendship.id, friend.id)
                            }}
                          >
                            Bloquer
                          </button>
                        </div>
                      }
                    />
                  ))}
                </div>
              </ToggleLabelsWithExpendableList>
            )}

            {/* Invitations envoyées - Toggle */}
            {sentRequests.length > 0 && (
              <ToggleLabelsWithExpendableList
                label="Invitations envoyées"
                count={sentRequests.length}
                isExpanded={isSentRequestsExpanded}
                onToggle={() => setIsSentRequestsExpanded(!isSentRequestsExpanded)}
              >
                <div className="friends-grid">
                  {sentRequests.map((friend, index) => (
                    <UserCard
                      key={`${friend.id}-${index}`}
                      user={friend}
                    />
                  ))}
                </div>
              </ToggleLabelsWithExpendableList>
            )}

            {/* Liste des amitiés - Toggle */}
            {activeFriends.length > 0 && (
              <ToggleLabelsWithExpendableList
                label="Amitiés"
                count={activeFriends.length}
                isExpanded={isActiveFriendsExpanded}
                onToggle={() => setIsActiveFriendsExpanded(!isActiveFriendsExpanded)}
                className="with-border-top"
              >
                {/* Barre de recherche pour filtrer les amis */}
                <div style={{ marginBottom: 'var(--md)' }}>
                  <input
                    type="text"
                    placeholder="Rechercher un ami..."
                    value={friendsSearchQuery}
                    onChange={(e) => setFriendsSearchQuery(e.target.value)}
                    className="friends-search-input"
                    style={{
                      width: '100%',
                      padding: 'var(--sm) var(--md)',
                      fontSize: 'var(--text-sm)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      backgroundColor: 'var(--surface)',
                      color: 'var(--text)',
                      outline: 'none',
                      transition: 'border-color var(--transition-fast)'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary)'
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border)'
                    }}
                  />
                </div>
                <div className="friends-grid">
                  {filteredActiveFriends.map((friend, index) => (
                    <UserCard
                      key={`${friend.id}-${index}`}
                      user={friend}
                    />
                  ))}
                </div>
                {filteredActiveFriends.length === 0 && friendsSearchQuery.trim() && (
                  <div style={{
                    textAlign: 'center',
                    padding: 'var(--lg)',
                    color: 'var(--text-muted)',
                    fontSize: 'var(--text-sm)'
                  }}>
                    Aucun ami trouvé pour "{friendsSearchQuery}"
                  </div>
                )}
              </ToggleLabelsWithExpendableList>
            )}

            {/* Empty state si aucun ami, aucune demande */}
            {activeFriends.length === 0 && pendingFriends.length === 0 && sentRequests.length === 0 && !relationsError && (
              <div className="friends-empty">
                <div className="empty-icon">👥</div>
                <h4 className="empty-title">Aucun ami pour le moment</h4>
                <p className="empty-description">
                  Invite tes amis à rejoindre FOMO pour partager vos événements !
                </p>
              </div>
            )}
          </div>

          {/* Modal d'ajout d'ami */}
          <AddFriendModal
            isOpen={isAddFriendModalOpen}
            onClose={() => setIsAddFriendModalOpen(false)}
            currentUserId={user?.id || ''}
            onFriendAdded={() => {
              refreshUserRelations()
              setIsAddFriendModalOpen(false)
            }}
          />
        </div>
      </div>

      {/* Section Paramètres */}
      <div className="profile-section" style={{ marginBottom: 'var(--md)' }}>
        <h3 style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--text)',
          margin: '0 0 var(--sm) 0',
          paddingBottom: 'var(--sm)',
          borderBottom: '1px solid var(--border)'
        }}>
          Paramètres
        </h3>

        {/* Toggle: Afficher ma participation aux amis */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--sm) 0',
          borderBottom: '1px solid var(--border)'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 'var(--text-md)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--text)',
              marginBottom: 'var(--xs)'
            }}>
              Afficher ma participation aux amis
            </div>
            <div style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)'
            }}>
              {user.showAttendanceToFriends
                ? 'Vos amis peuvent voir les événements auxquels vous participez'
                : 'Vos amis ne peuvent pas voir votre participation aux événements'
              }
            </div>
          </div>
          <button
            onClick={handleToggleShowAttendance}
            role="switch"
            aria-checked={user.showAttendanceToFriends}
            aria-label={user.showAttendanceToFriends ? 'Masquer la participation' : 'Afficher la participation'}
            style={{
              width: '52px',
              height: '28px',
              borderRadius: '14px',
              border: 'none',
              backgroundColor: user.showAttendanceToFriends ? 'var(--success)' : 'var(--text-muted)',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background-color var(--transition-fast)',
              marginLeft: 'var(--md)',
              flexShrink: 0
            }}
          >
            <div style={{
              position: 'absolute',
              top: '2px',
              left: user.showAttendanceToFriends ? '26px' : '2px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'var(--white)',
              transition: 'left var(--transition-fast)',
              boxShadow: 'var(--shadow)'
            }} />
          </button>
        </div>

        {/* Toggle: Autoriser les demandes d'amitié */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--sm) 0',
          borderBottom: '1px solid var(--border)'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 'var(--text-md)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--text)',
              marginBottom: 'var(--xs)'
            }}>
              Autoriser les demandes d'amitié
            </div>
            <div style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)'
            }}>
              {allowFriendshipRequests
                ? 'Les autres utilisateurs peuvent vous envoyer des demandes d\'amitié'
                : 'Les demandes d\'amitié sont bloquées'
              }
            </div>
          </div>
          <button
            onClick={handleToggleAllowFriendshipRequests}
            role="switch"
            aria-checked={allowFriendshipRequests}
            aria-label={allowFriendshipRequests ? 'Bloquer les demandes' : 'Autoriser les demandes'}
            style={{
              width: '52px',
              height: '28px',
              borderRadius: '14px',
              border: 'none',
              backgroundColor: allowFriendshipRequests ? 'var(--success)' : 'var(--text-muted)',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background-color var(--transition-fast)',
              marginLeft: 'var(--md)',
              flexShrink: 0
            }}
          >
            <div style={{
              position: 'absolute',
              top: '2px',
              left: allowFriendshipRequests ? '26px' : '2px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'var(--white)',
              transition: 'left var(--transition-fast)',
              boxShadow: 'var(--shadow)'
            }} />
          </button>
        </div>

        {/* Changer la ville */}
        <div style={{
          padding: 'var(--sm) 0'
        }}>
          <div className="city-setting-header" style={{
            marginBottom: editingCity ? 'var(--md)' : 0
          }}>
            <div className="city-setting-title">
              Lieu{user?.city ? `: ${user.city}` : ''}
            </div>
            {!editingCity && (
              <button
                className="city-edit-button"
                onClick={handleStartEditingCity}
                type="button"
              >
                Modifier
              </button>
            )}
          </div>

          {/* Mode édition avec AddressAutocomplete */}
          {editingCity && (
            <div className="city-editor">
              <div style={{ flex: 1 }}>
                <AddressAutocomplete
                  value={newCity}
                  onChange={setNewCity}
                  onAddressSelect={handleCitySelect}
                  placeholder="Rechercher une ville ou adresse..."
                  minLength={2}
                />
              </div>
              <div className="city-editor-actions">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCancelEditingCity}
                >
                  Annuler
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleCityChange(newCity)}
                  disabled={!newCity.trim()}
                >
                  Enregistrer
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Boutons d'action */}
        <div style={{
          padding: 'var(--sm) 0',
          borderTop: '1px solid var(--border)',
          marginTop: 'var(--sm)',
        }}>
          <Button variant="secondary" onClick={handleSignOut} style={{ width: '100%' }}>
            Se déconnecter
          </Button>
        </div>
      </div>

      {/* Section Mes événements créés */}
      <div className="profile-section" style={{ marginBottom: 'var(--md)' }}>
        <h3 style={{
          fontSize: 'var(--text-lg)',
          fontWeight: 'var(--font-weight-bold)',
          color: 'var(--text)',
          margin: '0 0 var(--md) 0',
          paddingBottom: 'var(--sm)',
          borderBottom: '1px solid var(--border)'
        }}>
          Mes événements créés
          {userEvents.length > 0 && (
            <span style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--font-weight-normal)',
              color: 'var(--text-muted)',
              marginLeft: 'var(--sm)'
            }}>
              ({userEvents.length})
            </span>
          )}
        </h3>

        {isLoadingUserEvents ? (
          <div style={{
            textAlign: 'center',
            padding: 'var(--xl)',
            color: 'var(--text-muted)'
          }}>
            Chargement de vos événements...
          </div>
        ) : profileEventsGrouped.periods.length > 0 ? (
          <>
            {profileEventsGrouped.periods.map((period) => (
              <div
                key={period.key}
                className="calendar-period"
              >
                {/* Barre de division */}
                <div className="calendar-period-divider"></div>
                {/* Label de période */}
                <div className="calendar-period-label">
                  {period.label}
                </div>

                {/* Événements de la période */}
                <div className="calendar-period-events">
                  {period.events.map((event) => (
                    <div key={event.id} className="event-list-item">
                      <EventCard
                        event={event}
                        showToggleResponse={false}
                        isProfilePage={true}
                        isMyEventsPage={false}
                        onEdit={handleEditEvent}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <h4 className="empty-title">Aucun événement créé</h4>
            <p className="empty-description">
              Créez votre premier événement pour commencer à inviter vos amis !
            </p>
          </div>
        )}
      </div>






      {/* Spacer pour éviter que le contenu soit caché par la navbar */}
      <div style={{ height: '80px' }}></div>

      {/* Modal d'édition d'événement */}
      <CreateEventModal
        isOpen={isEditEventModalOpen}
        onClose={handleCloseEditEventModal}
        editMode={true}
        initialEvent={eventToEdit}
      />
    </div>
  )
}

export default ProfilePageWeb

