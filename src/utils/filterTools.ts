/**
 * FOMO MVP - Filter Data Manager
 *
 * Module 100% pur: petites fonctions génériques (pas de contexte, pas d'I/O)
 *
 * Sections:
 * 1) Types & constantes publiques (FilterConfig, TIME_PERIODS)
 * Note: CalendarPeriod est défini dans @/types/fomoTypes
 * 2) Types & helpers internes
 * 3) Matchers thématiques (contenu, portée, temps, relations, exclusions)
 * 4) Pipeline principal (filterEvents)
 * 5) Utilitaires UserResponses (build/group)
 * 6) Calendrier (périodes & groupements)
 * 7) Utilitaires pour les invitations (groupUsersByResponses)
 */

import type { Event, UserResponseValue, Periods, CalendarPeriod, UserResponse, Friendship, User } from '@/types/fomoTypes'
import {
    isWeekend,
    isSameWeek,
    isSameMonth,
    isToday,
    isTomorrow,
    startOfWeek,
    endOfWeek,
    startOfMonth,
    endOfMonth,
    addWeeks,
    addMonths,
    isPast,

} from 'date-fns'
import { toZonedTime } from 'date-fns-tz'


// (ancien FilterOptions supprimé: la configuration passe par FilterConfig ci-dessous)

// Périodes communes pour filtres et calendrier
export const TIME_PERIODS = [

    // Ordre d'affichage dans le calendrier : passé → présent → futur
    { key: 'past', label: 'Passés' },
    { key: 'today', label: 'Aujourd\'hui' },
    { key: 'tomorrow', label: 'Demain' },
    { key: 'thisWeek', label: 'Cette semaine' },
    { key: 'thisWeekend', label: 'Ce week-end' },
    { key: 'nextWeek', label: 'La semaine prochaine' },
    { key: 'thisMonth', label: 'Ce mois' },
    { key: 'nextMonth', label: 'Le mois prochain' },
]



// ===== CONFIG PIPELINE GÉNÉRIQUE =====
export interface FilterConfig {
    // base
    isPublic?: boolean | 'all'
    onlyMineUserId?: string
    isOnline?: boolean | 'all'

    // contenu
    tags?: string[]
    query?: string
    // NOTE (MVP): organizerQuery/locationQuery INACTIFS côté app
    // Conservés pour évolutivité; le filtrage actuel par organisateur se fait via organizerId (FiltersContext)
    organizerQuery?: string // (inactif côté app) Nom d'organisateur (substring)
    locationQuery?: string // (inactif côté app) Nom/adresse/composeurs de lieu

    // temps
    timeRange?: Periods
    now?: Date
    userTimezone?: string

    // filtres par défaut pour DiscoverPage
    excludePastEvents?: boolean // Exclure les événements passés (endsAt < maintenant)
    excludeNotInterested?: boolean // Exclure les événements où l'utilisateur a répondu "not_interested"
    currentUserId?: string // ID de l'utilisateur connecté pour le filtrage not_interested
    allowedResponses?: UserResponseValue[] // N'afficher que les événements avec ces réponses (ex: ['going', 'interested'])
}

// Utilitaire: type de réponse minimal (compatibilité ancien système)
// Note: userResponsesMapper utilise maintenant UserResponse directement
type MinimalResponse = { eventId: string; userId?: string; response: UserResponseValue }



// ===== 3) MATCHERS - CONTENU =====

/**
 * Fonction générique de filtrage par requête de recherche.
 * Recherche récursivement dans toutes les propriétés string/number d'un objet ou directement dans la valeur si c'est une string.
 * 
 * @param item - L'élément à tester (peut être n'importe quel type)
 * @param query - La requête de recherche (optionnelle)
 * @returns true si l'élément correspond à la requête, ou si pas de requête
 */
