/**
 * Visitor Data Context - Contexte minimal pour le mode visitor
 * 
 * Charge uniquement l'événement visitor et gère ses réponses
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useRef } from 'react'
import { useFomoData } from '@/utils/dataManager'
import type { Event, UserResponse } from '@/types/fomoTypes'
import type { FomoDataContextType } from './UserDataContext'
import { addEventResponseShared } from '@/utils/eventResponseUtils'

// ===== TYPES =====

/**
 * Type pour le contexte Visitor : propriétés minimales requises + optionnelles pour compatibilité
 * Visitor n'a besoin que de certaines fonctionnalités, les autres sont optionnelles
 */
export type VisitorDataContextType =
    // Propriétés requises (que Visitor implémente)
    Pick<FomoDataContextType,
        'events' | 'responses' |
        'addEventResponse' | 'invalidateCache' |
        'isLoading' | 'hasError' | 'dataReady'
    > &
    // Propriétés optionnelles (stubs pour compatibilité avec useFomoDataContext)
    Partial<Pick<FomoDataContextType,
        'users' | 'userRelations' | 'usersError' | 'eventsError' | 'responsesError' | 'relationsError' |
        'refreshEvents' | 'refreshUsers' | 'refreshResponses' | 'refreshUserRelations' | 'refreshAll' |
        'createEvent' | 'updateEvent' | 'sendFriendshipRequest' | 'addFriendshipAction' |
        'searchUsers' | 'getTags' | 'checkUserByEmail' | 'saveUserToBackend' |
        'getUserEvents' | 'searchAddresses'
    >>

export const VisitorDataContext = createContext<VisitorDataContextType | undefined>(undefined)

// ===== PROVIDER =====

interface VisitorDataProviderProps {
    children: ReactNode
    visitorEvent: Event | null
}

