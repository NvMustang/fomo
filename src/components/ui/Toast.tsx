/**
 * Toast Component - Système de notification unifié
 * Composant UI pour afficher des notifications toast
 */

import React, { useState, useEffect } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
    title: string
    message: string
    type: ToastType
    duration?: number
}

interface ToastProps {
    toast: ToastMessage | null
    onClose: () => void
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
    const [isVisible, setIsVisible] = useState(false)
    const [isClosing, setIsClosing] = useState(false)

    useEffect(() => {
        if (toast) {
            console.log('🍞 [Toast] DISPLAYING toast:', toast.title, '-', toast.message, '- type:', toast.type)
            setIsVisible(true)
            setIsClosing(false)

            // Auto-fermeture après la durée spécifiée
            const timer = setTimeout(() => {
                setIsClosing(true)
                // Attendre la fin de l'animation CSS avant de fermer
                setTimeout(() => {
                    setIsVisible(false)
                    onClose()
                }, 200) // Durée de l'animation de sortie
            }, toast.duration || 2000)

            return () => clearTimeout(timer)
        } else if (isVisible) {
            // Fermeture immédiate avec animation quand toast devient null
            setIsClosing(true)
            const closeTimer = setTimeout(() => {
                setIsVisible(false)
                setIsClosing(false)
            }, 200) // Durée de l'animation de sortie

            return () => clearTimeout(closeTimer)
        }
    }, [toast, onClose, isVisible])

    if (!isVisible || !toast) {
        return null
    }

    return (
        <div className={`toast-overlay ${isClosing ? 'closing' : ''}`}>
            <div className={`toast-message ${toast.type}`}>
                <h3>{toast.title}</h3>
                {toast.message && <p>{toast.message}</p>}
            </div>
        </div>
    )
}