export function filterQuery<T>(item: T, query?: string): boolean {
    if (!query) return true
    const q = query.trim().toLowerCase()
    if (!q) return true

    // Si c'est une string, recherche directe
    if (typeof item === 'string') {
        return item.toLowerCase().includes(q)
    }

    // Si c'est un number, convertir en string et rechercher
    if (typeof item === 'number') {
        return item.toString().toLowerCase().includes(q)
    }

    // Si c'est null ou undefined, ne pas matcher
    if (item === null || item === undefined) {
        return false
    }

    // Si c'est un tableau, rechercher dans chaque élément
    if (Array.isArray(item)) {
        return item.some(element => filterQuery(element, q))
    }

    // Si c'est un objet, rechercher récursivement dans toutes les propriétés
    if (typeof item === 'object') {
        const values = Object.values(item)
        return values.some(value => filterQuery(value, q))
    }

    // Pour les autres types, convertir en string et rechercher
    return String(item).toLowerCase().includes(q)
}

/**
 * Vérifie si un événement correspond à une requête de recherche textuelle.
 * Recherche dans: titre, description, lieu, organisateur, tags.
 * 
 * @param event - L'événement à tester
 * @param query - La requête de recherche (optionnelle)
 * @returns true si l'événement correspond à la requête, ou si pas de requête
 */
export function matchQuery(event: Event, query?: string): boolean {
    return filterQuery(event, query)
}

/**
 * Vérifie si un événement correspond aux tags sélectionnés.
 * Sémantique AND : tous les tags sélectionnés doivent être présents sur l'événement.
 * 
 * @param event - L'événement à tester
 * @param tags - Liste des tags à rechercher (optionnelle)
 * @returns true si l'événement correspond aux tags, ou si pas de filtrage de tags
 */
export function matchTags(event: Event, tags?: string[]): boolean {
    if (!tags || tags.length === 0 || tags.includes('all')) return true
    const wanted = tags
        .map(t => (t || '').trim().toLowerCase())
        .filter(Boolean)
    if (wanted.length === 0) return true

    const eventTags = (event.tags || [])
        .map(t => (t || '').trim().toLowerCase())

    // AND semantics: every selected tag must be present on the event
    for (const w of wanted) {
        const found = eventTags.some(et => et.includes(w))
        if (!found) return false
    }
    return true
}

/**
 * Vérifie si un événement correspond au filtre de portée publique/privée.
 * 
 * @param event - L'événement à tester
 * @param isPublic - true pour public, false pour privé, 'all' pour tous (optionnel)
 * @returns true si l'événement correspond au filtre, ou si pas de filtre
 */
export function matchPublic(event: Event, isPublic?: boolean | 'all'): boolean {
    if (isPublic === 'all' || isPublic === undefined) return true
    // Récupérer la valeur isPublic de l'événement (peut être undefined)
    const eventIsPublic = event.isPublic
    // Si l'événement n'a pas de valeur isPublic, ne pas filtrer (inclure par défaut)
    if (eventIsPublic === undefined) return true
    // Comparer: si on filtre pour public (isPublic=true), l'événement doit être public
    // Si on filtre pour privé (isPublic=false), l'événement doit être privé
    return isPublic ? eventIsPublic === true : eventIsPublic === false
}

/**
 * Vérifie si un événement correspond au filtre online/offline.
 * 
 * @param event - L'événement à tester
 * @param isOnline - true pour online, false pour offline, 'all' pour tous (optionnel)
 * @returns true si l'événement correspond au filtre, ou si pas de filtre
 */
export function matchOnline(event: Event, isOnline?: boolean | 'all'): boolean {
    if (isOnline === 'all' || isOnline === undefined) return true
    // Récupérer la valeur isOnline de l'événement (peut être undefined)
    const eventIsOnline = event.isOnline
    // Si l'événement n'a pas de valeur isOnline, ne pas filtrer (inclure par défaut)
    if (eventIsOnline === undefined) return true
    // Comparer strictement avec la valeur du filtre
    return eventIsOnline === isOnline
}

