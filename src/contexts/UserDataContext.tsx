/**
 * User Data Context - Contexte pour utilisateurs authentifiés
 * 
 * Utilise le FomoDataManager unifié pour gérer toutes les données
 * avec cache en mémoire et optimistic updates
 * 
 * SYSTÈME DE CHARGEMENT SILENCIEUX :
 * - Chargement unique au démarrage avec dataReady
 * - Pas de re-renders multiples
 * - Commit unique des données
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useFomoData } from '@/utils/dataManager'
import type { Event, User, UserResponse, Friend, Tag, AddressSuggestion } from '@/types/fomoTypes'
import { addEventResponseShared } from '@/utils/eventResponseUtils'
import { format } from 'date-fns'

// ===== TYPES =====

export interface FomoDataContextType {
    // Données
    events: Event[]
    users: User[]
    responses: UserResponse[] // Historique complet avec initialResponse/finalResponse
    userRelations: Friend[]

    // Erreurs
    eventsError: string | null
    usersError: string | null
    responsesError: string | null
    relationsError: string | null

    // Helpers pour réponses (NOUVEAU SYSTÈME)
    getLatestResponse: (userId: string, eventId: string) => UserResponse | null
    getCurrentResponse: (userId: string, eventId: string) => UserResponseValue
    getLatestResponsesByEvent: (userId: string) => Map<string, UserResponse>
    getLatestResponsesByUser: (eventId: string) => Map<string, UserResponse>

    // Actions
    refreshEvents: () => Promise<void>
    refreshUsers: () => Promise<void>
    refreshResponses: () => Promise<void>
    refreshUserRelations: () => Promise<void>
    refreshAll: () => Promise<void>

    // Actions utilisateur
    createEvent: (eventData: Omit<Event, 'id'>) => Promise<Event | null>
    updateEvent: (eventId: string, eventData: Event) => Promise<Event | null>
    addEventResponse: (
        eventId: string,
        finalResponse: 'going' | 'interested' | 'not_interested' | 'cleared' | 'seen' | 'invited' | null,
        options?: {
            email?: string
            targetUserId?: string // Si présent, utilise cet userId au lieu de user.id
            invitedByUserId?: string
        }
    ) => void
    sendFriendshipRequest: (toUserId: string) => Promise<boolean>
    addFriendshipAction: (type: 'accept' | 'block' | 'remove', friendshipId: string, toUserId: string) => Promise<void>
    searchUsers: (query: string) => Promise<Array<{ id: string, name: string, email: string, city: string, friendshipStatus: string }>>
    getTags: () => Promise<Tag[]>

    // Auth
    checkUserByEmail: (email: string) => Promise<User | null>
    matchByEmail: (email: string) => Promise<string | null>
    updateUser: (userId: string, userData: User, newId?: string) => Promise<User | null>
    saveUserToBackend: (userData: User) => Promise<User | null>

    // User Events
    getUserEvents: (userId: string) => Promise<Event[]>

    // Geocoding
    searchAddresses: (query: string, options?: { countryCode?: string; limit?: number }) => Promise<AddressSuggestion[]>

    // Upload - désactivé temporairement

    // Cache
    invalidateCache: () => void

    // États globaux
    isLoading: boolean
    hasError: boolean
    dataReady: boolean

}

const FomoDataContext = createContext<FomoDataContextType | undefined>(undefined)

// ===== PROVIDER =====

interface UserDataProviderProps {
    children: ReactNode
}

export const UserDataProvider: React.FC<UserDataProviderProps> = ({ children }) => {
    const { user } = useAuth()

    const fomoData = useFomoData()

    // États des données
    const [events, setEvents] = useState<Event[]>([])
    const [users, setUsers] = useState<User[]>([])
    const [responses, setResponses] = useState<UserResponse[]>([])
    const [userRelations, setUserRelations] = useState<Friend[]>([])

    // États d'erreur
    const [eventsError, setEventsError] = useState<string | null>(null)
    const [usersError, setUsersError] = useState<string | null>(null)
    const [responsesError, setResponsesError] = useState<string | null>(null)
    const [relationsError, setRelationsError] = useState<string | null>(null)

    // État de chargement global
    const [dataReady, setDataReady] = useState(false)
    const [isLoading, setIsLoading] = useState(false)


    // Charger les données SEULEMENT quand user est authentifié
    useEffect(() => {
        // Ne pas charger si pas d'utilisateur authentifié
        if (!user?.id) {
            setDataReady(false)
            return
        }

        let isMounted = true

        const loadData = async () => {
            setIsLoading(true)
            setDataReady(false)

            try {

                // Charger toutes les données en parallèle
                const [eventsData, usersData, responsesData, relationsData] = await Promise.allSettled([
                    fomoData.getEvents(),
                    fomoData.getUsers(),
                    fomoData.getResponses(),
                    fomoData.getUserRelations(user.id)
                ])

                if (!isMounted) return

                // Traiter les résultats
                if (eventsData.status === 'fulfilled') {
                    setEvents(eventsData.value)
                    setEventsError(null)
                } else {
                    setEventsError(eventsData.reason?.message || 'Erreur de chargement des événements')
                }

                if (usersData.status === 'fulfilled') {
                    setUsers(usersData.value)
                    setUsersError(null)
                } else {
                    setUsersError(usersData.reason?.message || 'Erreur de chargement des utilisateurs')
                }

                if (responsesData.status === 'fulfilled') {
                    setResponses(responsesData.value)
                    setResponsesError(null)
                } else {
                    setResponsesError(responsesData.reason?.message || 'Erreur de chargement des réponses')
                }

                if (relationsData.status === 'fulfilled') {
                    setUserRelations(relationsData.value)
                    setRelationsError(null)
                } else {
                    setRelationsError(relationsData.reason?.message || 'Erreur de chargement des relations')
                }


                // UN SEUL setDataReady(true) après Promise.all()
                setDataReady(true)

            } catch (error) {
                if (!isMounted) return
                console.error('❌ [FOMO DATA] Erreur de chargement:', error)
            } finally {
                if (isMounted) {
                    setIsLoading(false)
                }
            }
        }

        loadData()

        return () => {
            isMounted = false
        }
    }, [user?.id]) // Dépendre de user.id - ne charger que quand user est authentifié

    // Fonction de refresh global
    const loadAllData = useCallback(async () => {
        setIsLoading(true)
        setDataReady(false)

        try {

            // Charger toutes les données en parallèle
            const [eventsData, usersData, responsesData, relationsData] = await Promise.allSettled([
                fomoData.getEvents(),
                fomoData.getUsers(),
                fomoData.getResponses(),
                user?.id ? fomoData.getUserRelations(user.id) : Promise.resolve([])
            ])

            // Traiter les résultats
            if (eventsData.status === 'fulfilled') {
                setEvents(eventsData.value)
                setEventsError(null)
            } else {
                setEventsError(eventsData.reason?.message || 'Erreur de chargement des événements')
            }

            if (usersData.status === 'fulfilled') {
                setUsers(usersData.value)
                setUsersError(null)
            } else {
                setUsersError(usersData.reason?.message || 'Erreur de chargement des utilisateurs')
            }

            if (responsesData.status === 'fulfilled') {
                setResponses(responsesData.value)
                setResponsesError(null)
            } else {
                setResponsesError(responsesData.reason?.message || 'Erreur de chargement des réponses')
            }

            if (relationsData.status === 'fulfilled') {
                setUserRelations(relationsData.value)
                setRelationsError(null)
            } else {
                setRelationsError(relationsData.reason?.message || 'Erreur de chargement des relations')
            }

            setDataReady(true)

        } catch (error) {
            console.error('❌ [FOMO DATA] Erreur de refresh:', error)
        } finally {
            setIsLoading(false)
        }
    }, [fomoData, user?.id])

    // Fonctions de chargement avec loading states (pour les refresh manuels)
    const loadEvents = useCallback(async () => {
        try {
            setEventsError(null)
            const data = await fomoData.getEvents()
            setEvents(data)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erreur de chargement'
            setEventsError(errorMessage)
            console.error('Erreur de chargement events:', error)
        }
    }, [fomoData])

    const loadUsers = useCallback(async () => {
        try {
            setUsersError(null)
            const data = await fomoData.getUsers()
            setUsers(data)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erreur de chargement'
            setUsersError(errorMessage)
            console.error('Erreur de chargement users:', error)
        }
    }, [fomoData])

    const loadResponses = useCallback(async () => {
        try {
            setResponsesError(null)
            const data = await fomoData.getResponses()
            setResponses(data)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erreur de chargement'
            setResponsesError(errorMessage)
            console.error('Erreur de chargement responses:', error)
        }
    }, [fomoData])

    const loadUserRelations = useCallback(async () => {
        if (!user?.id) return Promise.resolve()
        try {
            setRelationsError(null)
            const data = await fomoData.getUserRelations(user.id)
            setUserRelations(data)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erreur de chargement'
            setRelationsError(errorMessage)
            console.error('Erreur de chargement relations:', error)
        }
    }, [fomoData, user?.id])

    // Fonctions de refresh
    const refreshEvents = useCallback(async () => {
        fomoData.invalidateCache()
        await loadEvents()
    }, [loadEvents, fomoData])

    const refreshUsers = useCallback(async () => {
        fomoData.invalidateCache()
        await loadUsers()
    }, [loadUsers, fomoData])

    const refreshResponses = useCallback(async () => {
        fomoData.invalidateCache()
        await loadResponses()
    }, [loadResponses, fomoData])

    const refreshUserRelations = useCallback(async () => {
        if (!user?.id) return
        fomoData.invalidateUserCache(user.id)
        await loadUserRelations()
    }, [loadUserRelations, fomoData, user?.id])

    const refreshAll = useCallback(async () => {
        fomoData.invalidateCache()
        await loadAllData()
    }, [loadAllData, fomoData])

    // Actions utilisateur
    const createEvent = useCallback(async (eventData: Omit<Event, 'id'>): Promise<Event | null> => {
        try {
            const newEvent = await fomoData.createEvent(eventData)
            // Mettre à jour le cache local
            setEvents(prev => [...prev, newEvent])
            return newEvent
        } catch (error) {
            console.error('Erreur lors de la création de l\'événement:', error)
            return null
        }
    }, [fomoData])

    const updateEvent = useCallback(async (eventId: string, eventData: Event): Promise<Event | null> => {
        // Sauvegarder l'état précédent pour rollback
        const previousEvent = events.find(e => e.id === eventId)

        // Mise à jour optimiste immédiate (comme pour addEventResponse)
        fomoData.updateEventInCache(eventId, eventData)
        setEvents(prev => prev.map(event => event.id === eventId ? eventData : event))

        // Appel API en arrière-plan (fire-and-forget)
        try {
            const updatedEvent = await fomoData.updateEvent(eventId, eventData)
            // Mettre à jour avec la réponse du serveur pour garantir la cohérence
            if (updatedEvent) {
                fomoData.updateEventInCache(eventId, updatedEvent)
                setEvents(prev => prev.map(event => event.id === eventId ? updatedEvent : event))
            }
            return updatedEvent
        } catch (error) {
            console.error('Erreur lors de la mise à jour de l\'événement:', error)
            // Rollback en cas d'erreur
            if (previousEvent) {
                fomoData.updateEventInCache(eventId, previousEvent)
                setEvents(prev => prev.map(event => event.id === eventId ? previousEvent : event))
            }
            return null
        }
    }, [fomoData, events])

    // ===== HELPERS POUR RÉPONSES (NOUVEAU SYSTÈME) =====

    const getLatestResponse = useCallback((userId: string, eventId: string): UserResponse | null => {
        const userEventResponses = responses
            .filter(r => r.userId === userId && r.eventId === eventId && !r.deletedAt)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        return userEventResponses.length > 0 ? userEventResponses[0] : null
    }, [responses])

    const getCurrentResponse = useCallback((userId: string, eventId: string): UserResponseValue => {
        const latest = getLatestResponse(userId, eventId)
        return latest ? latest.finalResponse : null
    }, [getLatestResponse])

    const getLatestResponsesByEvent = useCallback((userId: string): Map<string, UserResponse> => {
        const userResponses = responses.filter(r => r.userId === userId && !r.deletedAt)
        const latestMap = new Map<string, UserResponse>()
        userResponses.forEach(r => {
            const existing = latestMap.get(r.eventId)
            if (!existing || new Date(r.createdAt) > new Date(existing.createdAt)) {
                latestMap.set(r.eventId, r)
            }
        })
        return latestMap
    }, [responses])

    const getLatestResponsesByUser = useCallback((eventId: string): Map<string, UserResponse> => {
        const eventResponses = responses.filter(r => r.eventId === eventId && !r.deletedAt)
        const latestMap = new Map<string, UserResponse>()
        eventResponses.forEach(r => {
            const existing = latestMap.get(r.userId)
            if (!existing || new Date(r.createdAt) > new Date(existing.createdAt)) {
                latestMap.set(r.userId, r)
            }
        })
        return latestMap
    }, [responses])

    /**
     * STRATÉGIE DE GESTION DES RÉPONSES AUX ÉVÉNEMENTS
     * 
     * NOUVEAU SYSTÈME : Historique complet avec initialResponse et finalResponse
     * 
     * 1. Mise à jour optimiste immédiate de l'UI (nouvelle entrée)
     * 2. Appel API en arrière-plan
     * 3. Rollback en cas d'erreur
     * 
     * Unifiée pour gérer :
     * - Les réponses de l'utilisateur connecté (par défaut)
     * - Les invitations pour d'autres utilisateurs (avec targetUserId)
     */
    const addEventResponse = useCallback((
        eventId: string,
        finalResponse: 'going' | 'interested' | 'not_interested' | 'cleared' | 'seen' | 'invited' | null,
        options?: {
            targetUserId?: string // Si présent, utilise cet userId au lieu de user.id
            invitedByUserId?: string
        }
    ) => {
        if (!user?.id) {
            console.log('❌ [FomoDataContext] No user ID, aborting')
            return
        }

        // Déterminer le userId à utiliser : targetUserId si fourni, sinon user.id
        const targetUserId = options?.targetUserId || user.id

        // Utiliser la fonction partagée (optimiste + batch)
        addEventResponseShared({
            userId: targetUserId,
            eventId,
            finalResponse,
            invitedByUserId: options?.invitedByUserId,
            setResponses,
            fomoData,
            contextName: 'UserDataContext'
        })
    }, [user?.id, fomoData, setResponses])

    const sendFriendshipRequest = useCallback(async (toUserId: string): Promise<boolean> => {
        if (!user?.id) return false

        try {
            const result = await fomoData.sendFriendshipRequest(user.id, toUserId)
            if (result) {
                // Mettre à jour le cache local
                await loadUserRelations()
            }
            return result
        } catch (error) {
            console.error('Erreur lors de l\'envoi de la demande d\'amitié:', error)
            return false
        }
    }, [user?.id, fomoData, loadUserRelations])

    const addFriendshipAction = useCallback(async (type: 'accept' | 'block' | 'remove', friendshipId: string, toUserId: string) => {
        if (!user?.id) return

        // Mise à jour optimiste
        setUserRelations(prev => {
            switch (type) {
                case 'accept':
                    return prev.map(rel =>
                        rel.friendship?.id === friendshipId
                            ? { ...rel, friendship: { ...rel.friendship, status: 'active', updatedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") } }
                            : rel
                    )
                case 'block':
                    return prev.map(rel =>
                        rel.friendship?.id === friendshipId || rel.id === toUserId
                            ? { ...rel, friendship: { ...rel.friendship, status: 'blocked', updatedAt: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") } }
                            : rel
                    )
                case 'remove':
                    return prev.filter(rel => rel.friendship?.id !== friendshipId && rel.id !== toUserId)
                default:
                    return prev
            }
        })

        // Appel API en arrière-plan
        try {
            fomoData.addFriendshipAction(user.id, type, friendshipId, toUserId)
            // Sauvegarder immédiatement pour un feedback rapide
            await fomoData.savePendingActions()
            // Invalider le cache avant de recharger pour avoir les données à jour
            fomoData.invalidateUserCache(user.id)
            // Invalider aussi le cache de l'autre utilisateur si on le connaît
            const relation = userRelations.find(r => r.friendship?.id === friendshipId)
            if (relation && relation.id !== user.id) {
                fomoData.invalidateUserCache(relation.id)
            }
            // Rafraîchir les relations après succès pour s'assurer que les données sont à jour
            await loadUserRelations()
        } catch (error) {
            console.error('Erreur lors de l\'action d\'amitié:', error)
            // Rollback en cas d'erreur - invalider le cache et recharger
            fomoData.invalidateUserCache(user.id)
            await loadUserRelations()
        }
    }, [user?.id, fomoData, loadUserRelations, userRelations])

    const searchUsers = useCallback(async (query: string) => {
        if (!user?.id) return []
        try {
            return await fomoData.searchUsers(query, user.id)
        } catch (error) {
            console.error('Erreur lors de la recherche d\'utilisateurs:', error)
            return []
        }
    }, [fomoData, user?.id])

    // Tags - reconstruits côté front depuis les events en cache
    const getTags = useCallback(async (): Promise<Tag[]> => {
        try {
            // Construire un index { tag -> { count, lastUsed, created_at, created_by } } depuis events
            const tagMap = new Map<string, { usage_count: number, last_used: string, created_at: string, created_by: string }>()

            const normalize = (t: string) => t.trim().toLowerCase()

            for (const evt of events) {
                const eventTime = evt.startsAt || ''
                const eventCreatedAt = evt.createdAt || eventTime
                const eventOrganizerName = evt.organizerName || ''

                for (const raw of (evt.tags || [])) {
                    const t = typeof raw === 'string' ? normalize(raw) : ''
                    if (!t) continue
                    const existing = tagMap.get(t)
                    if (!existing) {
                        // Première occurrence : utiliser createdAt et organizerName de l'event
                        tagMap.set(t, {
                            usage_count: 1,
                            last_used: eventTime,
                            created_at: eventCreatedAt,
                            created_by: eventOrganizerName
                        })
                    } else {
                        const newer = !existing.last_used || (eventTime && eventTime > existing.last_used)
                        tagMap.set(t, {
                            usage_count: existing.usage_count + 1,
                            last_used: newer ? eventTime : existing.last_used,
                            created_at: existing.created_at, // Garder la date de création originale
                            created_by: existing.created_by  // Garder le créateur original
                        })
                    }
                }
            }

            const list: Tag[] = Array.from(tagMap.entries()).map(([tag, info]) => ({
                tag,
                usage_count: info.usage_count,
                last_used: info.last_used || '',
                created_at: info.created_at || '',
                created_by: info.created_by || ''
            }))

            // Trier par popularité décroissante
            list.sort((a, b) => b.usage_count - a.usage_count)
            return list
        } catch (error) {
            console.error('Erreur lors de la reconstruction des tags:', error)
            return []
        }
    }, [events])

    // Auth
    const checkUserByEmail = useCallback(async (email: string) => {
        try {
            return await fomoData.checkUserByEmail(email)
        } catch (error) {
            console.error('Erreur lors de la vérification de l\'utilisateur:', error)
            return null
        }
    }, [fomoData])

    const matchByEmail = useCallback(async (email: string) => {
        try {
            return await fomoData.matchByEmail(email)
        } catch (error) {
            console.error('Erreur lors du match par email:', error)
            return null
        }
    }, [fomoData])

    const updateUser = useCallback(async (userId: string, userData: User, newId?: string) => {
        try {
            return await fomoData.updateUser(userId, userData, newId)
        } catch (error) {
            console.error('Erreur lors de la mise à jour de l\'utilisateur:', error)
            throw error
        }
    }, [fomoData])

    const saveUserToBackend = useCallback(async (userData: User) => {
        try {
            return await fomoData.saveUserToBackend(userData)
        } catch (error) {
            console.error('Erreur lors de la sauvegarde de l\'utilisateur:', error)
            throw error
        }
    }, [fomoData])

    // User Events
    const getUserEvents = useCallback(async (userId: string) => {
        try {
            return await fomoData.getUserEvents(userId)
        } catch (error) {
            console.error('Erreur lors de la récupération des événements utilisateur:', error)
            return []
        }
    }, [fomoData])

    // Geocoding

    const searchAddresses = useCallback(async (query: string, options?: { countryCode?: string; limit?: number }) => {
        try {
            return await fomoData.searchAddresses(query, options)
        } catch (error) {
            console.error('Erreur lors de la recherche d\'adresses:', error)
            return []
        }
    }, [fomoData])

    // Upload - désactivé temporairement

    // États globaux
    const hasError = !!(eventsError || usersError || responsesError || relationsError)

    // Log des états de chargement - supprimé car redondant avec App.tsx

    // Log des valeurs du contexte pour debug

    // Valeur du contexte - STABILISÉE pour éviter les re-renders
    const value = useMemo(() => ({
        // Données
        events,
        users,
        responses,
        userRelations,

        // Erreurs
        eventsError,
        usersError,
        responsesError,
        relationsError,

        // Helpers pour réponses (NOUVEAU SYSTÈME)
        getLatestResponse,
        getCurrentResponse,
        getLatestResponsesByEvent,
        getLatestResponsesByUser,

        // Actions
        refreshEvents,
        refreshUsers,
        refreshResponses,
        refreshUserRelations,
        refreshAll,

        // Actions utilisateur
        createEvent,
        updateEvent,
        addEventResponse,
        sendFriendshipRequest,
        addFriendshipAction,
        searchUsers,
        getTags,

        // Auth
        checkUserByEmail,
        matchByEmail,
        updateUser,
        saveUserToBackend,

        // User Events
        getUserEvents,

        // Geocoding
        searchAddresses,

        // Upload - désactivé temporairement

        // Cache
        invalidateCache: fomoData.invalidateCache,

        // États globaux
        isLoading,
        hasError,
        dataReady,
    }), [
        // Toutes les dépendances nécessaires pour stabiliser l'objet
        events, users, responses, userRelations,
        eventsError, usersError, responsesError, relationsError,
        isLoading, hasError, dataReady,
        // Helpers pour réponses
        getLatestResponse, getCurrentResponse, getLatestResponsesByEvent, getLatestResponsesByUser,
        // Fonctions stabilisées avec useCallback
        refreshEvents, refreshUsers, refreshResponses, refreshUserRelations, refreshAll,
        createEvent, updateEvent, addEventResponse, getTags,
        sendFriendshipRequest, addFriendshipAction, searchUsers,
        checkUserByEmail, matchByEmail, updateUser, saveUserToBackend, getUserEvents,
        searchAddresses,
        fomoData.invalidateCache
    ])

    return (
        <FomoDataContext.Provider value={value}>
            {children}
        </FomoDataContext.Provider>
    )
}

// ===== HOOK =====

export const useUserDataContext = (): FomoDataContextType => {
    const context = useContext(FomoDataContext)
    if (context === undefined) {
        throw new Error('useUserDataContext must be used within a UserDataProvider')
    }
    return context
}

export default FomoDataContext