/**
 * Data Context - Provider unifié pour données visitor et user (REFACTORISÉ)
 * 
 * Simplifié de 765 → ~400 lignes :
 * - Suppression duplication loadData/loadAllData
 * - Suppression fonctions individuelles inutiles
 * - Suppression helpers wrappers
 * - Suppression useMemo inutile
 * - getTags simplifié et calculé une fois
 * - Stockage source "linked" unifié pour users et visitors via lien (réponse créée seulement à la soumission)
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { usePrivacy } from '@/contexts/PrivacyContext'
import { useFomoData } from '@/utils/dataManager'
import { getApiBaseUrl } from '@/config/env'
import { ERROR_MESSAGES } from '@/utils/errorMessages'
import type { Event, User, UserResponse, UserResponseValue, Friend, Tag } from '@/types/fomoTypes'
import { format } from 'date-fns'
// getUser n'est plus utilisé ici (calculateTags supprimé)

// ===== TYPES =====

export interface DataContextType {
    // ===== STATE GLOBAL =====
    events: Event[]  // allEventsSource (Discover/Calendar)
    myEvents: Event[]  // myEventsSource (Profile)
    users: User[]
    responses: UserResponse[]
    userRelations: Friend[]
    tags: Tag[]

    // ===== ERREURS =====
    eventsError: string | null
    myEventsError: string | null
    usersError: string | null
    responsesError: string | null
    relationsError: string | null

    // ===== IDENTITÉ =====
    currentUserId: string | null
    currentUserName: string | null
    isVisitor: boolean

    // ===== REFRESH =====
    refreshAll: () => Promise<void>
    refreshRelations: () => Promise<void>

    // ===== MUTATIONS UI (avec optimistic updates) =====
    createEvent: (eventData: Omit<Event, 'id'>) => Promise<Event | null>
    updateEvent: (eventId: string, eventData: Event) => Promise<Event | null>
    addEventResponse: (
        eventId: string,
        finalResponse: UserResponseValue,
        options?: {
            targetUserId?: string
            invitedByUserId?: string
            initialResponse?: UserResponseValue  // Source d'origine (linked/invited) si différente de finalResponse
        }
    ) => void
    sendFriendshipRequest: (toUserId: string) => Promise<boolean>
    addFriendshipAction: (type: 'accept' | 'block' | 'remove', friendshipId: string, toUserId: string) => Promise<void>

    // ===== SOURCES INITIALES (linked/invited) =====
    // Stocke la source d'origine (linked/invited) pour les événements où l'utilisateur
    // est arrivé via un lien ou une invitation, mais n'a pas encore créé de réponse.
    // Utilisé par EventCard.getLocalResponse() pour déterminer l'initialResponse.
    getInitialResponseSource: (eventId: string) => 'linked' | 'invited' | null

    // ===== EVENT DEPUIS URL =====
    // Event chargé depuis l'URL (?event=xxx)
    // Utilisé par OnboardingStateContext pour identifier l'event d'onboarding
    eventFromUrl: Event | null
    eventFromUrlError: string | null  // Erreur lors du chargement de l'événement depuis l'URL

    // ===== ÉTATS =====
    isLoading: boolean
    hasError: boolean
    dataReady: boolean
    eventsReady: boolean  // Indique spécifiquement si les events sont chargés (allEvents)
}

// Note: Pour les appels API directs (searchUsers, getUserById, etc.), 
// utiliser useFomoData() au lieu de passer par DataContext

const DataContext = createContext<DataContextType | undefined>(undefined)

// ===== PROVIDER =====

interface DataProviderProps {
    children: ReactNode
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
    const { user } = useAuth()
    const { isPublicMode } = usePrivacy()
    const fomoData = useFomoData()

    // États des données
    const [events, setEvents] = useState<Event[]>([])  // allEventsSource (pour Discover/Calendar)
    const [myEvents, setMyEvents] = useState<Event[]>([])  // myEventsSource (pour Profile)
    const [users, setUsers] = useState<User[]>([])
    const [responses, setResponses] = useState<UserResponse[]>([])
    const [userRelations, setUserRelations] = useState<Friend[]>([])
    const [tags, setTags] = useState<Tag[]>([])  // Bibliothèque globale depuis /api/tags
    const [eventFromUrl, setEventFromUrl] = useState<Event | null>(null)  // Event chargé depuis l'URL
    const [eventFromUrlError, setEventFromUrlError] = useState<string | null>(null)  // Erreur lors du chargement de l'événement depuis l'URL

    // ===== SOURCES INITIALES (linked/invited) =====
    // Map<eventId, 'linked' | 'invited'>
    // Stocke la source d'origine pour les événements où l'utilisateur est arrivé via un lien
    // ou une invitation, mais n'a pas encore créé de réponse dans le backend.
    // Cette information est utilisée par EventCard.getLocalResponse() pour déterminer
    // l'initialResponse lors de la création de la réponse (quand l'utilisateur soumet sa réponse).
    const [initialResponseSources, setInitialResponseSources] = useState<Map<string, 'linked' | 'invited'>>(new Map())

    // États d'erreur
    const [eventsError, setEventsError] = useState<string | null>(null)
    const [myEventsError, setMyEventsError] = useState<string | null>(null)
    const [usersError, setUsersError] = useState<string | null>(null)
    const [responsesError, setResponsesError] = useState<string | null>(null)
    const [relationsError, setRelationsError] = useState<string | null>(null)

    // État de chargement global
    const [dataReady, setDataReady] = useState(false)
    const [eventsReady, setEventsReady] = useState(false)  // Indique spécifiquement si les events sont chargés
    const [isLoading, setIsLoading] = useState(false)

    // Identité utilisateur actuel (toujours défini, visitor ou user)
    const currentUserId = user.id
    const currentUserName = user.name
    const isVisitor = user.isVisitor

    // ===== FONCTION GÉNÉRIQUE POUR METTRE À JOUR EVENTS ET MYEVENTS =====
    /**
     * Met à jour de manière synchronisée events et myEvents.
     * Vérifie automatiquement si l'événement appartient à l'utilisateur actuel.
     */
    const updateEventInLists = useCallback((
        operation: 'add' | 'update' | 'remove',
        eventOrId: Event | string,
        updatedEvent?: Event
    ) => {
        const eventId = typeof eventOrId === 'string' ? eventOrId : eventOrId.id
        const event = typeof eventOrId === 'string' ? updatedEvent : eventOrId

        if (!event && operation !== 'remove') {
            console.error('❌ [DataContext] updateEventInLists: event required for add/update operations')
            return
        }

        // Vérifier si l'événement appartient à l'utilisateur actuel
        const isMyEvent = event && (
            event.organizerId === currentUserId ||
            event.organizerId === `amb_${currentUserId}`
        )

        // Mettre à jour events (toujours)
        switch (operation) {
            case 'add':
                if (event) {
                    setEvents(prev => [...prev, event])
                }
                break
            case 'update':
                if (event) {
                    setEvents(prev => prev.map(e => e.id === eventId ? event : e))
                }
                break
            case 'remove':
                setEvents(prev => prev.filter(e => e.id !== eventId))
                break
        }

        // Mettre à jour myEvents (seulement si l'événement appartient à l'utilisateur)
        if (isMyEvent) {
            switch (operation) {
                case 'add':
                    if (event) {
                        setMyEvents(prev => [...prev, event])
                    }
                    break
                case 'update':
                    if (event) {
                        setMyEvents(prev => prev.map(e => e.id === eventId ? event : e))
                    }
                    break
                case 'remove':
                    setMyEvents(prev => prev.filter(e => e.id !== eventId))
                    break
            }
        }
    }, [currentUserId])

    // ===== FONCTION UNIQUE DE CHARGEMENT =====
    const loadData = useCallback(async () => {
        setIsLoading(true)
        setDataReady(false)
        setEventsReady(false)

        // Invalider le cache
        fomoData.invalidateCache()

        try {
            // Déterminer les paramètres pour l'endpoint events
            const mode = isVisitor ? 'visitor' : 'user'
            const privacy = isPublicMode ? 'public' : 'private'

            console.log(`📦 [DataContext] Chargement données: mode=${mode}, privacy=${privacy}, userId=${currentUserId}`)

            // ===== GESTION DES LIENS D'ÉVÉNEMENTS (?event=xxx) =====
            // NOUVELLE APPROCHE : Stocker la source "linked" au lieu de créer une réponse immédiatement
            // La réponse sera créée seulement quand l'utilisateur soumettra sa réponse dans EventCard.
            // Cela évite de créer des entrées pour les bots/visiteurs qui ne complètent jamais le formulaire.
            // 
            // Flux :
            // 1. Visitor arrive via lien → stocke "linked" dans initialResponseSources
            // 2. EventCard s'ouvre → getLocalResponse() retourne "linked" (depuis initialResponseSources)
            // 3. Visitor choisit "participe" → pendingResponseRef = "participe"
            // 4. EventCard se ferme → handleClose crée réponse avec initialResponse="linked", finalResponse="participe"
            const urlParams = new URLSearchParams(window.location.search)
            const eventIdFromUrl = urlParams.get('event')

            // ===== CHARGEMENT DE L'ÉVÉNEMENT DEPUIS L'URL (avec fallback) =====
            // Cette logique est commune aux users et visitors
            // Si l'event de l'URL n'est pas trouvé (404), on essaie evt_tester_000000 comme fallback
            let eventFromUrl: Event | null = null
            if (eventIdFromUrl && currentUserId) {
                console.log(`🔗 [DataContext] Lien d'événement détecté (${isVisitor ? 'visitor' : 'user'}): ${eventIdFromUrl}`)

                try {
                    // 1. Vérifier si une réponse existe déjà pour cet event
                    const existingResponses = await fomoData.getResponses(currentUserId)
                    const hasResponse = existingResponses.some(r => r.eventId === eventIdFromUrl)

                    if (!hasResponse) {
                        // 2. Stocker "linked" dans initialResponseSources (au lieu de créer une réponse)
                        // Cette valeur sera utilisée par EventCard.getLocalResponse() pour déterminer l'initialResponse
                        console.log(`📝 [DataContext] Stockage source "linked" pour ${eventIdFromUrl} (réponse créée seulement à la soumission)`)
                        setInitialResponseSources(prev => {
                            const next = new Map(prev)
                            next.set(eventIdFromUrl, 'linked')
                            return next
                        })
                        console.log(`✅ [DataContext] Source "linked" stockée pour ${eventIdFromUrl}`)
                    } else {
                        console.log(`ℹ️ [DataContext] Réponse existante pour ${eventIdFromUrl}, pas de stockage source`)
                    }

                    // 3. Charger l'event depuis l'API
                    const apiUrl = getApiBaseUrl()
                    const response = await fetch(`${apiUrl}/events/${eventIdFromUrl}`)

                    if (!response.ok) {
                        // Utiliser le message d'erreur centralisé
                        throw new Error(ERROR_MESSAGES.eventNotFound)
                    }

                    const data = await response.json()
                    if (!data.success || !data.data) {
                        throw new Error('Format de réponse invalide')
                    }

                    eventFromUrl = data.data as Event
                    console.log(`✅ [DataContext] Event chargé depuis URL: ${eventFromUrl.title}`)
                    // Stocker l'event chargé depuis l'URL
                    setEventFromUrl(eventFromUrl)
                } catch (error) {
                    console.error('❌ [DataContext] Erreur traitement lien événement:', error)
                    // En cas d'erreur (notamment 404), définir l'erreur pour l'afficher dans WelcomeScreen
                    const errorMessage = error instanceof Error ? error.message : ERROR_MESSAGES.eventLoadGeneric
                    setEventFromUrlError(errorMessage)
                    setEventFromUrl(null)
                }
            } else {
                // Pas d'eventId dans l'URL, réinitialiser
                setEventFromUrl(null)
            }

            // 1. allEventsSource : events pour Discover/Calendar (online only)
            const eventsPromise = fetch(`${getApiBaseUrl()}/events?mode=${mode}&privacy=${privacy}&userId=${currentUserId}`)
                .then(r => r.json())
                .then(data => data.success ? data.data : [])
                .catch(err => {
                    console.error('❌ [DataContext] Erreur allEvents:', err)
                    throw err
                })

            // 2. myEventsSource : MES events pour Profile (online + offline)
            const myEventsPromise = fetch(`${getApiBaseUrl()}/events/my?userId=${currentUserId}`)
                .then(r => r.json())
                .then(data => data.success ? data.data : [])
                .catch(err => {
                    console.error('❌ [DataContext] Erreur myEvents:', err)
                    throw err
                })

            // Charger responses (filtrage backend par userId)
            const responsesPromise = fomoData.getResponses(currentUserId)

            // Charger users et relations UNIQUEMENT si user authentifié
            let usersPromise: Promise<User[]> = Promise.resolve([])
            let relationsPromise: Promise<Friend[]> = Promise.resolve([])

            if (!isVisitor && user?.id) {
                usersPromise = fomoData.getUsers()
                relationsPromise = fomoData.getUserRelations(user.id)
            }

            const [eventsData, myEventsData, responsesData, usersData, relationsData] = await Promise.allSettled([
                eventsPromise,
                myEventsPromise,
                responsesPromise,
                usersPromise,
                relationsPromise
            ])

            // Traiter les résultats
            // Charger les réponses d'abord pour pouvoir vérifier si eventFromUrl doit être ajouté
            const loadedResponses = responsesData.status === 'fulfilled' ? responsesData.value : []
            if (responsesData.status === 'fulfilled') {
                setResponses(responsesData.value)
                setResponsesError(null)
            } else {
                setResponsesError(responsesData.reason?.message || 'Erreur de chargement des réponses')
            }

            if (eventsData.status === 'fulfilled') {
                let finalEvents = eventsData.value

                // Ajouter eventFromUrl à la liste seulement si :
                // 1. Il existe
                // 2. Il n'est pas déjà dans la liste
                // 3. L'utilisateur n'a pas encore de réponse pour cet événement
                // (protection : si l'utilisateur a déjà une réponse, l'événement devrait déjà être dans la liste)
                if (eventFromUrl && !finalEvents.some((e: Event) => e.id === eventFromUrl.id)) {
                    const hasResponse = loadedResponses.some((r: UserResponse) => r.eventId === eventFromUrl.id && r.userId === currentUserId)
                    if (!hasResponse) {
                        finalEvents = [...finalEvents, eventFromUrl]
                    }
                }

                setEvents(finalEvents)
                setEventsError(null)
                setEventsReady(true)  // Marquer les events comme prêts
                console.log(`✅ [DataContext] ${finalEvents.length} allEvents chargés (Discover/Calendar)`)
            } else {
                setEvents([])
                setEventsError(eventsData.reason?.message || 'Erreur de chargement des événements')
                // Ne pas marquer eventsReady en cas d'erreur
            }

            if (myEventsData.status === 'fulfilled') {
                setMyEvents(myEventsData.value)
                setMyEventsError(null)
                console.log(`✅ [DataContext] ${myEventsData.value.length} myEvents chargés (Profile)`)
            } else {
                setMyEventsError(myEventsData.reason?.message || 'Erreur de chargement de mes événements')
            }

            if (usersData.status === 'fulfilled') {
                setUsers(usersData.value)
                setUsersError(null)
            } else if (!isVisitor) {
                setUsersError(usersData.reason?.message || 'Erreur de chargement des utilisateurs')
            }

            if (relationsData.status === 'fulfilled') {
                setUserRelations(relationsData.value)
                setRelationsError(null)
            } else if (!isVisitor) {
                setRelationsError(relationsData.reason?.message || 'Erreur de chargement des relations')
            }

            // Charger la bibliothèque globale des tags depuis l'API
            if (eventsData.status === 'fulfilled') {
                try {
                    const tagsData = await fomoData.getAllTags()
                    setTags(tagsData)
                    console.log(`✅ [DataContext] ${tagsData.length} tags chargés depuis la bibliothèque globale`)
                } catch (error) {
                    console.error('❌ [DataContext] Erreur chargement tags:', error)
                    setTags([])
                }
            }

            setDataReady(true)

        } catch (error) {
            console.error('❌ [DataContext] Erreur de chargement:', error)
            // Mettre dataReady=true même en cas d'erreur pour permettre l'affichage d'un message d'erreur
            setDataReady(true)
            // Définir une erreur globale si pas déjà définie (vérifier si eventsError est null)
            setEventsError(prev => prev || 'Erreur de chargement des données')
        } finally {
            setIsLoading(false)
        }
    }, [currentUserId, isVisitor, isPublicMode, fomoData])

    // Charger les données quand les conditions sont remplies
    useEffect(() => {
        // Charger les données (gestion d'erreur dans loadData() qui met dataReady=true même en cas d'erreur)
        loadData().catch((error) => {
            // Erreur déjà gérée dans loadData() qui met dataReady=true
            // Ici on log juste pour le debug
            console.error('❌ [DataContext] Erreur lors du chargement (useEffect):', error)
        })
    }, [loadData])

    // ===== REFRESH =====
    const refreshAll = useCallback(async () => {
        await loadData()
    }, [loadData])

    // Recharger uniquement les relations utilisateur (plus léger que refreshAll)
    const refreshRelations = useCallback(async () => {
        if (isVisitor || !user?.id) return

        try {
            const relationsData = await fomoData.getUserRelations(user.id)
            setUserRelations(relationsData)
            setRelationsError(null)
        } catch (error) {
            console.error('❌ [DataContext] Erreur lors du rechargement des relations:', error)
            setRelationsError(error instanceof Error ? error.message : 'Erreur de chargement des relations')
        }
    }, [isVisitor, user?.id, fomoData])

    // ===== ACTIONS UTILISATEUR =====

    const createEvent = useCallback(async (eventData: Omit<Event, 'id'>): Promise<Event | null> => {
        if (isVisitor) {
            console.error('❌ [DataContext] Visitors cannot create events')
            return null
        }

        // Créer un événement temporaire pour la mise à jour optimiste
        const tempEvent: Event = {
            ...eventData,
            id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
        }

        // Mise à jour optimiste
        updateEventInLists('add', tempEvent)

        try {
            const newEvent = await fomoData.createEvent(eventData)

            // Recharger myEvents depuis le backend pour avoir les vraies données
            try {
                const myEventsResponse = await fetch(`${getApiBaseUrl()}/events/my?userId=${currentUserId}`)
                const myEventsData = await myEventsResponse.json()
                if (myEventsData.success) {
                    setMyEvents(myEventsData.data)
                }
            } catch (reloadError) {
                console.error('Erreur lors du rechargement de myEvents:', reloadError)
                // En cas d'erreur, remplacer quand même l'événement temporaire par le réel
                updateEventInLists('remove', tempEvent.id)
                updateEventInLists('add', newEvent)
            }

            return newEvent
        } catch (error) {
            console.error('Erreur lors de la création de l\'événement:', error)
            // Rollback
            updateEventInLists('remove', tempEvent.id)
            return null
        }
    }, [fomoData, isVisitor, updateEventInLists, currentUserId])

    const updateEvent = useCallback(async (eventId: string, eventData: Event): Promise<Event | null> => {
        if (isVisitor) {
            console.error('❌ [DataContext] Visitors cannot update events')
            return null
        }

        const previousEvent = events.find(e => e.id === eventId)

        // Mise à jour optimiste
        fomoData.updateEventInCache(eventId, eventData)
        updateEventInLists('update', eventId, eventData)

        try {
            const updatedEvent = await fomoData.updateEvent(eventId, eventData)
            if (updatedEvent) {
                fomoData.updateEventInCache(eventId, updatedEvent)
                updateEventInLists('update', eventId, updatedEvent)
            }
            return updatedEvent
        } catch (error) {
            console.error('Erreur lors de la mise à jour de l\'événement:', error)
            // Rollback
            if (previousEvent) {
                fomoData.updateEventInCache(eventId, previousEvent)
                updateEventInLists('update', eventId, previousEvent)
            }
            return null
        }
    }, [fomoData, events, isVisitor, updateEventInLists])

    /**
     * Ajouter ou mettre à jour une réponse à un événement.
     * 
     * IMPORTANT : Cette fonction fonctionne même si le user n'a pas encore de nom ou n'existe pas encore dans le backend.
     * Pour les visitors, la réponse est sauvegardée avec leur ID unique (même sans nom), permettant à l'hôte de voir
     * la réponse immédiatement. Le nom peut être ajouté plus tard via le formulaire de registration.
     * 
     * C'est le "meilleur des deux mondes" : réponse sauvegardée + pas de frustration UX.
     */
    const addEventResponse = useCallback((
        eventId: string,
        finalResponse: UserResponseValue,
        options?: {
            targetUserId?: string
            invitedByUserId?: string
            initialResponse?: UserResponseValue  // Source d'origine (linked/invited) si différente de finalResponse
        }
    ) => {
        const effectiveUserId = options?.targetUserId || currentUserId

        if (!effectiveUserId) {
            console.log('❌ [DataContext] No user ID, aborting')
            return
        }

        // Utiliser initialResponse si fourni, sinon utiliser finalResponse (comportement par défaut)
        // Cela permet de créer des réponses avec initialResponse="linked" et finalResponse="participe"
        const initialResponse = options?.initialResponse ?? finalResponse

        console.log(`📝 [DataContext] addEventResponse pour event ${eventId}, user ${effectiveUserId}, ${initialResponse} → ${finalResponse}`)

        // Mise à jour optimiste
        const optimisticResponse: UserResponse = {
            id: `temp-${Date.now()}-${Math.random()}`,
            userId: effectiveUserId,
            eventId,
            initialResponse,
            finalResponse,
            createdAt: new Date().toISOString(),
            invitedByUserId: options?.invitedByUserId
        }
        setResponses(prev => [...prev, optimisticResponse])

        // Appel API (batché)
        fomoData.addOrUpdateResponse(
            effectiveUserId,
            eventId,
            initialResponse,
            finalResponse,
            options?.invitedByUserId ? 'invitation' : 'direct',
            options?.invitedByUserId
        ).catch((error: Error) => {
            console.error('❌ [DataContext] Erreur lors de l\'ajout de réponse:', error)
            // Rollback
            setResponses(prev => prev.filter(r => r.id !== optimisticResponse.id))
        })
    }, [currentUserId, fomoData])

    const sendFriendshipRequest = useCallback(async (toUserId: string): Promise<boolean> => {
        if (!user?.id) return false

        // Trouver l'utilisateur cible dans la liste des users pour la mise à jour optimiste
        const targetUser = users.find(u => u.id === toUserId)

        // Garder une référence à l'état précédent pour le rollback
        let previousRelation: Friend | undefined
        const tempFriendshipId = `temp-${Date.now()}-${Math.random()}`

        // Mise à jour optimiste : ajouter la relation avec status 'pending' si l'utilisateur existe
        if (targetUser) {
            const existingRelation = userRelations.find(rel => rel.id === toUserId)
            previousRelation = existingRelation

            const optimisticFriendship: Friend = {
                ...targetUser,
                friendship: {
                    id: tempFriendshipId,
                    userId1: user.id,
                    userId2: toUserId,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    initiatedBy: user.id
                }
            }
            setUserRelations(prev => {
                // Vérifier si la relation existe déjà
                const exists = prev.some(rel => rel.id === toUserId)
                if (exists) {
                    // Mettre à jour la relation existante
                    return prev.map(rel =>
                        rel.id === toUserId
                            ? optimisticFriendship
                            : rel
                    )
                }
                // Ajouter la nouvelle relation
                return [...prev, optimisticFriendship]
            })
        }

        try {
            const result = await fomoData.sendFriendshipRequest(user.id, toUserId)
            if (result) {
                // Recharger uniquement les relations (pas toutes les données)
                await refreshRelations()
            } else {
                // Rollback en cas d'échec
                if (targetUser) {
                    setUserRelations(prev => {
                        if (previousRelation) {
                            // Restaurer la relation précédente
                            return prev.map(rel =>
                                rel.id === toUserId ? previousRelation! : rel
                            )
                        } else {
                            // Supprimer la relation optimiste qu'on vient d'ajouter
                            return prev.filter(rel =>
                                rel.id !== toUserId || rel.friendship?.id !== tempFriendshipId
                            )
                        }
                    })
                }
            }
            return result
        } catch (error) {
            console.error('Erreur lors de l\'envoi de la demande d\'amitié:', error)
            // Rollback en cas d'erreur
            if (targetUser) {
                setUserRelations(prev => {
                    if (previousRelation) {
                        // Restaurer la relation précédente
                        return prev.map(rel =>
                            rel.id === toUserId ? previousRelation! : rel
                        )
                    } else {
                        // Supprimer la relation optimiste qu'on vient d'ajouter
                        return prev.filter(rel =>
                            rel.id !== toUserId || rel.friendship?.id !== tempFriendshipId
                        )
                    }
                })
            }
            return false
        }
    }, [user?.id, fomoData, users, userRelations, refreshRelations])

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

        try {
            fomoData.addFriendshipAction(user.id, type, friendshipId, toUserId)
            await fomoData.savePendingActions()
            fomoData.invalidateUserCache(user.id)
            const relation = userRelations.find(r => r.friendship?.id === friendshipId)
            if (relation && relation.id !== user.id) {
                fomoData.invalidateUserCache(relation.id)
            }
            // Recharger uniquement les relations (pas toutes les données)
            await refreshRelations()
        } catch (error) {
            console.error('Erreur lors de l\'action d\'amitié:', error)
            fomoData.invalidateUserCache(user.id)
            // Recharger uniquement les relations en cas d'erreur aussi
            await refreshRelations()
        }
    }, [user?.id, fomoData, refreshRelations, userRelations])

    // ===== SOURCES INITIALES =====
    // Récupère la source d'origine (linked/invited) pour un événement donné.
    // Cette fonction est utilisée par EventCard.getLocalResponse() pour déterminer
    // l'initialResponse quand l'utilisateur n'a pas encore créé de réponse dans le backend.
    const getInitialResponseSource = useCallback((eventId: string): 'linked' | 'invited' | null => {
        return initialResponseSources.get(eventId) || null
    }, [initialResponseSources])

    // Note: searchUsers, matchByEmail, updateUser, getUserEvents, getUserById, searchAddresses
    // sont maintenant accessibles directement via useFomoData() dans les composants

    // ===== ÉTATS GLOBAUX =====

    const hasError = !!(eventsError || usersError || responsesError || relationsError || eventFromUrlError)

    // ===== CONTEXT VALUE (PAS DE USEMEMO INUTILE) =====

    const value: DataContextType = {
        // State global
        events,  // allEventsSource (Discover/Calendar)
        myEvents,  // myEventsSource (Profile)
        users,
        responses,
        userRelations,
        tags,

        // Erreurs
        eventsError,
        myEventsError,
        usersError,
        responsesError,
        relationsError,

        // Identité
        currentUserId,
        currentUserName,
        isVisitor,

        // Refresh
        refreshAll,
        refreshRelations,

        // Mutations UI
        createEvent,
        updateEvent,
        addEventResponse,
        sendFriendshipRequest,
        addFriendshipAction,

        // Sources initiales
        getInitialResponseSource,

        // Event depuis URL
        eventFromUrl,
        eventFromUrlError,

        // États
        isLoading,
        hasError,
        dataReady,
        eventsReady,
    }

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    )
}

// Note: La fonction calculateTags() a été supprimée car les tags sont maintenant
// chargés directement depuis l'API /api/tags (bibliothèque globale)
// Le FilterBar calcule ses propres tags via groupAndCountEventsByTag() depuis filterTools

// ===== HOOK =====

export const useDataContext = (): DataContextType => {
    const context = useContext(DataContext)
    if (context === undefined) {
        throw new Error('useDataContext must be used within a DataProvider')
    }
    return context
}

export default DataContext

