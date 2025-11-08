/**
 * Script d'analyse des données d'onboarding
 * 
 * Analyse les données de production pour identifier :
 * - Les doublons
 * - Les anomalies
 * - Les données incohérentes
 * - Les patterns d'abandon
 * - Le "bruit" dans les données
 */

const DataServiceV2 = require('../utils/dataService')
const OnboardingController = require('../controllers/onboardingController')

/**
 * Usage:
 *   node scripts/analyze-onboarding-data.js          # Utilise la config par défaut (test en local, prod sur Vercel)
 *   node scripts/analyze-onboarding-data.js --prod   # Force l'utilisation de la base de production
 */
async function analyzeOnboardingData(forceProduction = false) {
    // Forcer la production si demandé
    if (forceProduction) {
        process.env.FORCE_PRODUCTION = 'true'
        // Recharger sheets-config pour prendre en compte le changement
        delete require.cache[require.resolve('../utils/sheets-config')]
        console.log('📊 Mode PRODUCTION forcé\n')
    }

    console.log('🔍 Analyse des données d\'onboarding...\n')

    try {
        // Récupérer toutes les sessions
        const sessions = await DataServiceV2.getAllActiveData(
            OnboardingController.ONBOARDING_SESSIONS_RANGE,
            DataServiceV2.mappers.onboardingSessions
        )

        // Récupérer toutes les étapes (feuille optionnelle)
        let steps = []
        try {
            steps = await DataServiceV2.getAllActiveData(
                OnboardingController.ONBOARDING_STEPS_RANGE,
                DataServiceV2.mappers.onboardingSteps
            )
        } catch (error) {
            // La feuille OnboardingSteps est optionnelle, ignorer l'erreur si elle n'existe pas
            if (error.message && error.message.includes('Unable to parse range')) {
                console.log('ℹ️ Feuille OnboardingSteps non trouvée (optionnelle)')
            } else {
                console.warn('⚠️ Erreur lors de la récupération des étapes:', error.message)
            }
        }

        console.log(`📊 Total sessions: ${sessions.length}`)
        console.log(`📊 Total étapes: ${steps.length}`)
        
        if (sessions.length === 0) {
            console.log('\n⚠️ Aucune donnée d\'onboarding trouvée dans la base de données.')
            console.log('   Cela peut être normal si aucun utilisateur n\'a encore complété le parcours.')
            console.log('   Vérifiez que le tracking est bien activé et que les données sont sauvegardées.\n')
            return
        }
        
        console.log('')

        // 1. Analyse des doublons de sessions
        console.log('🔍 1. Analyse des doublons de sessions...')
        const sessionIds = sessions.map(s => s.sessionId)
        const duplicateSessionIds = sessionIds.filter((id, index) => sessionIds.indexOf(id) !== index)
        const uniqueDuplicates = [...new Set(duplicateSessionIds)]
        
        if (uniqueDuplicates.length > 0) {
            console.log(`   ⚠️ ${uniqueDuplicates.length} sessions dupliquées trouvées:`)
            uniqueDuplicates.slice(0, 10).forEach(id => {
                const count = sessionIds.filter(sid => sid === id).length
                console.log(`      - ${id}: ${count} occurrences`)
            })
            if (uniqueDuplicates.length > 10) {
                console.log(`      ... et ${uniqueDuplicates.length - 10} autres`)
            }
        } else {
            console.log('   ✅ Aucun doublon de session trouvé')
        }
        console.log('')

        // 2. Analyse des sessions incomplètes (sans endTime mais pas abandonnées)
        console.log('🔍 2. Analyse des sessions incomplètes...')
        const incompleteSessions = sessions.filter(s => 
            !s.endTime && !s.abandonedAt && !s.completed
        )
        console.log(`   ⚠️ ${incompleteSessions.length} sessions incomplètes (sans endTime, pas abandonnées, pas complétées)`)
        if (incompleteSessions.length > 0 && incompleteSessions.length <= 10) {
            incompleteSessions.forEach(s => {
                console.log(`      - ${s.sessionId}: ${s.stepsCount} étapes, dernière étape: ${s.lastStep || 'N/A'}`)
            })
        }
        console.log('')

        // 3. Analyse des sessions avec durée anormale
        console.log('🔍 3. Analyse des durées anormales...')
        const sessionsWithDuration = sessions.filter(s => s.totalDuration && s.totalDuration !== '')
        if (sessionsWithDuration.length === 0) {
            console.log('   ℹ️ Aucune session avec durée disponible')
        } else {
            const durations = sessionsWithDuration.map(s => parseFloat(s.totalDuration) || 0)
            const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0
            const maxDuration = durations.length > 0 ? Math.max(...durations) : 0
            const minDuration = durations.length > 0 ? Math.min(...durations) : 0
            // Sessions avec durée > 1 heure (probablement anormale)
            const veryLongSessions = sessionsWithDuration.filter(s => {
                const duration = parseFloat(s.totalDuration) || 0
                return duration > 3600000 // 1 heure en ms
            })
            
            // Sessions avec durée < 1 seconde (probablement anormale)
            const veryShortSessions = sessionsWithDuration.filter(s => {
                const duration = parseFloat(s.totalDuration) || 0
                return duration < 1000 && duration > 0 // > 0 pour exclure les null
            })

            console.log(`   📊 Durée moyenne: ${Math.round(avgDuration / 1000)}s`)
            console.log(`   📊 Durée min: ${Math.round(minDuration / 1000)}s`)
            console.log(`   📊 Durée max: ${Math.round(maxDuration / 1000)}s`)
            console.log(`   ⚠️ Sessions > 1h: ${veryLongSessions.length}`)
            console.log(`   ⚠️ Sessions < 1s: ${veryShortSessions.length}`)
            if (veryLongSessions.length > 0 && veryLongSessions.length <= 5) {
                veryLongSessions.forEach(s => {
                    console.log(`      - ${s.sessionId}: ${Math.round(parseFloat(s.totalDuration) / 1000)}s`)
                })
            }
        }
        console.log('')

        // 4. Analyse des étapes orphelines (sans session correspondante)
        console.log('🔍 4. Analyse des étapes orphelines...')
        const sessionIdSet = new Set(sessions.map(s => s.sessionId))
        const orphanSteps = steps.filter(step => !sessionIdSet.has(step.sessionId))
        console.log(`   ⚠️ ${orphanSteps.length} étapes orphelines (sans session correspondante)`)
        if (orphanSteps.length > 0 && orphanSteps.length <= 10) {
            const orphanSessionIds = [...new Set(orphanSteps.map(s => s.sessionId))]
            orphanSessionIds.slice(0, 5).forEach(id => {
                const count = orphanSteps.filter(s => s.sessionId === id).length
                console.log(`      - ${id}: ${count} étapes`)
            })
        }
        console.log('')

        // 5. Analyse des sessions sans étapes
        console.log('🔍 5. Analyse des sessions sans étapes...')
        const stepSessionIds = new Set(steps.map(s => s.sessionId))
        const sessionsWithoutSteps = sessions.filter(s => !stepSessionIds.has(s.sessionId))
        console.log(`   ⚠️ ${sessionsWithoutSteps.length} sessions sans aucune étape trackée`)
        if (sessionsWithoutSteps.length > 0 && sessionsWithoutSteps.length <= 10) {
            sessionsWithoutSteps.forEach(s => {
                console.log(`      - ${s.sessionId}: ${s.stepsCount} étapes déclarées mais aucune dans OnboardingSteps`)
            })
        }
        console.log('')

        // 6. Analyse des patterns d'abandon
        console.log('🔍 6. Analyse des patterns d\'abandon...')
        const abandonedSessions = sessions.filter(s => s.abandonedAt && s.abandonedAt !== '')
        const abandonmentByStep = {}
        abandonedSessions.forEach(s => {
            const step = s.abandonedAt || 'unknown'
            abandonmentByStep[step] = (abandonmentByStep[step] || 0) + 1
        })
        
        const sortedAbandonment = Object.entries(abandonmentByStep)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
        
        console.log(`   📊 Top 10 des étapes d'abandon:`)
        sortedAbandonment.forEach(([step, count]) => {
            const percentage = ((count / abandonedSessions.length) * 100).toFixed(1)
            console.log(`      - ${step.replace(/_/g, ' ')}: ${count} (${percentage}%)`)
        })
        console.log('')

        // 7. Analyse des incohérences (sessions complétées mais avec abandonedAt)
        console.log('🔍 7. Analyse des incohérences...')
        const inconsistentSessions = sessions.filter(s => 
            s.completed && s.abandonedAt && s.abandonedAt !== ''
        )
        console.log(`   ⚠️ ${inconsistentSessions.length} sessions marquées comme complétées ET abandonnées`)
        if (inconsistentSessions.length > 0 && inconsistentSessions.length <= 5) {
            inconsistentSessions.forEach(s => {
                console.log(`      - ${s.sessionId}: complétée mais abandonnée à ${s.abandonedAt}`)
            })
        }
        console.log('')

        // 8. Analyse des timestamps invalides
        console.log('🔍 8. Analyse des timestamps invalides...')
        const invalidStartTimes = sessions.filter(s => {
            const date = new Date(s.startTime)
            return isNaN(date.getTime())
        })
        const invalidEndTimes = sessions.filter(s => {
            if (!s.endTime) return false
            const date = new Date(s.endTime)
            return isNaN(date.getTime())
        })
        console.log(`   ⚠️ ${invalidStartTimes.length} sessions avec startTime invalide`)
        console.log(`   ⚠️ ${invalidEndTimes.length} sessions avec endTime invalide`)
        console.log('')

        // 9. Résumé et recommandations
        console.log('📋 RÉSUMÉ ET RECOMMANDATIONS:')
        console.log('')
        
        const issues = []
        if (uniqueDuplicates.length > 0) {
            issues.push(`- ${uniqueDuplicates.length} sessions dupliquées à nettoyer`)
        }
        if (incompleteSessions.length > 0) {
            issues.push(`- ${incompleteSessions.length} sessions incomplètes (peut être normal si en cours)`)
        }
        if (veryLongSessions.length > 0) {
            issues.push(`- ${veryLongSessions.length} sessions > 1h (vérifier si normal)`)
        }
        if (veryShortSessions.length > 0) {
            issues.push(`- ${veryShortSessions.length} sessions < 1s (probablement du bruit)`)
        }
        if (orphanSteps.length > 0) {
            issues.push(`- ${orphanSteps.length} étapes orphelines à nettoyer`)
        }
        if (sessionsWithoutSteps.length > 0) {
            issues.push(`- ${sessionsWithoutSteps.length} sessions sans étapes (vérifier le tracking)`)
        }
        if (inconsistentSessions.length > 0) {
            issues.push(`- ${inconsistentSessions.length} sessions incohérentes (complétées + abandonnées)`)
        }
        if (invalidStartTimes.length > 0 || invalidEndTimes.length > 0) {
            issues.push(`- ${invalidStartTimes.length + invalidEndTimes.length} sessions avec timestamps invalides`)
        }

        if (issues.length > 0) {
            console.log('   ⚠️ Problèmes détectés:')
            issues.forEach(issue => console.log(`      ${issue}`))
        } else {
            console.log('   ✅ Aucun problème majeur détecté')
        }

        console.log('')
        console.log('✅ Analyse terminée')

    } catch (error) {
        console.error('❌ Erreur lors de l\'analyse:', error)
        process.exit(1)
    }
}

// Exécuter l'analyse
if (require.main === module) {
    const forceProduction = process.argv.includes('--prod') || process.argv.includes('--production')
    analyzeOnboardingData(forceProduction)
        .then(() => process.exit(0))
        .catch(error => {
            console.error('❌ Erreur fatale:', error)
            process.exit(1)
        })
}

module.exports = { analyzeOnboardingData }

