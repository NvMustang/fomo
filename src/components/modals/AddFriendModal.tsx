import React, { useState, useCallback, useEffect } from 'react'
import { useFomoDataContext } from '@/contexts/FomoDataProvider'
import { UserCard } from '@/components'
import { useToast, useModalScrollHint } from '@/hooks'
import type { User } from '@/types/fomoTypes'

interface AddFriendModalProps {
    isOpen: boolean
    onClose: () => void
    currentUserId: string
    onFriendAdded?: () => void
}

interface SearchResult {
    id: string
    name: string
    email: string
    city: string
    isPublicProfile?: boolean
    isAmbassador?: boolean
    friendshipStatus: string
}

// Convertir SearchResult en User pour UserCard
const searchResultToUser = (result: SearchResult): User => ({
    id: result.id,
    name: result.name,
    email: result.email,
    city: result.city,
    friendsCount: 0,
    showAttendanceToFriends: false,
    isPublicProfile: result.isPublicProfile ?? true,
    isAmbassador: result.isAmbassador ?? false,
    allowRequests: true
})

export const AddFriendModal: React.FC<AddFriendModalProps> = React.memo(({
    isOpen,
    onClose,
    currentUserId: _currentUserId,
    onFriendAdded
}) => {
    const { searchUsers, sendFriendshipRequest } = useFomoDataContext()
    const { showToast } = useToast()
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])
    const [allSearchResults, setAllSearchResults] = useState<SearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [expandedCardId, setExpandedCardId] = useState<string | null>(null)

    // Animation de scroll à l'ouverture du modal
    const modalContentRef = useModalScrollHint(isOpen)

    // Debounce de la recherche (comme FilterBar)
    useEffect(() => {
        if (!searchQuery.trim() || searchQuery.length < 3) {
            setSearchResults([])
            setAllSearchResults([])
            setIsSearching(false)
            return
        }

        setIsSearching(true)
        const timeout = setTimeout(async () => {
            try {
                const results = await searchUsers(searchQuery)
                setAllSearchResults(results)
                // Filtrer les utilisateurs qui ont un statut d'amitié actif (active, pending, blocked)
                // Permettre les statuts 'none' et 'inactive' (pour renouer une amitié)
                const filteredResults = results.filter(user =>
                    user.friendshipStatus === 'none' || user.friendshipStatus === 'inactive'
                )
                setSearchResults(filteredResults)
            } catch (error) {
                console.error('Erreur lors de la recherche d\'utilisateurs:', error)
                showToast({
                    title: 'Erreur',
                    message: 'Impossible de rechercher des utilisateurs',
                    type: 'error',
                    position: 'top',
                    duration: 2000
                })
                setSearchResults([])
                setAllSearchResults([])
            } finally {
                setIsSearching(false)
            }
        }, 600)

        return () => clearTimeout(timeout)
    }, [searchQuery, searchUsers, showToast])

    const handleSendRequest = useCallback(async (targetUserId: string) => {
        setIsLoading(true)
        try {
            const success = await sendFriendshipRequest(targetUserId)
            if (success) {
                // Mettre à jour le statut local
                setSearchResults(prev =>
                    prev.map(user =>
                        user.id === targetUserId
                            ? { ...user, friendshipStatus: 'pending' }
                            : user
                    )
                )
                showToast({
                    title: 'Demande envoyée',
                    message: 'Votre demande d\'amitié a été envoyée',
                    type: 'success',
                    position: 'top',
                    duration: 2000
                })
                onFriendAdded?.()
            } else {
                showToast({
                    title: 'Erreur',
                    message: 'Impossible d\'envoyer la demande d\'amitié',
                    type: 'error',
                    position: 'top',
                    duration: 2000
                })
            }
        } catch (error) {
            console.error('Erreur lors de l\'envoi de la demande d\'amitié:', error)
            showToast({
                title: 'Erreur',
                message: 'Impossible d\'envoyer la demande d\'amitié',
                type: 'error',
                duration: 2000
            })
        } finally {
            setIsLoading(false)
        }
    }, [sendFriendshipRequest, onFriendAdded, showToast])

    const handleClose = useCallback(() => {
        setSearchQuery('')
        setSearchResults([])
        setAllSearchResults([])
        setExpandedCardId(null)
        onClose()
    }, [onClose])

    const getStatusText = (status: string) => {
        switch (status) {
            case 'active': return 'Ami'
            case 'pending': return 'Demande envoyée'
            case 'blocked': return 'Bloqué'
            default: return 'Ajouter'
        }
    }

    const getStatusClass = (status: string) => {
        switch (status) {
            case 'active': return 'status-active'
            case 'pending': return 'status-pending'
            case 'blocked': return 'status-blocked'
            default: return ''
        }
    }

    if (!isOpen) return null

    return (
        <div className="modal_overlay" onClick={handleClose}>
            <div className="modal_container">
                <div className="modal" onClick={(e) => e.stopPropagation()}>


                    <div ref={modalContentRef} className="modal-content modal-form">
                        <div className="form-section">
                            <label htmlFor="friend-search" className="form-label">
                                Rechercher par nom ou email
                            </label>
                            <input className="form-input"
                                id="friend-search"
                                type="search"
                                placeholder="Nom ou adresse email"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                aria-label="Rechercher par nom ou email"
                            />
                        </div>

                        {/* Container fixe pour les résultats ou les états vides */}
                        <div className="search-results-wrapper">
                            {isSearching ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon">🔍</div>
                                    <div className="empty-state-text">Recherche en cours...</div>
                                </div>
                            ) : searchQuery.length >= 3 && searchResults.length > 0 ? (
                                <>
                                    <h4 className="form-label">
                                        Résultats ({searchResults.length})
                                    </h4>
                                    <div className="search-results-scrollable">
                                        <div style={{
                                            display: 'grid',
                                            gap: 'var(--md)',
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'
                                        }}>
                                            {searchResults.map((result) => {
                                                const user = searchResultToUser(result)
                                                const isExpanded = expandedCardId === result.id
                                                const canAdd = result.friendshipStatus === 'none' || result.friendshipStatus === 'inactive'

                                                return (
                                                    <UserCard
                                                        key={result.id}
                                                        user={user}
                                                        isExpanded={isExpanded}
                                                        onExpandChange={canAdd ? (userId, expanded) => {
                                                            setExpandedCardId(expanded ? userId : null)
                                                        } : undefined}
                                                        actionButtons={
                                                            canAdd && isExpanded ? (
                                                                <div className="friend-actions">
                                                                    <button
                                                                        className="button primary"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleSendRequest(result.id)
                                                                        }}
                                                                        disabled={isLoading}
                                                                    >
                                                                        {isLoading ? 'Envoi...' : result.friendshipStatus === 'inactive' ? 'Renouer' : 'Ajouter'}
                                                                    </button>
                                                                </div>
                                                            ) : !canAdd ? (
                                                                <div className="friend-actions" style={{ justifyContent: 'center', padding: 'var(--sm)' }}>
                                                                    <span className={`status-badge ${getStatusClass(result.friendshipStatus)}`}>
                                                                        {getStatusText(result.friendshipStatus)}
                                                                    </span>
                                                                </div>
                                                            ) : undefined
                                                        }
                                                    />
                                                )
                                            })}
                                        </div>
                                    </div>
                                </>
                            ) : searchQuery.length >= 3 && searchResults.length === 0 ? (
                                <div className="empty-state">
                                    {allSearchResults.length > 0 ? (
                                        <>
                                            <div className="empty-state-icon">👥</div>
                                            <div className="empty-state-text">Tous les utilisateurs trouvés ont déjà une relation active avec vous</div>
                                            <div className="empty-state-subtext">
                                                Ces utilisateurs sont déjà amis, ont une demande en attente, ou sont bloqués
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="empty-state-icon">🔍</div>
                                            <div className="empty-state-text">Aucun utilisateur trouvé</div>
                                            <div className="empty-state-subtext">
                                                Vérifiez l'orthographe ou essayez un autre nom ou email
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-state-icon">✉️</div>
                                    <div className="empty-state-text">Saisissez au moins 3 caractères pour afficher les suggestions</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
})

AddFriendModal.displayName = 'AddFriendModal'
export default AddFriendModal
