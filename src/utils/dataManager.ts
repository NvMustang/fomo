/**
 * FOMO Data Manager - Module unifié pour API, Cache et Batch
 * 
 * Architecture simplifiée :
 * - Cache en mémoire uniquement (pas persistant)
 * - Optimistic updates immédiats
 * - Batch avec debounce pour les réponses
 * - Push direct pour events et amitiés
 * 
 * @author FOMO MVP Team
 * @version 1.0.0
 */

import type { Event, User, Friend, UserResponse, UserResponseValue, BatchAction, BatchProcessResult, AddressSuggestion } from '@/types/fomoTypes'
import { isFriendshipActionData } from '@/types/fomoTypes'
import { getApiBaseUrl } from '@/config/env'
import { format } from 'date-fns'


// ===== CONFIGURATION =====
// (types déplacés dans '@/types/fomo')


// Utiliser la configuration centralisée pour l'URL de l'API
// - En dev: LAN automatique (pas de localhost)
// - En prod/Vercel: chemin relatif '/api'
// - Override: VITE_API_URL
const API_BASE_URL = getApiBaseUrl()
const BATCH_DEBOUNCE_MS = 5000 // 5 secondes pour les réponses
const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutes

// ===== CACHE EN MÉMOIRE =====

class MemoryCache {
    private cache = new Map<string, { data: unknown, timestamp: number }>()

    get<T>(key: string): T | null {
        const cached = this.cache.get(key)
        if (!cached) return null

        const isExpired = Date.now() - cached.timestamp > CACHE_TTL_MS
        if (isExpired) {
            this.cache.delete(key)
            return null
        }

        return cached.data as T
    }

    set<T>(key: string, data: T): void {
        this.cache.set(key, { data, timestamp: Date.now() })
    }

    delete(key: string): void {
        this.cache.delete(key)
    }

    clear(): void {
        this.cache.clear()
    }

    // Invalider les clés liées à un utilisateur
    invalidateUser(userId: string): void {
        const keysToDelete = Array.from(this.cache.keys()).filter(key =>
            key.includes(userId) || key.includes('friends') || key.includes('responses')
        )
        keysToDelete.forEach(key => this.cache.delete(key))
    }
}

/**
 * Cache spécialisé pour les réponses aux événements
 * 
 * STRATÉGIE : Pas de TTL (Time To Live)
 * - Les réponses sont maintenues en mémoire jusqu'à la synchronisation backend
 * - Pas d'expiration automatique pour éviter les pertes de données
 * - Invalidation manuelle uniquement lors des mises à jour réussies
 */
class ResponseCache {
    private cache = new Map<string, unknown>()

    get<T>(key: string): T | null {
        const value = this.cache.get(key)
        return (value as T) || null
    }

    set<T>(key: string, data: T): void {
        this.cache.set(key, data)
    }

    delete(key: string): void {
        this.cache.delete(key)
    }

    clear(): void {
        this.cache.clear()
    }

    // Invalider les clés liées à un utilisateur
    invalidateUser(userId: string): void {
        const keysToDelete = Array.from(this.cache.keys()).filter(key =>
            key.includes(userId) || key.includes('responses')
        )
        keysToDelete.forEach(key => this.cache.delete(key))
    }
}

// ===== BATCH MANAGER =====

class BatchManager {
    private pendingActions = new Map<string, BatchAction>()
    private debounceTimer: NodeJS.Timeout | null = null

    addAction(action: BatchAction): void {
        // Ajouter l'action directement avec son ID unique
        this.pendingActions.set(action.id, action)
        this.scheduleBatch()
    }