/**
 * Vérifie si un événement appartient à un organisateur spécifique.
 * 
 * @param event - L'événement à tester
 * @param organizerId - L'ID de l'organisateur à vérifier (optionnel)
 * @returns true si l'événement appartient à l'organisateur, ou si pas de filtre
 */
export function matchOrganizer(event: Event, organizerId?: string): boolean {
    if (!organizerId) return true
    return event.organizerId === organizerId
}

/**
 * Vérifie si un événement appartient à une période calendaire spécifique.
 * 
 * @param event - L'événement à tester
 * @param period - La période calendaire à vérifier (optionnelle)
 * @returns true si l'événement appartient à la période, ou si pas de filtre
 */
export function matchPeriod(event: Event, period?: Periods): boolean {
    if (!period || period === 'all') return true
    const eventPeriod = getPeriod(event)
    return eventPeriod.key === period
}

// ===== 5) UTILITAIRES USER RESPONSES =====
/**
 * Transforme une liste de réponses utilisateur en dictionnaire eventId -> response (string ou '')
 * pour l'utilisateur courant, limité à la liste d'événements fournie.
 * 
 * @param events - Liste d'événements pour filtrer les réponses pertinentes
 * @param userResponses - Liste de réponses utilisateur (UserResponse[] ou MinimalResponse[])
 * @param currentUserId - ID de l'utilisateur courant (optionnel)
 * @returns Dictionnaire eventId -> response normalisé (chaîne vide pour valeurs falsy)
 */
export function userResponsesMapper(
    events: Event[],
    userResponses: UserResponse[] | MinimalResponse[],
    currentUserId?: string
): Record<string, string> {
    // Initialiser TOUS les événements avec une chaîne vide par défaut
    const result: Record<string, string> = {}
    if (!events || events.length === 0) return result

    // Initialiser tous les événements avec '' (aucune réponse)
    events.forEach(e => {
        result[e.id] = ''
    })

    if (!currentUserId || !userResponses || userResponses.length === 0) return result

    const eventIds = new Set(events.map(e => e.id))

    // NOUVEAU SYSTÈME : Utiliser la dernière réponse par event (finalResponse)
    // Grouper par eventId et garder la plus récente
    // Support à la fois UserResponse (avec createdAt/finalResponse) et MinimalResponse (avec response)
    const latestByEvent = new Map<string, { finalResponse: UserResponseValue; createdAt?: string }>()

    userResponses.forEach(r => {
        // Détecter le format : UserResponse ou MinimalResponse
        const isUserResponse = 'finalResponse' in r && 'createdAt' in r
        const response = isUserResponse ? (r as UserResponse).finalResponse : (r as MinimalResponse).response
        const createdAt = isUserResponse ? (r as UserResponse).createdAt : undefined
        const userId = r.userId
        const eventId = r.eventId

        if (userId === currentUserId && eventIds.has(eventId)) {
            const existing = latestByEvent.get(eventId)

            if (!existing) {
                latestByEvent.set(eventId, { finalResponse: response, createdAt })
            } else if (createdAt && existing.createdAt) {
                // Si les deux ont createdAt, prendre la plus récente
                if (new Date(createdAt) > new Date(existing.createdAt)) {
                    latestByEvent.set(eventId, { finalResponse: response, createdAt })
                }
            } else if (!existing.createdAt && createdAt) {
                // Si seulement le nouveau a createdAt, le prendre
                latestByEvent.set(eventId, { finalResponse: response, createdAt })
            } else if (!existing.finalResponse || existing.finalResponse === 'cleared') {
                // Si pas de createdAt, prendre le premier ou remplacer si cleared
                if (response && response !== 'cleared') {
                    latestByEvent.set(eventId, { finalResponse: response, createdAt })
                }
            }
        }
    })

    latestByEvent.forEach((r, eventId) => {
        // Normaliser: toujours une chaîne (pas null/undefined)
        // Si finalResponse est null ou undefined, on garde '' (déjà initialisé)
        if (r.finalResponse && typeof r.finalResponse === 'string') {
            result[eventId] = r.finalResponse
        }
    })

    return result
}

