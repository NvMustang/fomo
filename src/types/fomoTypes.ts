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
export type UserResponseValue = 'going' | 'interested' | 'not_interested' | 'cleared' | 'seen' | 'invited' | null

export interface UserFriendshipResponse {
    userId: string
    friendshipId: string
    response: 'accept' | 'block' | 'remove' | null
}

// ===== DATA MANAGER SHARED TYPES =====
export interface UserResponse {
    userId: string
    eventId: string
    response: UserResponseValue
    createdAt: string
    invitedByUserId?: string // ID de l'utilisateur ayant invité
}

export interface BatchAction {
    id: string
    type: 'event_response' | 'friendship_accept' | 'friendship_block' | 'friendship_remove'
    data: any
    userId: string
    timestamp: number
}