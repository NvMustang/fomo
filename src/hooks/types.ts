/**
 * Types partagés pour les hooks
 */

export interface UserResponse {
    userId: string
    eventId: string
    response: 'going' | 'interested' | 'not_interested'
    createdAt: string
}