export const VisitorDataProvider: React.FC<VisitorDataProviderProps> = ({ children, visitorEvent }) => {
    const fomoData = useFomoData()

    // États des données
    const [events] = useState<Event[]>(visitorEvent ? [visitorEvent] : [])
    const [responses, setResponses] = useState<UserResponse[]>([])

    // Visitor user ID et infos (généré une seule fois)
    const visitorUserIdRef = useRef<string | null>(null)
    const visitorNameRef = useRef<string | null>(null)
    const visitorEmailRef = useRef<string | undefined>(undefined)

    // Initialiser visitorUserId depuis sessionStorage ou le créer
    React.useEffect(() => {
        if (!visitorUserIdRef.current) {
            // Vérifier si on a déjà un visitorUserId en session
            try {
                const savedUserId = sessionStorage.getItem('fomo-visit-user-id')
                if (savedUserId) {
                    visitorUserIdRef.current = savedUserId
                    visitorNameRef.current = sessionStorage.getItem('fomo-visit-name')
                    visitorEmailRef.current = sessionStorage.getItem('fomo-visit-email') || undefined
                } else {
                    // Créer un nouveau visitorUserId
                    visitorUserIdRef.current = `visit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
                    sessionStorage.setItem('fomo-visit-user-id', visitorUserIdRef.current)
                }
            } catch {
                // Si sessionStorage indisponible, créer quand même un ID
                visitorUserIdRef.current = `visit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
            }
        }
    }, [])

    const addEventResponse = useCallback((
        eventId: string,
        response: 'going' | 'interested' | 'not_interested' | 'cleared' | 'seen' | 'invited' | null,
        options?: {
            targetUserId?: string
            invitedByUserId?: string
        }
    ) => {
        // Mettre à jour les refs depuis sessionStorage au cas où elles auraient changé
        try {
            const savedUserId = sessionStorage.getItem('fomo-visit-user-id')
            const savedName = sessionStorage.getItem('fomo-visit-name')
            const savedEmail = sessionStorage.getItem('fomo-visit-email')

            if (savedUserId) {
                visitorUserIdRef.current = savedUserId
                visitorNameRef.current = savedName
                visitorEmailRef.current = savedEmail || undefined
            }
        } catch {
            // Ignore si sessionStorage indisponible
        }

        if (!visitorUserIdRef.current) {
            console.warn('⚠️ [VisitorDataContext] Visitor user ID not set')
            return
        }
        if (!visitorEvent) return

        console.log('🔄 [VisitorDataContext] addEventResponse called:', eventId, response, 'visitorUserId:', visitorUserIdRef.current)

        // Si le visitor n'a pas encore de nom, on ne peut pas continuer
        // (ce cas devrait être géré par EventCard qui ouvre le modal)
        if (!visitorNameRef.current) {
            console.warn('⚠️ [VisitorDataContext] Visitor name not set, cannot add response')
            return
        }

        // 1. Créer le user visitor dans Users si pas déjà fait (de manière asynchrone en arrière-plan)
        const createUserIfNeeded = async () => {
            if (!sessionStorage.getItem(`fomo-visit-user-created-${visitorUserIdRef.current}`)) {
                try {
                    const userData = {
                        id: visitorUserIdRef.current,
                        name: visitorNameRef.current,
                        email: visitorEmailRef.current || '',
                        city: '',
                        friendsCount: 0,
                        showAttendanceToFriends: false,
                        privacy: { showAttendanceToFriends: false },
                        isPublicProfile: false,
                        isActive: true,
                        isAmbassador: false,
                        allowRequests: false,
                        createdAt: new Date().toISOString()
                    }

                    // Utiliser l'API directement pour créer le user
                    const explicit = import.meta.env.VITE_API_URL?.trim()
                    const apiUrl = explicit || (import.meta.env.PROD ? '/api' : `http://${window.location.hostname}:${import.meta.env.VITE_API_PORT || '3001'}/api`)
                    await fetch(`${apiUrl}/users`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(userData)
                    })

                    sessionStorage.setItem(`fomo-visit-user-created-${visitorUserIdRef.current}`, 'true')
                } catch (error) {
                    console.error('Erreur lors de la création du user visitor:', error)
                    // Continue quand même, le backend pourra créer le user si nécessaire
                }
            }
        }

        // Lancer la création du user en arrière-plan (non bloquant)
        createUserIfNeeded()

        // 2. Utiliser la fonction partagée (optimiste + batch) - exactement comme UserDataContext
        addEventResponseShared({
            userId: visitorUserIdRef.current,
            eventId,
            response,
            invitedByUserId: options?.invitedByUserId,
            setResponses,
            fomoData,
            contextName: 'VisitorDataContext'
        })
    }, [visitorEvent, fomoData])

    // Stubs pour fonctions non disponibles en mode visitor (optionnelles)
    const notAvailableStub = async () => {
        throw new Error('Cette fonctionnalité n\'est pas disponible en mode visiteur')
    }



    const value = useMemo((): VisitorDataContextType => ({
        // Données (requises)
        events,
        responses,

        // Actions (requises)
        addEventResponse,
        invalidateCache: fomoData.invalidateCache,

        // États globaux (requis - valeurs constantes pour Visitor)
        isLoading: false,
        hasError: false,
        dataReady: !!visitorEvent,

        // Propriétés optionnelles (stubs)
        users: [],
        userRelations: [],
        usersError: null,
        eventsError: null,
        responsesError: null,
        relationsError: null,

        // Actions optionnelles (stubs)
        refreshEvents: notAvailableStub,
        refreshUsers: notAvailableStub,
        refreshResponses: notAvailableStub,
        refreshUserRelations: notAvailableStub,
        refreshAll: notAvailableStub,
        createEvent: notAvailableStub,
        updateEvent: notAvailableStub,
        sendFriendshipRequest: notAvailableStub,
        addFriendshipAction: notAvailableStub,
        searchUsers: notAvailableStub,
        getTags: notAvailableStub,
        checkUserByEmail: notAvailableStub,
        saveUserToBackend: notAvailableStub,
        getUserEvents: notAvailableStub,
        searchAddresses: notAvailableStub,
    }), [
        events,
        responses,
        visitorEvent,
        addEventResponse,
        fomoData.invalidateCache
    ])

    return (
        <VisitorDataContext.Provider value={value}>
            {children}
        </VisitorDataContext.Provider>
    )
}

// ===== HOOK =====

export const useVisitorDataContext = (): VisitorDataContextType => {
    const context = useContext(VisitorDataContext)
    if (context === undefined) {
        throw new Error('useVisitorDataContext must be used within a VisitorDataProvider')
    }
    return context
}

export default VisitorDataContext

