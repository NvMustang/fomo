/**
 * Filters Context - Gestion des filtres globaux
 * 
 * Gère les filtres de recherche, catégories et plages horaires
 * SANS persistence (les filtres sont réinitialisés à chaque refresh)
 */

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'
import { useFomoDataContext } from './FomoDataProvider'
import { useAuth } from './AuthContext'
import { usePrivacy } from './PrivacyContext'

// ===== TYPES =====
import type { Event, Periods, UserResponseValue, CalendarPeriod, Friend, UserResponse } from '@/types/fomoTypes'
import {
    TIME_PERIODS,
    groupEventsByPeriods,
    groupEventsByUserResponse,
    groupUsersByResponses,
    groupUsersByFriendships,
    intersectEventIds,
    matchOnline,
    matchPublic,
    matchQuery,
    matchTags,
    matchOrganizer,
    userResponsesMapper,
    getUsersMapByIds,
    createEmptyGroups,
    type Groups
} from '@/utils/filterTools'

interface Filters {
    searchQuery: string
    period: Periods
    tags: string[]
    organizerId?: string
    response?: UserResponseValue
    showHiddenEvents: boolean
    hideRejectedEvents: boolean
    includePastEvents: boolean
}

interface FiltersContextType {
    filters: Filters
    setFilters: (filters: Filters | ((prev: Filters) => Filters)) => void

    // Tronc commun
    getEventsByPrivacy: () => Event[]
    getOnlineEvents: () => Event[]
    getOnlineEventsGroupedByPeriods: () => { periods: CalendarPeriod[]; totalEvents: number }
    getOnlineEventsGroupedByResponses: () => Groups<Event>

    // Branches
    getCalendarEvents: () => { events: Event[]; totalCount: number; filteredCount: number; isLoading: boolean; hasError: boolean }
    getDiscoverEvents: () => { events: Event[]; totalCount: number; filteredCount: number; isLoading: boolean; hasError: boolean }
    getMapEvents: () => Event[] // Source de vérité pour la carte : getDiscoverEvents() en mode public, événements avec réponses en mode private
    getAllMapEvents: (options?: { visitorEvent?: Event | null; fakeEvents?: Event[] }) => Event[] // Version unifiée incluant visitorEvent et fake pins selon le mode privacy (filtrage automatique avec matchPublic)
    getMyEvents: () => Event[]
    getProfileEventsGroupedByPeriods: () => { periods: CalendarPeriod[]; totalEvents: number }

    // Fonctions de filtrage pour FilterBar
    filterByQuery: (events: Event[], query: string) => Set<string>
    filterByOrganizer: (events: Event[], organizerId: string) => Set<string>
    filterByTags: (events: Event[], tags: string[]) => Set<string>
    filterByPeriod: (events: Event[], period: Periods) => Set<string>
    filterByResponse: (events: Event[], response: UserResponseValue) => Set<string>

    // Suggestions pour FilterBar
    getLocalPeriods: () => Array<{ value: Periods; label: string; count: number }>
    getLocalResponses: () => Array<{ value: UserResponseValue; label: string; count: number }>
    getLocalOrganizers: () => Array<{ value: string; label: string; count: number }>
    getLocalTags: () => Array<{ value: string; label: string; count: number }>

    // IDs filtrés pour MapLibre (pilotage des pins via setFilter)
    getMapFilterIds: () => string[]

    // Fonctions pour les invitations
    getFriends: (userId: string) => Friend[]
    getFriendsGroupedByFrienship: (userId: string) => {
        activeFriends: Friend[]
        pendingFriends: Friend[]
        sentRequests: Friend[]
        blockedUsers: Friend[]
    }
    getGuests: (eventId: string) => UserResponse[]
    getGuestsGroupedByResponse: (eventId: string) => Groups<UserResponse>
}

// ===== CONTEXT =====

const FiltersContext = createContext<FiltersContextType | undefined>(undefined)

// ===== PROVIDER =====

interface FiltersProviderProps {
    children: ReactNode
}