/**
 * Type pour les groupes de réponses (événements ou utilisateurs)
 */
export type Groups<T> = {
    going: T[]
    participe: T[]
    interested: T[]
    maybe: T[]
    not_interested: T[]
    not_there: T[]
    seen: T[]
    cleared: T[]
    invited: T[]
    null: T[]
}

/**
 * Crée un objet Groups vide avec tous les tableaux initialisés à []
 */
export function createEmptyGroups<T>(): Groups<T> {
    return {
        going: [],
        participe: [],
        interested: [],
        maybe: [],
        not_interested: [],
        not_there: [],
        seen: [],
        cleared: [],
        invited: [],
        null: []
    }
}

/**
 * Options pour la fonction de groupement d'événements par réponse
 */
export interface GroupEventsByUserResponseOptions {
    /**
     * Fonction pour extraire la valeur de réponse à utiliser pour le groupement
     * @default (e, map) => map[e.id] || null
     */
    getResponseValue?: (event: Event, userResponsesMap: Record<string, string>) => UserResponseValue | string | null | undefined

    /**
     * Mapping personnalisé des valeurs de réponse vers les clés de groupe
     * Si non fourni, utilise un mapping par défaut (1:1)
     * @default undefined (mapping direct)
     */
    responseKeyMap?: (value: UserResponseValue | string | null | undefined) => keyof Groups<Event>
}

/**
 * Groupe les événements par réponse utilisateur en se basant sur le dictionnaire userResponses.
 * Retourne des tableaux d'événements par catégorie, incluant un groupe 'null' (aucune réponse).
 * 
 * @param events - Liste des événements à grouper
 * @param userResponsesMap - Dictionnaire associant eventId à la réponse utilisateur
 * @param options - Options de configuration pour le groupement
 * @returns Objet avec groupes par type de réponse
 */
export function groupEventsByUserResponse(
    events: Event[],
    userResponsesMap: Record<string, string>,
    options?: GroupEventsByUserResponseOptions
): Groups<Event> {
    const getResponseValue = options?.getResponseValue ?? ((e: Event, map: Record<string, string>) => {
        const value = map[e.id]
        return value === '' || value === undefined ? null : value
    })

    const responseKeyMap = options?.responseKeyMap ?? ((value: UserResponseValue | string | null | undefined) => {
        // Mapping par défaut : valeur directe vers clé de groupe
        if (value === null || value === undefined || value === '') return 'null' as const
        return value as keyof Groups<Event>
    })

    const groups = createEmptyGroups<Event>()

    events.forEach(e => {
        const responseValue = getResponseValue(e, userResponsesMap)
        const groupKey = responseKeyMap(responseValue)

        // Vérifier que la clé existe dans le grouped
        if (groupKey in groups) {
            (groups[groupKey] as Event[]).push(e)
        } else {
            // Fallback vers null si la clé n'existe pas
            groups.null.push(e)
        }
    })

    return groups
}

/**
 * Transforme une liste de valeurs de réponse utilisateur en options pour React Select.
 * Gère le regroupement cleared/seen → "Non répondu" et l'ordre d'affichage.
 * 
 * @param responseValues - Liste des valeurs de réponse disponibles (UserResponseValue[])
 * @returns Options formatées pour React Select avec labels français et ordre de tri
 */
