export interface User {
    id: string
    name: string
    email: string
    city: string
    lat?: number | null
    lng?: number | null
    friendsCount: number
    avatarUrl?: string
    showAttendanceToFriends: boolean
    isPublicProfile: boolean
    isAmbassador: boolean
    allowRequests?: boolean
    isVisitor: boolean // true pour les visiteurs, false pour les utilisateurs authentifiés
    isNewVisitor: boolean // true pour les nouveaux visiteurs (première visite, pas de nom sauvegardé)
    createdAt?: string
    lastConnexion?: string
}

export interface Venue {
    name: string
    address: string
    lat: number
    lng: number
    // Composants structurés (optionnels, enrichis depuis Mapbox à la création)
    components?: {
        street?: string
        address_number?: string
        postcode?: string
        place?: string // Ville
        region?: string
        country?: string
        country_code?: string
    }
}

export interface EventStats {
    going: number
    interested: number
    friendsGoing: number
    // Nouvelles propriétés calculées par Google Sheets
    goingCount: number
    interestedCount: number
    notInterestedCount: number
    totalResponses: number
    // Nouvelles propriétés d'amis
    friendsGoingCount: number
    friendsInterestedCount: number
    // Listes d'amis
    friendsGoingList: string
    friendsInterestedList: string
}

export interface Event {
    id: string
    createdAt?: string
    title: string
    startsAt: string
    endsAt: string
    venue: Venue
    tags: string[] // Maximum 3 tags
    coverUrl: string
    coverImagePosition?: { x: number; y: number } // Position de l'image (object-position en %)
    description: string
    price?: string
    ticketUrl?: string
    organizerId: string
    organizerName?: string
    source?: string // URL source de l'événement (ex: URL Facebook)
    stats: EventStats
    isPublic?: boolean
    isOnline?: boolean
    capacity?: number
    isPast?: boolean
    friendsGoingNames?: string[]
    friendsInterestedNames?: string[]
    isFake?: boolean // Indique si l'événement est un événement factice (pour les fake pins)
    // Propriétés de compatibilité pour les composants existants
    date?: string
    time?: string
    location?: string
}

// ===== TIME / FILTERING =====
export type Periods = 'all' | 'today' | 'tomorrow' | 'thisWeek' | 'thisWeekend' | 'nextWeek' | 'thisMonth' | 'nextMonth' | 'past'

export interface CalendarPeriod {
    key: string
    label: string
    startDate: Date
    endDate: Date
    events: Event[]
}

export interface Friendship {
    id: string
    userId1: string
    userId2: string
    status: 'active' | 'inactive' | 'pending' | 'blocked' | 'cancelled'
    createdAt: string
    updatedAt: string
    initiatedBy: string
}

// ===== USER VARIANTS =====
// Friend et Organizer sont des variantes de User avec des propriétés spécifiques

export interface Friend extends User {
    friendship: Friendship
    friends?: Friend[] // Amis de cet ami (calculé uniquement pour les suggestions)
}

export interface Organizer extends User {
    logoUrl?: string
}
// ===== TAGS =====
export interface Tag {
    tag: string
    usage_count: number
    // Note: last_used, created_at, created_by supprimés pour optimisation
    // (non utilisés dans CreateEventModal, calcul beaucoup plus rapide)
}

// ===== USER RESPONSES =====
export type UserResponseValue = 'going' | 'participe' | 'interested' | 'maybe' | 'not_interested' | 'not_there' | 'cleared' | 'seen' | 'invited' | 'linked' | 'new' | null

export interface UserFriendshipResponse {
    userId: string
    friendshipId: string
    response: 'accept' | 'block' | 'remove' | null
}

// ===== DATA MANAGER SHARED TYPES =====
export interface UserResponse {
    id: string // ID unique de l'entrée d'historique
    userId: string
    eventId: string
    initialResponse: UserResponseValue // Réponse AVANT le changement
    finalResponse: UserResponseValue // Réponse APRÈS le changement (était "response")
    createdAt: string
    invitedByUserId?: string // ID de l'utilisateur ayant invité
    email?: string // Email (optionnel)
}

// ===== GEOCODING =====
export interface AddressSuggestion {
    display_name: string // Nom principal (pour affichage)
    name?: string // Nom du lieu (ex: "Rue de la Paix", "Restaurant XYZ")
    address?: string // Adresse complète (ex: "Rue de la Paix, Paris, Île-de-France, France")
    lat: string
    lon: string
    place_id: string
    place_name?: string // Nom complet avec ville, région, pays
    components?: {
        street?: string
        place?: string
        locality?: string
        region?: string
        country?: string
        postcode?: string
        address_number?: string
        country_code?: string
    }
    context?: Array<{
        id: string
        text?: string
        name?: string
        short_code?: string
    }>
}

// ===== BATCH ACTIONS =====
export interface BatchEventResponseData {
    eventId: string
    initialResponse: UserResponseValue
    finalResponse: UserResponseValue
    responseMode: string
    invitedByUserId?: string
}

export interface BatchFriendshipActionData {
    friendshipId?: string  // Optionnel pour les demandes (pas encore créée)
    toUserId: string
    fromUserId?: string  // Pour les demandes d'amitié
}

export type BatchActionData = BatchEventResponseData | BatchFriendshipActionData

// Type guard pour vérifier si une action d'amitié
export function isFriendshipActionData(data: BatchActionData): data is BatchFriendshipActionData {
    return 'toUserId' in data
}

export interface BatchAction {
    id: string
    type: 'event_response' | 'friendship_request' | 'friendship_accept' | 'friendship_block' | 'friendship_remove'
    data: BatchActionData
    userId: string
    timestamp: number
}

export interface BatchProcessResult {
    processed: number
    results: Array<{
        type: BatchAction['type']
        action: string
        eventId?: string
        response?: UserResponseValue
        friendshipId?: string
        toUserId?: string
    }>
}

// ===== EMAIL VALIDATION =====
export const VALID_TLDS = [
    // Top TLD génériques
    'com', 'net', 'org', 'info', 'io', 'app', 'dev', 'online', 'club',
    // TLD nationaux principaux - Europe
    'fr', 'be', 'ch', 'uk', 'de', 'nl', 'es', 'it', 'pt', 'at', 'dk', 'se', 'no', 'fi',
    'pl', 'cz', 'ro', 'hu', 'gr', 'ie', 'lu', 'bg', 'sk', 'lt', 'lv', 'ee',
    // TLD nationaux principaux - Amériques
    'ca', 'us', 'mx', 'br', 'ar', 'cl', 'co', 'pe', 'uy',
    // TLD nationaux principaux - Asie/Pacifique
    'au', 'nz', 'sg', 'hk', 'my', 'id', 'th', 'vn', 'tw', 'jp', 'kr', 'cn', 'in',
    // TLD nationaux principaux - Autres
    'za', 'ru', 'tr', 'il'
] as const