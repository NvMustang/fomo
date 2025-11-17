/**
 * Map animations - Pulse and other dynamic animations for map features
 */

import type { Event } from '@/types/fomoTypes'

/**
 * Initialise et démarre l'animation pulse pour les events "linked" ou "invited"
 * @param eventsToAnimate - Liste des events à animer
 * @param map - Instance MapLibre
 * @param pulseAnimationStartedRef - Ref pour tracker si l'animation a déjà été démarrée
 * @param pulseAnimationFrameRef - Ref pour stocker l'ID de requestAnimationFrame
 */
export const initializePulseAnimation = (
    eventsToAnimate: Event[],
    map: any,
    pulseAnimationStartedRef: { current: boolean },
    pulseAnimationFrameRef: { current: number | null }
) => {
    if (pulseAnimationStartedRef.current || eventsToAnimate.length === 0) return

    pulseAnimationStartedRef.current = true

    // Attendre un court délai pour que MapLibre traite les features
    setTimeout(() => {
        // Initialiser le feature-state pulse
        eventsToAnimate.forEach((event: Event) => {
            try {
                map.setFeatureState({ source: 'events', id: event.id }, { pulse: 0.2 })
            } catch (e) {
                // Ignorer si le feature-state n'existe pas encore
            }
        })

        // Démarrer l'animation pulse avec requestAnimationFrame (boucle infinie)
        if (pulseAnimationFrameRef.current === null) {
            const PULSE_PERIOD = 1000 // 1 seconde
            let startTime = performance.now()

            const tick = (now: number) => {
                if (!map || !map.getSource('events')) {
                    pulseAnimationFrameRef.current = null
                    return
                }

                // Utiliser le modulo pour faire boucler l'animation indéfiniment
                const elapsed = (now - startTime) % PULSE_PERIOD

                // Calculer l'opacité avec une fonction sinusoïdale qui boucle (plage 0.2 à 1.0)
                const normalizedPulse = 0.5 - 0.5 * Math.cos((elapsed / PULSE_PERIOD) * 2 * Math.PI)
                const opacity = 0.2 + 0.8 * normalizedPulse

                // Mettre à jour tous les événements linked/invited
                eventsToAnimate.forEach((event: Event) => {
                    try {
                        map.setFeatureState({ source: 'events', id: event.id }, { pulse: opacity })
                    } catch (e) {
                        // Ignorer si le feature-state n'existe pas
                    }
                })

                // Continuer l'animation en boucle
                pulseAnimationFrameRef.current = requestAnimationFrame(tick)
            }

            pulseAnimationFrameRef.current = requestAnimationFrame(tick)
        }
    }, 100) // Délai de 100ms pour laisser MapLibre traiter
}