export function mapResponseValuesToSelectOptions(
    responseValues: UserResponseValue[]
): Array<{ value: string; label: string; sortOrder: number }> {
    const optionsMap = new Map<string, { value: string; label: string; sortOrder: number }>()

    responseValues.forEach(response => {
        if (response === null) {
            // Nouveaux (null)
            optionsMap.set('null', { value: 'null', label: 'Nouveaux', sortOrder: 1 })
        } else if (response === 'going' || response === 'participe') {
            // J'y vais (participe est traité comme going pour l'affichage)
            optionsMap.set('going', { value: 'going', label: 'J\'y vais', sortOrder: 2 })
        } else if (response === 'interested' || response === 'maybe') {
            // Intéressé / Peut-être (mappé vers "interested" pour les filtres)
            optionsMap.set('interested', { value: 'interested', label: 'Intéressé', sortOrder: 3 })
        } else if (response === 'cleared' || response === 'seen') {
            // Non répondu (regroupé pour cleared et seen)
            if (!optionsMap.has('non_repondu')) {
                optionsMap.set('non_repondu', { value: 'non_repondu', label: 'Non répondu', sortOrder: 4 })
            }
        }
    })

    // Convertir en tableau et trier par ordre
    return Array.from(optionsMap.values()).sort((a, b) => a.sortOrder - b.sortOrder)
}

/**
 * Convertit une valeur de réponse UserResponseValue en option React Select sélectionnée.
 * Gère les conversions spéciales (null → 'null', cleared/seen → 'non_repondu').
 * 
 * @param response - Valeur de réponse à convertir
 * @param options - Liste d'options disponibles (issue de mapResponseValuesToSelectOptions)
 * @returns Option correspondante ou null si non trouvée/undefined
 */
export function findResponseOption(
    response: UserResponseValue | undefined,
    options: Array<{ value: string; label: string }>
): { value: string; label: string } | null {
    // Vérifier explicitement undefined (null est une valeur valide pour "Nouveau")
    if (response === undefined) return null

    // Convertir la valeur sélectionnée en option
    if (response === null) {
        return options.find(opt => opt.value === 'null') || null
    } else if (response === 'going' || response === 'participe') {
        // participe est traité comme going pour l'affichage
        return options.find(opt => opt.value === 'going') || null
    } else if (response === 'interested' || response === 'maybe') {
        // "maybe" est mappé vers "interested" pour les filtres
        return options.find(opt => opt.value === 'interested') || null
    } else if (response === 'not_interested' || response === 'not_there') {
        // "not_there" est mappé vers "not_interested" pour les filtres
        return options.find(opt => opt.value === 'not_interested') || null
    } else if (response === 'cleared' || response === 'seen') {
        // Pour "Non répondu", on peut choisir 'cleared' comme valeur par défaut
        return options.find(opt => opt.value === 'non_repondu') || null
    }

    return null
}

