/**
 * Hook pour gérer l'état des modals
 * 
 * Centralise la gestion de l'ouverture/fermeture des modals
 * Gère plusieurs modals de manière générique
 */

import { useState, useCallback, useMemo } from 'react'

type ModalID = 'createEvent' | 'addFriend' | 'editEvent' | 'beta' | string

interface ModalState {
    [key: string]: boolean
}

/**
 * Hook pour gérer les modals
 * 
 * @param initialModals - Modals initiaux à gérer (optionnel)
 */
export function useModalManager(initialModals?: ModalID[]) {
    // État pour tous les modals
    const [modals, setModals] = useState<ModalState>(() => {
        const initial: ModalState = {}
        if (initialModals) {
            initialModals.forEach(id => {
                initial[id] = false
            })
        }
        // Toujours initialiser createEvent (pour compatibilité)
        if (!initial.createEvent) {
            initial.createEvent = false
        }
        return initial
    })

    // Ouvrir un modal
    const openModal = useCallback((modalID: ModalID) => {
        setModals(prev => ({ ...prev, [modalID]: true }))
    }, [])

    // Fermer un modal
    const closeModal = useCallback((modalID: ModalID) => {
        setModals(prev => ({ ...prev, [modalID]: false }))
    }, [])

    // Toggle un modal
    const toggleModal = useCallback((modalID: ModalID) => {
        setModals(prev => ({ ...prev, [modalID]: !prev[modalID] }))
    }, [])

    // Vérifier si un modal est ouvert
    const isModalOpen = useCallback((modalID: ModalID): boolean => {
        return modals[modalID] === true
    }, [modals])

    // Helpers spécifiques pour createEvent (pour compatibilité)
    const isCreateEventModalOpen = useMemo(() => modals.createEvent === true, [modals.createEvent])
    const openCreateEventModal = useCallback(() => openModal('createEvent'), [openModal])
    const closeCreateEventModal = useCallback(() => closeModal('createEvent'), [closeModal])
    const toggleCreateEventModal = useCallback(() => toggleModal('createEvent'), [toggleModal])

    return {
        // API générique
        openModal,
        closeModal,
        toggleModal,
        isModalOpen,
        // API spécifique createEvent (pour compatibilité)
        isCreateEventModalOpen,
        openCreateEventModal,
        closeCreateEventModal,
        toggleCreateEventModal
    }
}

