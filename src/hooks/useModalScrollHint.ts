/**
 * Hook pour afficher une animation de scroll à l'ouverture d'un modal
 * Indique visuellement aux utilisateurs qu'ils peuvent scroller le contenu
 * Animation naturelle imitant un scroll humain avec accélération/décélération progressive
 */

import { useEffect, useRef } from 'react'

/**
 * Animation de scroll naturelle imitant un mouvement humain
 * Utilise une fonction d'easing personnalisée pour un mouvement fluide et naturel
 */
function animateScroll(
    element: HTMLElement,
    start: number,
    end: number,
    duration: number,
    onComplete?: () => void
) {
    const startTime = performance.now()
    const distance = end - start

    function step(currentTime: number) {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)

        // Easing personnalisé : ease-in-out avec une légère courbe naturelle
        // Imite un mouvement humain avec accélération progressive puis décélération douce
        const ease = progress < 0.5
            ? 2 * progress * progress // Accélération progressive
            : 1 - Math.pow(-2 * progress + 2, 2) / 2 // Décélération douce

        const current = start + distance * ease
        element.scrollTop = current

        if (progress < 1) {
            requestAnimationFrame(step)
        } else if (onComplete) {
            onComplete()
        }
    }

    requestAnimationFrame(step)
}

/**
 * Hook qui anime un scroll vers le bas puis revient au top à l'ouverture d'un modal
 * Animation naturelle imitant un scroll humain
 * @param isOpen - Si le modal est ouvert
 * @param delay - Délai avant de lancer l'animation (par défaut 500ms pour attendre l'animation d'entrée)
 */
export function useModalScrollHint(isOpen: boolean, delay: number = 500) {
    const scrollElementRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!isOpen || !scrollElementRef.current) return

        const scrollElement = scrollElementRef.current
        const maxScroll = scrollElement.scrollHeight - scrollElement.clientHeight

        // Si le contenu n'est pas scrollable, ne rien faire
        if (maxScroll <= 0) return

        let timer2: NodeJS.Timeout | null = null

        // Attendre que l'animation d'entrée du modal soit terminée
        const timer1 = setTimeout(() => {
            const scrollAmount = Math.min(40, maxScroll) // Légèrement plus pour mieux montrer le scroll
            const startPosition = scrollElement.scrollTop

            // Animation vers le bas avec mouvement naturel (800ms)
            animateScroll(
                scrollElement,
                startPosition,
                scrollAmount,
                800,
                () => {
                    // Petite pause naturelle (200ms) avant de remonter
                    timer2 = setTimeout(() => {
                        // Animation de retour au top avec mouvement naturel (600ms)
                        animateScroll(
                            scrollElement,
                            scrollAmount,
                            0,
                            600,
                            () => {
                                // Effet de rebond : léger overshoot vers le bas puis retour à 0
                                animateScroll(
                                    scrollElement,
                                    0,
                                    6, // Petit rebond vers le bas (overshoot)
                                    120,
                                    () => {
                                        // Retour final à 0 avec rebond amorti
                                        animateScroll(
                                            scrollElement,
                                            6,
                                            0,
                                            180
                                        )
                                    }
                                )
                            }
                        )
                    }, 200)
                }
            )
        }, delay)

        return () => {
            clearTimeout(timer1)
            if (timer2) {
                clearTimeout(timer2)
            }
        }
    }, [isOpen, delay])

    return scrollElementRef
}

