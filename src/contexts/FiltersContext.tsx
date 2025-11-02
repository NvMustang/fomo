/**
 * Filters Context - Gestion des filtres globaux
 * 
 * Gère les filtres de recherche, catégories et plages horaires
 * avec persistence localStorage SANS useEffect
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'
import { useFomoDataContext } from './FomoDataProvider'
import { useAuth } from './AuthContext'
import { usePrivacy } from './PrivacyContext'

// ===== TYPES =====
import type { Event, Periods, UserResponseValue, CalendarPeriod, Friend, UserResponse } from '@/types/fomoTypes'
import {
    groupEventsByCalendarPeriod,
    groupEventsByUserResponse,
    groupUsersByResponses,
    groupUsersByFriendships,
    intersectEventIds,
    matchOnline,
    matchPublic,
    matchQuery,
    matchTags,
    matchOrganizer,
    userResponsesMapper
} from '@/utils/filterTools'

interface Filters {
    searchQuery: string
    period: Periods
    tags: string[]
    organizerId?: string
    response?: UserResponseValue
    showHiddenEvents: boolean
    hideRejectedEvents: boolean
}

interface FiltersContextType {
    filters: Filters
    setFilters: (filters: Filters | ((prev: Filters) => Filters)) => void

    // Tronc commun
    getEventsByPrivacy: () => Event[]
    getOnlineEvents: () => Event[]
    getOnlineEventsGroupedByPeriods: () => { periods: CalendarPeriod[]; totalEvents: number }
    getOnlineEventsGroupedByResponses: () => {
        going: Event[]
        interested: Event[]
        not_interested: Event[]
        seen: Event[]
        cleared: Event[]
        invited: Event[]
        null: Event[]
    }

    // Branches
    getCalendarEvents: () => { events: Event[]; totalCount: number; filteredCount: number; isLoading: boolean; hasError: boolean }
    getDiscoverEvents: () => { events: Event[]; totalCount: number; filteredCount: number; isLoading: boolean; hasError: boolean }
    getLocalDiscoverEvents: () => { events: Event[]; totalCount: number; filteredCount: number; isLoading: boolean; hasError: boolean }
    getMyEvents: () => Event[]
    getProfileEventsGroupedByPeriods: () => { periods: CalendarPeriod[]; totalEvents: number }

    // Fonctions de filtrage pour FilterBar
    filterByQuery: (events: Event[], query: string) => Set<string>
    filterByOrganizer: (events: Event[], organizerId: string) => Set<string>
    filterByTags: (events: Event[], tags: string[]) => Set<string>
    filterByPeriod: (events: Event[], period: Periods) => Set<string>
    filterByResponse: (events: Event[], response: UserResponseValue) => Set<string>

    // Suggestions pour FilterBar
    getLocalPeriods: () => Periods[]
    getLocalResponses: () => UserResponseValue[]
    getLocalOrganizers: () => { value: string; label: string }[]
    getLocalTags: () => { value: string; label: string }[]

    // Fonctions pour les invitations
    getFriends: (userId: string) => Friend[]
    getFriendsGroupedByFrienship: (userId: string) => {
        activeFriends: Friend[]
        pendingFriends: Friend[]
        sentRequests: Friend[]
        blockedUsers: Friend[]
    }
    getGuests: (eventId: string) => UserResponse[]
    getGuestsGroupedByResponse: (eventId: string) => {
        invited: UserResponse[]
        going: UserResponse[]
        interested: UserResponse[]
        not_interested: UserResponse[]
        seen: UserResponse[]
        cleared: UserResponse[]
        null: UserResponse[]
    }
}

// ===== CONTEXT =====

const FiltersContext = createContext<FiltersContextType | undefined>(undefined)

// ===== PROVIDER =====

interface FiltersProviderProps {
    children: ReactNode
}

export const FiltersProvider: React.FC<FiltersProviderProps> = ({ children }) => {
    // Initialiser les filtres depuis localStorage (1 seule fois au montage)
    const [filters, setFiltersState] = useState<Filters>(() => {
        try {
            const savedFilters = localStorage.getItem('fomo-filters')
            if (savedFilters) {
                const parsed = JSON.parse(savedFilters)
                // Forcer au démarrage: masquer les "masqués" et les "refusés"
                return {
                    ...parsed,
                    showHiddenEvents: false,
                    hideRejectedEvents: true
                }
            }
        } catch (error) {
            console.warn('Erreur lors du chargement des filtres depuis localStorage:', error)
        }
        // Valeurs par défaut
        return {
            searchQuery: '',
            period: 'all',
            tags: ['all'],
            organizerId: undefined,
            response: undefined,
            showHiddenEvents: false,
            hideRejectedEvents: true,
        }
    })

    // Importer les contextes nécessaires pour le filtrage
    const { events, eventsError, dataReady, responses, userRelations } = useFomoDataContext()
    const { user } = useAuth()
    const { isPublicMode } = usePrivacy()

    // Setter custom qui sauvegarde dans localStorage SANS useEffect
    const setFilters = useCallback((newFilters: Filters | ((prev: Filters) => Filters)) => {
        setFiltersState(prev => {
            const updated = typeof newFilters === 'function' ? newFilters(prev) : newFilters

            // Sauvegarder directement dans localStorage (pas de useEffect)
            try {
                localStorage.setItem('fomo-filters', JSON.stringify(updated))
            } catch (error) {
                console.warn('Erreur lors de la sauvegarde des filtres dans localStorage:', error)
            }

            return updated
        })
    }, [])

    // ===== TRONC COMMUN =====

    /**
     * Filtre les événements selon isPublic uniquement.
     * 
     * Architecture :
     * Filtre par isPublic selon PrivacyContext (public ou privé)
     * 
     * @returns Les événements filtrés par privacy (online et offline)
     */
    const getEventsByPrivacy = useCallback((): Event[] => {
        if (!dataReady || !events || events.length === 0) return []

        // Filtrer par isPublic selon PrivacyContext
        // isPublicMode = true → afficher uniquement les événements publics
        // isPublicMode = false → afficher uniquement les événements privés
        const eventsByPrivacy = events.filter(e => matchPublic(e, isPublicMode))

        return eventsByPrivacy
    }, [dataReady, events, isPublicMode])

    /**
     * Filtre les événements par isOnline.
     * 
     * Filtre eventsByPrivacy pour ne garder que les événements online.
     * 
     * @returns Les événements online uniquement
     */
    const getOnlineEvents = useCallback((): Event[] => {
        const eventsByPrivacy = getEventsByPrivacy()
        return eventsByPrivacy.filter(e => matchOnline(e, true))
    }, [getEventsByPrivacy])

    /**
     * Groupe les événements online selon les périodes calendaires.
     * 
     * @returns Groupes d'événements online par période (today, tomorrow, etc.)
     */
    const getOnlineEventsGroupedByPeriods = useCallback(() => {
        const onlineEvents = getOnlineEvents()
        return groupEventsByCalendarPeriod(onlineEvents)
    }, [getOnlineEvents])

    /**
     * Groupe les événements online selon les réponses utilisateur.
     * 
     * @returns Groupes d'événements online par type de réponse (going, interested, etc.)
     */
    const getOnlineEventsGroupedByResponses = useCallback(() => {
        const onlineEvents = getOnlineEvents()
        if (onlineEvents.length === 0) {
            return {
                going: [],
                interested: [],
                not_interested: [],
                seen: [],
                cleared: [],
                invited: [],
                null: []
            }
        }

        // Construire le dictionnaire userResponses pour le groupement
        const userResponsesMap = userResponsesMapper(onlineEvents, responses, user?.id)

        return groupEventsByUserResponse(onlineEvents, userResponsesMap)
    }, [getOnlineEvents, responses, user?.id])


    // ===== BRANCHES =====

    /**
     * Calendrier : Retourne tous les événements online avec seulement les réponses "going" et "interested".
     * Groupe les événements par période calendaire.
     * 
     * @returns Événements pour la page Calendar
     */
    const getCalendarEvents = useCallback(() => {
        if (!dataReady) {
            return {
                events: [],
                totalCount: 0,
                filteredCount: 0,
                isLoading: true,
                hasError: false
            }
        }

        if (eventsError) {
            return {
                events: [],
                totalCount: 0,
                filteredCount: 0,
                isLoading: false,
                hasError: true
            }
        }

        // Prendre going + interested depuis onlineEventsGroupedByResponses
        const responseGroups = getOnlineEventsGroupedByResponses()
        const goingEvents = responseGroups.going
        const interestedEvents = responseGroups.interested
        const calendarResponseEvents = [...goingEvents, ...interestedEvents]

        // Grouper par période
        const calendarGrouped = groupEventsByCalendarPeriod(calendarResponseEvents)

        // Aplatir pour retourner la liste d'événements
        const calendarEvents = calendarGrouped.periods.flatMap(p => p.events)

        return {
            events: calendarEvents,
            totalCount: calendarGrouped.totalEvents,
            filteredCount: calendarEvents.length,
            isLoading: false,
            hasError: false
        }
    }, [dataReady, eventsError, getOnlineEventsGroupedByResponses])

    /**
     * Discover : Retourne les événements online via intersection de :
     * - Périodes : onlineEventsGroupedByPeriods (all sauf past)
     * - Réponses : onlineEventsGroupedByResponses (exclut not_interested, et null si isPublicMode=false)
     * 
     * @returns Événements pour la page Discover (avant filtrage local)
     */
    const getDiscoverEvents = useCallback(() => {
        if (!dataReady) {
            return {
                events: [],
                totalCount: 0,
                filteredCount: 0,
                isLoading: true,
                hasError: false
            }
        }

        if (eventsError) {
            return {
                events: [],
                totalCount: 0,
                filteredCount: 0,
                isLoading: false,
                hasError: true
            }
        }

        // Récupérer les périodes (exclure 'past')
        const periodGroups = getOnlineEventsGroupedByPeriods()
        const periodsWithoutPast = periodGroups.periods.filter(p => p.key !== 'past')
        const periodEventIds = new Set(
            periodsWithoutPast.flatMap(p => p.events.map(e => e.id))
        )

        // Récupérer les réponses (exclure not_interested, et null si isPublicMode=false)
        const responseGroups = getOnlineEventsGroupedByResponses()
        const allowedResponseGroups: Event[] = [
            ...responseGroups.going,
            ...responseGroups.interested,
            ...responseGroups.seen,
            ...responseGroups.cleared,
            ...responseGroups.invited
        ]

        // Inclure null seulement si isPublicMode = true
        if (isPublicMode) {
            allowedResponseGroups.push(...responseGroups.null)
        }

        const responseEventIds = new Set(allowedResponseGroups.map(e => e.id))

        // Intersection entre périodes (all sauf past) et réponses (exclut not_interested, et null si isPublicMode=false)
        const intersectionIds = intersectEventIds(periodEventIds, responseEventIds)

        if (intersectionIds.length === 0) {
            return {
                events: [],
                totalCount: periodGroups.totalEvents,
                filteredCount: 0,
                isLoading: false,
                hasError: false
            }
        }

        // Récupérer les événements correspondants
        const intersectionIdSet = new Set(intersectionIds)
        const discoverEvents = allowedResponseGroups.filter(e => intersectionIdSet.has(e.id))

        return {
            events: discoverEvents,
            totalCount: periodGroups.totalEvents,
            filteredCount: discoverEvents.length,
            isLoading: false,
            hasError: false
        }
    }, [dataReady, eventsError, getOnlineEventsGroupedByPeriods, getOnlineEventsGroupedByResponses, isPublicMode])

    /**
     * Filtre les événements où l'utilisateur est organisateur.
     * Inclut les événements online et offline, filtrés uniquement par privacy puis par organizer.
     * 
     * @returns Événements créés par l'utilisateur (online + offline)
     */
    const getMyEvents = useCallback((): Event[] => {
        if (!user?.id) return []
        const eventsByPrivacy = getEventsByPrivacy()
        return eventsByPrivacy.filter(e => matchOrganizer(e, user.id))
    }, [getEventsByPrivacy, user?.id])

    /**
     * Groupe les événements de l'utilisateur par période calendaire.
     * 
     * @returns Groupes d'événements par période (today, tomorrow, etc.)
     */
    const getProfileEventsGroupedByPeriods = useCallback(() => {
        const myEvents = getMyEvents()
        return groupEventsByCalendarPeriod(myEvents)
    }, [getMyEvents])


    // ===== FONCTIONS DE FILTRAGE POUR FILTERBAR =====

    /**
     * Filtre les événements par requête de recherche textuelle.
     * Utilise matchQuery() sans parser.
     * 
     * @param events - Liste d'événements à filtrer
     * @param query - Requête de recherche
     * @returns Set d'IDs d'événements correspondants
     */
    const filterByQuery = useCallback((events: Event[], query: string): Set<string> => {
        if (!events || events.length === 0) return new Set<string>()
        const q = (query || '').trim()
        if (!q) return new Set(events.map(e => e.id))

        const filtered = events.filter(e => matchQuery(e, q))
        return new Set(filtered.map(e => e.id))
    }, [])

    /**
     * Filtre les événements par organisateur.
     * 
     * @param events - Liste d'événements à filtrer
     * @param organizerId - ID de l'organisateur
     * @returns Set d'IDs d'événements correspondants
     */
    const filterByOrganizer = useCallback((events: Event[], organizerId: string): Set<string> => {
        if (!events || events.length === 0) return new Set<string>()
        if (!organizerId || organizerId.trim() === '') return new Set(events.map(e => e.id))

        const filtered = events.filter(e => matchOrganizer(e, organizerId))
        return new Set(filtered.map(e => e.id))
    }, [])

    /**
     * Filtre les événements par tags.
     * 
     * @param events - Liste d'événements à filtrer
     * @param tags - Liste de tags à rechercher
     * @returns Set d'IDs d'événements correspondants
     */
    const filterByTags = useCallback((events: Event[], tags: string[]): Set<string> => {
        if (!events || events.length === 0) return new Set<string>()
        if (!tags || tags.length === 0 || tags.includes('all')) return new Set(events.map(e => e.id))

        const filtered = events.filter(e => matchTags(e, tags))
        return new Set(filtered.map(e => e.id))
    }, [])

    /**
     * Filtre les événements par période via intersection avec getOnlineEventsGroupedByPeriods.
     * Compare les événements fournis avec le groupe de période sélectionné.
     * 
     * @param events - Liste d'événements à filtrer
     * @param period - Période à filtrer (ex: 'tomorrow')
     * @returns Set d'IDs d'événements correspondants
     */
    const filterByPeriod = useCallback((events: Event[], period: Periods): Set<string> => {
        if (!events || events.length === 0) return new Set<string>()
        if (!period || period === 'all') return new Set(events.map(e => e.id))

        // Récupérer les événements de la période depuis les groupes
        const periodGroups = getOnlineEventsGroupedByPeriods()
        const periodData = periodGroups.periods.find(p => p.key === period)
        const periodEvents = periodData?.events || []

        // Intersection entre les événements fournis et ceux de la période
        const periodEventIds = new Set(periodEvents.map(e => e.id))
        const inputEventIds = new Set(events.map(e => e.id))
        const intersectionIds = intersectEventIds(periodEventIds, inputEventIds)

        return new Set(intersectionIds)
    }, [getOnlineEventsGroupedByPeriods])

    /**
     * Filtre les événements par réponse via intersection avec getOnlineEventsGroupedByResponses.
     * Compare les événements fournis avec le groupe de réponse sélectionné.
     * 
     * @param events - Liste d'événements à filtrer
     * @param response - Type de réponse à filtrer (ex: 'going', null pour nouveau)
     * @returns Set d'IDs d'événements correspondants
     */
    const filterByResponse = useCallback((events: Event[], response: UserResponseValue): Set<string> => {
        if (!events || events.length === 0) return new Set<string>()
        if (response === undefined) return new Set(events.map(e => e.id))

        // Récupérer les événements de la réponse depuis les groupes
        const responseGroups = getOnlineEventsGroupedByResponses()
        let responseEvents: Event[]
        if (response === null) {
            // "Nouveaux" : inclure les événements sans réponse (null) ET les événements invités (invited)
            responseEvents = [...responseGroups.null, ...responseGroups.invited]
        } else {
            responseEvents = responseGroups[response] || []
        }

        // Intersection entre les événements fournis et ceux de la réponse
        const responseEventIds = new Set(responseEvents.map((e: Event) => e.id))
        const inputEventIds = new Set(events.map(e => e.id))
        const intersectionIds = intersectEventIds(responseEventIds, inputEventIds)

        return new Set(intersectionIds)
    }, [getOnlineEventsGroupedByResponses])

    /**
     * Applique tous les filtres de FilterBar sur une liste d'événements.
     * Utilise intersectEventIds pour combiner les résultats de tous les filtres.
     * 
     * @param events - Liste d'événements à filtrer (généralement depuis getDiscoverEvents)
     * @returns Événements filtrés selon tous les critères de FilterBar
     */
    const getLocalCombinedFilters = useCallback((events: Event[]): Event[] => {
        if (!events || events.length === 0) return []

        // Appliquer chaque filtre et récupérer les Sets d'IDs
        const queryEventIds = filterByQuery(events, filters.searchQuery)
        const organizerEventIds = filters.organizerId
            ? filterByOrganizer(events, filters.organizerId)
            : undefined
        const tagsEventIds = filters.tags && filters.tags.length > 0 && !filters.tags.includes('all')
            ? filterByTags(events, filters.tags)
            : undefined
        const periodEventIds = filters.period && filters.period !== 'all'
            ? filterByPeriod(events, filters.period)
            : undefined

        // Gérer le filtrage par réponse
        // filterByResponse gère déjà null → inclut null + invited
        // Si 'cleared' est sélectionné (UI: "Non répondu"), inclure aussi 'seen'
        let responseEventIds: Set<string> | undefined = undefined
        if (filters.response !== undefined) {
            if (filters.response === 'cleared') {
                // "Non répondu" : inclure cleared ET seen
                const clearedIds = filterByResponse(events, 'cleared')
                const seenIds = filterByResponse(events, 'seen')
                // Union des deux Sets
                responseEventIds = new Set([...clearedIds, ...seenIds])
            } else {
                // Pour null, filterByResponse inclut déjà null + invited
                responseEventIds = filterByResponse(events, filters.response)
            }
        }

        // Intersection de tous les filtres actifs
        const intersectionIds = intersectEventIds(
            queryEventIds,
            organizerEventIds,
            tagsEventIds,
            periodEventIds,
            responseEventIds
        )

        if (intersectionIds.length === 0) return []

        // Retourner les événements correspondants
        const idSet = new Set(intersectionIds)
        return events.filter(e => idSet.has(e.id))
    }, [filters, filterByQuery, filterByOrganizer, filterByTags, filterByPeriod, filterByResponse])

    /**
     * Discover avec filtres locaux : Applique getLocalCombinedFilters sur le résultat de getDiscoverEvents.
     * Filtre également les événements privés selon les invitations.
     * 
     * @returns Événements Discover filtrés selon FilterBar et invitations
     */
    const getLocalDiscoverEvents = useCallback(() => {
        const base = getDiscoverEvents()

        if (base.isLoading || base.hasError) {
            return base
        }

        // Appliquer les filtres de FilterBar
        let localDiscoverEvents = getLocalCombinedFilters(base.events)

        // Filtrer les événements privés : inclure uniquement si l'utilisateur a une réponse valide
        if (user?.id) {
            const userResponseMap = new Map<string, UserResponseValue>()
            responses.forEach(r => {
                if (r.userId === user.id) {
                    userResponseMap.set(r.eventId, r.response)
                }
            })

            localDiscoverEvents = localDiscoverEvents.filter(e => {
                const userResponse = userResponseMap.get(e.id)
                // TODO: Corriger la logique de filtrage des événements privés
                // Si l'événement est public ou offline, toujours accessible
                if (e.isPublic === true || e.isOnline === false) {
                    return true
                }

                // Si l'événement est privé (isPublic === false) et online (isOnline === true)
                if (e.isPublic === false && e.isOnline === true) {
                    // Si l'utilisateur est l'organisateur, accessible
                    if (e.organizerId === user.id || e.organizerId === `amb_${user.id}`) {
                        return true
                    }

                    // Si l'utilisateur a une réponse valide, accessible
                    const validPrivateResponses: UserResponseValue[] = ['invited', 'going', 'interested', 'seen', 'cleared']
                    if (userResponse && validPrivateResponses.includes(userResponse)) {
                        return true
                    }

                    // Sinon, pas accessible
                    return false
                }

                // Par défaut, inclure (événements sans isPublic défini)
                return true
            })
        }

        return {
            events: localDiscoverEvents,
            totalCount: base.totalCount,
            filteredCount: localDiscoverEvents.length,
            isLoading: false,
            hasError: false
        }
    }, [getDiscoverEvents, getLocalCombinedFilters, user?.id, responses])

    // ===== SUGGESTIONS POUR FILTERBAR =====

    /**
     * Retourne les périodes disponibles dans localDiscoverEvents.
     * 
     * @returns Liste des périodes Periods présentes dans les événements locaux
     */
    const getLocalPeriods = useCallback((): Periods[] => {
        const { events } = getLocalDiscoverEvents()
        const grouped = groupEventsByCalendarPeriod(events)
        return grouped.periods
            .filter(p => p.events.length > 0)
            .map(p => p.key) as Periods[]
    }, [getLocalDiscoverEvents])

    /**
     * Retourne les réponses disponibles dans localDiscoverEvents.
     * 
     * @returns Liste des types de réponses présents dans les événements locaux
     */
    const getLocalResponses = useCallback((): UserResponseValue[] => {
        const { events } = getLocalDiscoverEvents()
        const responseGroups = getOnlineEventsGroupedByResponses()

        // Trouver quelles réponses sont présentes dans localDiscoverEvents
        const localEventIds = new Set(events.map(e => e.id))
        const availableResponses: UserResponseValue[] = []

        if (responseGroups.going.some(e => localEventIds.has(e.id))) availableResponses.push('going')
        if (responseGroups.interested.some(e => localEventIds.has(e.id))) availableResponses.push('interested')
        if (responseGroups.not_interested.some(e => localEventIds.has(e.id))) availableResponses.push('not_interested')
        if (responseGroups.seen.some(e => localEventIds.has(e.id))) availableResponses.push('seen')
        if (responseGroups.cleared.some(e => localEventIds.has(e.id))) availableResponses.push('cleared')
        // Note: "invited" n'est plus ajouté car il est intégré dans "Nouveaux" (null)

        // null pour les événements sans réponse ET les événements invités
        // Les événements "invited" sont traités comme "Nouveaux" (null) pour le filtrage
        const eventsWithResponses = new Set(
            [
                ...responseGroups.going,
                ...responseGroups.interested,
                ...responseGroups.not_interested,
                ...responseGroups.seen,
                ...responseGroups.cleared
                // Note: responseGroups.invited est intentionnellement exclu ici
                // car les événements "invited" doivent compter pour l'option "Nouveaux"
            ].map(e => e.id)
        )
        // Inclure null si :
        // 1. Il y a des événements sans réponse (null), OU
        // 2. Il y a des événements invités (invited)
        const hasNullEvents = events.some(e => !eventsWithResponses.has(e.id))
        const hasInvitedEvents = responseGroups.invited.some(e => localEventIds.has(e.id))
        if (hasNullEvents || hasInvitedEvents) availableResponses.push(null)

        return availableResponses
    }, [getLocalDiscoverEvents, getOnlineEventsGroupedByResponses])

    /**
     * Retourne les organisateurs disponibles dans localDiscoverEvents.
     * 
     * @returns Liste des organisateurs avec value et label
     */
    const getLocalOrganizers = useCallback(() => {
        const { events } = getLocalDiscoverEvents()
        const unique = new Map<string, string>()
        for (const e of events) {
            const id = e.organizerId
            const label = e.organizerName || e.organizerId
            if (!id || !label) continue
            if (!unique.has(id)) unique.set(id, label)
        }
        return Array.from(unique.entries())
            .map(([value, label]) => ({ value, label }))
            .slice(0, 50)
    }, [getLocalDiscoverEvents])

    /**
     * Retourne les tags disponibles dans localDiscoverEvents.
     * 
     * @returns Liste des tags avec value, label et count (nombre d'occurrences), triés par fréquence
     */
    const getLocalTags = useCallback(() => {
        const { events } = getLocalDiscoverEvents()
        const freq = new Map<string, number>()
        for (const e of events) {
            for (const t of (e.tags || [])) {
                const tag = (t || '').trim()
                if (!tag) continue
                freq.set(tag, (freq.get(tag) || 0) + 1)
            }
        }
        return Array.from(freq.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([tag, count]) => ({ value: tag, label: tag, count }))
            .slice(0, 4)
    }, [getLocalDiscoverEvents])

    // ===== FONCTIONS POUR LES INVITATIONS =====

    /**
     * Retourne les amis actifs d'un utilisateur.
     * 
     * @param userId - ID de l'utilisateur
     * @returns Liste des amis actifs (Friend[])
     */
    const getFriends = useCallback((userId: string): Friend[] => {
        if (!userRelations || userRelations.length === 0) return []
        return userRelations.filter(relation => {
            const friendship = relation.friendship
            if (!friendship || friendship.status !== 'active') return false
            // Vérifier que l'utilisateur est impliqué dans cette relation d'amitié
            const isInvolved = friendship.userId1 === userId || friendship.userId2 === userId
            // Exclure l'utilisateur lui-même (son propre ID ne peut pas être dans les deux côtés)
            return isInvolved && relation.id !== userId
        })
    }, [userRelations])

    /**
     * Retourne les guests (invités) d'un événement.
     * getGuests = intersection entre getFriends et getUserResponses (going, interested, not_interested, seen, cleared, invited)
     * 
     * @param eventId - ID de l'événement
     * @returns Liste des UserResponse pour les guests (amis qui ont répondu)
     */
    const getGuests = useCallback((eventId: string): UserResponse[] => {
        if (!user?.id || !responses || responses.length === 0) return []

        // Obtenir les amis actifs
        const friends = getFriends(user.id)
        const friendIds = new Set(friends.map(f => f.id))

        // Obtenir les réponses pour cet événement avec les types valides
        const validResponses: UserResponseValue[] = ['going', 'interested', 'not_interested', 'seen', 'cleared', 'invited']
        const eventResponses = responses.filter(r =>
            r.eventId === eventId &&
            r.response &&
            validResponses.includes(r.response)
        )

        // Utiliser intersectEventIds pour calculer l'intersection
        // Créer un Set des userIds des réponses (explicitement Set<string>)
        const responseUserIds = new Set<string>(eventResponses.map(r => r.userId))
        const intersectionIds = intersectEventIds(friendIds, responseUserIds)

        // Retourner les UserResponse correspondants
        return eventResponses.filter(r => intersectionIds.includes(r.userId))
    }, [user?.id, responses, getFriends])

    /**
     * Retourne les amis groupés par statut d'amitié (actifs, en attente reçus, en attente envoyés).
     * 
     * @param userId - ID de l'utilisateur
     * @returns Objet avec groupes par statut d'amitié
     */
    const getFriendsGroupedByFrienship = useCallback((userId: string) => {
        if (!userRelations || userRelations.length === 0) {
            return {
                activeFriends: [] as Friend[],
                pendingFriends: [] as Friend[],
                sentRequests: [] as Friend[],
                blockedUsers: [] as Friend[]
            }
        }
        return groupUsersByFriendships(userRelations, userId)
    }, [userRelations])

    /**
     * Retourne les guests d'un événement groupés par type de réponse.
     * 
     * @param eventId - ID de l'événement
     * @returns Objet avec groupes par type de réponse
     */
    const getGuestsGroupedByResponse = useCallback((eventId: string) => {
        if (!user?.id) {
            return {
                invited: [] as UserResponse[],
                going: [] as UserResponse[],
                interested: [] as UserResponse[],
                not_interested: [] as UserResponse[],
                seen: [] as UserResponse[],
                cleared: [] as UserResponse[],
                null: [] as UserResponse[]
            }
        }
        const guests = getGuests(eventId)
        return groupUsersByResponses(guests)
    }, [user?.id, getGuests])

    // Stabiliser la value du context pour éviter les re-renders
    const value = useMemo(() => ({
        filters,
        setFilters,
        // Tronc commun
        getEventsByPrivacy,
        getOnlineEvents,
        getOnlineEventsGroupedByPeriods,
        getOnlineEventsGroupedByResponses,
        // Branches
        getCalendarEvents,
        getDiscoverEvents,
        getLocalDiscoverEvents,
        getMyEvents,
        getProfileEventsGroupedByPeriods,
        // Fonctions de filtrage
        filterByQuery,
        filterByOrganizer,
        filterByTags,
        filterByPeriod,
        filterByResponse,
        // Suggestions
        getLocalPeriods,
        getLocalResponses,
        getLocalOrganizers,
        getLocalTags,
        // Invitations
        getFriends,
        getFriendsGroupedByFrienship,
        getGuests,
        getGuestsGroupedByResponse
    }), [
        filters,
        setFilters,
        getEventsByPrivacy,
        getOnlineEvents,
        getOnlineEventsGroupedByPeriods,
        getOnlineEventsGroupedByResponses,
        getCalendarEvents,
        getDiscoverEvents,
        getLocalDiscoverEvents,
        getMyEvents,
        getProfileEventsGroupedByPeriods,
        filterByQuery,
        filterByOrganizer,
        filterByTags,
        filterByPeriod,
        filterByResponse,
        getLocalPeriods,
        getLocalResponses,
        getLocalOrganizers,
        getLocalTags,
        getFriends,
        getFriendsGroupedByFrienship,
        getGuests,
        getGuestsGroupedByResponse
    ])

    return (
        <FiltersContext.Provider value={value}>
            {children}
        </FiltersContext.Provider>
    )
}

// ===== HOOK =====

export const useFilters = (): FiltersContextType => {
    const context = useContext(FiltersContext)
    if (context === undefined) {
        throw new Error('useFilters must be used within a FiltersProvider')
    }
    return context
}
