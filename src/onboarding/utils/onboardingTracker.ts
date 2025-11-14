/**
 * Onboarding Tracker - Suivi du parcours d'intégration visitor
 * 
 * Tracke les étapes du parcours, temps passés, abandons et statistiques
 * 
 * @author FOMO MVP Team
 */

import { isProd } from '@/config/env'

export type OnboardingStep =
    | 'initialization'
    | 'flyto_started'
    | 'flyto_completed'
    | 'invitation_toast_shown'
    | 'bonjour_toast_shown'
    | 'pin_clicked'
    | 'eventcard_opened'
    | 'details_toast_shown'
    | 'details_expanded'
    | 'label_clicked'
    | 'buttons_activated'
    | 'impatience_toast_shown'
    | 'response_clicked'
    | 'stars_animation_started'
    | 'visitor_modal_opened'
    | 'visitor_form_name_focus'
    | 'visitor_form_name_blur'
    | 'visitor_form_email_focus'
    | 'visitor_form_email_blur'
    | 'visitor_form_city_focus'
    | 'visitor_form_city_blur'
    | 'visitor_form_email_error'
    | 'form_completed'
    | 'thankyou_toast_shown'
    | 'getVisitorResponse_started'
    | 'getVisitorResponse_completed'
    | 'pssst_toast_shown'
    | 'visitorDiscoverPublicMode_started'
    | 'visitorDiscoverPublicMode_completed'
    | 'privacy_toggled'
    | 'zoomout_started'
    | 'zoomout_completed'
    | 'exploration_toast_shown'
    | 'fake_pin_clicked'
    | 'fake_eventcard_opened'
    | 'fake_events_toast_shown'
    | 'signup_clicked'
    | 'user_form_name_focus'
    | 'user_form_name_blur'
    | 'user_form_email_focus'
    | 'user_form_email_blur'
    | 'user_form_city_focus'
    | 'user_form_city_blur'
    | 'user_form_email_error'
    | 'user_form_city_error'
    | 'user_account_created'
    | 'welcome_screen_shown'
    | 'view_my_events_clicked'
    | 'abandoned'
    | 'completed'

export interface OnboardingStepEvent {
    step: OnboardingStep
    timestamp: number
    timeSinceStart: number // Temps depuis le début du parcours (ms)
    timeSinceLastStep: number | null // Temps depuis la dernière étape (ms)
    sessionId: string
    userAgent?: string
    viewport?: { width: number; height: number }
}

export interface OnboardingSession {
    sessionId: string
    startTime: number
    endTime: number | null
    steps: OnboardingStepEvent[]
    completed: boolean
    abandonedAt: OnboardingStep | null
    totalDuration: number | null // Durée totale en ms
    lastStep: OnboardingStep | null
    userAgent?: string
    viewport?: { width: number; height: number }
    deploymentId?: string // Identifiant du déploiement (pour comparaison)
}

export interface OnboardingData {
    sessions: OnboardingSession[]
    currentSession: OnboardingSession | null
    lastUpdate: number
}

const MAX_SESSIONS = 100 // Limiter le nombre de sessions en mémoire

class OnboardingTracker {
    private data: OnboardingData

    /**
     * Obtenir la clé de storage selon l'environnement
     */
    private getStorageKey(): string {
        const isVercelProd = typeof window !== 'undefined' &&
            (window.location.hostname.includes('vercel.app') ||
                window.location.hostname.includes('vercel.com'))
        const prod = isProd() || isVercelProd
        return prod ? 'fomo_onboarding_prod' : 'fomo_onboarding_test'
    }

    constructor() {
        this.data = this.loadFromStorage()
        this.setupAbandonDetection()
    }

