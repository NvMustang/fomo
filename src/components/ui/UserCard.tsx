import React, { useState, useEffect } from 'react'
import type { User } from '@/types/fomoTypes'

interface UserCardProps {
    user: User
    showEditButton?: boolean
    onEdit?: () => void
    className?: string
    actionButtons?: React.ReactNode
    onClick?: () => void
    isExpanded?: boolean // Contrôle externe de l'expansion
    onExpandChange?: (userId: string, isExpanded: boolean) => void // Callback pour notifier le parent
}

/**
 * UserCard - Composant pour afficher les informations d'un utilisateur
 * Similaire à EventCard mais adapté pour les profils utilisateurs
 */
export const UserCard: React.FC<UserCardProps> = React.memo(({
    user,
    showEditButton = false,
    onEdit,
    className = '',
    actionButtons,
    onClick,
    isExpanded: isExpandedProp,
    onExpandChange
}: UserCardProps) => {
    // État interne pour l'expansion (uncontrolled)
    const [isExpandedInternal, setIsExpandedInternal] = useState(false)

    // Utiliser le prop isExpanded si fourni (controlled), sinon utiliser l'état interne
    const isExpanded = isExpandedProp !== undefined ? isExpandedProp : isExpandedInternal

    // Synchroniser l'état interne si le prop change
    useEffect(() => {
        if (isExpandedProp !== undefined) {
            setIsExpandedInternal(isExpandedProp)
        }
    }, [isExpandedProp])

    // Handler pour gérer le clic sur la carte
    const handleCardClick = () => {
        if (onExpandChange) {
            // Si onExpandChange est fourni, le parent contrôle l'état
            onExpandChange(user.id, !isExpanded)
        } else {
            // Sinon, gérer l'état en interne
            const newExpanded = !isExpandedInternal
            setIsExpandedInternal(newExpanded)
        }

        // Appeler onClick si fourni (pour compatibilité)
        if (onClick) {
            onClick()
        }
    }

    // Déterminer si on doit afficher les actionButtons
    const shouldShowActionButtons = actionButtons && isExpanded

    return (
        <div
            className={`event-card user-card ${user.isPublicProfile ? 'user-card-public' : 'user-card-private'} ${isExpanded ? 'card-pending' : ''} ${className}`.trim()}
            onClick={handleCardClick}
            style={(onExpandChange || onClick) ? { cursor: 'pointer' } : undefined}
        >
            {/* Zone fixe 1 - Header avec nom, infos et bouton expand */}
            <div className="user-card-header">
                {/* Infos utilisateur */}
                <div className="user-card-info">
                    {/* Header avec nom et badge Public/Privé */}
                    <div className="user-card-title-row">
                        <h3 className="event-card-title user-card-title">{user.name}</h3>
                        {/* Badge Public/Privé en haut à droite */}
                        <span className={`user-card-badge ${user.isPublicProfile ? 'user-card-badge-public' : 'user-card-badge-private'}`}>
                            {user.isPublicProfile ? (
                                <>
                                    <img
                                        src="/globe-icon.svg"
                                        alt="Public"
                                        className="user-card-badge-icon"
                                    />
                                    Public
                                </>
                            ) : (
                                <>
                                    <img
                                        src="/lock-icon.svg"
                                        alt="Privé"
                                        className="user-card-badge-icon"
                                    />
                                    Privé
                                </>
                            )}
                        </span>
                    </div>

                    {/* Meta infos */}
                    <div className="event-card-meta user-card-meta">
                        <div className="meta-row">📍 {user.city || 'Ville non spécifiée'}</div>
                        {user.email && (
                            <div className="meta-row">✉️ {user.email}</div>
                        )}
                    </div>

                    {/* Badge Ambassadeur */}
                    {user.isAmbassador && (
                        <div className="user-card-ambassador-wrapper">
                            <span className="user-card-ambassador-badge">
                                ⭐ Ambassadeur
                            </span>
                        </div>
                    )}


                </div>
            </div>

            {/* Zone fixe 4 - Bouton d'édition (si activé) */}
            {showEditButton && onEdit && (
                <div className="user-card-edit-wrapper">
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            onEdit()
                        }}
                        className="user-card-edit-button"
                    >
                        Modifier le profil
                    </button>
                </div>
            )}

            {/* Zone fixe 5 - Boutons d'action personnalisés (affichés uniquement si expanded) */}
            {shouldShowActionButtons && (
                <div className="user-card-actions-wrapper">
                    {actionButtons}
                </div>
            )}
        </div>
    )
})

UserCard.displayName = 'UserCard'

export default UserCard