// ===== 6) CALENDRIER =====
/** Ordre de filtrage: past, today, tomorrow, thisWeekend, thisWeek, nextWeek, thisMonth, nextMonth */
function getPeriodByDate(startDate: Date, endDate: Date): { key: string; label: string; startDate: Date; endDate: Date } {
    const now = new Date()

    // Variables centralisées pour toutes les périodes


    const nextWeek = addWeeks(now, 1)
    const nextMonth = addMonths(now, 1)


    // 1. Past
    if (isPast(endDate)) {
        return {
            key: 'past',
            label: 'Passés',
            startDate: new Date(0),
            endDate: endDate
        }
    }

    // 2. Today
    if (isToday(startDate)) {
        return {
            key: 'today',
            label: 'Aujourd\'hui',
            startDate: startDate,
            endDate: new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
        }
    }

    // 3. Tomorrow
    if (isTomorrow(startDate)) {
        return {
            key: 'tomorrow',
            label: 'Demain',
            startDate: startDate,
            endDate: new Date(startDate.getTime() + 24 * 60 * 60 * 1000)
        }
    }

    // 4. ThisWeekend (samedi ou dimanche de cette semaine)
    if (isWeekend(startDate) && isSameWeek(startDate, now, { weekStartsOn: 1 })) {
        const weekendStart = startOfWeek(startDate, { weekStartsOn: 6 })
        const weekendEnd = endOfWeek(startDate, { weekStartsOn: 6 })
        return {
            key: 'thisWeekend',
            label: 'Ce week-end',
            startDate: weekendStart,
            endDate: weekendEnd
        }
    }

    // 5. ThisWeek (lundi à dimanche, ISO 8601)
    if (isSameWeek(startDate, now, { weekStartsOn: 1 })) {
        const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 })
        const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 })
        return {
            key: 'thisWeek',
            label: 'Cette semaine',
            startDate: thisWeekStart,
            endDate: thisWeekEnd
        }
    }

    // 6. NextWeek
    if (isSameWeek(startDate, nextWeek, { weekStartsOn: 1 })) {
        const nextWeekStart = startOfWeek(nextWeek, { weekStartsOn: 1 })
        const nextWeekEnd = endOfWeek(nextWeek, { weekStartsOn: 1 })
        return {
            key: 'nextWeek',
            label: 'La semaine prochaine',
            startDate: nextWeekStart,
            endDate: nextWeekEnd
        }
    }

    // 7. ThisMonth
    if (isSameMonth(startDate, now)) {
        const thisMonthStart = startOfMonth(now)
        const thisMonthEnd = endOfMonth(now)
        return {
            key: 'thisMonth',
            label: 'Ce mois',
            startDate: thisMonthStart,
            endDate: thisMonthEnd
        }
    }

    // 8. NextMonth
    if (isSameMonth(startDate, nextMonth)) {
        const nextMonthStart = startOfMonth(nextMonth)
        const nextMonthEnd = endOfMonth(nextMonth)
        return {
            key: 'nextMonth',
            label: 'Le mois prochain',
            startDate: nextMonthStart,
            endDate: nextMonthEnd
        }
    }

    // Événements non classés (hors périodes définies)
    return {
        key: 'other',
        label: 'Autres',
        startDate: startDate,
        endDate: endDate,
    }
}

/**
 * Détermine la période calendaire d'un évènement en tenant compte des deux dates (start/end)
 * et du fuseau horaire utilisateur. Priorité: "Passés" si l'événement est terminé.
 */
export function getPeriod(event: Event): { key: string; label: string; startDate: Date; endDate: Date } {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone


    // Dates converties dans le fuseau local
    const startTz = toZonedTime(event.startsAt, userTimezone)
    const endTz = toZonedTime(event.endsAt, userTimezone)


    // 2) Futur/présent: déléguer à la logique existante avec la date de début locale
    return getPeriodByDate(startTz, endTz)
}

/**
 * Groupe les événements par période calendaire
 */
export function groupEventsByPeriods(events: Event[]): { periods: CalendarPeriod[]; totalEvents: number } {
    const periodMap = new Map<string, CalendarPeriod>()

    events.forEach(event => {
        // Utiliser une logique basée sur start+end avec fuseau et priorité aux passés
        const period = getPeriod(event)

        // Exclure les événements non classés ('other') du calendrier
        if (period.key === 'other') {
            return
        }

        if (!periodMap.has(period.key)) {
            periodMap.set(period.key, {
                key: period.key,
                label: period.label,
                startDate: period.startDate,
                endDate: period.endDate,
                events: []
            })
        }

        periodMap.get(period.key)!.events.push(event)
    })

    // Trier les événements dans chaque période par date
    periodMap.forEach(period => {
        period.events.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    })

    // Convertir en tableau et trier par ordre chronologique selon TIME_PERIODS
    const periods = Array.from(periodMap.values()).sort((a, b) => {
        // Utiliser l'ordre défini dans TIME_PERIODS (sans 'all' qui n'est pas une période calendaire)
        const timePeriodKeys = TIME_PERIODS.filter(p => p.key !== 'all').map(p => p.key)
        const aIndex = timePeriodKeys.indexOf(a.key)
        const bIndex = timePeriodKeys.indexOf(b.key)

        if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex
        }

        // Si pas dans TIME_PERIODS, trier par date de début
        return a.startDate.getTime() - b.startDate.getTime()
    })

    return {
        periods,
        totalEvents: events.length
    }
}

