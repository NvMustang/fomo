/**
 * Onboarding Dashboard - Analyse du parcours visitor
 * 
 * Dashboard pour visualiser les statistiques d'onboarding
 * 
 * @author FOMO MVP Team
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getApiBaseUrl } from '@/config/env'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface OnboardingStats {
    totalSessions: number
    completedSessions: number
    abandonedSessions: number
    averageDuration: number | null
    averageSteps: number
    abandonmentRate: number
    stepAverages: Record<string, number>
    abandonmentPoints: Record<string, number>
    sessions: Array<{
        sessionId: string
        startTime: string
        endTime: string | null
        completed: boolean
        abandonedAt: string | null
        totalDuration: string | null
        stepsCount: string
        lastStep: string | null
        deploymentId?: string
    }>
    steps: Array<{
        sessionId: string
        step: string
        timestamp: string
        timeSinceStart: string
        timeSinceLastStep: string | null
    }>
    // Nouvelles métriques
    funnel?: {
        pin_clicked: number
        eventcard_opened: number
        response_clicked: number
        form_completed: number
        visitorDiscoverPublicMode_started: number
        signup_clicked: number
        user_account_created: number
    }
    stepWaitTimes?: Record<string, { min: number; max: number; avg: number }>
    formFieldStats?: {
        visitor: {
            name: { focused: number; filled: number }
            email: { focused: number; filled: number }
            city: { focused: number; filled: number }
            errors: number
        }
        user: {
            name: { focused: number; filled: number }
            email: { focused: number; filled: number }
            city: { focused: number; filled: number }
            errors: number
        }
    }
    conversionRate?: number
    deployments?: Record<string, {
        deploymentId: string
        totalSessions: number
        completedSessions: number
        abandonedSessions: number
        completionRate: number
        abandonmentRate: number
        conversionRate: number
        funnel: {
            pin_clicked: number
            eventcard_opened: number
            response_clicked: number
            form_completed: number
            visitorDiscoverPublicMode_started: number
            signup_clicked: number
            user_account_created: number
        }
    }>
}

interface OnboardingDashboardProps {
    onClose?: () => void
}

const OnboardingDashboard: React.FC<OnboardingDashboardProps> = ({ onClose }) => {
    const [stats, setStats] = useState<OnboardingStats | null>(null)
    const [loading, setLoading] = useState<boolean>(false)
    const [selectedDeploymentId, setSelectedDeploymentId] = useState<string | null>(null)

    // Obtenir le deploymentId actuel (celui de la session courante)
    const getCurrentDeploymentId = useCallback((): string => {
        const explicitDeploymentId = typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEPLOYMENT_ID
        if (explicitDeploymentId) {
            return explicitDeploymentId.trim()
        }
        const commitSha = typeof import.meta !== 'undefined' && import.meta.env?.VITE_GIT_COMMIT_SHA
        if (commitSha) {
            return commitSha.trim().substring(0, 7)
        }
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return `dev-${today.getTime()}`
    }, [])

    const currentDeploymentId = useMemo(() => getCurrentDeploymentId(), [getCurrentDeploymentId])

    // Obtenir les stats d'un déploiement spécifique
    const getDeploymentStats = useCallback((deploymentId: string | null) => {
        if (!stats?.deployments || !deploymentId) return null
        return stats.deployments[deploymentId] || null
    }, [stats])

    const currentDeploymentStats = useMemo(() => getDeploymentStats(currentDeploymentId), [getDeploymentStats, currentDeploymentId])
    const selectedDeploymentStats = useMemo(() => getDeploymentStats(selectedDeploymentId), [getDeploymentStats, selectedDeploymentId])

    // Liste des déploiements disponibles
    const availableDeployments = useMemo(() => {
        if (!stats?.deployments) return []
        return Object.keys(stats.deployments).sort()
    }, [stats])

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const apiUrl = getApiBaseUrl()
            const response = await fetch(`${apiUrl}/onboarding/aggregated`)
            const result = await response.json()
            if (result.success) {
                console.log('📊 [OnboardingDashboard] Données chargées:', {
                    totalSessions: result.data.totalSessions,
                    deploymentsCount: result.data.deployments ? Object.keys(result.data.deployments).length : 0,
                    deployments: result.data.deployments
                })
                setStats(result.data)
                // Initialiser le déploiement sélectionné au premier disponible (si pas déjà défini)
                if (!selectedDeploymentId && result.data.deployments) {
                    const deploymentIds = Object.keys(result.data.deployments)
                    if (deploymentIds.length > 0) {
                        // Sélectionner le premier déploiement qui n'est pas le déploiement actuel
                        const otherDeployment = deploymentIds.find(id => id !== currentDeploymentId) || deploymentIds[0]
                        setSelectedDeploymentId(otherDeployment)
                    }
                }
            } else {
                console.warn('⚠️ Erreur chargement données onboarding:', result.error)
            }
        } catch (error) {
            console.warn('⚠️ Erreur chargement données onboarding:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadData()
        const interval = setInterval(() => {
            loadData()
        }, 60 * 60 * 1000) // 1 heure
        return () => clearInterval(interval)
    }, [loadData])

    if (loading && !stats) {
        return (
            <div className="dashboard-container">
                <div className="spinner" />
            </div>
        )
    }

    if (!stats) {
        return (
            <div className="dashboard-container">
                <p>Aucune donnée disponible</p>
            </div>
        )
    }

    // Couleurs standardisées pour la comparaison
    const COLORS = {
        actuel: '#0088FE', // Bleu pour le déploiement actuel
        comparé: '#82ca9d'  // Vert pour le déploiement comparé
    }

    // Calculer les abandonment points par déploiement
    const abandonmentData = (() => {
        if (!stats.sessions) return []

        // Calculer pour le déploiement actuel
        const currentSessions = stats.sessions.filter(s => {
            const sessionDeploymentId = (s.deploymentId || '').toString().trim() || currentDeploymentId
            return sessionDeploymentId === currentDeploymentId
        })
        const currentAbandonmentPoints: Record<string, number> = {}
        currentSessions.forEach(session => {
            if (session.abandonedAt && session.abandonedAt !== '') {
                currentAbandonmentPoints[session.abandonedAt] = (currentAbandonmentPoints[session.abandonedAt] || 0) + 1
            }
        })

        // Calculer pour le déploiement comparé (si sélectionné)
        let selectedAbandonmentPoints: Record<string, number> = {}
        if (selectedDeploymentId && stats.sessions) {
            const selectedSessions = stats.sessions.filter(s => {
                const sessionDeploymentId = (s.deploymentId || '').toString().trim() || currentDeploymentId
                return sessionDeploymentId === selectedDeploymentId
            })
            selectedSessions.forEach(session => {
                if (session.abandonedAt && session.abandonedAt !== '') {
                    selectedAbandonmentPoints[session.abandonedAt] = (selectedAbandonmentPoints[session.abandonedAt] || 0) + 1
                }
            })
        }

        // Combiner tous les steps uniques
        const allSteps = new Set([
            ...Object.keys(currentAbandonmentPoints),
            ...Object.keys(selectedAbandonmentPoints)
        ])

        return Array.from(allSteps)
            .map(step => ({
                step,
                actuel: currentAbandonmentPoints[step] || 0,
                comparé: selectedAbandonmentPoints[step] || 0
            }))
            .filter(item => item.actuel > 0 || item.comparé > 0)
            .sort((a, b) => Math.max(b.actuel, b.comparé) - Math.max(a.actuel, a.comparé))
            .slice(0, 10)
    })()

    // Calculer les temps d'attente par déploiement
    const stepWaitTimesData = (() => {
        if (!stats.steps || !stats.sessions) return []

        // Calculer pour le déploiement actuel
        const currentSessions = stats.sessions.filter(s => {
            const sessionDeploymentId = (s.deploymentId || '').toString().trim() || currentDeploymentId
            return sessionDeploymentId === currentDeploymentId
        })
        const currentSessionIds = new Set(currentSessions.map(s => s.sessionId))
        const currentSteps = stats.steps.filter(s => currentSessionIds.has(s.sessionId))

        const currentWaitTimes: Record<string, { times: number[] }> = {}
        currentSteps.forEach(step => {
            if (step.step && step.timeSinceLastStep) {
                const time = parseFloat(step.timeSinceLastStep) || 0
                if (time > 0) {
                    if (!currentWaitTimes[step.step]) {
                        currentWaitTimes[step.step] = { times: [] }
                    }
                    currentWaitTimes[step.step].times.push(time)
                }
            }
        })

        // Calculer pour le déploiement comparé
        let selectedWaitTimes: Record<string, { times: number[] }> = {}
        if (selectedDeploymentId && stats.sessions) {
            const selectedSessions = stats.sessions.filter(s => {
                const sessionDeploymentId = (s.deploymentId || '').toString().trim() || currentDeploymentId
                return sessionDeploymentId === selectedDeploymentId
            })
            const selectedSessionIds = new Set(selectedSessions.map(s => s.sessionId))
            const selectedSteps = stats.steps.filter(s => selectedSessionIds.has(s.sessionId))

            selectedSteps.forEach(step => {
                if (step.step && step.timeSinceLastStep) {
                    const time = parseFloat(step.timeSinceLastStep) || 0
                    if (time > 0) {
                        if (!selectedWaitTimes[step.step]) {
                            selectedWaitTimes[step.step] = { times: [] }
                        }
                        selectedWaitTimes[step.step].times.push(time)
                    }
                }
            })
        }

        // Combiner tous les steps uniques
        const allSteps = new Set([
            ...Object.keys(currentWaitTimes),
            ...Object.keys(selectedWaitTimes)
        ])

        return Array.from(allSteps)
            .map(step => {
                const currentTimes = currentWaitTimes[step]?.times || []
                const selectedTimes = selectedWaitTimes[step]?.times || []

                const calcStats = (times: number[]) => {
                    if (times.length === 0) return { min: 0, max: 0, avg: 0 }
                    return {
                        min: Math.min(...times),
                        max: Math.max(...times),
                        avg: times.reduce((a, b) => a + b, 0) / times.length
                    }
                }

                const currentStats = calcStats(currentTimes)
                const selectedStats = calcStats(selectedTimes)

                return {
                    step,
                    actuel_avg: Math.round(currentStats.avg / 1000), // en secondes
                    comparé_avg: selectedTimes.length > 0 ? Math.round(selectedStats.avg / 1000) : 0
                }
            })
            .filter(item => item.actuel_avg > 0 || item.comparé_avg > 0)
            .sort((a, b) => Math.max(b.actuel_avg, b.comparé_avg) - Math.max(a.actuel_avg, a.comparé_avg))
            .slice(0, 10)
    })()

    // Calculer les stats de formulaire par déploiement
    const calculateFormStats = (deploymentId: string | null) => {
        if (!deploymentId || !stats.sessions || !stats.steps) {
            return {
                visitor: { name: { focused: 0, filled: 0 }, email: { focused: 0, filled: 0 }, city: { focused: 0, filled: 0 }, errors: 0 },
                user: { name: { focused: 0, filled: 0 }, email: { focused: 0, filled: 0 }, city: { focused: 0, filled: 0 }, errors: 0 }
            }
        }

        const sessions = stats.sessions.filter(s => {
            const sessionDeploymentId = (s.deploymentId || '').toString().trim() || currentDeploymentId
            return sessionDeploymentId === deploymentId
        })
        const sessionIds = new Set(sessions.map(s => s.sessionId))
        const steps = stats.steps.filter(s => sessionIds.has(s.sessionId))

        const formStats = {
            visitor: { name: { focused: 0, filled: 0 }, email: { focused: 0, filled: 0 }, city: { focused: 0, filled: 0 }, errors: 0 },
            user: { name: { focused: 0, filled: 0 }, email: { focused: 0, filled: 0 }, city: { focused: 0, filled: 0 }, errors: 0 }
        }

        steps.forEach(step => {
            if (step.step === 'visitor_form_name_focus') formStats.visitor.name.focused++
            if (step.step === 'visitor_form_name_blur') formStats.visitor.name.filled++
            if (step.step === 'visitor_form_email_focus') formStats.visitor.email.focused++
            if (step.step === 'visitor_form_email_blur') formStats.visitor.email.filled++
            if (step.step === 'visitor_form_city_focus') formStats.visitor.city.focused++
            if (step.step === 'visitor_form_city_blur') formStats.visitor.city.filled++
            if (step.step === 'visitor_form_email_error') formStats.visitor.errors++
            if (step.step === 'user_form_name_focus') formStats.user.name.focused++
            if (step.step === 'user_form_name_blur') formStats.user.name.filled++
            if (step.step === 'user_form_email_focus') formStats.user.email.focused++
            if (step.step === 'user_form_email_blur') formStats.user.email.filled++
            if (step.step === 'user_form_city_focus') formStats.user.city.focused++
            if (step.step === 'user_form_city_blur') formStats.user.city.filled++
            if (step.step === 'user_form_email_error' || step.step === 'user_form_city_error') formStats.user.errors++
        })

        return formStats
    }

    const currentFormStats = calculateFormStats(currentDeploymentId)
    const selectedFormStats = selectedDeploymentId ? calculateFormStats(selectedDeploymentId) : null

    // Préparer les données du funnel pour comparaison
    const funnelData = (() => {
        const currentFunnel = currentDeploymentStats?.funnel || stats.funnel
        const selectedFunnel = selectedDeploymentStats?.funnel

        if (!currentFunnel) return []

        const steps = [
            { key: 'pin_clicked', name: 'Pin cliqué' },
            { key: 'eventcard_opened', name: 'Carte ouverte' },
            { key: 'response_clicked', name: 'Réponse cliquée' },
            { key: 'form_completed', name: 'Formulaire complété' },
            { key: 'visitorDiscoverPublicMode_started', name: 'Découverte FOMO' },
            { key: 'signup_clicked', name: 'Inscription cliquée' },
            { key: 'user_account_created', name: 'Compte créé' }
        ]

        return steps.map(step => ({
            name: step.name,
            actuel: currentFunnel[step.key as keyof typeof currentFunnel] || 0,
            comparé: selectedFunnel?.[step.key as keyof typeof selectedFunnel] || 0
        }))
    })()

    return (
        <div className="dashboard-container" style={{ padding: 'var(--lg)', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--lg)' }}>
                <h1 style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--font-weight-bold)', margin: 0 }}>
                    Onboardings
                </h1>
                {onClose && (
                    <button onClick={onClose} className="back-button" style={{ fontSize: 'var(--text-xl)' }}>
                        ✕
                    </button>
                )}
            </div>

            {/* Comparaison entre déploiements */}
            <div className="card" style={{ padding: 'var(--md)', marginBottom: 'var(--lg)' }}>
                <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--md)' }}>
                    Comparaison entre déploiements
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--md)', marginBottom: 'var(--md)', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--xs)' }}>
                        <div style={{ width: '12px', height: '12px', backgroundColor: COLORS.actuel, borderRadius: '2px' }} />
                        <span style={{ fontSize: 'var(--text-sm)' }}>Actuel ({currentDeploymentId})</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--xs)' }}>
                        <div style={{ width: '12px', height: '12px', backgroundColor: COLORS.comparé, borderRadius: '2px' }} />
                        <span style={{ fontSize: 'var(--text-sm)' }}>Comparé:</span>
                        {availableDeployments.length > 0 ? (
                            <select
                                value={selectedDeploymentId || ''}
                                onChange={(e) => setSelectedDeploymentId(e.target.value || null)}
                                style={{
                                    padding: 'var(--xs) var(--sm)',
                                    fontSize: 'var(--text-sm)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-sm)',
                                    backgroundColor: 'var(--bg-primary)',
                                    color: 'var(--text-primary)',
                                    minWidth: '150px'
                                }}
                            >
                                <option value="">-- Sélectionner --</option>
                                {availableDeployments.map((id) => (
                                    <option key={id} value={id}>
                                        {id} {id === currentDeploymentId ? '(actuel)' : ''}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>Aucun</span>
                        )}
                    </div>
                </div>
                {stats.deployments && Object.keys(stats.deployments).length > 0 ? (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', fontSize: 'var(--text-sm)', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                                    <th style={{ textAlign: 'left', padding: 'var(--sm)' }}>Métrique</th>
                                    <th style={{ textAlign: 'right', padding: 'var(--sm)' }}>Valeur</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: 'var(--sm)', fontWeight: 'var(--font-weight-medium)' }}>Sessions</td>
                                    <td style={{ textAlign: 'right', padding: 'var(--sm)' }}>
                                        <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                            {currentDeploymentStats?.totalSessions ?? stats.totalSessions}
                                        </div>
                                        {selectedDeploymentStats && (
                                            <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                {selectedDeploymentStats.totalSessions}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: 'var(--sm)', fontWeight: 'var(--font-weight-medium)' }}>Complétion</td>
                                    <td style={{ textAlign: 'right', padding: 'var(--sm)' }}>
                                        <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                            {currentDeploymentStats
                                                ? `${Math.round(currentDeploymentStats.completionRate)}%`
                                                : stats.totalSessions > 0
                                                    ? `${Math.round((stats.completedSessions / stats.totalSessions) * 100)}%`
                                                    : '0%'}
                                        </div>
                                        {selectedDeploymentStats && (
                                            <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                {Math.round(selectedDeploymentStats.completionRate)}%
                                            </div>
                                        )}
                                    </td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: 'var(--sm)', fontWeight: 'var(--font-weight-medium)' }}>Abandon</td>
                                    <td style={{ textAlign: 'right', padding: 'var(--sm)' }}>
                                        <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                            {currentDeploymentStats
                                                ? `${Math.round(currentDeploymentStats.abandonmentRate)}%`
                                                : `${Math.round(stats.abandonmentRate)}%`}
                                        </div>
                                        {selectedDeploymentStats && (
                                            <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                {Math.round(selectedDeploymentStats.abandonmentRate)}%
                                            </div>
                                        )}
                                    </td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: 'var(--sm)', fontWeight: 'var(--font-weight-medium)' }}>Conversion</td>
                                    <td style={{ textAlign: 'right', padding: 'var(--sm)' }}>
                                        <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                            {currentDeploymentStats
                                                ? `${Math.round(currentDeploymentStats.conversionRate * 100)}%`
                                                : stats.conversionRate !== undefined
                                                    ? `${Math.round(stats.conversionRate * 100)}%`
                                                    : stats.funnel?.user_account_created
                                                        ? `${Math.round((stats.funnel.user_account_created / stats.totalSessions) * 100)}%`
                                                        : 'N/A'}
                                        </div>
                                        {selectedDeploymentStats && (
                                            <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                {Math.round(selectedDeploymentStats.conversionRate * 100)}%
                                            </div>
                                        )}
                                    </td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: 'var(--sm)', fontWeight: 'var(--font-weight-medium)' }}>Funnel: Pin cliqué</td>
                                    <td style={{ textAlign: 'right', padding: 'var(--sm)' }}>
                                        <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                            {currentDeploymentStats?.funnel?.pin_clicked ?? stats.funnel?.pin_clicked ?? 0}
                                        </div>
                                        {selectedDeploymentStats && (
                                            <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                {selectedDeploymentStats.funnel?.pin_clicked ?? 0}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: 'var(--sm)', fontWeight: 'var(--font-weight-medium)' }}>Funnel: Réponse cliquée</td>
                                    <td style={{ textAlign: 'right', padding: 'var(--sm)' }}>
                                        <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                            {currentDeploymentStats?.funnel?.response_clicked ?? stats.funnel?.response_clicked ?? 0}
                                        </div>
                                        {selectedDeploymentStats && (
                                            <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                {selectedDeploymentStats.funnel?.response_clicked ?? 0}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: 'var(--sm)', fontWeight: 'var(--font-weight-medium)' }}>Funnel: Inscription</td>
                                    <td style={{ textAlign: 'right', padding: 'var(--sm)' }}>
                                        <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                            {currentDeploymentStats?.funnel?.user_account_created ?? stats.funnel?.user_account_created ?? 0}
                                        </div>
                                        {selectedDeploymentStats && (
                                            <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                {selectedDeploymentStats.funnel?.user_account_created ?? 0}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div style={{ padding: 'var(--lg)', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <p>Aucune donnée de déploiement disponible pour le moment.</p>
                        <p style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                            Les nouveaux déploiements seront automatiquement trackés via le commit SHA.
                        </p>
                    </div>
                )}
            </div>

            {/* Funnel de conversion */}
            {funnelData.length > 0 && (
                <div className="card" style={{ padding: 'var(--md)', marginBottom: 'var(--lg)' }}>
                    <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--md)' }}>Funnel de conversion</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={funnelData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="actuel" fill={COLORS.actuel} name={`Actuel (${currentDeploymentId})`} />
                            {selectedDeploymentStats && (
                                <Bar dataKey="comparé" fill={COLORS.comparé} name={`Comparé (${selectedDeploymentId})`} />
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Points d'abandon */}
            {abandonmentData.length > 0 && (
                <div className="card" style={{ padding: 'var(--md)', marginBottom: 'var(--lg)' }}>
                    <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--md)' }}>Top 10 points d'abandon</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={abandonmentData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" />
                            <YAxis dataKey="step" type="category" width={150} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="actuel" fill={COLORS.actuel} name={`Actuel (${currentDeploymentId})`} />
                            {selectedDeploymentStats && (
                                <Bar dataKey="comparé" fill={COLORS.comparé} name={`Comparé (${selectedDeploymentId})`} />
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Temps d'attente entre étapes */}
            {stepWaitTimesData.length > 0 && (
                <div className="card" style={{ padding: 'var(--md)', marginBottom: 'var(--lg)' }}>
                    <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--md)' }}>
                        Temps d'attente moyen entre étapes (top 10)
                    </h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={stepWaitTimesData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="step" angle={-45} textAnchor="end" height={100} />
                            <YAxis label={{ value: 'Temps (secondes)', angle: -90, position: 'insideLeft' }} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="actuel_avg" fill={COLORS.actuel} name={`Actuel (${currentDeploymentId})`} />
                            {selectedDeploymentStats && (
                                <Bar dataKey="comparé_avg" fill={COLORS.comparé} name={`Comparé (${selectedDeploymentId})`} />
                            )}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Stats des champs du formulaire - Comparaison */}
            {stats.formFieldStats && (
                <div className="card" style={{ padding: 'var(--md)', marginBottom: 'var(--lg)' }}>
                    <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--md)' }}>Analyse des formulaires</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--md)' }}>
                        {/* Formulaire Visitor */}
                        <div>
                            <h3 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--sm)' }}>Formulaire Visitor</h3>
                            <table style={{ width: '100%', fontSize: 'var(--text-sm)', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ textAlign: 'left', padding: 'var(--xs)' }}>Champ</th>
                                        <th style={{ textAlign: 'right', padding: 'var(--xs)' }}>Focus</th>
                                        <th style={{ textAlign: 'right', padding: 'var(--xs)' }}>Rempli</th>
                                        <th style={{ textAlign: 'right', padding: 'var(--xs)' }}>Taux</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: 'var(--xs)' }}>Nom</td>
                                        <td style={{ textAlign: 'right', padding: 'var(--xs)' }}>
                                            <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                                {currentFormStats.visitor.name.focused}
                                            </div>
                                            {selectedFormStats && (
                                                <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                    {selectedFormStats.visitor.name.focused}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: 'var(--xs)' }}>
                                            <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                                {currentFormStats.visitor.name.filled}
                                            </div>
                                            {selectedFormStats && (
                                                <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                    {selectedFormStats.visitor.name.filled}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: 'var(--xs)' }}>
                                            <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                                {currentFormStats.visitor.name.focused > 0
                                                    ? `${Math.round((currentFormStats.visitor.name.filled / currentFormStats.visitor.name.focused) * 100)}%`
                                                    : 'N/A'}
                                            </div>
                                            {selectedFormStats && selectedFormStats.visitor.name.focused > 0 && (
                                                <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                    {Math.round((selectedFormStats.visitor.name.filled / selectedFormStats.visitor.name.focused) * 100)}%
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: 'var(--xs)' }}>Email</td>
                                        <td style={{ textAlign: 'right', padding: 'var(--xs)' }}>
                                            <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                                {currentFormStats.visitor.email.focused}
                                            </div>
                                            {selectedFormStats && (
                                                <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                    {selectedFormStats.visitor.email.focused}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: 'var(--xs)' }}>
                                            <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                                {currentFormStats.visitor.email.filled}
                                            </div>
                                            {selectedFormStats && (
                                                <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                    {selectedFormStats.visitor.email.filled}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: 'var(--xs)' }}>
                                            <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                                {currentFormStats.visitor.email.focused > 0
                                                    ? `${Math.round((currentFormStats.visitor.email.filled / currentFormStats.visitor.email.focused) * 100)}%`
                                                    : 'N/A'}
                                            </div>
                                            {selectedFormStats && selectedFormStats.visitor.email.focused > 0 && (
                                                <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                    {Math.round((selectedFormStats.visitor.email.filled / selectedFormStats.visitor.email.focused) * 100)}%
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: 'var(--xs)' }}>Ville</td>
                                        <td style={{ textAlign: 'right', padding: 'var(--xs)' }}>
                                            <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                                {currentFormStats.visitor.city.focused}
                                            </div>
                                            {selectedFormStats && (
                                                <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                    {selectedFormStats.visitor.city.focused}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: 'var(--xs)' }}>
                                            <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                                {currentFormStats.visitor.city.filled}
                                            </div>
                                            {selectedFormStats && (
                                                <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                    {selectedFormStats.visitor.city.filled}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: 'var(--xs)' }}>
                                            <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                                {currentFormStats.visitor.city.focused > 0
                                                    ? `${Math.round((currentFormStats.visitor.city.filled / currentFormStats.visitor.city.focused) * 100)}%`
                                                    : 'N/A'}
                                            </div>
                                            {selectedFormStats && selectedFormStats.visitor.city.focused > 0 && (
                                                <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                    {Math.round((selectedFormStats.visitor.city.filled / selectedFormStats.visitor.city.focused) * 100)}%
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td colSpan={3} style={{ fontWeight: 'bold', padding: 'var(--xs)' }}>Erreurs</td>
                                        <td style={{ textAlign: 'right', padding: 'var(--xs)' }}>
                                            <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                                {currentFormStats.visitor.errors}
                                            </div>
                                            {selectedFormStats && (
                                                <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                    {selectedFormStats.visitor.errors}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Formulaire User */}
                        <div>
                            <h3 style={{ fontSize: 'var(--text-md)', marginBottom: 'var(--sm)' }}>Formulaire User</h3>
                            <table style={{ width: '100%', fontSize: 'var(--text-sm)', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ textAlign: 'left', padding: 'var(--xs)' }}>Champ</th>
                                        <th style={{ textAlign: 'right', padding: 'var(--xs)' }}>Focus</th>
                                        <th style={{ textAlign: 'right', padding: 'var(--xs)' }}>Rempli</th>
                                        <th style={{ textAlign: 'right', padding: 'var(--xs)' }}>Taux</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: 'var(--xs)' }}>Nom</td>
                                        <td style={{ textAlign: 'right', padding: 'var(--xs)' }}>
                                            <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                                {currentFormStats.user.name.focused}
                                            </div>
                                            {selectedFormStats && (
                                                <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                    {selectedFormStats.user.name.focused}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: 'var(--xs)' }}>
                                            <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                                {currentFormStats.user.name.filled}
                                            </div>
                                            {selectedFormStats && (
                                                <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                    {selectedFormStats.user.name.filled}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: 'var(--xs)' }}>
                                            <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                                {currentFormStats.user.name.focused > 0
                                                    ? `${Math.round((currentFormStats.user.name.filled / currentFormStats.user.name.focused) * 100)}%`
                                                    : 'N/A'}
                                            </div>
                                            {selectedFormStats && selectedFormStats.user.name.focused > 0 && (
                                                <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                    {Math.round((selectedFormStats.user.name.filled / selectedFormStats.user.name.focused) * 100)}%
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: 'var(--xs)' }}>Email</td>
                                        <td style={{ textAlign: 'right', padding: 'var(--xs)' }}>
                                            <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                                {currentFormStats.user.email.focused}
                                            </div>
                                            {selectedFormStats && (
                                                <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                    {selectedFormStats.user.email.focused}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: 'var(--xs)' }}>
                                            <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                                {currentFormStats.user.email.filled}
                                            </div>
                                            {selectedFormStats && (
                                                <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                    {selectedFormStats.user.email.filled}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: 'var(--xs)' }}>
                                            <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                                {currentFormStats.user.email.focused > 0
                                                    ? `${Math.round((currentFormStats.user.email.filled / currentFormStats.user.email.focused) * 100)}%`
                                                    : 'N/A'}
                                            </div>
                                            {selectedFormStats && selectedFormStats.user.email.focused > 0 && (
                                                <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                    {Math.round((selectedFormStats.user.email.filled / selectedFormStats.user.email.focused) * 100)}%
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: 'var(--xs)' }}>Ville</td>
                                        <td style={{ textAlign: 'right', padding: 'var(--xs)' }}>
                                            <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                                {currentFormStats.user.city.focused}
                                            </div>
                                            {selectedFormStats && (
                                                <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                    {selectedFormStats.user.city.focused}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: 'var(--xs)' }}>
                                            <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                                {currentFormStats.user.city.filled}
                                            </div>
                                            {selectedFormStats && (
                                                <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                    {selectedFormStats.user.city.filled}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right', padding: 'var(--xs)' }}>
                                            <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                                {currentFormStats.user.city.focused > 0
                                                    ? `${Math.round((currentFormStats.user.city.filled / currentFormStats.user.city.focused) * 100)}%`
                                                    : 'N/A'}
                                            </div>
                                            {selectedFormStats && selectedFormStats.user.city.focused > 0 && (
                                                <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                    {Math.round((selectedFormStats.user.city.filled / selectedFormStats.user.city.focused) * 100)}%
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td colSpan={3} style={{ fontWeight: 'bold', padding: 'var(--xs)' }}>Erreurs</td>
                                        <td style={{ textAlign: 'right', padding: 'var(--xs)' }}>
                                            <div style={{ color: COLORS.actuel, fontWeight: 'var(--font-weight-medium)' }}>
                                                {currentFormStats.user.errors}
                                            </div>
                                            {selectedFormStats && (
                                                <div style={{ color: COLORS.comparé, fontSize: 'var(--text-xs)', marginTop: 'var(--xs)' }}>
                                                    {selectedFormStats.user.errors}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default OnboardingDashboard

