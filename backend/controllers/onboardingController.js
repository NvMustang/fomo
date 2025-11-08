/**
 * Contrôleur pour l'Onboarding
 * Sauvegarde les données d'onboarding dans Google Sheets
 */

const DataServiceV2 = require('../utils/dataService')

class OnboardingController {
    // Range Google Sheets pour la feuille Onboarding
    // Colonnes: Session ID, Start Time, End Time, Completed, Abandoned At, Total Duration (ms), Steps Count, Last Step, User Agent, Viewport Width, Viewport Height, Saved At, Deployment ID
    static ONBOARDING_SESSIONS_RANGE = 'Onboarding!A2:N'
    
    // Range pour les étapes individuelles
    // Colonnes: Session ID, Step, Timestamp, Time Since Start (ms), Time Since Last Step (ms), User Agent, Viewport Width, Viewport Height, Saved At
    static ONBOARDING_STEPS_RANGE = 'OnboardingSteps!A2:J'

    /**
     * Sauvegarder les données d'onboarding depuis le frontend
     */
    static async saveOnboarding(req, res) {
        const requestId = Math.random().toString(36).substr(2, 9)
        const timestamp = new Date().toISOString()

        try {
            const { sessionId, sessions, stats } = req.body

            if (!sessions || !Array.isArray(sessions)) {
                return res.status(400).json({
                    success: false,
                    error: 'Données onboarding incomplètes: sessions manquantes'
                })
            }

            console.log(`📊 [${requestId}] [${timestamp}] Sauvegarde onboarding...`)
            console.log(`📊 [${requestId}] Sessions: ${sessions.length} sessions à sauvegarder`)

            // Préparer les données des sessions à sauvegarder
            const sessionsToSave = []
            const stepsToSave = []
            let newSessionsCount = 0
            let newStepsCount = 0

            sessions.forEach(session => {
                // Sauvegarder la session
                sessionsToSave.push([
                    session.sessionId || '',
                    new Date(session.startTime).toISOString(), // Start Time
                    session.endTime ? new Date(session.endTime).toISOString() : '', // End Time
                    session.completed ? 'true' : 'false', // Completed
                    session.abandonedAt || '', // Abandoned At
                    session.totalDuration !== null ? session.totalDuration.toString() : '', // Total Duration (ms)
                    session.steps.length.toString(), // Steps Count
                    session.lastStep || '', // Last Step
                    session.userAgent || '', // User Agent
                    session.viewport?.width?.toString() || '', // Viewport Width
                    session.viewport?.height?.toString() || '', // Viewport Height
                    new Date().toISOString(), // Saved At
                    session.deploymentId || '' // Deployment ID
                ])

                // Sauvegarder chaque étape
                session.steps.forEach(step => {
                    stepsToSave.push([
                        session.sessionId || '', // Session ID
                        step.step || '', // Step
                        new Date(step.timestamp).toISOString(), // Timestamp
                        step.timeSinceStart?.toString() || '', // Time Since Start (ms)
                        step.timeSinceLastStep !== null ? step.timeSinceLastStep.toString() : '', // Time Since Last Step (ms)
                        step.userAgent || '', // User Agent
                        step.viewport?.width?.toString() || '', // Viewport Width
                        step.viewport?.height?.toString() || '', // Viewport Height
                        new Date().toISOString() // Saved At
                    ])
                })
            })

            // Sauvegarder dans Google Sheets avec déduplication
            const { appendDataWithDeduplication, validateSheet } = require('../utils/sheets-config')
            
            if (sessionsToSave.length > 0) {
                try {
                    await validateSheet('Onboarding')
                    // Déduplication par Session ID (colonne A, index 0)
                    const result = await appendDataWithDeduplication('Onboarding', sessionsToSave, [0], 2, 10000, requestId)
                    newSessionsCount = result.saved
                } catch (error) {
                    console.error(`❌ [${requestId}] Erreur sauvegarde sessions:`, error.message)
                    // Continuer même si la sauvegarde échoue
                }
            }

            if (stepsToSave.length > 0) {
                try {
                    // OnboardingSteps est optionnel, créer la feuille si elle n'existe pas
                    try {
                        await validateSheet('OnboardingSteps')
                    } catch {
                        // Si la feuille n'existe pas, on log mais on continue
                        console.warn(`⚠️ [${requestId}] Feuille OnboardingSteps non trouvée, création nécessaire`)
                    }
                    
                    // Déduplication par Session ID + Step + Timestamp (colonnes A, B, C, indices 0, 1, 2)
                    const result = await appendDataWithDeduplication('OnboardingSteps', stepsToSave, [0, 1, 2], 2, 100000, requestId)
                    newStepsCount = result.saved
                } catch (error) {
                    console.error(`❌ [${requestId}] Erreur sauvegarde étapes:`, error.message)
                    // Continuer même si la sauvegarde échoue
                }
            }

            res.json({
                success: true,
                message: `${newSessionsCount} nouvelles sessions et ${newStepsCount} nouvelles étapes sauvegardées`
            })
        } catch (error) {
            console.error(`❌ [${requestId}] Erreur sauvegarde onboarding:`, error)
            res.status(500).json({
                success: false,
                error: error.message
            })
        }
    }

