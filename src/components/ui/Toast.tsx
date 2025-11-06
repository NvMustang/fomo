/**
 * Toast Component - Système de notification unifié
 * Composant UI pour afficher des notifications toast
 */

import React, { useState, useEffect, useRef } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
    title: string | React.ReactNode
    message: string | React.ReactNode
    type: ToastType
    duration?: number
    className?: string
    position?: 'top' | 'bottom'
    bounceAnimation?: boolean
}

interface ToastProps {
    toast: ToastMessage | null
    onClose: () => void
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
    const [isVisible, setIsVisible] = useState(false)
    const [isClosing, setIsClosing] = useState(false)
    const isVisibleRef = useRef(isVisible)

    // Synchroniser la ref pour éviter de dépendre de isVisible dans l'effet principal
    useEffect(() => {
        isVisibleRef.current = isVisible
    }, [isVisible])

    useEffect(() => {
        if (toast) {
            console.log('🍞 [Toast] DISPLAYING toast:', toast.title, '-', toast.message, '- type:', toast.type)
            setIsVisible(true)
            setIsClosing(false)

            // Auto-fermeture après la durée spécifiée (si duration est définie et > 0)
            // Si duration est undefined ou 0, le toast attend l'action utilisateur
            if (toast.duration !== undefined && toast.duration > 0) {
                const timer = setTimeout(() => {
                    setIsClosing(true)
                    // Attendre la fin de l'animation CSS avant de fermer
                    setTimeout(() => {
                        setIsVisible(false)
                        onClose()
                    }, 200) // Durée de l'animation de sortie
                }, toast.duration)

                return () => clearTimeout(timer)
            }
            // Pas de timer si duration est undefined ou 0
        } else if (isVisibleRef.current) {
            // Fermeture immédiate avec animation quand toast devient null
            setIsClosing(true)
            const closeTimer = setTimeout(() => {
                setIsVisible(false)
                setIsClosing(false)
            }, 200) // Durée de l'animation de sortie

            return () => clearTimeout(closeTimer)
        }
    }, [toast, onClose])

    if (!isVisible || !toast) {
        return null
    }

    const position = toast.position || 'top'
    const isBottom = position === 'bottom'
    const overlayStyle: React.CSSProperties = isBottom
        ? {
            alignItems: 'flex-end',
            paddingTop: 0,
            paddingBottom: '15vh'
        }
        : {}

    return (
        <div 
            className={`toast-overlay ${isClosing ? 'closing' : ''} ${toast.bounceAnimation ? 'toast-bounce' : ''}`}
            style={overlayStyle}
        >
            <div className={`toast-message ${toast.type} ${toast.className || ''}`}>
                <h3>{toast.title}</h3>
                {toast.message && <p>{toast.message}</p>}
            </div>
        </div>
    )
}
