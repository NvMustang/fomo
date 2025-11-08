/**
 * FOMO MVP - Hook pour gérer les handlers de réponses visitor
 * Gère les clics sur les réponses, l'animation des étoiles, le modal d'inscription et la création du visiteur
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useFomoDataContext } from '@/contexts/FomoDataProvider'
import { useFomoData } from '@/utils/dataManager'
import { getUser } from '@/utils/filterTools'
import { getApiBaseUrl } from '@/config/env'
import { onboardingTracker } from '../utils/onboardingTracker'
import { useStarsAnimation } from './useStarsAnimation'
import type { Event, UserResponseValue, User } from '@/types/fomoTypes'

/**
 * Obtenir le nom de l'organisateur d'un événement
 */
function getOrganizerName(event: Event | null, users: User[] | null | undefined): string {
    if (!event) {
        return 'L\'organisateur'
    }
    const organizer = getUser(users || [], event.organizerId)
    return organizer?.name || event.organizerName || 'L\'organisateur'
}

export function useVisitorResponseHandlers(
    selectedEvent: Event | null,
    onVisitorFormCompleted: (organizerName: string) => void,
    onEventCardClose?: () => void,
    _hasUserAndResponse?: boolean, // Fork : si user + response existent (non utilisé pour l'instant)
    onHideToast?: () => void,
    showCloseEventCardToast?: (selectedEvent: Event | null) => void, // Toast éducatif pour fermer l'EventCard (mutualisé entre Cas A et Cas B)
    getSelectedEvent?: () => Event | null, // Fonction getter pour récupérer selectedEvent actuel depuis DiscoverPage
    markResponseClicked?: () => void // Callback pour marquer qu'une réponse a été cliquée (pour éviter le toast impatience)
) {
    const { users, currentUserId, getLatestResponse } = useFomoDataContext()
    const fomoData = useFomoData()

    // Ref pour suivre selectedEvent et vérifier sa valeur actuelle dans les timeouts
    const selectedEventRef = useRef<Event | null>(selectedEvent)
    useEffect(() => {
        selectedEventRef.current = selectedEvent
    }, [selectedEvent])

    // États pour le modal visitor
    // En mode privé, seules participe, maybe, not_there sont valides pour le modal
    const [showVisitorModal, setShowVisitorModal] = useState(false)
    const [selectedResponseType, setSelectedResponseType] = useState<'participe' | 'maybe' | 'not_there' | null>(null)

    // Animation des étoiles pour les réponses visitor
    // Callback appelé à la fin de l'animation
    // Selon la séquence : Animation → Sauvegarde sessionStorage → Modal (Cas A uniquement)
    const handleAnimationEnd = useCallback(() => {
        // Sauvegarder la réponse dans sessionStorage APRÈS l'animation (selon séquence)
        if (selectedResponseType) {
            try {
                sessionStorage.setItem('fomo-visit-pending-response', selectedResponseType)
            } catch {
                // Ignorer si sessionStorage indisponible
            }
        }

        // Vérifier si une réponse existe déjà pour cet événement
        if (selectedEvent && currentUserId && getLatestResponse) {
            const existingResponse = getLatestResponse(currentUserId, selectedEvent.id)
            const hasExistingResponse = existingResponse !== null &&
                existingResponse.finalResponse !== null &&
                existingResponse.finalResponse !== 'cleared'

            // Cas B : Si une réponse existe déjà, ne pas ouvrir le modal
            // Le toast "Bonjour" est affiché à l'ouverture de l'app (étape 3), pas ici
            if (hasExistingResponse) {
                // Toast éducatif pour fermer l'EventCard (mutualisé avec Cas A)
                if (showCloseEventCardToast) {
                    setTimeout(() => {
                        // Vérifier la valeur actuelle de selectedEvent au moment de l'exécution
                        const currentSelectedEvent = getSelectedEvent ? getSelectedEvent() : selectedEventRef.current
                        showCloseEventCardToast(currentSelectedEvent)
                    }, 2000) // 2s après la fin de l'animation
                }
                return
            }
        }

        // Cas A : Si pas de réponse existante, ouvrir le modal normalement
        setShowVisitorModal(true)
        onboardingTracker.trackStep('visitor_modal_opened')
    }, [selectedEvent, currentUserId, getLatestResponse, selectedResponseType, showCloseEventCardToast, getSelectedEvent])

    const { triggerStars, StarsAnimation } = useStarsAnimation({
        onAnimationEnd: handleAnimationEnd
    })

    // Handler pour les réponses en mode visitor
    // En mode privé, seules les réponses suivantes sont valides : participe, maybe, not_there, cleared, seen
    const handleVisitorResponseClick = useCallback((responseType: UserResponseValue) => {
        // Filtrer pour ne garder que les réponses valides en mode privé
        const validPrivateResponses: UserResponseValue[] = ['participe', 'maybe', 'not_there', 'cleared', 'seen']

        if (!responseType || !validPrivateResponses.includes(responseType)) {
            return
        }

        // Ne pas ouvrir le modal pour cleared, seen (ces réponses sont automatiques)
        if (responseType === 'cleared' || responseType === 'seen') {
            return
        }

        // Marquer immédiatement qu'une réponse a été cliquée (pour éviter le toast impatience)
        if (markResponseClicked) {
            markResponseClicked()
        }

        // Fermer le toast impatience si présent
        if (onHideToast) {
            onHideToast()
        }

        // Normaliser le type de réponse
        const normalizedResponseType = responseType as 'participe' | 'maybe' | 'not_there'
        setSelectedResponseType(normalizedResponseType)

        // Track réponse cliquée
        onboardingTracker.trackStep('response_clicked')

        // Selon la séquence : Animation des étoiles se joue AVANT la sauvegarde
        // La sauvegarde dans sessionStorage se fera dans handleAnimationEnd (après l'animation)
        // Pour Cas B, le toast "Bonjour" sera aussi géré dans handleAnimationEnd
        triggerStars(normalizedResponseType)
        onboardingTracker.trackStep('stars_animation_started')
    }, [triggerStars, onHideToast, markResponseClicked])

    // Handler pour la confirmation du modal visitor
    // Ne fait QUE sauvegarder le nom/email, ne PAS envoyer la réponse
    // La réponse sera envoyée par EventCard.handleClose quand il se ferme
    const handleVisitorModalConfirm = useCallback(async (name: string, email?: string) => {
        // Sauvegarder le nom et email en sessionStorage
        try {
            sessionStorage.setItem('fomo-visit-name', name)
            if (email) {
                sessionStorage.setItem('fomo-visit-email', email)
            }
            // Sauvegarder aussi la réponse sélectionnée pour qu'EventCard puisse l'utiliser
            if (selectedResponseType) {
                sessionStorage.setItem('fomo-visit-pending-response', selectedResponseType)
            }
        } catch {
            // Ignorer si sessionStorage indisponible
        }

        // Créer ou mettre à jour l'utilisateur dans la base de données
        try {
            const apiUrl = getApiBaseUrl()
            let userId: string | null = null

            // 1. Vérifier si un visitorUserId existe déjà dans sessionStorage
            try {
                const savedUserId = sessionStorage.getItem('fomo-visit-user-id')
                if (savedUserId) {
                    userId = savedUserId
                    console.log(`🔄 [useVisitorResponseHandlers] Utilisation de l'ID visitor existant: ${userId}`)
                }
            } catch {
                // Ignorer si sessionStorage indisponible
            }

            // 2. Si pas d'ID en sessionStorage, vérifier par email si un visitor existe
            if (!userId && email?.trim()) {
                try {
                    const matchedId = await fomoData.matchByEmail(email.trim())
                    if (matchedId) {
                        const existingUser = await fomoData.checkUserByEmail(email.trim())
                        // Utiliser l'ID seulement si c'est un visitor (pas un user authentifié)
                        if (existingUser && existingUser.isVisitor === true) {
                            userId = matchedId
                            console.log(`🔄 [useVisitorResponseHandlers] Visitor trouvé par email: ${userId}`)
                            // Mettre à jour sessionStorage avec l'ID trouvé
                            try {
                                sessionStorage.setItem('fomo-visit-user-id', userId)
                            } catch {
                                // Ignorer si sessionStorage indisponible
                            }
                        }
                    }
                } catch (error) {
                    console.error('❌ [useVisitorResponseHandlers] Erreur lors de la recherche par email:', error)
                }
            }

            // 3. Si toujours pas d'ID, créer un nouveau visitor
            if (!userId) {
                userId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
                console.log(`📝 [useVisitorResponseHandlers] Création d'un nouveau visitor: ${userId}`)
            }

            const userData = {
                id: userId,
                name: name.trim(),
                email: email?.trim() || '',
                city: '',
                friendsCount: 0,
                showAttendanceToFriends: false,
                privacy: { showAttendanceToFriends: false },
                isPublicProfile: false,
                isActive: true,
                isAmbassador: false,
                allowRequests: false,
                isVisitor: true,
                createdAt: new Date().toISOString()
            }

            const response = await fetch(`${apiUrl}/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            })

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Erreur inconnue')
                console.error('Erreur lors de la sauvegarde de l\'utilisateur visitor:', response.status, response.statusText, errorText)
            } else {
                const result = await response.json().catch(() => null)
                if (result?.success) {
                    // Sauvegarder l'ID utilisateur en sessionStorage pour référence future
                    try {
                        sessionStorage.setItem('fomo-visit-user-id', userId)
                    } catch {
                        // Ignorer si sessionStorage indisponible
                    }
                    console.log(`✅ [useVisitorResponseHandlers] Visitor ${result.action === 'updated' ? 'mis à jour' : 'créé'}: ${userId}`)
                } else {
                    console.error('Erreur lors de la sauvegarde de l\'utilisateur visitor: réponse invalide', result)
                }
            }
        } catch (error) {
            console.error('Erreur lors de la sauvegarde de l\'utilisateur visitor:', error)
            // Ne pas bloquer le flux si la sauvegarde échoue
        }

        // Fermer le modal
        setShowVisitorModal(false)
        setSelectedResponseType(null)

        // Track complétion formulaire
        onboardingTracker.trackStep('form_completed')

        // Appeler le callback parent pour mettre visitorRegistrationCompletedRef.current à true
        if (selectedEvent) {
            const organizerName = getOrganizerName(selectedEvent, users)
            console.log('📝 [useVisitorResponseHandlers] Appel onVisitorFormCompleted')
            onVisitorFormCompleted(organizerName)
        }

        // Toast éducatif pour fermer l'EventCard (mutualisé avec Cas B)
        if (showCloseEventCardToast) {
            setTimeout(() => {
                // Vérifier la valeur actuelle de selectedEvent au moment de l'exécution
                const currentSelectedEvent = getSelectedEvent ? getSelectedEvent() : selectedEventRef.current
                showCloseEventCardToast(currentSelectedEvent)
            }, 2000) // 2s après la confirmation du formulaire
        }

        // Ne pas fermer l'EventCard automatiquement - l'utilisateur doit la fermer manuellement
    }, [selectedResponseType, selectedEvent, users, onVisitorFormCompleted, onEventCardClose, showCloseEventCardToast, getSelectedEvent])

    // Handler pour la fermeture du modal
    const handleVisitorModalClose = useCallback(() => {
        setShowVisitorModal(false)
        setSelectedResponseType(null)
    }, [])

    // Handler pour l'événement centré (vide pour l'instant)
    const handleEventCentered = useCallback(() => {
        // NOP - placeholder pour future logic
    }, [])

    return {
        showVisitorModal,
        selectedResponseType,
        handleVisitorResponseClick,
        handleVisitorModalConfirm,
        handleVisitorModalClose,
        handleEventCentered,
        StarsAnimation,
        organizerName: getOrganizerName(selectedEvent, users)
    }
}

