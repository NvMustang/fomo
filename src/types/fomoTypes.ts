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
    isVisitor?: boolean // true pour les visiteurs, false pour les utilisateurs authentifiés
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
}

export interface Organizer extends User {
    logoUrl?: string
}
// ===== TAGS =====
export interface Tag {
    tag: string
    usage_count: number
    last_used: string
    created_at: string
    created_by: string
}

// ===== USER RESPONSES =====
export type UserResponseValue = 'going' | 'participe' | 'interested' | 'maybe' | 'not_interested' | 'not_there' | 'cleared' | 'seen' | 'invited' | null

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
    display_name: string
    lat: string
    lon: string
    place_id: string
}

// ===== BATCH ACTIONS =====
export interface BatchEventResponseData {
    eventId: string
    initialResponse: UserResponseValue
    finalResponse: UserResponseValue
    invitedByUserId?: string
}

export interface BatchFriendshipActionData {
    friendshipId: string
    toUserId: string
}

export type BatchActionData = BatchEventResponseData | BatchFriendshipActionData

// Type guard pour vérifier si une action d'amitié
export function isFriendshipActionData(data: BatchActionData): data is BatchFriendshipActionData {
    return 'friendshipId' in data && 'toUserId' in data
}

export interface BatchAction {
    id: string
    type: 'event_response' | 'friendship_accept' | 'friendship_block' | 'friendship_remove'
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

// ===== API PAYLOADS =====
export interface UserCreatePayload {
    id?: string
    name: string
    email: string
    city: string
    lat: number | null
    lng: number | null
    friendsCount: number
    showAttendanceToFriends: boolean
    privacy: { showAttendanceToFriends: boolean }
    isPublicProfile: boolean
    isActive: boolean
    isAmbassador: boolean
    allowRequests: boolean
    modifiedAt: string
    lastConnexion: string
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