    private loadFromStorage(): OnboardingData {
        const storageKey = this.getStorageKey()
        try {
            const stored = localStorage.getItem(storageKey)
            if (stored) {
                const parsed = JSON.parse(stored)
                if (parsed && parsed.sessions) {
                    // Limiter le nombre de sessions
                    const sessions = parsed.sessions.slice(-MAX_SESSIONS)
                    return {
                        sessions,
                        currentSession: parsed.currentSession || null,
                        lastUpdate: parsed.lastUpdate || Date.now()
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ [OnboardingTracker] Erreur chargement storage:', error)
        }

        return {
            sessions: [],
            currentSession: null,
            lastUpdate: Date.now()
        }
    }

    private saveToStorage(): void {
        const storageKey = this.getStorageKey()
        try {
            localStorage.setItem(storageKey, JSON.stringify(this.data))
        } catch (error) {
            console.warn('⚠️ [OnboardingTracker] Erreur sauvegarde storage:', error)
        }
    }

    /**
     * Obtenir l'ID de déploiement (pour comparaison entre déploiements)
     * 
     * Priorité :
     * 1. VITE_DEPLOYMENT_ID (variable d'environnement explicite)
     * 2. VERCEL_GIT_COMMIT_SHA (fourni automatiquement par Vercel = commit SHA)
     * 3. Date du jour (fallback pour dev local)
     */
    private getDeploymentId(): string {
        // 1. Variable d'environnement explicite (peut être définie manuellement)
        const explicitDeploymentId = typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEPLOYMENT_ID
        if (explicitDeploymentId) {
            return explicitDeploymentId.trim()
        }

        // 2. Commit SHA depuis Vercel (automatique à chaque push)
        // Vercel injecte VERCEL_GIT_COMMIT_SHA au build time
        // On doit l'exposer via VITE_ pour que Vite le rende disponible
        // Note: Il faut ajouter VERCEL_GIT_COMMIT_SHA dans vite.config.ts ou .env
        const commitSha = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GIT_COMMIT_SHA
        if (commitSha) {
            // Utiliser les 7 premiers caractères du SHA (format court Git)
            return commitSha.trim().substring(0, 7)
        }

        // 3. Fallback : date du jour (pour dev local uniquement)
        // En production Vercel, on devrait toujours avoir le commit SHA
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return `dev-${today.getTime()}`
    }

    /**
     * Générer un ID de session unique
     */
    private generateSessionId(): string {
        return `onboarding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    /**
     * Démarrer une nouvelle session d'onboarding
     */
    startSession(): string {
        const sessionId = this.generateSessionId()
        const startTime = Date.now()

        const session: OnboardingSession = {
            sessionId,
            startTime,
            endTime: null,
            steps: [],
            completed: false,
            abandonedAt: null,
            totalDuration: null,
            lastStep: null,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
            viewport: typeof window !== 'undefined' ? {
                width: window.innerWidth,
                height: window.innerHeight
            } : undefined,
            deploymentId: this.getDeploymentId()
        }

        this.data.currentSession = session
        this.saveToStorage()

        // Enregistrer l'étape initiale
        this.trackStep('initialization')

        console.log('📊 [OnboardingTracker] Session démarrée:', sessionId)
        return sessionId
    }

    /**
     * Tracker une étape du parcours
     */
    trackStep(step: OnboardingStep): void {
        if (!this.data.currentSession) {
            // Démarrer automatiquement une session si elle n'existe pas
            this.startSession()
        }

        const session = this.data.currentSession!
        const now = Date.now()
        const timeSinceStart = now - session.startTime
        const lastStep = session.steps.length > 0 ? session.steps[session.steps.length - 1] : null
        const timeSinceLastStep = lastStep ? now - lastStep.timestamp : null

        const stepEvent: OnboardingStepEvent = {
            step,
            timestamp: now,
            timeSinceStart,
            timeSinceLastStep,
            sessionId: session.sessionId,
            userAgent: session.userAgent,
            viewport: session.viewport
        }

        session.steps.push(stepEvent)
        session.lastStep = step

        // Marquer comme complété si c'est la dernière étape
        if (step === 'completed') {
            session.completed = true
            session.endTime = now
            session.totalDuration = timeSinceStart
            this.finishSession()
        }

        // Marquer comme abandonné si c'est un abandon
        if (step === 'abandoned') {
            session.abandonedAt = session.lastStep
            session.endTime = now
            session.totalDuration = timeSinceStart
            this.finishSession()
        }

        this.saveToStorage()

        console.log(`📊 [OnboardingTracker] Étape trackée: ${step} (${timeSinceStart}ms depuis le début)`)
    }

    /**
     * Finaliser la session actuelle
     */
    finishSession(): void {
        if (!this.data.currentSession) return

        const session = this.data.currentSession
        this.data.sessions.push(session)

        // Limiter le nombre de sessions
        if (this.data.sessions.length > MAX_SESSIONS) {
            this.data.sessions = this.data.sessions.slice(-MAX_SESSIONS)
        }

        this.data.currentSession = null
        this.data.lastUpdate = Date.now()
        this.saveToStorage()

        console.log('📊 [OnboardingTracker] Session finalisée:', session.sessionId, {
            completed: session.completed,
            abandonedAt: session.abandonedAt,
            totalDuration: session.totalDuration,
            stepsCount: session.steps.length
        })

        // Déclencher un événement pour notifier la sauvegarde automatique
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('onboarding-session-finished'))
        }
    }

    /**
     * Détecter les abandons (quand l'utilisateur quitte)
     */
    private setupAbandonDetection(): void {
        if (typeof window === 'undefined') return

        // Détecter quand l'utilisateur quitte la page
        const handleBeforeUnload = () => {
            if (this.data.currentSession && !this.data.currentSession.completed) {
                this.trackStep('abandoned')
                // Essayer de sauvegarder (peut ne pas fonctionner selon le navigateur)
                try {
                    this.saveToStorage()
                } catch (error) {
                    // Ignorer les erreurs lors de beforeunload
                }
            }
        }

        // Détecter quand l'utilisateur change d'onglet/app
        const handleVisibilityChange = () => {
            if (document.hidden && this.data.currentSession && !this.data.currentSession.completed) {
                // L'utilisateur a quitté l'onglet, mais on ne marque pas comme abandonné
                // car il peut revenir. On tracke juste l'événement de visibilité.
                console.log('📊 [OnboardingTracker] Onglet caché, session en pause')
            }
        }

        window.addEventListener('beforeunload', handleBeforeUnload)
        document.addEventListener('visibilitychange', handleVisibilityChange)

        // Nettoyer au démontage (si jamais)
        if (typeof window !== 'undefined') {
            // Garder les listeners actifs pour toute la durée de vie de l'app
        }
    }

    /**
     * Obtenir les statistiques agrégées
     */
    getStats(): {
        totalSessions: number
        completedSessions: number
        abandonedSessions: number
        averageDuration: number | null
        averageSteps: number
        abandonmentRate: number
        stepAverages: Record<OnboardingStep, number | null>
        abandonmentPoints: Record<OnboardingStep, number>
        medianDuration: number | null
        medianSteps: number
    } {
        const sessions = this.data.sessions
        const totalSessions = sessions.length
        const completedSessions = sessions.filter(s => s.completed).length
        const abandonedSessions = sessions.filter(s => s.abandonedAt !== null).length

        // Calculer les durées moyennes
        const completedDurations = sessions
            .filter(s => s.totalDuration !== null)
            .map(s => s.totalDuration!)
        const averageDuration = completedDurations.length > 0
            ? completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length
            : null

        // Calculer le nombre moyen d'étapes
        const stepCounts = sessions.map(s => s.steps.length)
        const averageSteps = stepCounts.length > 0
            ? stepCounts.reduce((a, b) => a + b, 0) / stepCounts.length
            : 0

        // Calculer la médiane de durée
        const sortedDurations = [...completedDurations].sort((a, b) => a - b)
        const medianDuration = sortedDurations.length > 0
            ? sortedDurations[Math.floor(sortedDurations.length / 2)]
            : null

        // Calculer la médiane d'étapes
        const sortedSteps = [...stepCounts].sort((a, b) => a - b)
        const medianSteps = sortedSteps.length > 0
            ? sortedSteps[Math.floor(sortedSteps.length / 2)]
            : 0

        // Calculer les temps moyens par étape
        const stepAverages: Record<OnboardingStep, number | null> = {} as Record<OnboardingStep, number | null>
        const allSteps: OnboardingStep[] = [
            'initialization', 'flyto_started', 'flyto_completed', 'invitation_toast_shown', 'bonjour_toast_shown',
            'pin_clicked', 'eventcard_opened', 'details_toast_shown', 'details_expanded', 'label_clicked',
            'buttons_activated', 'impatience_toast_shown', 'response_clicked', 'stars_animation_started',
            'visitor_modal_opened', 'visitor_form_name_focus', 'visitor_form_name_blur', 'visitor_form_email_focus',
            'visitor_form_email_blur', 'visitor_form_city_focus', 'visitor_form_city_blur', 'visitor_form_email_error',
            'form_completed', 'thankyou_toast_shown', 'getVisitorResponse_started',
            'getVisitorResponse_completed', 'pssst_toast_shown', 'visitorDiscoverPublicMode_started',
            'visitorDiscoverPublicMode_completed', 'privacy_toggled', 'zoomout_started', 'zoomout_completed', 'exploration_toast_shown',
            'fake_pin_clicked', 'fake_eventcard_opened', 'fake_events_toast_shown', 'signup_clicked',
            'user_form_name_focus', 'user_form_name_blur', 'user_form_email_focus', 'user_form_email_blur',
            'user_form_city_focus', 'user_form_city_blur', 'user_form_email_error', 'user_form_city_error',
            'user_account_created', 'welcome_screen_shown', 'abandoned', 'completed'
        ]

        allSteps.forEach(step => {
            const stepEvents = sessions
                .flatMap(s => s.steps)
                .filter(e => e.step === step)
            if (stepEvents.length > 0) {
                stepAverages[step] = stepEvents.reduce((sum, e) => sum + e.timeSinceStart, 0) / stepEvents.length
            } else {
                stepAverages[step] = null
            }
        })

        // Calculer les points d'abandon
        const abandonmentPoints: Record<OnboardingStep, number> = {} as Record<OnboardingStep, number>
        allSteps.forEach(step => {
            abandonmentPoints[step] = sessions.filter(s => s.abandonedAt === step).length
        })

        const abandonmentRate = totalSessions > 0 ? (abandonedSessions / totalSessions) * 100 : 0

        return {
            totalSessions,
            completedSessions,
            abandonedSessions,
            averageDuration,
            averageSteps,
            abandonmentRate,
            stepAverages,
            abandonmentPoints,
            medianDuration,
            medianSteps
        }
    }

    /**
     * Obtenir la session actuelle
     */
    getCurrentSession(): OnboardingSession | null {
        return this.data.currentSession
    }

    /**
     * Obtenir toutes les sessions
     */
    getAllSessions(): OnboardingSession[] {
        return [...this.data.sessions]
    }

    /**
     * Exporter les données pour sauvegarde backend
     */
    exportData(): {
        sessions: OnboardingSession[]
        stats: {
            totalSessions: number
            completedSessions: number
            abandonedSessions: number
            averageDuration: number | null
            averageSteps: number
            abandonmentRate: number
            stepAverages: Record<OnboardingStep, number | null>
            abandonmentPoints: Record<OnboardingStep, number>
            medianDuration: number | null
            medianSteps: number
        }
    } {
        return {
            sessions: this.getAllSessions(),
            stats: this.getStats()
        }
    }

    /**
     * Vider les sessions finalisées (après sauvegarde réussie)
     * Garde la session en cours si elle existe
     */
    clearSavedSessions(): void {
        // Garder seulement la session en cours (si elle existe)
        const currentSession = this.data.currentSession
        this.data.sessions = []
        this.data.currentSession = currentSession
        this.data.lastUpdate = Date.now()
        this.saveToStorage()
        console.log('🧹 [OnboardingTracker] Sessions finalisées vidées du cache')
    }

    /**
     * Réinitialiser les données (pour tests)
     */
    reset(): void {
        this.data = {
            sessions: [],
            currentSession: null,
            lastUpdate: Date.now()
        }
        this.saveToStorage()
    }
}

// Instance singleton
export const onboardingTracker = new OnboardingTracker()