    private scheduleBatch(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer)
        }

        // STRATÉGIE DEBOUCE : Attendre 5 secondes avant d'envoyer au backend
        // Si l'utilisateur change d'avis, seul le dernier choix est envoyé
        this.debounceTimer = setTimeout(() => {
            this.processBatch()
        }, BATCH_DEBOUNCE_MS)
    }

    private async processBatch(): Promise<void> {
        const actions = Array.from(this.pendingActions.values())
        if (actions.length === 0) {
            return
        }

        try {
            const requestBody = {
                actions,
                userId: actions[0]?.userId
            }

            const response = await fetch(`${API_BASE_URL}/batch`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            })

            if (!response.ok) {
                const errorText = await response.text()
                console.error(`❌ [BatchManager] Erreur HTTP ${response.status}:`, errorText)
                throw new Error(`HTTP ${response.status}: ${errorText}`)
            }

            const result = await response.json()

            if (result.success) {
                this.pendingActions.clear()

                // Invalider le cache selon le type d'actions
                const hasEventResponses = actions.some(a => a.type === 'event_response')
                const hasFriendshipActions = actions.some(a => a.type.startsWith('friendship_'))

                if (hasEventResponses) {
                    cache.invalidateUser(actions[0].userId)
                }

                if (hasFriendshipActions) {
                    // Invalider le cache utilisateur pour les actions d'amitié
                    cache.invalidateUser(actions[0].userId)
                    // Invalider aussi le cache des autres utilisateurs impliqués
                    actions.forEach(action => {
                        if (action.type.startsWith('friendship_') && isFriendshipActionData(action.data)) {
                            cache.invalidateUser(action.data.toUserId)
                        }
                    })
                }
            } else {
                console.error('❌ [BatchManager] Erreur lors du traitement batch:', result.error)
            }
        } catch (error) {
            console.error('❌ [BatchManager] Erreur réseau lors du traitement batch:', error)
            if (error instanceof Error) {
                console.error('❌ [BatchManager] Message:', error.message)
                console.error('❌ [BatchManager] Stack:', error.stack)
            }
        }
    }

    // Sauvegarder immédiatement (pour beforeunload)
    async saveNow(): Promise<void> {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer)
        }
        await this.processBatch()
    }
}

// ===== API CLIENT =====