// ===== UTILITAIRES GÉNÉRIQUES =====
/**
 * Intersection performante d'ensembles d'identifiants d'événements.
 * Ne conserve que les ids présents dans tous les ensembles non vides fournis.
 */
export function intersectEventIds(...sets: Array<Set<string> | undefined>): string[] {
    const active = sets.filter((s): s is Set<string> => !!s && s.size > 0)
    if (active.length === 0) return []
    active.sort((a, b) => a.size - b.size)
    const [smallest, ...rest] = active
    const out: string[] = []
    outer: for (const id of smallest) {
        for (const s of rest) {
            if (!s.has(id)) continue outer
        }
        out.push(id)
    }
    return out
}

// ===== UTILITAIRES POUR LES INVITATIONS =====

/**
 * Options pour la fonction de groupement générique
 */
export interface GroupUsersByResponsesOptions {
    /**
     * Fonction pour extraire la valeur de réponse à utiliser pour le groupement
     * @default (r) => r.finalResponse
     */
    getResponseValue?: (response: UserResponse) => UserResponseValue

    /**
     * Mapping personnalisé des valeurs de réponse vers les clés de groupe
     * Si non fourni, utilise un mapping par défaut (1:1)
     * @default undefined (mapping direct)
     */
    responseKeyMap?: (value: UserResponseValue) => keyof (Groups<UserResponse> & { invited: UserResponse[] })
}

/**
 * Groupe une liste de UserResponse par type de réponse.
 * Fonction générique réutilisable pour grouper des réponses utilisateur.
 * 
 * @param responses - Liste des réponses utilisateur à grouper (UserResponse[])
 * @param options - Options de configuration pour le groupement
 * @returns Objet avec groupes par type de réponse
 */
export function groupUsersByResponses(
    responses: UserResponse[],
    options?: GroupUsersByResponsesOptions
): Groups<UserResponse> & { invited: UserResponse[] } {
    const getResponseValue = options?.getResponseValue ?? ((r: UserResponse) => r.finalResponse)
    const responseKeyMap = options?.responseKeyMap ?? ((value: UserResponseValue) => {
        // Mapping par défaut : valeur directe vers clé de groupe
        if (value === null) return 'null' as const
        return value as keyof (Groups<UserResponse> & { invited: UserResponse[] })
    })

    const grouped = { ...createEmptyGroups<UserResponse>() } as Groups<UserResponse> & { invited: UserResponse[] }

    responses.forEach(response => {
        const responseValue = getResponseValue(response)
        const groupKey = responseKeyMap(responseValue)

        // Vérifier que la clé existe dans le grouped
        if (groupKey in grouped) {
            (grouped[groupKey] as UserResponse[]).push(response)
        } else {
            // Fallback vers null si la clé n'existe pas
            grouped.null.push(response)
        }
    })

    return grouped
}

// ===== UTILITAIRES POUR LES RELATIONS D'AMITIÉ =====

/**
 * Groupe les relations d'amitié par statut (actives, en attente reçues, en attente envoyées, bloquées).
 * Fonction générique pure réutilisable pour grouper les relations d'amitié.
 * 
 * @param userRelations - Liste complète des relations d'amitié
 * @param userId - ID de l'utilisateur courant
 * @returns Objet avec groupes par statut d'amitié
 */
