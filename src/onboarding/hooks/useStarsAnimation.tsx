/**
 * FOMO MVP - Hook générique pour gérer l'animation des étoiles avec effets avancés
 * Animation spectaculaire avec traînées, glow, particules secondaires
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

// Types pour canvas-confetti
type ConfettiModule = typeof import('canvas-confetti')
type ConfettiShape = NonNullable<ReturnType<ConfettiModule['default']['shapeFromText']>>
type ConfettiConfig = {
    particleCount: number
    spread: number
    startVelocity: number
    gravity: number
    scalar: number
    decay?: number
    drift?: number
    angle: number
    ticks: number
    origin: { x: number; y: number }
    flat?: boolean
    disableForReducedMotion?: boolean
    shapes?: ConfettiShape[]
}

/**
 * Créer les shapes d'emojis pour canvas-confetti
 */
function createEmojiShapes(
    confetti: ConfettiModule['default'],
    emojis: string[],
    scalar: number
): ConfettiShape[] {
    return emojis
        .map(emoji => {
            try {
                return confetti.shapeFromText({ text: emoji, scalar })
            } catch (err) {
                console.error('[StarsAnimation] Error creating shape for emoji', emoji, err)
                return null
            }
        })
        .filter((shape): shape is ConfettiShape => shape !== null)
}

/**
 * Mapping des émojis selon le type de réponse
 * 5 émojis par réponse, sets finaux
 */
const getReactionEmojis = (responseType?: 'participe' | 'maybe' | 'not_there'): string[] => {
    switch (responseType) {
        case 'participe':
            // Ambiance positive, énergie, fête
            return ['🎉', '🕺', '✨', '🥳', '💃']
        case 'maybe':
            // Curiosité, hésitation, bienveillance
            return ['🤞', '👀', '❓', '🤔', '✨']
        case 'not_there':
            // Désolé, fatigué, bienveillant malgré le refus
            return ['🥲', '✨', '🤷‍♂️', '🚫', '🤷‍♀️']
        default:
            // Par défaut, utiliser les émojis de "participe"
            return ['🎉', '😄', '🙌', '🥳', '💃']
    }
}