    /**
     * Récupérer les statistiques d'onboarding agrégées
     */
    static async getAggregatedStats(req, res) {
        try {
            // Lire les sessions depuis Google Sheets
            const sessions = await DataServiceV2.getAllActiveData(
                OnboardingController.ONBOARDING_SESSIONS_RANGE,
                DataServiceV2.mappers.onboardingSessions
            )

            // Lire les étapes depuis Google Sheets (optionnel)
            let steps = []
            try {
                steps = await DataServiceV2.getAllActiveData(
                    OnboardingController.ONBOARDING_STEPS_RANGE,
                    DataServiceV2.mappers.onboardingSteps
                )
            } catch (error) {
                // Si la feuille OnboardingSteps n'existe pas, continuer avec un tableau vide
                console.warn('⚠️ Feuille OnboardingSteps non trouvée, utilisation d\'un tableau vide')
            }

            // Calculer les statistiques
            const totalSessions = sessions.length
            const completedSessions = sessions.filter(s => s.completed === 'true' || s.completed === true).length
            const abandonedSessions = sessions.filter(s => s.abandonedAt && s.abandonedAt !== '').length

            // Calculer les durées moyennes
            const completedDurations = sessions
                .filter(s => s.totalDuration && s.totalDuration !== '')
                .map(s => parseFloat(s.totalDuration) || 0)
            const averageDuration = completedDurations.length > 0
                ? completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length
                : null

            // Calculer le nombre moyen d'étapes
            const stepCounts = sessions
                .filter(s => s.stepsCount && s.stepsCount !== '')
                .map(s => parseInt(s.stepsCount) || 0)
            const averageSteps = stepCounts.length > 0
                ? stepCounts.reduce((a, b) => a + b, 0) / stepCounts.length
                : 0

            // Calculer les points d'abandon
            const abandonmentPoints = {}
            sessions.forEach(session => {
                if (session.abandonedAt && session.abandonedAt !== '') {
                    abandonmentPoints[session.abandonedAt] = (abandonmentPoints[session.abandonedAt] || 0) + 1
                }
            })

            // Calculer les temps moyens par étape
            const stepAverages = {}
            steps.forEach(step => {
                if (step.step && step.timeSinceStart) {
                    const time = parseFloat(step.timeSinceStart) || 0
                    if (!stepAverages[step.step]) {
                        stepAverages[step.step] = { total: 0, count: 0 }
                    }
                    stepAverages[step.step].total += time
                    stepAverages[step.step].count += 1
                }
            })

            // Convertir en moyennes
            const stepAveragesResult = {}
            Object.keys(stepAverages).forEach(step => {
                stepAveragesResult[step] = stepAverages[step].total / stepAverages[step].count
            })

            const abandonmentRate = totalSessions > 0 ? (abandonedSessions / totalSessions) * 100 : 0

            // Calculer le funnel de conversion
            const funnel = {
                pin_clicked: 0,
                eventcard_opened: 0,
                response_clicked: 0,
                form_completed: 0,
                visitorDiscoverFomoApp_started: 0,
                signup_clicked: 0,
                user_account_created: 0
            }
            steps.forEach(step => {
                if (step.step === 'pin_clicked') funnel.pin_clicked++
                if (step.step === 'eventcard_opened') funnel.eventcard_opened++
                if (step.step === 'response_clicked') funnel.response_clicked++
                if (step.step === 'form_completed') funnel.form_completed++
                if (step.step === 'visitorDiscoverFomoApp_started') funnel.visitorDiscoverFomoApp_started++
                if (step.step === 'signup_clicked') funnel.signup_clicked++
                if (step.step === 'user_account_created') funnel.user_account_created++
            })

            // Calculer les temps d'attente entre étapes (timeSinceLastStep)
            const stepWaitTimes = {}
            steps.forEach(step => {
                if (step.step && step.timeSinceLastStep !== null && step.timeSinceLastStep !== '') {
                    const waitTime = parseFloat(step.timeSinceLastStep) || 0
                    if (!stepWaitTimes[step.step]) {
                        stepWaitTimes[step.step] = { min: waitTime, max: waitTime, total: waitTime, count: 1 }
                    } else {
                        stepWaitTimes[step.step].min = Math.min(stepWaitTimes[step.step].min, waitTime)
                        stepWaitTimes[step.step].max = Math.max(stepWaitTimes[step.step].max, waitTime)
                        stepWaitTimes[step.step].total += waitTime
                        stepWaitTimes[step.step].count++
                    }
                }
            })
            // Convertir en moyennes
            const stepWaitTimesResult = {}
            Object.keys(stepWaitTimes).forEach(step => {
                stepWaitTimesResult[step] = {
                    min: stepWaitTimes[step].min,
                    max: stepWaitTimes[step].max,
                    avg: stepWaitTimes[step].total / stepWaitTimes[step].count
                }
            })

            // Calculer les stats des champs du formulaire
            const formFieldStats = {
                visitor: {
                    name: { focused: 0, filled: 0 },
                    email: { focused: 0, filled: 0 },
                    city: { focused: 0, filled: 0 },
                    errors: 0
                },
                user: {
                    name: { focused: 0, filled: 0 },
                    email: { focused: 0, filled: 0 },
                    city: { focused: 0, filled: 0 },
                    errors: 0
                }
            }
            // Compter les focus
            steps.forEach(step => {
                if (step.step === 'visitor_form_name_focus') formFieldStats.visitor.name.focused++
                if (step.step === 'visitor_form_email_focus') formFieldStats.visitor.email.focused++
                if (step.step === 'visitor_form_city_focus') formFieldStats.visitor.city.focused++
                if (step.step === 'visitor_form_email_error') formFieldStats.visitor.errors++
                if (step.step === 'user_form_name_focus') formFieldStats.user.name.focused++
                if (step.step === 'user_form_email_focus') formFieldStats.user.email.focused++
                if (step.step === 'user_form_city_focus') formFieldStats.user.city.focused++
                if (step.step === 'user_form_email_error' || step.step === 'user_form_city_error') formFieldStats.user.errors++
            })
            // Compter les remplis (blur = rempli)
            steps.forEach(step => {
                if (step.step === 'visitor_form_name_blur') formFieldStats.visitor.name.filled++
                if (step.step === 'visitor_form_email_blur') formFieldStats.visitor.email.filled++
                if (step.step === 'visitor_form_city_blur') formFieldStats.visitor.city.filled++
                if (step.step === 'user_form_name_blur') formFieldStats.user.name.filled++
                if (step.step === 'user_form_email_blur') formFieldStats.user.email.filled++
                if (step.step === 'user_form_city_blur') formFieldStats.user.city.filled++
            })

            // Calculer le taux de conversion visitor → user
            const conversionRate = totalSessions > 0
                ? funnel.user_account_created / totalSessions
                : 0

            // Comparaison par déploiement
            const deployments = {}
            sessions.forEach(session => {
                // deploymentId est dans la colonne N (index 12 après savedAt)
                const deploymentId = (session.deploymentId || 'unknown').toString().trim() || 'unknown'
                if (!deployments[deploymentId]) {
                    deployments[deploymentId] = {
                        deploymentId,
                        totalSessions: 0,
                        completedSessions: 0,
                        abandonedSessions: 0,
                        conversionCount: 0
                    }
                }
                deployments[deploymentId].totalSessions++
                if (session.completed === 'true' || session.completed === true) {
                    deployments[deploymentId].completedSessions++
                }
                if (session.abandonedAt && session.abandonedAt !== '') {
                    deployments[deploymentId].abandonedSessions++
                }
            })

            // Compter les conversions par déploiement (via les steps)
            const deploymentSteps = {}
            steps.forEach(step => {
                // Trouver le deploymentId de la session correspondante
                const session = sessions.find(s => s.sessionId === step.sessionId)
                if (session && session.deploymentId) {
                    const deploymentId = session.deploymentId
                    if (!deploymentSteps[deploymentId]) {
                        deploymentSteps[deploymentId] = []
                    }
                    deploymentSteps[deploymentId].push(step)
                }
            })

            // Calculer les métriques par déploiement
            const deploymentStats = {}
            Object.keys(deployments).forEach(deploymentId => {
                const dep = deployments[deploymentId]
                const depSteps = deploymentSteps[deploymentId] || []
                const depFunnel = {
                    pin_clicked: 0,
                    eventcard_opened: 0,
                    response_clicked: 0,
                    form_completed: 0,
                    visitorDiscoverFomoApp_started: 0,
                    signup_clicked: 0,
                    user_account_created: 0
                }
                depSteps.forEach(step => {
                    if (step.step === 'pin_clicked') depFunnel.pin_clicked++
                    if (step.step === 'eventcard_opened') depFunnel.eventcard_opened++
                    if (step.step === 'response_clicked') depFunnel.response_clicked++
                    if (step.step === 'form_completed') depFunnel.form_completed++
                    if (step.step === 'visitorDiscoverFomoApp_started') depFunnel.visitorDiscoverFomoApp_started++
                    if (step.step === 'signup_clicked') depFunnel.signup_clicked++
                    if (step.step === 'user_account_created') depFunnel.user_account_created++
                })

                const completionRate = dep.totalSessions > 0 ? (dep.completedSessions / dep.totalSessions) * 100 : 0
                const abandonmentRate = dep.totalSessions > 0 ? (dep.abandonedSessions / dep.totalSessions) * 100 : 0
                const conversionRate = dep.totalSessions > 0 ? (depFunnel.user_account_created / dep.totalSessions) * 100 : 0

                deploymentStats[deploymentId] = {
                    deploymentId,
                    totalSessions: dep.totalSessions,
                    completedSessions: dep.completedSessions,
                    abandonedSessions: dep.abandonedSessions,
                    completionRate,
                    abandonmentRate,
                    conversionRate,
                    funnel: depFunnel
                }
            })

            res.json({
                success: true,
                data: {
                    totalSessions,
                    completedSessions,
                    abandonedSessions,
                    averageDuration,
                    averageSteps,
                    abandonmentRate,
                    stepAverages: stepAveragesResult,
                    abandonmentPoints,
                    funnel,
                    stepWaitTimes: stepWaitTimesResult,
                    formFieldStats,
                    conversionRate,
                    deployments: deploymentStats, // Comparaison par déploiement
                    sessions: sessions.slice(-100), // Dernières 100 sessions
                    steps: steps.slice(-1000) // Dernières 1000 étapes
                }
            })
        } catch (error) {
            console.error('❌ Erreur récupération stats onboarding:', error)
            res.status(500).json({
                success: false,
                error: error.message
            })
        }
    }
}

module.exports = OnboardingController

