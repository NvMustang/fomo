import React, { useState, useCallback, useEffect } from 'react'
import { useDataContext } from '@/contexts/DataContext'
import { UserCard } from '@/components'
import { useToast, useModalScrollHint } from '@/hooks'
import { useFomoData } from '@/utils/dataManager'
import type { User, Friend } from '@/types/fomoTypes'

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
    allowRequests: true,
    isVisitor: false, // Les résultats de recherche sont des users authentifiés
    isNewVisitor: false
})

export const AddFriendModal: React.FC<AddFriendModalProps> = React.memo(({
    isOpen,
    onClose,
    currentUserId: _currentUserId,
    onFriendAdded
}) => {
    const { refreshRelations } = useDataContext()
    const fomoData = useFomoData()
    const { showToast } = useToast()
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<SearchResult[]>([])
    const [allSearchResults, setAllSearchResults] = useState<SearchResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
    // Stocker les demandes en attente (Set pour éviter les doublons)
    const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set())

    // Suggestions d'amis
    const [suggestions, setSuggestions] = useState<Array<Friend & { _suggestionScore?: number; _commonEvents?: number; _mutualFriends?: number; friendshipStatus?: string }>>([])
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)

    // Animation de scroll à l'ouverture du modal
    const modalContentRef = useModalScrollHint(isOpen)

    // Charger les suggestions à l'ouverture du modal
    useEffect(() => {
        if (!isOpen || !_currentUserId) return

        setIsLoadingSuggestions(true)
        fomoData.getFriendSuggestions(_currentUserId)
            .then(result => {
                // Limiter à 5 suggestions pour l'affichage
                setSuggestions(result.suggestions.slice(0, 5))
            })
            .catch(error => {
                console.error('Erreur lors du chargement des suggestions:', error)
                showToast({
                    title: 'Erreur',
                    message: 'Impossible de charger les suggestions d\'amis',
                    type: 'error',
                    position: 'top',
                    duration: 2000
                })
            })
            .finally(() => {
                setIsLoadingSuggestions(false)
            })
    }, [isOpen, _currentUserId, fomoData, showToast])

    // Recherche hybride : d'abord dans les suggestions, puis dans la DB
    useEffect(() => {
        if (!searchQuery.trim() || searchQuery.length < 3) {
            setSearchResults([])
            setAllSearchResults([])
            setIsSearching(false)
            return
        }

        setIsSearching(true)

        // 1. Chercher d'abord dans les suggestions
        const queryLower = searchQuery.toLowerCase().trim()
        const suggestionsMatches = suggestions.filter(suggestion => {
            const nameMatch = suggestion.name?.toLowerCase().includes(queryLower)
            const emailMatch = suggestion.email?.toLowerCase().includes(queryLower)
            return nameMatch || emailMatch
        })

        if (suggestionsMatches.length > 0) {
            // Convertir les suggestions en SearchResult
            const results: SearchResult[] = suggestionsMatches.map(s => ({
                id: s.id,
                name: s.name,
                email: s.email,
                city: s.city,
                isPublicProfile: s.isPublicProfile,
                isAmbassador: s.isAmbassador,
                friendshipStatus: 'none' // Les suggestions sont toujours ajoutables
            }))
            setAllSearchResults(results)
            setSearchResults(results)
            setIsSearching(false)
            return
        }

        // 2. Si pas de résultat dans les suggestions, chercher dans la DB
        const timeout = setTimeout(async () => {
            try {
                const results = await fomoData.searchUsers(searchQuery, _currentUserId)
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
    }, [searchQuery, fomoData, _currentUserId, showToast, suggestions])

    const handleSendRequest = useCallback((targetUserId: string) => {
        // Ajouter à la liste des demandes en attente
        setPendingRequests(prev => new Set(prev).add(targetUserId))

        // Mettre à jour le statut local immédiatement (optimiste)
        setSearchResults(prev =>
            prev.map(user =>
                user.id === targetUserId
                    ? { ...user, friendshipStatus: 'pending' }
                    : user
            )
        )

        // Réduire la carte après l'ajout
        setExpandedCardId(null)
    }, [])

    const resetState = useCallback(() => {
        setSearchQuery('')
        setSearchResults([])
        setAllSearchResults([])
        setExpandedCardId(null)
        setPendingRequests(new Set())
        // Ne pas réinitialiser les suggestions (elles restent chargées)
    }, [])

    const handleSubmit = useCallback(async () => {
        if (pendingRequests.size === 0) return

        try {
            // Ajouter toutes les demandes au batch
            pendingRequests.forEach(toUserId => {
                fomoData.addFriendshipRequest(_currentUserId, toUserId)
            })

            // Envoyer le batch immédiatement
            await fomoData.savePendingActions()

            // Recharger les relations
            await refreshRelations()

            // Afficher le toast avec le nombre de demandes
            const count = pendingRequests.size
            showToast({
                title: 'Demandes envoyées',
                message: `${count} demande${count > 1 ? 's' : ''} d'amitié envoyée${count > 1 ? 's' : ''}`,
                type: 'success',
                position: 'top',
                duration: 3000
            })

            onFriendAdded?.()

            // Réinitialiser l'état et fermer
            resetState()
            onClose()
        } catch (error) {
            console.error('Erreur lors de l\'envoi des demandes d\'amitié:', error)
            showToast({
                title: 'Erreur',
                message: 'Impossible d\'envoyer les demandes d\'amitié',
                type: 'error',
                position: 'top',
                duration: 3000
            })
        }
    }, [pendingRequests, fomoData, _currentUserId, refreshRelations, showToast, onFriendAdded, onClose, resetState])

    const handleCancel = useCallback(() => {
        // Réinitialiser l'état et fermer sans envoyer
        resetState()
        onClose()
    }, [resetState, onClose])

    const handleClose = useCallback(() => {
        // Un clic en dehors du modal = annuler
        handleCancel()
    }, [handleCancel])

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

    const pendingCount = pendingRequests.size

    return (
        <div className="modal_overlay" onClick={handleClose}>
            <div className="modal_container">
                <div className="modal" onClick={(e) => e.stopPropagation()}>


                    <div
                        ref={modalContentRef}
                        className="modal-content modal-form"
                        style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
                    >
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
                            {isLoadingSuggestions ? (
                                <div className="empty-state">
                                    <div className="empty-state-icon">💡</div>
                                    <div className="empty-state-text">Création des suggestions d'amis...</div>
                                </div>
                            ) : isSearching ? (
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
                                                                    >
                                                                        {result.friendshipStatus === 'inactive' ? 'Renouer' : 'Ajouter'}
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
                            ) : searchQuery.length === 0 && suggestions.length > 0 ? (
                                <>
                                    <h4 className="form-label">
                                        Suggestions ({suggestions.length})
                                    </h4>
                                    <div className="search-results-scrollable">
                                        <div style={{
                                            display: 'grid',
                                            gap: 'var(--md)',
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'
                                        }}>
                                            {suggestions.map((suggestion) => {
                                                const user: User = {
                                                    id: suggestion.id,
                                                    name: suggestion.name,
                                                    email: suggestion.email,
                                                    city: suggestion.city,
                                                    friendsCount: suggestion.friendsCount,
                                                    showAttendanceToFriends: suggestion.showAttendanceToFriends,
                                                    isPublicProfile: suggestion.isPublicProfile,
                                                    isAmbassador: suggestion.isAmbassador,
                                                    allowRequests: suggestion.allowRequests,
                                                    isVisitor: false,
                                                    isNewVisitor: false
                                                }
                                                const isExpanded = expandedCardId === suggestion.id

                                                return (
                                                    <UserCard
                                                        key={suggestion.id}
                                                        user={user}
                                                        isExpanded={isExpanded}
                                                        onExpandChange={(userId, expanded) => {
                                                            setExpandedCardId(expanded ? userId : null)
                                                        }}
                                                        actionButtons={
                                                            isExpanded ? (
                                                                <div className="friend-actions">
                                                                    <button
                                                                        className="button primary"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation()
                                                                            handleSendRequest(suggestion.id)
                                                                        }}
                                                                    >
                                                                        Ajouter
                                                                    </button>
                                                                </div>
                                                            ) : undefined
                                                        }
                                                    />
                                                )
                                            })}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-state-icon">✉️</div>
                                    <div className="empty-state-text">Saisissez au moins 3 caractères pour rechercher, ou consultez les suggestions ci-dessus</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer avec boutons */}
                    <div className="modal-footer">
                        <div style={{
                            display: 'flex',
                            gap: 'var(--sm)',
                            justifyContent: 'flex-end'
                        }}>
                            <button
                                className="button secondary"
                                onClick={handleCancel}
                                type="button"
                            >
                                Annuler
                            </button>
                            <button
                                className="button primary"
                                onClick={handleSubmit}
                                disabled={pendingCount === 0}
                                type="button"
                            >
                                Ajouter {pendingCount > 0 ? `${pendingCount}` : ''} amitié{pendingCount > 1 ? 's' : ''}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
})

AddFriendModal.displayName = 'AddFriendModal'
export default AddFriendModal
