/**
 * useFilters - Hook pour filtrer les événements
 * 
 * SIMPLIFIÉ : Gère UNIQUEMENT les filtres UI et groupements
 * Les données (events/myEvents) sont utilisées directement depuis DataContext
 */

import { useCallback } from 'react'
import { useDataContext } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import { useFiltersContext, type Filters } from '@/contexts/FiltersContext'

// Ré-exporter Filters pour compatibilité
export type { Filters }

import type { Event, UserResponseValue, CalendarPeriod, Friend, UserResponse } from '@/types/fomoTypes'
import {
    groupEventsByPeriods,
    groupEventsByResponses,
    groupUsersByResponses,
    groupUsersByFriendships,
    createEmptyGroups,
    userResponsesMapper,
    applyFilters,
    groupAndCountEventsByTag,
    groupAndCountEventsByOrganizer,
    groupAndCountEventsByResponse,
    groupAndCountEventsByPeriod,
    type Groups
} from '@/utils/filterTools'

export const useFilters = () => {
    const { filters, setFilters } = useFiltersContext()
    const { responses, userRelations, users, currentUserId, dataReady } = useDataContext()
    const { user } = useAuth()

    // ===== FILTRAGE =====

    const applyCurrentFilters = useCallback((baseEvents: Event[]): Event[] => {
        const effectiveUserId = currentUserId || user?.id

        // ⚠️ Utiliser groupAndCountEventsByPeriod pour grouper par période
        // Puis exclure le groupe "past" si excludePastEvents est true
        const { groups } = groupAndCountEventsByPeriod(baseEvents)
        const excludePast = filters.excludePastEvents !== false // Par défaut true

        // Flatten les groupes en excluant "past" si nécessaire
        let eventsToFilter: Event[] = []
        Object.entries(groups).forEach(([periodKey, periodEvents]) => {
            if (periodKey === 'past' && excludePast) {
                return // Exclure "past" si excludePastEvents est true
            }
            eventsToFilter.push(...periodEvents)
        })

        // Appliquer les autres filtres (sans excludePastEvents)
        let filtered = applyFilters(
            eventsToFilter,
            {
                searchQuery: filters.searchQuery?.trim() || undefined,
                tags: filters.tags,
                organizerId: filters.organizerId,
                responses: filters.responses,
                customStartDate: filters.customStartDate,
                customEndDate: filters.customEndDate
                // excludePastEvents retiré - géré via les groupes
            },
            {
                responses,
                userId: effectiveUserId
            }
        )

        return filtered
    }, [filters])

    // ===== GROUPEMENTS =====

    /**
     * Groupe les événements par périodes
     */
    const groupByPeriods = useCallback((events: Event[]): { periods: CalendarPeriod[]; totalEvents: number } => {
        return groupEventsByPeriods(events)
    }, [])

    /**
     * Groupe les événements par réponses utilisateur
     */
    const groupByResponses = useCallback((events: Event[]): { groups: Groups<Event>; counts: Array<{ value: UserResponseValue; label: string; count: number }> } => {
        const effectiveUserId = currentUserId || user?.id
        if (!effectiveUserId) return { groups: createEmptyGroups(), counts: [] }

        const userResponsesMap = userResponsesMapper(events, responses, effectiveUserId)
        const groups = groupEventsByResponses(events, userResponsesMap)

        // Calculer les counts
        const counts = Object.entries(groups).map(([key, evts]) => ({
            value: key as UserResponseValue,
            label: key,
            count: evts.length
        })).filter(c => c.count > 0)

        return { groups, counts }
    }, [currentUserId, user?.id, responses])

    // ===== SUGGESTIONS FILTERBAR =====

    /**
     * Calcule les options de filtrage disponibles basées sur les événements filtrés
     */
    const getFilterOptions = useCallback((baseEvents: Event[]) => {
        const effectiveUserId = currentUserId || user?.id

        // ⚠️ Utiliser groupAndCountEventsByPeriod pour grouper par période
        // Puis exclure le groupe "past" si excludePastEvents est true
        const { groups } = groupAndCountEventsByPeriod(baseEvents)
        const excludePast = filters.excludePastEvents !== false // Par défaut true

        // Flatten les groupes en excluant "past" si nécessaire
        let eventsToFilter: Event[] = []
        Object.entries(groups).forEach(([periodKey, periodEvents]) => {
            if (periodKey === 'past' && excludePast) {
                return // Exclure "past" si excludePastEvents est true
            }
            eventsToFilter.push(...periodEvents)
        })

        // Appliquer tous les filtres pour chaque catégorie, en excluant celui qu'on calcule

        // Pour les tags : on applique TOUS les filtres (y compris les tags déjà sélectionnés)
        // pour montrer quels tags coexistent avec les tags sélectionnés
        const eventsWithTagsFilter = applyFilters(eventsToFilter, {
            searchQuery: filters.searchQuery?.trim() || undefined,
            customStartDate: filters.customStartDate,
            customEndDate: filters.customEndDate,
            organizerId: filters.organizerId,
            responses: filters.responses,
            tags: filters.tags // ← Tags INCLUS pour voir la coexistence
            // excludePastEvents retiré - géré via les groupes
        }, { responses, userId: effectiveUserId })

        const eventsWithoutOrganizerFilter = applyFilters(eventsToFilter, {
            searchQuery: filters.searchQuery?.trim() || undefined,
            tags: filters.tags,
            customStartDate: filters.customStartDate,
            customEndDate: filters.customEndDate,
            responses: filters.responses
            // organizerId exclu
            // excludePastEvents retiré - géré via les groupes
        }, { responses, userId: effectiveUserId })

        // Pour les réponses : on EXCLUT le filtre responses pour afficher toutes les options disponibles
        // Cela permet le multi-select intuitif (logique OR : J'y vais + Intéressé)
        const eventsWithoutResponsesFilter = applyFilters(eventsToFilter, {
            searchQuery: filters.searchQuery?.trim() || undefined,
            tags: filters.tags,
            customStartDate: filters.customStartDate,
            customEndDate: filters.customEndDate,
            organizerId: filters.organizerId
            // responses EXCLU → affiche toutes les réponses disponibles
            // excludePastEvents retiré - géré via les groupes
        }, { responses, userId: effectiveUserId })

        return {
            tags: groupAndCountEventsByTag(eventsWithTagsFilter),
            organizers: groupAndCountEventsByOrganizer(eventsWithoutOrganizerFilter, users),
            responses: groupAndCountEventsByResponse(eventsWithoutResponsesFilter, responses, effectiveUserId)
        }
    }, [filters, responses, users, currentUserId, user?.id])

    // ===== FRIENDS & GUESTS =====

    /**
     * Récupère les amis (pour ShareContent)
     */
    const getFriends = useCallback((): Friend[] => {
        if (!dataReady) return []
        const effectiveUserId = currentUserId || user?.id
        if (!effectiveUserId) return []

        return userRelations.filter(rel =>
            rel.friendship.status === 'active' &&
            (rel.friendship.userId1 === effectiveUserId || rel.friendship.userId2 === effectiveUserId)
        )
    }, [userRelations, currentUserId, user?.id, dataReady])

    /**
     * Récupère les invités d'un événement (pour ShareContent)
     */
    const getGuests = useCallback((eventId: string): Groups<UserResponse> & { invited: UserResponse[] } => {
        if (!dataReady) {
            return {
                going: [],
                participe: [],
                interested: [],
                maybe: [],
                not_interested: [],
                not_there: [],
                seen: [],
                cleared: [],
                null: [],
                invited: [],
                linked: []

            }
        }

        const eventResponses = responses.filter(r => r.eventId === eventId)
        return groupUsersByResponses(eventResponses)
    }, [responses, dataReady])

    /**
     * Récupère les amis groupés par status (pour ProfilePage)
     */
    const getFriendsGroupedByFrienship = useCallback(() => {
        if (!dataReady) return { activeFriends: [], pendingFriends: [], sentRequests: [] }
        const effectiveUserId = currentUserId || user?.id
        if (!effectiveUserId) return { activeFriends: [], pendingFriends: [], sentRequests: [] }

        return groupUsersByFriendships(userRelations, effectiveUserId)
    }, [userRelations, currentUserId, user?.id, dataReady])

    // Retourner toutes les fonctions
    return {
        // Filtres
        filters,
        setFilters,

        // Fonctions principales
        applyCurrentFilters,
        groupByPeriods,
        groupByResponses,
        getFilterOptions,

        // Friends & Guests
        getFriends,
        getGuests,
        getFriendsGroupedByFrienship,

        // État
        dataReady
    }
}
