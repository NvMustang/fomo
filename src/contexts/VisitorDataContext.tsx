/**
 * Visitor Data Context - Contexte minimal pour le mode visitor
 * 
 * Charge uniquement l'événement visitor et gère ses réponses
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode, useRef } from 'react'
import { useFomoData } from '@/utils/dataManager'
import type { Event, UserResponse, UserResponseValue } from '@/types/fomoTypes'
import type { FomoDataContextType } from './UserDataContext'
import { addEventResponseShared, getLatestResponse as getLatestResponseShared, getCurrentResponse as getCurrentResponseShared, getLatestResponsesByEvent as getLatestResponsesByEventShared, getLatestResponsesByUser as getLatestResponsesByUserShared } from '@/utils/eventResponseUtils'
import { useAuth } from './AuthContext'
import { getCity } from '@/utils/getSessionId'

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
                    // Créer un nouveau user ID (avec préfixe usr- même pour les visiteurs)
                    visitorUserIdRef.current = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
                    sessionStorage.setItem('fomo-visit-user-id', visitorUserIdRef.current)
                    // Exposer dans l'état
                    setCurrentUserId(visitorUserIdRef.current)
                }
            } catch {
                // Si sessionStorage indisponible, créer quand même un ID
                visitorUserIdRef.current = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
                setCurrentUserId(visitorUserIdRef.current)
            }
        }
    }, [])

    // Charger les réponses du visitor depuis le backend au démarrage
    React.useEffect(() => {
        const loadVisitorResponses = async () => {
            // Attendre que le visitorUserId soit défini
            if (!currentUserId || !visitorEvent) {
                return
            }

            try {
                // Charger toutes les réponses depuis le backend
                const allResponses = await fomoData.getResponses()
                
                // Filtrer pour ne garder que les réponses du visitor pour l'événement visitor
                const visitorResponses = allResponses.filter(
                    response => 
                        response.userId === currentUserId && 
                        response.eventId === visitorEvent.id
                )

                if (visitorResponses.length > 0) {
                    setResponses(visitorResponses)
                    console.log(`✅ [VisitorDataContext] ${visitorResponses.length} réponse(s) chargée(s) pour le visitor`)
                }
            } catch (error) {
                console.error('❌ [VisitorDataContext] Erreur lors du chargement des réponses visitor:', error)
            }
        }

        loadVisitorResponses()
    }, [currentUserId, visitorEvent, fomoData])

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
                setCurrentUserId(savedUserId)
                setCurrentUserName(savedName)
            }
        } catch {
            // Ignorer si sessionStorage indisponible
        }

        // Utiliser targetUserId si fourni, sinon visitorUserId
        const userId = options?.targetUserId || visitorUserIdRef.current
        if (!userId) {
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

                        if (matchedId.startsWith('usr-')) {
                            // User authentifié trouvé → connexion automatique SEULEMENT si ce n'est PAS un visitor
                            try {
                                const user = await fomoData.checkUserByEmail(visitorEmailRef.current!)
                                if (user) {
                                    // Ne JAMAIS connecter un visitor
                                    if (user.isVisitor === true) {
                                        console.warn('⚠️ [VisitorDataContext] Visitor détecté (isVisitor: true), refus de connexion automatique')
                                        // Réutiliser le visitor existant au lieu de se connecter
                                        visitorUserIdRef.current = matchedId
                                        setCurrentUserId(matchedId)
                                        try {
                                            sessionStorage.setItem('fomo-visit-user-id', matchedId)
                                        } catch { }
                                    } else {
                                        console.log(`✅ [VisitorDataContext] User authentifié trouvé, connexion automatique...`)
                                        await authLogin(user.name, user.city, user.email, user)
                                        console.log('✅ [VisitorDataContext] Connexion réussie')
                                    }
                                }
                            } catch (error) {
                                console.error('❌ [VisitorDataContext] Erreur lors de la connexion:', error)
                            }
                        } else {
                            // Visiteur existant trouvé → réutiliser
                            console.log(`✅ [VisitorDataContext] Visiteur existant trouvé, réutilisation...`)
                            visitorUserIdRef.current = matchedId
                            setCurrentUserId(matchedId)
                            try {
                                sessionStorage.setItem('fomo-visit-user-id', matchedId)
                            } catch { }
                        }
                    } else {
                    // Créer un nouveau visitor
                    console.log(`📝 [VisitorDataContext] Création nouveau visitor: ${visitorUserIdRef.current}`)
                    const city = getCity() || ''
                    await fomoData.saveUserToBackend({
                        id: visitorUserIdRef.current!,
                        name: visitorNameRef.current!,
                        email: visitorEmailRef.current!,
                        city: city,
                        friendsCount: 0,
                        showAttendanceToFriends: false,
                        isVisitor: true,
                        isPublicProfile: false,
                        isAmbassador: false,
                        allowRequests: false
                    })
                    }
                } catch (error) {
                    console.error('❌ [VisitorDataContext] Erreur lors de la création du visitor:', error)
                } finally {
                    visitorCreatePromiseRef.current = null
                }
            })()

            // Ne pas attendre la création, continuer avec l'ajout de la réponse
        }

        // 2. Ajouter la réponse (optimiste + batch)
        addEventResponseShared({
            userId,
            eventId,
            finalResponse: response,
            invitedByUserId: options?.invitedByUserId,
            setResponses,
            fomoData,
            contextName: 'VisitorDataContext'
        })
    }, [visitorEvent, fomoData, authLogin])

    // Helpers pour réponses (utiliser les fonctions partagées)
    const getLatestResponse = useCallback((userId: string, eventId: string): UserResponse | null => {
        return getLatestResponseShared(responses, userId, eventId)
    }, [responses])

    const getCurrentResponse = useCallback((userId: string, eventId: string): UserResponseValue => {
        return getCurrentResponseShared(responses, userId, eventId)
    }, [responses])

    const getLatestResponsesByEvent = useCallback((userId: string): Map<string, UserResponse> => {
        return getLatestResponsesByEventShared(responses, userId)
    }, [responses])

    const getLatestResponsesByUser = useCallback((eventId: string): Map<string, UserResponse> => {
        return getLatestResponsesByUserShared(responses, eventId)
    }, [responses])

    // Invalider le cache (stub pour compatibilité)
    const invalidateCache = useCallback(() => {
        // Visitor n'a pas de cache à invalider
    }, [])

    // Value du contexte
    const value = useMemo((): VisitorDataContextType => ({
        // Données
        events,
        responses,
        users: undefined, // Visitor n'a pas besoin de users
        userRelations: undefined, // Visitor n'a pas besoin de relations

        // Erreurs
        eventsError: null,
        usersError: undefined,
        responsesError: null,
        relationsError: undefined,

        // Helpers pour réponses
        getLatestResponse,
        getCurrentResponse,
        getLatestResponsesByEvent,
        getLatestResponsesByUser,

        // Actions
        addEventResponse,
        invalidateCache,

        // Refresh (stubs pour compatibilité - fonctions qui lancent une erreur)
        refreshEvents: async () => { throw new Error('refreshEvents n\'est pas disponible en mode visitor') },
        refreshUsers: async () => { throw new Error('refreshUsers n\'est pas disponible en mode visitor') },
        refreshResponses: async () => { throw new Error('refreshResponses n\'est pas disponible en mode visitor') },
        refreshUserRelations: async () => { throw new Error('refreshUserRelations n\'est pas disponible en mode visitor') },
        refreshAll: async () => { throw new Error('refreshAll n\'est pas disponible en mode visitor') },

        // Actions utilisateur (stubs pour compatibilité - fonctions qui lancent une erreur)
        createEvent: async () => { throw new Error('createEvent n\'est pas disponible en mode visitor'); return null },
        updateEvent: async () => { throw new Error('updateEvent n\'est pas disponible en mode visitor'); return null },
        sendFriendshipRequest: async () => { throw new Error('sendFriendshipRequest n\'est pas disponible en mode visitor'); return false },
        addFriendshipAction: async () => { throw new Error('addFriendshipAction n\'est pas disponible en mode visitor') },
        searchUsers: async () => { throw new Error('searchUsers n\'est pas disponible en mode visitor'); return [] },
        getTags: async () => { throw new Error('getTags n\'est pas disponible en mode visitor'); return [] },
        checkUserByEmail: async () => { throw new Error('checkUserByEmail n\'est pas disponible en mode visitor'); return null },
        matchByEmail: (email: string) => fomoData.matchByEmail(email),
        saveUserToBackend: async () => { throw new Error('saveUserToBackend n\'est pas disponible en mode visitor'); return null },
        getUserEvents: async () => { throw new Error('getUserEvents n\'est pas disponible en mode visitor'); return [] },
        searchAddresses: async () => { throw new Error('searchAddresses n\'est pas disponible en mode visitor'); return [] },

        // Identité
        currentUserId,
        currentUserName,

        // États globaux
        isLoading: false,
        hasError: false,
        dataReady: true // Visitor est toujours prêt (pas de chargement asynchrone)
    }), [
        events,
        responses,
        getLatestResponse,
        getCurrentResponse,
        getLatestResponsesByEvent,
        getLatestResponsesByUser,
        addEventResponse,
        invalidateCache,
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

