/**
 * Utilitaire pour gérer le batch d'événements du bookmarklet
 * 
 * Les événements sont stockés dans localStorage avec la clé 'fomo-bookmarklet-batch'
 */

const BATCH_STORAGE_KEY = 'fomo-bookmarklet-batch'

export interface BookmarkletEvent {
    id: string
    timestamp: string
    source: string
    url: string
    title: string
    description?: string
    start: string
    end?: string
    venue_name?: string
    address?: string
    host?: string
    cover?: string
    attending_count?: string | number
    interested_count?: string | number
}

/**
 * Récupérer tous les événements du batch
 */
export function getBatchEvents(): BookmarkletEvent[] {
    try {
        console.log('🔍 [BookmarkletBatch] Lecture de localStorage avec clé:', BATCH_STORAGE_KEY)
        const batchData = localStorage.getItem(BATCH_STORAGE_KEY)
        console.log('🔍 [BookmarkletBatch] Données brutes depuis localStorage:', batchData ? `présentes (${batchData.length} caractères)` : 'absentes')
        
        if (!batchData) {
            console.log('ℹ️ [BookmarkletBatch] Aucune donnée trouvée dans localStorage')
            return []
        }
        
        const batch = JSON.parse(batchData)
        console.log('🔍 [BookmarkletBatch] Données parsées:', {
            estArray: Array.isArray(batch),
            longueur: Array.isArray(batch) ? batch.length : 'N/A',
            type: typeof batch,
            contenu: Array.isArray(batch) ? batch.map(e => ({ id: e.id, title: e.title })) : batch
        })
        
        if (!Array.isArray(batch)) {
            console.warn('⚠️ [BookmarkletBatch] Les données ne sont pas un tableau:', typeof batch, batch)
            return []
        }
        
        console.log('✅ [BookmarkletBatch] Événements retournés:', batch.length)
        return batch
    } catch (error) {
        console.error('❌ [BookmarkletBatch] Erreur lors de la lecture du batch:', error)
        console.error('❌ [BookmarkletBatch] Stack:', error instanceof Error ? error.stack : 'N/A')
        return []
    }
}

/**
 * Obtenir le nombre d'événements en attente
 */
export function getBatchSize(): number {
    return getBatchEvents().length
}

/**
 * Supprimer un événement du batch
 */
export function removeEventFromBatch(eventId: string): void {
    try {
        const batch = getBatchEvents()
        const filtered = batch.filter(e => e.id !== eventId)
        localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(filtered))
    } catch (error) {
        console.error('❌ [BookmarkletBatch] Erreur lors de la suppression:', error)
    }
}

/**
 * Vider complètement le batch
 */
export function clearBatch(): void {
    try {
        localStorage.removeItem(BATCH_STORAGE_KEY)
    } catch (error) {
        console.error('❌ [BookmarkletBatch] Erreur lors du vidage:', error)
    }
}

/**
 * Supprimer plusieurs événements du batch
 */
export function removeEventsFromBatch(eventIds: string[]): void {
    try {
        const batch = getBatchEvents()
        const filtered = batch.filter(e => !eventIds.includes(e.id))
        localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(filtered))
    } catch (error) {
        console.error('❌ [BookmarkletBatch] Erreur lors de la suppression multiple:', error)
    }
}

