/**
 * Hook pour gérer le batch d'événements du bookmarklet
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getBatchEvents, clearBatch, removeEventsFromBatch, type BookmarkletEvent } from '@/utils/bookmarkletBatch'

const BATCH_STORAGE_KEY = 'fomo-bookmarklet-batch'

export function useBookmarkletBatch() {
    const [batchSize, setBatchSize] = useState(0)
    const [events, setEvents] = useState<BookmarkletEvent[]>([])
    const lastKnownSizeRef = useRef(0)

    // Charger le batch au montage et écouter les changements
    useEffect(() => {
        const loadBatch = () => {
            const batch = getBatchEvents()
            const newSize = batch.length
            console.log('📦 [useBookmarkletBatch] Chargement du batch:', {
                size: newSize,
                events: batch.map(e => ({ id: e.id, title: e.title }))
            })
            setEvents(batch)
            setBatchSize(newSize)
            lastKnownSizeRef.current = newSize
        }

        // Charger immédiatement
        console.log('📦 [useBookmarkletBatch] Initialisation du hook')
        loadBatch()

        // Écouter les changements de localStorage (si l'utilisateur ajoute depuis un autre onglet)
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === BATCH_STORAGE_KEY) {
                console.log('📦 [useBookmarkletBatch] Changement détecté dans localStorage (autre onglet)')
                loadBatch()
            }
        }

        window.addEventListener('storage', handleStorageChange)

        // Vérifier périodiquement (pour les changements dans le même onglet)
        // Note: storage event ne se déclenche que pour les autres onglets
        const interval = setInterval(() => {
            const currentBatch = getBatchEvents()
            const currentSize = currentBatch.length
            if (currentSize !== lastKnownSizeRef.current) {
                console.log('📦 [useBookmarkletBatch] Changement détecté (même onglet):', {
                    ancien: lastKnownSizeRef.current,
                    nouveau: currentSize
                })
                loadBatch()
            }
        }, 1000)

        return () => {
            window.removeEventListener('storage', handleStorageChange)
            clearInterval(interval)
        }
    }, [])

    const refresh = useCallback(() => {
        console.log('📦 [useBookmarkletBatch] Refresh manuel appelé')
        const batch = getBatchEvents()
        const newSize = batch.length
        console.log('📦 [useBookmarkletBatch] Nouveau batch après refresh:', {
            size: newSize,
            events: batch.map(e => ({ id: e.id, title: e.title }))
        })
        setEvents(batch)
        setBatchSize(newSize)
    }, [])

    const clear = useCallback(() => {
        clearBatch()
        setEvents([])
        setBatchSize(0)
    }, [])

    const removeEvents = useCallback((eventIds: string[]) => {
        removeEventsFromBatch(eventIds)
        refresh()
    }, [refresh])

    return {
        batchSize,
        events,
        refresh,
        clear,
        removeEvents
    }
}

