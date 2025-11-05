/**
 * Visitor Data Context - Contexte minimal pour le mode visitor
 * 
 * Charge uniquement l'événement visitor et gère ses réponses
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useRef } from 'react'
import { useFomoData } from '@/utils/dataManager'
import type { Event, UserResponse, UserResponseValue } from '@/types/fomoTypes'
import type { FomoDataContextType } from './UserDataContext'
import { addEventResponseShared, getLatestResponse, getCurrentResponse as getCurrentResponseShared, getLatestResponsesByEvent as getLatestResponsesByEventShared, getLatestResponsesByUser as getLatestResponsesByUserShared } from '@/utils/eventResponseUtils'
import { useAuth } from './AuthContext'

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
        'isLoading' | 'hasError' | 'dataReady' |
        'getLatestResponse' | 'getCurrentResponse' | 'getLatestResponsesByEvent' | 'getLatestResponsesByUser'
    > &
    // Propriétés optionnelles (stubs pour compatibilité avec useFomoDataContext)
    Partial<Pick<FomoDataContextType,
        'users' | 'userRelations' | 'usersError' | 'eventsError' | 'responsesError' | 'relationsError' |
        'refreshEvents' | 'refreshUsers' | 'refreshResponses' | 'refreshUserRelations' | 'refreshAll' |
        'createEvent' | 'updateEvent' | 'sendFriendshipRequest' | 'addFriendshipAction' |
        'searchUsers' | 'getTags' | 'checkUserByEmail' | 'matchByEmail' | 'saveUserToBackend' |
        'getUserEvents' | 'searchAddresses'
    >> &
    // Propriétés spécifiques au visitor (exposées pour accès unifié)
    {
        currentUserId: string | null
        currentUserName: string | null
    }

export const VisitorDataContext = createContext<VisitorDataContextType | undefined>(undefined)

// ===== PROVIDER =====

interface VisitorDataProviderProps {
    children: ReactNode
    visitorEvent: Event | null
}

export const VisitorDataProvider: React.FC<VisitorDataProviderProps> = ({ children, visitorEvent }) => {
    const fomoData = useFomoData()
    const { login: authLogin } = useAuth()

    // États des données
    const [events] = useState<Event[]>(visitorEvent ? [visitorEvent] : [])
    const [responses, setResponses] = useState<UserResponse[]>([])

    // Visitor user ID et infos (généré une seule fois)
    // Exposés dans l'état pour accès depuis le contexte
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [currentUserName, setCurrentUserName] = useState<string | null>(null)
    const visitorUserIdRef = useRef<string | null>(null)
    const visitorNameRef = useRef<string | null>(null)
    const visitorEmailRef = useRef<string | undefined>(undefined)
    const visitorCreatePromiseRef = useRef<Promise<void> | null>(null)

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
                    // Exposer dans l'état
                    setCurrentUserId(savedUserId)
                    setCurrentUserName(visitorNameRef.current)
                } else {
                    // Créer un nouveau user ID (avec préfixe user- même pour les visiteurs)
                    visitorUserIdRef.current = `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
                    sessionStorage.setItem('fomo-visit-user-id', visitorUserIdRef.current)
                    // Exposer dans l'état
                    setCurrentUserId(visitorUserIdRef.current)
                }
            } catch {
                // Si sessionStorage indisponible, créer quand même un ID
                visitorUserIdRef.current = `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
                setCurrentUserId(visitorUserIdRef.current)
            }
        }
    }, [])

    // Synchroniser les changements de nom depuis sessionStorage
    React.useEffect(() => {
        const syncVisitorInfo = () => {
            try {
                const savedName = sessionStorage.getItem('fomo-visit-name')
                if (savedName && savedName !== currentUserName) {
                    visitorNameRef.current = savedName
                    setCurrentUserName(savedName)
                }
            } catch {
                // Ignorer si sessionStorage indisponible
            }
        }
        // Vérifier périodiquement (toutes les secondes) pour capturer les changements
        const interval = setInterval(syncVisitorInfo, 1000)
        return () => clearInterval(interval)
    }, [currentUserName])

    const addEventResponse = useCallback((
        eventId: string,
        response: 'going' | 'participe' | 'interested' | 'maybe' | 'not_interested' | 'not_there' | 'cleared' | 'seen' | 'invited' | null,
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
                // Exposer dans l'état
                setCurrentUserId(savedUserId)
                setCurrentUserName(savedName)
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

        // 1. Créer le user visitor dans Users si nécessaire (une seule fois, même si addEventResponse appelé plusieurs fois)
        if (!visitorCreatePromiseRef.current && visitorEmailRef.current) {
            visitorCreatePromiseRef.current = (async () => {
                try {
                    // Vérifier si un utilisateur existe déjà avec cet email
                    const matchedId = await fomoData.matchByEmail(visitorEmailRef.current!)

                    if (matchedId) {
                        // User existant trouvé (peut être un visiteur ou un user authentifié)
                        console.log(`✅ [VisitorDataContext] User existant trouvé: ${matchedId}`)
                        if (visitorEmailRef.current) {
                            const user = await fomoData.checkUserByEmail(visitorEmailRef.current)
                            if (user) {
                                // Si isVisitor est false, c'est un user authentifié -> connexion automatique
                                if (!user.isVisitor) {
                                    console.log(`✅ [VisitorDataContext] User authentifié trouvé, connexion automatique...`)
                                    await authLogin(user.name, user.city, user.email, user)
                                } else {
                                    // C'est un visiteur existant -> réutiliser cet ID
                                    console.log(`✅ [VisitorDataContext] Visiteur existant trouvé, réutilisation...`)
                                    visitorUserIdRef.current = matchedId
                                    sessionStorage.setItem('fomo-visit-user-id', matchedId)
                                }
                            }
                        }
                        return
                    }

                    // Aucun utilisateur trouvé -> créer nouveau visitor (avec isVisitor: true)
                    console.log(`📝 [VisitorDataContext] Création nouveau visitor: ${visitorUserIdRef.current}`)
                    const userData = {
                        id: visitorUserIdRef.current,
                        name: visitorNameRef.current,
                        email: visitorEmailRef.current,
                        city: '',
                        friendsCount: 0,
                        showAttendanceToFriends: false,
                        privacy: { showAttendanceToFriends: false },
                        isPublicProfile: false,
                        isActive: true,
                        isAmbassador: false,
                        allowRequests: false,
                        isVisitor: true, // Marquer comme visiteur
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
                } catch (error) {
                    console.error('Erreur lors de la création du user visitor:', error)
                }
            })()
        }

        // Lancer la création en arrière-plan (non bloquant, mais une seule fois grâce à visitorCreatePromiseRef)
        visitorCreatePromiseRef.current?.catch(() => { })

        // 2. Utiliser la fonction partagée (optimiste + batch) - exactement comme UserDataContext
        addEventResponseShared({
            userId: visitorUserIdRef.current,
            eventId,
            finalResponse: response,
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

    // Helpers pour réponses (partagés avec UserDataContext)
    const getLatestResponseHelper = useCallback((userId: string, eventId: string): UserResponse | null => {
        return getLatestResponse(responses, userId, eventId)
    }, [responses])

    const getCurrentResponseHelper = useCallback((userId: string, eventId: string): UserResponseValue => {
        return getCurrentResponseShared(responses, userId, eventId)
    }, [responses])

    const getLatestResponsesByEventHelper = useCallback((userId: string): Map<string, UserResponse> => {
        return getLatestResponsesByEventShared(responses, userId)
    }, [responses])

    const getLatestResponsesByUserHelper = useCallback((eventId: string): Map<string, UserResponse> => {
        return getLatestResponsesByUserShared(responses, eventId)
    }, [responses])

    const value = useMemo((): VisitorDataContextType => ({
        // Données (requises)
        events,
        responses,

        // Actions (requises)
        addEventResponse,
        invalidateCache: fomoData.invalidateCache,

        // Helpers pour réponses (requis - partagés avec UserDataContext)
        getLatestResponse: getLatestResponseHelper,
        getCurrentResponse: getCurrentResponseHelper,
        getLatestResponsesByEvent: getLatestResponsesByEventHelper,
        getLatestResponsesByUser: getLatestResponsesByUserHelper,

        // États globaux (requis - valeurs constantes pour Visitor)
        isLoading: false,
        hasError: false,
        dataReady: !!visitorEvent,

        // Propriétés spécifiques au visitor (exposées pour accès unifié)
        currentUserId,
        currentUserName,

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
        matchByEmail: (email: string) => fomoData.matchByEmail(email),
        saveUserToBackend: notAvailableStub,
        getUserEvents: notAvailableStub,
        searchAddresses: notAvailableStub,
    }), [
        events,
        responses,
        visitorEvent,
        addEventResponse,
        fomoData.invalidateCache,
        authLogin,
        getLatestResponseHelper,
        getCurrentResponseHelper,
        getLatestResponsesByEventHelper,
        getLatestResponsesByUserHelper,
        currentUserId,
        currentUserName
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