export function useStarsAnimation(options?: {
    buttonId?: string
    starCount?: number
    duration?: number
    responseType?: 'participe' | 'maybe' | 'not_there'
    onAnimationEnd?: () => void
}) {
    const [showStars, setShowStars] = useState(false)
    const starsRef = useRef<HTMLDivElement>(null)
    const buttonId = options?.buttonId
    const starCount = options?.starCount ?? 40
    const duration = options?.duration ?? 2000
    // Utiliser un ref pour stocker le responseType dynamique
    const responseTypeRef = useRef<'participe' | 'maybe' | 'not_there' | undefined>(options?.responseType)
    // Utiliser un ref pour stocker le callback onAnimationEnd
    const onAnimationEndRef = useRef<(() => void) | undefined>(options?.onAnimationEnd)

    // Mettre à jour le ref quand onAnimationEnd change
    useEffect(() => {
        onAnimationEndRef.current = options?.onAnimationEnd
    }, [options?.onAnimationEnd])

    // Fonction pour déclencher l'animation avec un responseType
    const triggerStars = useCallback((responseType?: 'participe' | 'maybe' | 'not_there') => {
        if (responseType) {
            responseTypeRef.current = responseType
        }
        setShowStars(true)
    }, [])

    useEffect(() => {
        if (!showStars || !starsRef.current) return

        // Lire le responseType depuis le ref au moment de l'exécution
        const responseType = responseTypeRef.current

        // Position centrale (fixe)
        starsRef.current.style.left = '50%'
        starsRef.current.style.top = '50%'
        starsRef.current.style.transform = 'translate(-50%, -50%)'
        starsRef.current.style.width = '100vw'
        starsRef.current.style.height = '100vh'

        const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        const count = prefersReducedMotion ? Math.max(8, Math.floor(starCount * 0.4)) : starCount

        const container = starsRef.current
        // Confetti via canvas-confetti (dynamic import) + logs; no DOM fallback
        try {
            // Créer un canvas explicitement pour éviter l'erreur getContext
            let canvas = container.querySelector('canvas') as HTMLCanvasElement
            if (!canvas) {
                canvas = document.createElement('canvas')
                canvas.style.position = 'absolute'
                canvas.style.top = '0'
                canvas.style.left = '0'
                canvas.style.width = '100%'
                canvas.style.height = '100%'
                canvas.style.pointerEvents = 'none'
                container.appendChild(canvas)
            }

            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const load = window.__confettiLoader || (window.__confettiLoader = import('canvas-confetti'))
            load.then((mod: ConfettiModule) => {
                console.info('[StarsAnimation] canvas-confetti loaded')
                const confetti = mod.default || mod
                // Désactiver useWorker pour éviter l'erreur transferControlToOffscreen
                // Passer le canvas explicitement au lieu du container
                const myConfetti = confetti.create(canvas, { resize: true, useWorker: false })

                // Configuration pour le modal visitor (quand buttonId n'est pas fourni)
                const isVisitorModal = !buttonId

                let cfg: ConfettiConfig
                if (isVisitorModal) {
                    // Configuration fixe pour le modal visitor (bas de l'écran, centré)
                    cfg = {
                        particleCount: 50,
                        spread: 30,
                        startVelocity: 21,
                        gravity: 0.9,
                        scalar: 4,
                        decay: 0.9760116708098051,
                        drift: 0,
                        angle: 90,
                        ticks: 150,
                        origin: { x: 0.5, y: 1.0 }, // Bas de l'écran, centré
                        flat: true,
                        disableForReducedMotion: prefersReducedMotion,
                    }

                    // Créer les shapes d'emojis
                    const ems = getReactionEmojis(responseType)
                    const shapes = createEmojiShapes(confetti, ems, cfg.scalar)

                    if (shapes.length > 0) {
                        cfg.shapes = shapes
                    }
                } else {
                    // Configuration originale pour les autres usages
                    const base: ConfettiConfig = {
                        particleCount: Math.max(40, Math.floor(count * 6)),
                        spread: 70,
                        startVelocity: 35,
                        ticks: Math.floor(duration / 8),
                        gravity: 1.0,
                        scalar: 1.0,
                        angle: 90,
                        origin: { x: 0.5, y: 0.5 },
                        disableForReducedMotion: prefersReducedMotion,
                    }

                    cfg = (() => {
                        switch (responseType) {
                            case 'participe':
                                return { ...base, spread: 85, startVelocity: 50, gravity: 0.9, scalar: 1.1 }
                            case 'maybe':
                                return { ...base, spread: 60, startVelocity: 30, gravity: 0.85, scalar: 0.95, origin: { x: 0.5, y: 0.5 } }
                            case 'not_there':
                                return { ...base, spread: 50, startVelocity: 25, gravity: 0.7, scalar: 0.9 }
                            default:
                                return base
                        }
                    })()

                    // Créer les shapes d'emojis selon le type de réponse
                    const ems = getReactionEmojis(responseType)
                    const shapes = createEmojiShapes(confetti, ems, cfg.scalar)

                    if (shapes.length > 0) {
                        cfg.shapes = shapes
                    }
                }

                console.info('[StarsAnimation] trigger confetti', { responseType, cfg, isVisitorModal })
                myConfetti({ ...cfg })

                // Double burst seulement si ce n'est pas le modal visitor
                if (!isVisitorModal) {
                    setTimeout(() => {
                        myConfetti({ ...cfg, particleCount: Math.round(cfg.particleCount * 0.6), spread: cfg.spread + 15, scalar: cfg.scalar * 0.92 })
                    }, 120)
                }

                // Emoji accent DOM (seulement si ce n'est pas le modal visitor, car les emojis sont déjà dans le confetti)
                let timer: NodeJS.Timeout
                if (!isVisitorModal) {
                    const accent = document.createElement('div')
                    accent.style.position = 'absolute'
                    accent.style.left = '50%'
                    accent.style.top = '50%'
                    accent.style.transform = 'translate(-50%, -50%)'
                    accent.style.pointerEvents = 'none'
                    const ems = getReactionEmojis(responseType)
                    const frag = document.createDocumentFragment()
                    for (let i = 0; i < 5; i++) {
                        const span = document.createElement('span')
                        span.textContent = ems[i % ems.length]
                        span.style.position = 'absolute'
                        span.style.left = '0'
                        span.style.top = '0'
                        span.style.fontSize = `${28 + Math.floor(Math.random() * 16)}px`
                        const ang = (i / 5) * Math.PI * 2 + Math.random() * 0.25
                        const dist = 60 + Math.random() * 80
                        span.style.transform = `translate3d(${Math.cos(ang) * dist}px, ${Math.sin(ang) * dist}px, 0)`
                        span.style.opacity = '0'
                        span.style.transition = `transform ${Math.floor(duration * 0.8)}ms cubic-bezier(.17,.67,.46,1.01), opacity ${Math.floor(duration * 0.5)}ms ease`
                        frag.appendChild(span)
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                span.style.opacity = '1'
                                span.style.transform = `translate3d(${Math.cos(ang) * (dist + 20)}px, ${Math.sin(ang) * (dist + 20)}px, 0)`
                            })
                        })
                    }
                    accent.appendChild(frag)
                    container.appendChild(accent)

                    timer = setTimeout(() => {
                        if (container.contains(accent)) container.removeChild(accent)
                        setShowStars(false)
                    }, duration)
                } else {
                    // Pour le modal visitor, juste un timer pour fermer l'animation
                    timer = setTimeout(() => {
                        setShowStars(false)
                        // Appeler le callback de fin d'animation si fourni
                        if (onAnimationEndRef.current) {
                            onAnimationEndRef.current()
                        }
                    }, duration)
                }

                return () => clearTimeout(timer)
            }).catch((err: unknown) => {
                console.error('[StarsAnimation] confetti import failed', err)
                setShowStars(false)
            })
        } catch (err) {
            console.error('[StarsAnimation] confetti import threw', err)
            setShowStars(false)
        }

        return () => { }
    }, [showStars, buttonId, starCount, duration])

    const StarsAnimation = showStars ? createPortal(
        <div
            ref={starsRef}
            className="stars-container stars-container--fade-out"
        />,
        document.body
    ) : null

    return {
        showStars,
        setShowStars, // Gardé pour compatibilité
        triggerStars, // Nouvelle fonction pour déclencher avec responseType
        StarsAnimation
    }
}