export const FiltersProvider: React.FC<FiltersProviderProps> = ({ children }) => {
    // Initialiser les filtres avec les valeurs par défaut (pas de persistence)
    // Nettoyer localStorage au démarrage pour supprimer les anciennes valeurs
    const [filters, setFiltersState] = useState<Filters>(() => {
        // Nettoyer localStorage au démarrage pour supprimer les anciennes valeurs persistées
        try {
            localStorage.removeItem('fomo-filters')
        } catch (error) {
            // Ignorer les erreurs de localStorage
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
            includePastEvents: false,
        }
    })

    // Importer les contextes nécessaires pour le filtrage
    const { events, eventsError, dataReady, responses, userRelations, users, getLatestResponsesByUser, currentUserId } = useFomoDataContext()
    const { user } = useAuth()
    const { isPublicMode } = usePrivacy()

    // Setter simple sans persistence (les filtres ne sont pas sauvegardés)
    const setFilters = useCallback((newFilters: Filters | ((prev: Filters) => Filters)) => {
        setFiltersState(prev => {
            const updated = typeof newFilters === 'function' ? newFilters(prev) : newFilters
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
        return events.filter(e => matchPublic(e, isPublicMode))
    }, [dataReady, events, isPublicMode])

    /**
     * Filtre les événements par isOnline.
     * Ne filtre PAS les événements passés ici (géré par les filtres).
     * 
     * Filtre eventsByPrivacy pour ne garder que les événements online.
     * 
     * @returns Les événements online uniquement (tous, passés inclus)
     */
    const getOnlineEvents = useCallback((): Event[] => {
        const eventsByPrivacy = getEventsByPrivacy()
        return eventsByPrivacy.filter(e => matchOnline(e, true))
    }, [getEventsByPrivacy])

    /**
     * Groupe les événements online selon les périodes calendaires.
     * Inclut toutes les périodes (y compris 'past').
     * 
     * @returns Groupes d'événements online par période (today, tomorrow, past, etc.)
     */
    const getOnlineEventsGroupedByPeriods = useCallback(() => {
        const onlineEvents = getOnlineEvents()
        return groupEventsByPeriods(onlineEvents)
    }, [getOnlineEvents])

    /**
     * Groupe les événements online selon les réponses utilisateur.
     * 
     * @returns Groupes d'événements online par type de réponse (going, interested, etc.)
     */
    const getOnlineEventsGroupedByResponses = useCallback((): Groups<Event> => {
        const onlineEvents = getOnlineEvents()
        if (onlineEvents.length === 0) {
            return createEmptyGroups<Event>()
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

        // Prendre going + participe + interested + maybe depuis onlineEventsGroupedByResponses
        const responseGroups = getOnlineEventsGroupedByResponses()
        const goingEvents = responseGroups.going
        const participeEvents = responseGroups.participe
        const interestedEvents = responseGroups.interested
        const maybeEvents = responseGroups.maybe
        const calendarResponseEvents = [...goingEvents, ...participeEvents, ...interestedEvents, ...maybeEvents]

        // Grouper par période
        const calendarGrouped = groupEventsByPeriods(calendarResponseEvents)

        // Aplatir pour retourner la liste d'événements
        const calendarEvents = calendarResponseEvents

        return {
            events: calendarEvents,
            totalCount: calendarGrouped.totalEvents,
            filteredCount: calendarEvents.length,
            isLoading: false,
            hasError: false
        }
    }, [dataReady, eventsError, getOnlineEventsGroupedByResponses])

    /**
     * Discover : Retourne TOUS les événements online (inclut past, present et future).
     * Inclut toutes les réponses utilisateur (y compris not_interested).
     * Source de vérité pour DiscoverPage et MapRenderer.
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

        // Source de vérité : filtrer directement par privacy puis par online
        // (pas besoin de passer par getOnlineEvents())
        const eventsByPrivacy = getEventsByPrivacy()
        const discoverEvents = eventsByPrivacy.filter(e => matchOnline(e, true))

        return {
            events: discoverEvents,
            totalCount: discoverEvents.length,
            filteredCount: discoverEvents.length,
            isLoading: false,
            hasError: false
        }
    }, [dataReady, eventsError, getEventsByPrivacy])

    /**
     * Source de vérité pour la carte (MapRenderer).
     * - Mode public : retourne tous les événements de getDiscoverEvents()
     * - Mode private : retourne uniquement les événements où l'utilisateur a une réponse (exclut chaîne vide)
     * 
     * Note : Les visiteurs sont gérés séparément dans DiscoverPage (filtre directement sur visitorEvent)
     * 
     * @returns Événements pour la carte selon le mode privacy
     */
    const getMapEvents = useCallback((): Event[] => {
        // Source de vérité : getDiscoverEvents()
        const discoverEvents = getDiscoverEvents().events

        if (isPublicMode) {
            // Mode public : retourner tous les événements de getDiscoverEvents()
            return discoverEvents
        } else {
            // Mode private : retourner uniquement les événements avec une réponse (exclut chaîne vide)
            // Utiliser currentUserId pour fonctionner avec visitor et user authentifié
            const userResponsesMap = userResponsesMapper(discoverEvents, responses, currentUserId || undefined)

            // Filtrer pour ne garder que les événements avec une réponse (userResponsesMapper retourne '' si pas de réponse)
            return discoverEvents.filter(e => {
                const response = userResponsesMap[e.id]
                return response !== ''
            })
        }
    }, [isPublicMode, getDiscoverEvents, responses, currentUserId])

    /**
     * Version unifiée de getMapEvents qui inclut le visitorEvent et les fake pins selon le mode privacy.
     * 
     * Logique unifiée :
     * - Mode public : retourne fakeEvents filtrés (si présents) OU tous les événements (getMapEvents)
     * - Mode privé : retourne visitorEvent (s'il existe) + événements avec réponse (getMapEvents), pas de fake pins
     * 
     * Le filtrage des fake events se fait automatiquement avec matchPublic() selon isPublicMode.
     * 
     * @param options - Options pour visitorEvent et fakeEvents
     * @returns Événements unifiés pour la carte selon le mode privacy
     */
    const getAllMapEvents = useCallback((options?: { visitorEvent?: Event | null; fakeEvents?: Event[] }): Event[] => {
        const { visitorEvent, fakeEvents = [] } = options || {}
        
        // Filtrer les fake events selon le mode privacy (utilise matchPublic comme pour les événements réels)
        const filteredFakeEvents = fakeEvents.filter(e => matchPublic(e, isPublicMode))
        
        // Mode public avec fake events : afficher uniquement les fake events filtrés
        if (isPublicMode && filteredFakeEvents.length > 0) {
            return filteredFakeEvents
        }
        
        // Récupérer les événements réels selon le mode privacy
        const realEvents = getMapEvents()
        
        // Inclure le visitorEvent s'il existe et n'est pas déjà dans realEvents (pour éviter les doublons)
        // En mode privé : toujours inclure le visitorEvent (car l'utilisateur a été invité)
        // En mode public : inclure le visitorEvent s'il n'est pas déjà dans la liste (cas où l'événement est privé)
        if (visitorEvent) {
            const visitorEventInRealEvents = realEvents.some(e => e.id === visitorEvent.id)
            if (!visitorEventInRealEvents) {
                return [visitorEvent, ...realEvents]
            }
        }
        
        // Retourner les événements réels (visitorEvent déjà inclus s'il était dans realEvents)
        return realEvents
    }, [isPublicMode, getMapEvents])

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
        return groupEventsByPeriods(myEvents)
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
            // Utiliser directement la clé de réponse (plus de conversion nécessaire)
            responseEvents = responseGroups[response as keyof typeof responseGroups] || []
        }

        // Intersection entre les événements fournis et ceux de la réponse
        const responseEventIds = new Set(responseEvents.map((e: Event) => e.id))
        const inputEventIds = new Set(events.map(e => e.id))
        const intersectionIds = intersectEventIds(responseEventIds, inputEventIds)

        return new Set(intersectionIds)
    }, [getOnlineEventsGroupedByResponses])

    /**
     * Retourne la liste des IDs d'événements correspondant à l'état courant des filtres.
     * Spécifique au pilotage de la carte: applique tous les filtres de FilterBar et retourne les IDs
     * (string[]) pour être utilisés dans MapLibre setFilter.
     */
    const getMapFilterIds = useCallback((): string[] => {
        // Utiliser getMapEvents() comme source de vérité (cohérent avec la carte)
        const events = getMapEvents()
        if (!events || events.length === 0) {
            return []
        }

        // 1) Appliquer chaque filtre et récupérer les Sets d'IDs (mêmes helpers que FilterBar)
        const queryEventIds = filterByQuery(events, filters.searchQuery)
        const organizerEventIds = filters.organizerId
            ? filterByOrganizer(events, filters.organizerId)
            : undefined
        const tagsEventIds = (filters.tags && filters.tags.length > 0 && !filters.tags.includes('all'))
            ? filterByTags(events, filters.tags)
            : undefined
        const periodEventIds = (filters.period && filters.period !== 'all')
            ? filterByPeriod(events, filters.period)
            : undefined

        // 2) Gérer le filtrage par réponse
        //    - 'cleared' = regrouper cleared ET seen (équivalent UI "Non répondu")
        //    - null = nouveaux (null) + invités (invited)
        let responseEventIds: Set<string> | undefined = undefined
        if (filters.response !== undefined) {
            if (filters.response === 'cleared') {
                const clearedIds = filterByResponse(events, 'cleared')
                const seenIds = filterByResponse(events, 'seen')
                responseEventIds = new Set([...clearedIds, ...seenIds])
            } else {
                responseEventIds = filterByResponse(events, filters.response)
            }
        }

        // 3) Intersection des filtres actifs → liste finale d'IDs
        let intersectionIds = intersectEventIds(
            queryEventIds,
            organizerEventIds,
            tagsEventIds,
            periodEventIds,
            responseEventIds
        )

        // 4) Exclure les événements passés si includePastEvents === false (sauf si period === 'past')
        if (!filters.includePastEvents && filters.period !== 'past') {
            const pastEventIds = filterByPeriod(events, 'past')
            const pastIdsArray = Array.from(pastEventIds)
            intersectionIds = intersectionIds.filter(id => !pastIdsArray.includes(id))
        }

        return intersectionIds
    }, [getMapEvents, filters, filterByQuery, filterByOrganizer, filterByTags, filterByPeriod, filterByResponse])

    // ===== SUGGESTIONS POUR FILTERBAR =====

    /**
     * Retourne les périodes disponibles parmi les événements visibles sur la carte.
     * Utilise getMapFilterIds() pour refléter uniquement les événements filtrés et affichés.
     * 
     * @returns Liste des périodes avec value, label et count (nombre d'événements par période)
     */
    const getLocalPeriods = useCallback((): Array<{ value: Periods; label: string; count: number }> => {
        // Source de vérité: getMapEvents() (cohérent avec la carte)
        const mapEvents = getMapEvents()
        if (!mapEvents || mapEvents.length === 0) {
            return []
        }

        // Filtrer selon les IDs visibles sur la carte (via MapLibre)
        const filteredIds = new Set(getMapFilterIds())
        const visibleEvents = mapEvents.filter((e: Event) => filteredIds.has(e.id))

        // Calculer les périodes disponibles parmi les événements visibles uniquement
        const grouped = groupEventsByPeriods(visibleEvents)
        const periodMap = new Map(TIME_PERIODS.map(p => [p.key, p.label]))

        // Exclure la période 'past' si includePastEvents === false (sauf si period === 'past')
        const filteredPeriods = grouped.periods.filter(p => {
            if (p.key === 'past' && !filters.includePastEvents && filters.period !== 'past') {
                return false
            }
            return p.events.length > 0
        })

        return filteredPeriods.map(p => ({
            value: p.key as Periods,
            label: periodMap.get(p.key) || p.label,
            count: p.events.length
        }))
    }, [getMapEvents, getMapFilterIds, filters.includePastEvents, filters.period])

    /**
     * Retourne les réponses disponibles parmi les événements visibles sur la carte.
     * Utilise getMapFilterIds() pour refléter uniquement les événements filtrés et affichés.
     * 
     * @returns Liste des types de réponses avec value, label et count (nombre d'événements par réponse)
     */
    const getLocalResponses = useCallback((): Array<{ value: UserResponseValue; label: string; count: number }> => {
        // Source de vérité: getMapEvents() (cohérent avec la carte)
        const mapEvents = getMapEvents()
        if (!mapEvents || mapEvents.length === 0) {
            return []
        }

        // Filtrer selon les IDs visibles sur la carte (via MapLibre)
        const filteredIds = new Set(getMapFilterIds())
        const visibleEvents = mapEvents.filter((e: Event) => filteredIds.has(e.id))

        // Obtenir les groupes de réponses (tous les événements online)
        const responseGroups = getOnlineEventsGroupedByResponses()

        // Trouver quelles réponses sont présentes parmi les événements visibles et compter
        const visibleEventIds = new Set(visibleEvents.map((e: Event) => e.id))
        const availableResponses: Array<{ value: UserResponseValue; label: string; count: number }> = []

        // Compter les événements going visibles
        const goingCount = responseGroups.going.filter(e => visibleEventIds.has(e.id)).length
        if (goingCount > 0) {
            availableResponses.push({ value: 'going', label: 'J\'y vais', count: goingCount })
        }

        // Compter les événements participe visibles
        const participeCount = responseGroups.participe.filter(e => visibleEventIds.has(e.id)).length
        if (participeCount > 0) {
            availableResponses.push({ value: 'participe', label: 'J\'y vais', count: participeCount })
        }

        // Compter les événements interested visibles
        const interestedCount = responseGroups.interested.filter(e => visibleEventIds.has(e.id)).length
        if (interestedCount > 0) {
            availableResponses.push({ value: 'interested', label: 'Intéressé', count: interestedCount })
        }

        // Compter les événements maybe visibles
        const maybeCount = responseGroups.maybe.filter(e => visibleEventIds.has(e.id)).length
        if (maybeCount > 0) {
            availableResponses.push({ value: 'maybe', label: 'Peut-être', count: maybeCount })
        }

        // Compter les événements not_interested visibles
        const notInterestedCount = responseGroups.not_interested.filter(e => visibleEventIds.has(e.id)).length
        if (notInterestedCount > 0) {
            availableResponses.push({ value: 'not_interested', label: 'Pas intéressé', count: notInterestedCount })
        }

        // Compter les événements not_there visibles
        const notThereCount = responseGroups.not_there.filter(e => visibleEventIds.has(e.id)).length
        if (notThereCount > 0) {
            availableResponses.push({ value: 'not_there', label: 'Pas là', count: notThereCount })
        }

        // Compter les événements seen + cleared visibles (regroupés en "Non répondu")
        const seenCount = responseGroups.seen.filter(e => visibleEventIds.has(e.id)).length
        const clearedCount = responseGroups.cleared.filter(e => visibleEventIds.has(e.id)).length
        const nonReponduCount = seenCount + clearedCount
        if (nonReponduCount > 0) {
            availableResponses.push({ value: 'cleared', label: 'Non répondu', count: nonReponduCount })
        }

        // null pour les événements sans réponse ET les événements invités (regroupés en "Nouveaux")
        const eventsWithResponses = new Set(
            [
                ...responseGroups.going,
                ...responseGroups.participe,
                ...responseGroups.interested,
                ...responseGroups.maybe,
                ...responseGroups.not_interested,
                ...responseGroups.not_there,
                ...responseGroups.seen,
                ...responseGroups.cleared
            ].map(e => e.id)
        )
        const nullEvents = visibleEvents.filter(e => !eventsWithResponses.has(e.id))
        const invitedCount = responseGroups.invited.filter(e => visibleEventIds.has(e.id)).length
        const nouveauxCount = nullEvents.length + invitedCount
        if (nouveauxCount > 0) {
            availableResponses.push({ value: null, label: 'Nouveaux', count: nouveauxCount })
        }

        return availableResponses
    }, [getMapEvents, getMapFilterIds, getOnlineEventsGroupedByResponses])

    /**
     * Retourne les organisateurs disponibles parmi les événements visibles sur la carte.
     * Exclut le filtre organisateur pour éviter les compteurs incorrects.
     * Récupère le nom de l'organisateur depuis la feuille Users via organizerId.
     * 
     * @returns Liste des organisateurs avec value, label et count (nombre d'événements par organisateur)
     */
    const getLocalOrganizers = useCallback((): Array<{ value: string; label: string; count: number }> => {
        // Source de vérité: getMapEvents() (cohérent avec la carte)
        const events = getMapEvents()
        if (!events || events.length === 0) {
            return []
        }

        // Appliquer tous les filtres SAUF le filtre organisateur pour avoir les bonnes options
        const queryEventIds = filterByQuery(events, filters.searchQuery)
        // Exclure organizerEventIds pour ne pas filtrer par organisateur
        const tagsEventIds = (filters.tags && filters.tags.length > 0 && !filters.tags.includes('all'))
            ? filterByTags(events, filters.tags)
            : undefined
        const periodEventIds = (filters.period && filters.period !== 'all')
            ? filterByPeriod(events, filters.period)
            : undefined

        // Gérer le filtrage par réponse
        let responseEventIds: Set<string> | undefined = undefined
        if (filters.response !== undefined) {
            if (filters.response === 'cleared') {
                const clearedIds = filterByResponse(events, 'cleared')
                const seenIds = filterByResponse(events, 'seen')
                responseEventIds = new Set([...clearedIds, ...seenIds])
            } else {
                responseEventIds = filterByResponse(events, filters.response)
            }
        }

        // Intersection des filtres (sans organisateur) → événements visibles pour compter les organisateurs
        const filteredIds = intersectEventIds(
            queryEventIds,
            tagsEventIds,
            periodEventIds,
            responseEventIds
        )
        const visibleEvents = events.filter((e: Event) => filteredIds.includes(e.id))

        // Récupérer tous les organizerId uniques des événements visibles
        const organizerIds = Array.from(new Set(
            visibleEvents
                .map(e => e.organizerId)
                .filter((id): id is string => !!id)
        ))

        // Récupérer uniquement les users correspondants aux organizerIds
        const organizersMap = getUsersMapByIds(users || [], organizerIds)

        // Compter les événements par organisateur parmi les événements visibles
        // Utiliser une Map pour éviter les doublons par organizerId
        const organizerCounts = new Map<string, { label: string; count: number }>()
        for (const e of visibleEvents) {
            const id = e.organizerId
            if (!id) continue

            // Récupérer le nom depuis la Map des users, sinon utiliser l'ID comme fallback
            const organizer = organizersMap.get(id)
            const organizerName = organizer?.name || id
            const current = organizerCounts.get(id)

            // Garder le premier label rencontré pour éviter les changements de label pour le même ID
            organizerCounts.set(id, {
                label: current?.label || organizerName, // Conserver le label existant ou utiliser le nouveau
                count: (current?.count || 0) + 1
            })
        }
        return Array.from(organizerCounts.entries())
            .map(([value, data]) => ({ value, label: data.label, count: data.count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 50)
    }, [getMapEvents, filters, filterByQuery, filterByTags, filterByPeriod, filterByResponse, users])

    /**
     * Retourne les tags disponibles parmi les événements visibles sur la carte.
     * Utilise getMapFilterIds() pour refléter uniquement les événements filtrés et affichés.
     * 
     * @returns Liste des tags avec value, label et count (nombre d'occurrences), triés par fréquence (limités aux événements visibles)
     */
    const getLocalTags = useCallback(() => {
        // Source de vérité: getMapEvents() (cohérent avec la carte)
        const mapEvents = getMapEvents()
        if (!mapEvents || mapEvents.length === 0) {
            return []
        }

        // Filtrer selon les IDs visibles sur la carte (via MapLibre)
        const filteredIds = new Set(getMapFilterIds())
        const visibleEvents = mapEvents.filter((e: Event) => filteredIds.has(e.id))

        // Compter la fréquence des tags parmi les événements visibles
        const freq = new Map<string, number>()
        for (const e of visibleEvents) {
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
    }, [getMapEvents, getMapFilterIds])

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
        // NOUVEAU SYSTÈME : Utiliser les helpers pour obtenir les dernières réponses par utilisateur
        const latestResponsesMap = getLatestResponsesByUser(eventId)
        const validResponses: UserResponseValue[] = ['going', 'interested', 'maybe', 'not_interested', 'not_there', 'seen', 'cleared', 'invited']
        const eventResponses = Array.from(latestResponsesMap.values()).filter(r =>
            r.finalResponse &&
            validResponses.includes(r.finalResponse)
        )

        // Utiliser intersectEventIds pour calculer l'intersection
        // Créer un Set des userIds des réponses (explicitement Set<string>)
        const responseUserIds = new Set<string>(eventResponses.map(r => r.userId))
        const intersectionIds = intersectEventIds(friendIds, responseUserIds)

        // Retourner les UserResponse correspondants
        return eventResponses.filter(r => intersectionIds.includes(r.userId))
    }, [user?.id, responses, getFriends, getLatestResponsesByUser])

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
    const getGuestsGroupedByResponse = useCallback((eventId: string): Groups<UserResponse> => {
        if (!user?.id) {
            return createEmptyGroups<UserResponse>()
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
        getMapEvents,
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
        // MapLibre
        getMapFilterIds,
        // Invitations
        getFriends,
        getFriendsGroupedByFrienship,
        getGuests,
        getGuestsGroupedByResponse,
        getAllMapEvents
    }), [
        filters,
        setFilters,
        getEventsByPrivacy,
        getOnlineEvents,
        getOnlineEventsGroupedByPeriods,
        getOnlineEventsGroupedByResponses,
        getCalendarEvents,
        getDiscoverEvents,
        getMapEvents,
        getAllMapEvents,
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
        getMapFilterIds,
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
