/**
 * Hook useToast - Gestion des notifications toast
 * Hook simple pour afficher des toasts dans l'application
 */

import { useState, useCallback, useEffect } from 'react'
import { ToastMessage } from '@/components/ui/Toast'

// État global du toast (singleton)
let globalToast: ToastMessage | null = null
let globalListeners: Array<(toast: ToastMessage | null) => void> = []

const notifyListeners = (toast: ToastMessage | null) => {
    globalToast = toast
    globalListeners.forEach(listener => listener(toast))
}

export const useToast = () => {
    const [currentToast, setCurrentToast] = useState<ToastMessage | null>(globalToast)

    // S'abonner aux changements de toast
    const handleToastChange = useCallback((toast: ToastMessage | null) => {
        setCurrentToast(toast)
    }, [])

    // Ajouter le listener au montage
    useEffect(() => {
        globalListeners.push(handleToastChange)
        return () => {
            globalListeners = globalListeners.filter(listener => listener !== handleToastChange)
        }
    }, [handleToastChange])

    const showToast = useCallback((toast: ToastMessage) => {
        notifyListeners(toast)
    }, [])

    const hideToast = useCallback(() => {
        notifyListeners(null)
    }, [])

    return {
        currentToast,
        showToast,
        hideToast,
        isVisible: currentToast !== null
    }
}
