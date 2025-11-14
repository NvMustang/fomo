/**
 * FOMO MVP - ToggleLabelsWithExpendableList
 * 
 * Composant réutilisable pour afficher des listes groupées avec label visible et zone expandable
 * Utilisé dans Profile (friends par statut) et ShareContent (guests par réponse)
 */

import React from 'react'

interface ToggleLabelsWithExpendableListProps {
    /**
     * Label du groupe (toujours visible)
     */
    label: string
    /**
     * Nombre d'éléments (affiché dans le badge)
     */
    count: number
    /**
     * État expanded/collapsed
     */
    isExpanded: boolean
    /**
     * Fonction pour toggle l'état expanded
     */
    onToggle: () => void
    /**
     * Contenu à afficher dans la zone expandable
     */
    children: React.ReactNode
    /**
     * Classe CSS additionnelle pour le container
     */
    className?: string
    /**
     * Marge bottom (par défaut var(--md))
     */
    marginBottom?: string
    /**
     * Si true, la section est toujours visible (pas de toggle)
     */
    alwaysVisible?: boolean
}

export const ToggleLabelsWithExpendableList: React.FC<ToggleLabelsWithExpendableListProps> = ({
    label,
    count,
    isExpanded,
    onToggle,
    children,
    className = '',
    marginBottom = 'var(--md)',
    alwaysVisible = false
}) => {
    return (
        <div className={`friends-subsection ${className}`} style={{ marginBottom }}>
            {/* Header avec label toujours visible - entièrement cliquable */}
            {!alwaysVisible ? (
                <button
                    onClick={onToggle}
                    aria-expanded={isExpanded}
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--sm)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        width: '100%',
                        textAlign: 'left'
                    }}
                >
                    <h4 className="friends-subsection-title" style={{ margin: 0 }}>
                        {label}
                        <span className="friends-count-badge">{count}</span>
                    </h4>
                    <span style={{ padding: 'var(--xs)' }}>{isExpanded ? '▼' : '▶'}</span>
                </button>
            ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sm)' }}>
                    <h4 className="friends-subsection-title">
                        {label}
                        <span className="friends-count-badge">{count}</span>
                    </h4>
                </div>
            )}

            {/* Zone expandable avec bordure top */}
            {(alwaysVisible || isExpanded) && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 'var(--sm)' }}>
                    {children}
                </div>
            )}
        </div>
    )
}

ToggleLabelsWithExpendableList.displayName = 'ToggleLabelsWithExpendableList'