class ApiClient {
    private async makeRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
        // Log API call seulement en mode debug
        if (process.env.NODE_ENV === 'development') {
            console.log(`📡 [API] ${options?.method || 'GET'} ${endpoint}`)
        }

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                ...options
            })

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`)
            }

            const result = await response.json()

            if (result.success) {
                console.log(`✅ [API SUCCESS] ${endpoint} - Data received`)
                return result.data
            } else {
                throw new Error(result.error || 'Erreur API')
            }
        } catch (error) {
            console.error(`❌ [API ERROR] ${endpoint}:`, error)
            if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
                throw new Error('Impossible de se connecter au serveur. Vérifiez que le backend est démarré.')
            }
            throw error
        }
    }

    // ===== EVENTS =====
    async getEvents(): Promise<Event[]> {
        return this.makeRequest<Event[]>('/events')
    }


    async createEvent(eventData: Omit<Event, 'id'>): Promise<Event> {
        return this.makeRequest<Event>('/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventData)
        })
    }

    async updateEvent(_eventId: string, eventData: Event): Promise<Event> {
        return this.makeRequest<Event>('/events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventData)
        })
    }

    // ===== USERS =====
    async getUsers(): Promise<User[]> {
        return this.makeRequest<User[]>('/users')
    }

    async getUserRelations(userId: string): Promise<Friend[]> {
        return this.makeRequest<Friend[]>(`/users/${userId}/friends?status=all`)
    }

    async sendFriendshipRequest(fromUserId: string, toUserId: string): Promise<{ id: string, status: string }> {
        return this.makeRequest<{ id: string, status: string }>('/users/friendships', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                fromUserId,
                toUserId,
                status: 'pending'
            })
        })
    }

    async searchUsersByEmail(email: string, currentUserId: string): Promise<Array<{ id: string, name: string, email: string, city: string, friendshipStatus: string }>> {
        return this.makeRequest<Array<{ id: string, name: string, email: string, city: string, friendshipStatus: string }>>(
            `/users/search?query=${encodeURIComponent(email)}&currentUserId=${currentUserId}`
        )
    }

    async searchUsers(query: string, currentUserId: string): Promise<Array<{ id: string, name: string, email: string, city: string, friendshipStatus: string }>> {
        return this.makeRequest<Array<{ id: string, name: string, email: string, city: string, friendshipStatus: string }>>(
            `/users/search?query=${encodeURIComponent(query)}&currentUserId=${currentUserId}`
        )
    }

    async getUserEvents(userId: string): Promise<Event[]> {
        return this.makeRequest<Event[]>(`/users/${userId}/events`)
    }

    // ===== GEOCODING =====
    async searchAddresses(query: string, options?: { countryCode?: string; limit?: number }): Promise<AddressSuggestion[]> {
        const params = new URLSearchParams()
        if (options?.countryCode) params.set('countryCode', options.countryCode)
        if (typeof options?.limit === 'number') params.set('limit', String(options.limit))
        const qs = params.toString()
        const endpoint = `/geocode/search/${encodeURIComponent(query)}${qs ? `?${qs}` : ''}`
        return this.makeRequest<AddressSuggestion[]>(endpoint)
    }

    // ===== RESPONSES =====
    async getResponses(): Promise<UserResponse[]> {
        return this.makeRequest<UserResponse[]>('/responses')
    }

    // ===== BATCH =====
    async processBatch(actions: BatchAction[]): Promise<BatchProcessResult> {
        return this.makeRequest<BatchProcessResult>('/batch', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                actions,
                userId: actions[0]?.userId
            })
        })
    }

}

// ===== INSTANCES GLOBALES =====

const cache = new MemoryCache()
const responseCache = new ResponseCache() // Cache spécialisé pour les réponses (sans TTL)
const batchManager = new BatchManager()
const apiClient = new ApiClient()

// ===== FOMO DATA MANAGER =====

export class FomoDataManager {
    // ===== EVENTS =====

    async getEvents(): Promise<Event[]> {
        const cacheKey = 'events'
        let events = cache.get<Event[]>(cacheKey)

        if (!events) {
            // Chargement des événements depuis l'API
            events = await apiClient.getEvents()
            cache.set(cacheKey, events)
        } else {
            console.log('💾 Événements récupérés depuis le cache')
        }

        return events
    }

    async createEvent(eventData: Omit<Event, 'id'>): Promise<Event> {
        console.log('📝 Création d\'un nouvel événement...')
        const newEvent = await apiClient.createEvent(eventData)

        // Mettre à jour le cache
        const events = cache.get<Event[]>('events') || []
        cache.set('events', [...events, newEvent])

        return newEvent
    }

    async updateEvent(eventId: string, eventData: Event): Promise<Event> {
        console.log('📝 Mise à jour d\'un événement...')
        const updatedEvent = await apiClient.updateEvent(eventId, eventData)

        // Mettre à jour le cache
        const events = cache.get<Event[]>('events') || []
        const updatedEvents = events.map(event =>
            event.id === eventId ? updatedEvent : event
        )
        cache.set('events', updatedEvents)

        return updatedEvent
    }

    updateEventInCache(eventId: string, updates: Partial<Event>): void {
        console.log('💾 Mise à jour optimiste du cache...')
        const events = cache.get<Event[]>('events') || []
        const updatedEvents = events.map(event =>
            event.id === eventId ? { ...event, ...updates } : event
        )
        cache.set('events', updatedEvents)
    }

    // ===== USERS =====

    async getUsers(): Promise<User[]> {
        const cacheKey = 'users'
        let users = cache.get<User[]>(cacheKey)

        if (!users) {
            // Chargement des utilisateurs depuis l'API
            users = await apiClient.getUsers()
            cache.set(cacheKey, users)
        } else {
            console.log('💾 Utilisateurs récupérés depuis le cache')
        }

        return users
    }

    async getUserEvents(userId: string): Promise<Event[]> {
        // Pas de cache local pour éviter la staleness sur profils
        return apiClient.getUserEvents(userId)
    }


    async getUserRelations(userId: string): Promise<Friend[]> {
        const cacheKey = `user-relations-${userId}`
        let relations = cache.get<Friend[]>(cacheKey)

        if (!relations) {
            // Chargement des relations pour l'utilisateur
            relations = await apiClient.getUserRelations(userId)
            cache.set(cacheKey, relations)
        } else {
            console.log(`💾 Relations récupérées depuis le cache pour ${userId}`)
        }

        return relations
    }

    // ===== GEOCODING =====
    async searchAddresses(query: string, options?: { countryCode?: string; limit?: number }): Promise<AddressSuggestion[]> {
        return apiClient.searchAddresses(query, options)
    }

    async sendFriendshipRequest(fromUserId: string, toUserId: string): Promise<boolean> {
        try {
            console.log(`👥 Envoi d'une demande d'amitié: ${fromUserId} -> ${toUserId}`)
            await apiClient.sendFriendshipRequest(fromUserId, toUserId)

            // Invalider le cache des relations pour les deux utilisateurs
            cache.invalidateUser(fromUserId)
            cache.invalidateUser(toUserId)

            return true
        } catch (error) {
            console.error('❌ Erreur lors de l\'envoi de la demande d\'amitié:', error)
            return false
        }
    }

    async searchUsersByEmail(email: string, currentUserId: string): Promise<Array<{ id: string, name: string, email: string, city: string, friendshipStatus: string }>> {
        return apiClient.searchUsers(email, currentUserId)
    }

    async searchUsers(query: string, currentUserId: string): Promise<Array<{ id: string, name: string, email: string, city: string, friendshipStatus: string }>> {
        return apiClient.searchUsers(query, currentUserId)
    }

    // ===== RESPONSES =====

    async getResponses(): Promise<UserResponse[]> {
        const cacheKey = 'responses'
        // Utiliser le cache de réponses sans TTL
        let responses = responseCache.get<UserResponse[]>(cacheKey)

        if (!responses) {
            // Chargement des réponses depuis l'API
            responses = await apiClient.getResponses()
            responseCache.set(cacheKey, responses)
        } else {
            console.log('💾 Réponses récupérées depuis le cache (sans TTL)')
        }

        return responses
    }

    // ===== BATCH ACTIONS =====

    addEventResponse(userId: string, eventId: string, initialResponse: UserResponseValue, finalResponse: UserResponseValue, invitedByUserId: string): void {
        const action: BatchAction = {
            id: `event_response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'event_response',
            data: {
                eventId,
                initialResponse,
                finalResponse,
                invitedByUserId,
            },
            userId,
            timestamp: Date.now()
        }

        batchManager.addAction(action)
        console.log(`➕ Réponse ajoutée au batch: userId ${userId} - ${initialResponse} -> ${finalResponse} pour ${eventId}${invitedByUserId !== 'none' ? ` (invitedByUserId: ${invitedByUserId})` : ''}`)
    }

    addFriendshipAction(userId: string, type: 'accept' | 'block' | 'remove', friendshipId: string, toUserId: string): void {
        const action: BatchAction = {
            id: `friendship_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: `friendship_${type}` as BatchAction['type'],
            data: { friendshipId, toUserId },
            userId,
            timestamp: Date.now()
        }

        batchManager.addAction(action)
        console.log(`➕ Action d'amitié ajoutée au batch: ${type} pour ${toUserId}`)
    }

    // ===== CACHE MANAGEMENT =====

    invalidateCache(): void {
        cache.clear()
        console.log('🗑️ Cache complètement vidé')
    }

    invalidateUserCache(userId: string): void {
        cache.invalidateUser(userId)
        responseCache.invalidateUser(userId) // Invalider aussi le cache de réponses
        console.log(`🗑️ Cache invalidé pour l'utilisateur: ${userId}`)
    }

    // ===== UTILITAIRES =====

    getUserResponse(userId: string, eventId: string, responses: UserResponse[]): UserResponseValue {
        // NOUVEAU SYSTÈME : Trouver la dernière réponse (la plus récente)
        const userEventResponses = responses
            .filter(r => r.userId === userId && r.eventId === eventId && !r.deletedAt)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        return userEventResponses.length > 0 ? userEventResponses[0].finalResponse : null
    }

    async savePendingActions(): Promise<void> {
        await batchManager.saveNow()
    }

    // ===== UPLOAD =====
    // Upload désactivé temporairement

    // ===== AUTH =====

    async checkUserByEmail(email: string): Promise<User | null> {
        try {
            // Normaliser l'email (trim + toLowerCase) avant l'envoi pour être cohérent avec le backend
            const normalizedEmail = (email || '').trim().toLowerCase()
            const apiUrl = `${API_BASE_URL}/users/email/${encodeURIComponent(normalizedEmail)}`

            console.log(`🔍 [Frontend] Recherche utilisateur par email: "${normalizedEmail}"`)
            console.log(`🔗 [Frontend] URL API: ${apiUrl}`)

            const response = await fetch(apiUrl)

            if (response.ok) {
                const result = await response.json()
                if (result.success && result.data) {
                    console.log(`✅ [Frontend] Utilisateur trouvé: ${result.data.name} (${result.data.email})`)
                    return result.data
                }
                // Utilisateur non trouvé (success: false ou data: null)
                console.log(`ℹ️ [Frontend] Utilisateur non trouvé (success: false)`)
                return null
            }

            // Erreur HTTP (404, 500, etc.) - utilisateur non trouvé ou erreur serveur
            if (response.status === 404) {
                // Utilisateur non trouvé - c'est normal, retourner null
                console.log(`ℹ️ [Frontend] Utilisateur non trouvé (404)`)
                return null
            }

            // Autre erreur HTTP - logger et retourner null
            const errorText = await response.text().catch(() => 'Unable to read error')
            console.error(`❌ [Frontend] Erreur HTTP ${response.status} lors de la vérification utilisateur:`, errorText)
            return null
        } catch (error) {
            // Erreur réseau ou autre - logger et retourner null (fallback)
            const errorMessage = error instanceof Error ? error.message : String(error)
            const errorStack = error instanceof Error ? error.stack : undefined
            console.error('❌ [Frontend] Erreur vérification utilisateur:', {
                message: errorMessage,
                stack: errorStack,
                apiUrl: `${API_BASE_URL}/users/email/...`
            })
            return null
        }
    }

    async matchByEmail(email: string): Promise<string | null> {
        try {
            const normalizedEmail = (email || '').trim().toLowerCase()
            const apiUrl = `${API_BASE_URL}/users/match-email/${encodeURIComponent(normalizedEmail)}`

            console.log(`🔍 [Frontend] matchByEmail: "${normalizedEmail}"`)
            console.log(`🔗 [Frontend] URL API: ${apiUrl}`)

            const response = await fetch(apiUrl)

            if (!response.ok) {
                console.error(`❌ [Frontend] matchByEmail erreur: ${response.status} ${response.statusText}`)
                return null
            }

            const result = await response.json()
            if (result.success && result.data) {
                console.log(`✅ [Frontend] matchByEmail trouvé: ${result.data}`)
                return result.data
            }

            console.log(`ℹ️ [Frontend] matchByEmail: aucun utilisateur trouvé`)
            return null
        } catch (error) {
            console.error('❌ [Frontend] Erreur matchByEmail:', error)
            return null
        }
    }


    async updateUser(userId: string, userData: User, newId?: string): Promise<User | null> {
        try {
            // Préparer le payload avec tous les champs explicites (comme pour events)
            const payload: any = {
                id: newId && newId !== userId ? newId : userId, // Nouvel ID si migration, sinon ID actuel
                name: userData.name,
                email: userData.email,
                city: userData.city,
                lat: userData.lat || null,
                lng: userData.lng || null,
                friendsCount: userData.friendsCount,
                // Valeurs par défaut pour users (écrasent les anciennes valeurs)
                showAttendanceToFriends: userData.showAttendanceToFriends !== undefined ? userData.showAttendanceToFriends : true,
                privacy: { showAttendanceToFriends: userData.showAttendanceToFriends !== undefined ? userData.showAttendanceToFriends : true },
                isPublicProfile: userData.isPublicProfile !== undefined ? userData.isPublicProfile : false,
                isActive: true, // Toujours actif
                isAmbassador: userData.isAmbassador !== undefined ? userData.isAmbassador : false,
                allowRequests: userData.allowRequests !== undefined ? userData.allowRequests : true,
                modifiedAt: new Date().toISOString(),
                lastConnexion: new Date().toISOString()
            }

            // Si changement d'ID, indiquer l'ancien ID pour la migration
            if (newId && newId !== userId) {
                payload.oldId = userId // Ancien ID pour migration des réponses
            }

            const response = await fetch(`${API_BASE_URL}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            })

            if (!response.ok) {
                throw new Error(`Erreur lors de la mise à jour de l'utilisateur: ${response.status} ${response.statusText}`)
            }

            const result = await response.json()
            if (result.success && result.data) {
                return {
                    id: result.data.id,
                    name: result.data.name,
                    email: result.data.email,
                    city: result.data.city,
                    friendsCount: result.data.friendsCount || 0,
                    showAttendanceToFriends: result.data.showAttendanceToFriends ?? true,
                    isPublicProfile: result.data.isPublicProfile ?? false,
                    isAmbassador: result.data.isAmbassador ?? false
                } as User
            }

            return null
        } catch (error) {
            console.error('❌ Erreur updateUser:', error)
            throw error
        }
    }

    async saveUserToBackend(userData: User, lastConnexion?: string): Promise<User | null> {
        // Géocoder la ville avant de sauvegarder
        let lat = null
        let lng = null

        // Préparer le payload avec tous les champs explicites (valeurs par défaut comme pour events)
        const payload: any = {
            ...(userData.id && userData.id.trim() ? { id: userData.id } : {}), // Envoyer l'ID seulement s'il existe vraiment
            name: userData.name,
            email: userData.email,
            city: userData.city,
            lat: lat,
            lng: lng,
            friendsCount: userData.friendsCount,
            // Valeurs par défaut pour users (écrasent les anciennes valeurs)
            showAttendanceToFriends: userData.showAttendanceToFriends !== undefined ? userData.showAttendanceToFriends : true,
            privacy: { showAttendanceToFriends: userData.showAttendanceToFriends !== undefined ? userData.showAttendanceToFriends : true },
            isPublicProfile: userData.isPublicProfile !== undefined ? userData.isPublicProfile : false,
            isActive: true, // Toujours actif
            isAmbassador: userData.isAmbassador !== undefined ? userData.isAmbassador : false,
            allowRequests: userData.allowRequests !== undefined ? userData.allowRequests : true,
            modifiedAt: new Date().toISOString(),
            lastConnexion: lastConnexion || format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx")
        }

        const response = await fetch(`${API_BASE_URL}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        })

        if (!response.ok) {
            throw new Error(`Erreur lors de la sauvegarde de l'utilisateur: ${response.status} ${response.statusText}`)
        }

        const result = await response.json()
        if (result.success && result.data) {
            // Retourner les données du user créé depuis le backend
            return {
                id: result.data.id,
                name: result.data.name,
                email: result.data.email,
                city: result.data.city,
                friendsCount: result.data.friendsCount || 0,
                showAttendanceToFriends: result.data.showAttendanceToFriends ?? true,
                isPublicProfile: result.data.isPublicProfile ?? false,
                isAmbassador: result.data.isAmbassador ?? false
            } as User & { isPublicProfile: boolean }
        }

        // Si pas de data, retourner null (ne devrait pas arriver)
        return null
    }

}

