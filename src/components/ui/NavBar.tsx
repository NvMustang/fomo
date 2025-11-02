import React from 'react'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { MapIcon, ListIcon, ChatIcon, ProfileIcon, PlusIcon } from './NavIcons'

interface NavBarProps {
    onCreateEventClick?: () => void
    onNavClick?: (path: string) => void
    currentPage?: string
    isCreateEventOpen?: boolean
}

interface NavItem {
    path: string
    icon: React.ComponentType<{ className?: string; size?: number }>
    label: string
}

export const NavBar: React.FC<NavBarProps> = React.memo(({ onCreateEventClick, onNavClick, currentPage = 'map', isCreateEventOpen = false }) => {
    const { isPublicMode } = usePrivacy()


    const navItems: NavItem[] = [
        { path: 'map', icon: MapIcon, label: 'Discover' },
        { path: 'list', icon: ListIcon, label: 'Calendar' },
        { path: 'chat', icon: ChatIcon, label: 'Chat' },
        { path: 'profil', icon: ProfileIcon, label: 'Profile' },
    ]

    return (
        <div className="navbar-container">
            <button
                className={`nav-create-floating circular-button circular-button ${isCreateEventOpen ? 'rotated' : ''}`}
                aria-label={isCreateEventOpen ? "Fermer la création d'événement" : "Créer un événement"}
                onClick={onCreateEventClick}
                tabIndex={0}
            >
                <PlusIcon className="nav-plus-icon" size={24} />
            </button>
            <nav className="navigation" role="navigation" aria-label="Navigation principale">
                {navItems.map((item) => {
                    const isActive = currentPage === item.path
                    return (
                        <button
                            key={item.path}
                            className={`nav-item${isActive ? ' active' : ''} ${isPublicMode ? 'public' : 'private'}`}
                            aria-label={`Aller à ${item.label}`}
                            tabIndex={0}
                            onClick={() => onNavClick?.(item.path)}
                        >
                            <div className="nav-icon">
                                <item.icon className="nav-svg-icon" size={22} />
                            </div>
                            <span className="nav-label">{item.label}</span>
                        </button>
                    )
                })}
            </nav>
        </div>
    )
})

NavBar.displayName = 'NavBar'

export default NavBar