export function groupUsersByFriendships<User extends { friendship: Friendship; id: string }>(
    userRelations: User[],
    userId: string
): {
    activeFriends: User[]
    pendingFriends: User[]
    sentRequests: User[]
    blockedUsers: User[]
} {
    // Filtrer les relations avec une structure friendship valide et initialisée
    const validRelations = userRelations.filter(relation => {
        const hasFriendship = relation?.friendship
        const hasStatus = relation?.friendship?.status
        const hasId = relation?.friendship?.id
        const hasInitiatedBy = relation?.friendship?.initiatedBy
        const friendshipUnknown = relation?.friendship as unknown as Record<string, unknown>
        const hasFromTo = friendshipUnknown?.fromUserId && friendshipUnknown?.toUserId

        return hasFriendship && hasStatus && hasId && (hasInitiatedBy || hasFromTo)
    })

    // Calculer les amis actifs depuis les relations valides
    const activeFriends = validRelations.filter(relation => {
        const friendship = relation.friendship
        if (!friendship || friendship.status !== 'active') return false
        // Vérifier que l'utilisateur est impliqué dans cette relation d'amitié
        const isInvolved = friendship.userId1 === userId || friendship.userId2 === userId
        // Exclure l'utilisateur lui-même
        return isInvolved && relation.id !== userId
    })

    // Filtrer les pending et sent depuis les relations valides
    const pendingFriends = validRelations.filter(relation => {
        const isPending = relation.friendship?.status === 'pending'
        const notInitiatedByMe = relation.friendship?.initiatedBy !== userId
        return isPending && notInitiatedByMe
    })

    const sentRequests = validRelations.filter(relation => {
        const isPending = relation.friendship?.status === 'pending'
        const initiatedByMe = relation.friendship?.initiatedBy === userId
        return isPending && initiatedByMe
    })

    // Filtrer les utilisateurs bloqués depuis les relations valides
    const blockedUsers = validRelations.filter(relation => {
        const friendship = relation.friendship
        if (!friendship || friendship.status !== 'blocked') return false
        // Vérifier que l'utilisateur est impliqué dans cette relation d'amitié
        const isInvolved = friendship.userId1 === userId || friendship.userId2 === userId
        return isInvolved && relation.id !== userId
    })

    return {
        activeFriends,
        pendingFriends,
        sentRequests,
        blockedUsers
    }
}

// ===== UTILITAIRES USERS =====

/**
 * Récupère un utilisateur par son ID depuis une liste d'utilisateurs.
 * 
 * @param users - Liste d'utilisateurs
 * @param userId - ID de l'utilisateur à rechercher
 * @returns L'utilisateur trouvé ou undefined si non trouvé
 */
export function getUser(users: User[], userId: string): User | undefined {
    if (!users || users.length === 0 || !userId) return undefined
    return users.find(u => u.id === userId)
}

/**
 * Crée une Map des utilisateurs par ID pour des recherches rapides.
 * 
 * @param users - Liste d'utilisateurs
 * @returns Map<userId, User>
 */
export function createUsersMap(users: User[]): Map<string, User> {
    const usersMap = new Map<string, User>()
    if (users && users.length > 0) {
        for (const u of users) {
            if (u.id) {
                usersMap.set(u.id, u)
            }
        }
    }
    return usersMap
}

/**
 * Filtre une liste d'utilisateurs sur base d'une liste d'IDs.
 * 
 * @param users - Liste complète d'utilisateurs
 * @param userIds - Liste d'IDs d'utilisateurs à récupérer
 * @returns Liste des utilisateurs correspondants aux IDs fournis (dans l'ordre des IDs)
 */
export function getUsersByIds(users: User[], userIds: string[]): User[] {
    if (!users || users.length === 0 || !userIds || userIds.length === 0) {
        return []
    }

    // Créer un Set pour des recherches rapides
    const userIdsSet = new Set(userIds)

    // Filtrer les users présents dans le Set
    return users.filter(u => u.id && userIdsSet.has(u.id))
}

/**
 * Filtre une liste d'utilisateurs sur base d'une liste d'IDs et retourne une Map.
 * Plus performant si on a besoin de faire plusieurs recherches par ID.
 * 
 * @param users - Liste complète d'utilisateurs
 * @param userIds - Liste d'IDs d'utilisateurs à récupérer
 * @returns Map<userId, User> contenant uniquement les utilisateurs correspondants
 */
export function getUsersMapByIds(users: User[], userIds: string[]): Map<string, User> {
    const filteredUsers = getUsersByIds(users, userIds)
    return createUsersMap(filteredUsers)
}