// ===== EXPORT =====

export const fomoDataManager = new FomoDataManager()

// ===== HOOKS SIMPLIFIÉS =====

// Objet stable pour éviter les re-créations
const fomoDataApi = {
    // Events
    getEvents: () => fomoDataManager.getEvents(),
    createEvent: (eventData: Omit<Event, 'id'>) => fomoDataManager.createEvent(eventData),
    updateEvent: (eventId: string, eventData: Event) => fomoDataManager.updateEvent(eventId, eventData),
    updateEventInCache: (eventId: string, updates: Partial<Event>) => fomoDataManager.updateEventInCache(eventId, updates),



    // Users
    getUsers: () => fomoDataManager.getUsers(),
    getUserRelations: (userId: string) => fomoDataManager.getUserRelations(userId),
    getUserEvents: (userId: string) => fomoDataManager.getUserEvents(userId),
    sendFriendshipRequest: (fromUserId: string, toUserId: string) => fomoDataManager.sendFriendshipRequest(fromUserId, toUserId),
    searchUsersByEmail: (email: string, currentUserId: string) => fomoDataManager.searchUsersByEmail(email, currentUserId),
    searchUsers: (query: string, currentUserId: string) => fomoDataManager.searchUsers(query, currentUserId),

    // Auth
    checkUserByEmail: (email: string) => fomoDataManager.checkUserByEmail(email),
    matchByEmail: (email: string) => fomoDataManager.matchByEmail(email),
    updateUser: (userId: string, userData: User, newId?: string) => fomoDataManager.updateUser(userId, userData, newId),
    saveUserToBackend: (userData: User) => fomoDataManager.saveUserToBackend(userData),

    // Responses
    getResponses: () => fomoDataManager.getResponses(),

    // Batch
    addEventResponse: (userId: string, eventId: string, initialResponse: UserResponseValue, finalResponse: UserResponseValue, invitedByUserId: string) => fomoDataManager.addEventResponse(userId, eventId, initialResponse, finalResponse, invitedByUserId),
    addFriendshipAction: (userId: string, type: 'accept' | 'block' | 'remove', friendshipId: string, toUserId: string) => fomoDataManager.addFriendshipAction(userId, type, friendshipId, toUserId),

    // Cache
    invalidateCache: () => fomoDataManager.invalidateCache(),
    invalidateUserCache: (userId: string) => fomoDataManager.invalidateUserCache(userId),

    // Utils
    getUserResponse: (userId: string, eventId: string, responses: UserResponse[]) => fomoDataManager.getUserResponse(userId, eventId, responses),
    savePendingActions: () => fomoDataManager.savePendingActions(),

    // Geocoding
    searchAddresses: (query: string, options?: { countryCode?: string; limit?: number }) => fomoDataManager.searchAddresses(query, options),



}

export const useFomoData = () => {
    return fomoDataApi
}

// ===== SETUP GLOBAL =====

// Sauvegarder les actions en cours avant de quitter la page
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        fomoDataManager.savePendingActions()
    })
}

export default fomoDataManager
