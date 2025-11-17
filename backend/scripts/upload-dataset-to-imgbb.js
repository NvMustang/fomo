/**
 * Script pour uploader toutes les images du dataset vers ImgBB
 * et mettre à jour Google Sheets
 * 
 * APPROCHE OPTIMISÉE EN DEUX PHASES:
 * - Phase 1: Uploader toutes les images vers ImgBB et mettre à jour le dataset JSON
 * - Phase 2: Batch update de Google Sheets en une seule requête
 * 
 * Usage:
 *   node scripts/upload-dataset-to-imgbb.js [--dry-run] [--limit 10] [--phase 1|2|both]
 * 
 * Options:
 *   --phase 1     : Exécuter uniquement la phase 1 (uploads)
 *   --phase 2     : Exécuter uniquement la phase 2 (batch update Sheets)
 *   --phase both  : Exécuter les deux phases (défaut)
 */

const path = require('path')
// Charger le .env depuis le dossier backend
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
const DataServiceV2 = require('../utils/dataService')
const EventsController = require('../controllers/eventsController')
const imgbbService = require('../utils/imgbbService')
const fs = require('fs')
const axios = require('axios')

/**
 * Phase 1: Uploader toutes les images vers ImgBB et mettre à jour le dataset JSON
 */
async function phase1UploadImages(dataset, limit, dryRun) {
    console.log('📤 PHASE 1: Upload des images vers ImgBB...')
    console.log('')

    // Filtrer les événements avec une URL d'image valide et sans imgbbUrl déjà présent
    let itemsToUpload = dataset.filter(item => {
        if (!item.imageUrl || !item.imageUrl.trim()) return false
        // Ignorer si déjà uploadé (imgbbUrl présent)
        if (item.imgbbUrl && (item.imgbbUrl.includes('i.ibb.co') || item.imgbbUrl.includes('imgbb.com'))) {
            return false
        }
        return true
    })

    console.log(`📋 ${itemsToUpload.length} événements à uploader (sans imgbbUrl)`)

    if (itemsToUpload.length === 0) {
        console.log('✅ Tous les événements ont déjà été uploadés!')
        return { successCount: 0, errorCount: 0, skippedCount: 0 }
    }

    // Limiter si demandé
    const itemsToProcess = limit ? itemsToUpload.slice(0, parseInt(limit)) : itemsToUpload

    let successCount = 0
    let errorCount = 0
    let skippedCount = 0

    // Traiter chaque événement
    for (let i = 0; i < itemsToProcess.length; i++) {
        const item = itemsToProcess[i]
        const progress = `[${i + 1}/${itemsToProcess.length}]`

        console.log(`${progress} Event ID: ${item.eventId}`)
        console.log(`   Titre: ${item.eventTitle || 'N/A'}`)
        console.log(`   📤 Upload vers ImgBB...`)
        console.log(`   URL: ${item.imageUrl.substring(0, 80)}...`)

        let uploadResult
        let retries = 0
        const maxRetries = 3

        while (retries <= maxRetries) {
            try {
                // Télécharger l'image localement d'abord (pour éviter les problèmes de signature Facebook)
                console.log(`   📥 Téléchargement de l'image...`)
                const imageResponse = await axios.get(item.imageUrl, {
                    responseType: 'arraybuffer',
                    timeout: 30000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0',
                        'Referer': 'https://www.facebook.com/'
                    }
                })

                const imageBuffer = Buffer.from(imageResponse.data)
                const contentType = imageResponse.headers['content-type'] || 'image/jpeg'
                const extension = contentType.includes('png') ? '.png' : contentType.includes('gif') ? '.gif' : '.jpg'
                const filename = `image_${item.eventId}${extension}`

                console.log(`   ✅ Image téléchargée (${(imageBuffer.length / 1024).toFixed(1)} KB)`)
                console.log(`   📤 Upload vers ImgBB via buffer...`)

                // Uploader via buffer
                uploadResult = await imgbbService.uploadImageFromBuffer(imageBuffer, filename)

                if (!uploadResult.success) {
                    const isRateLimit = uploadResult.httpStatus === 429 ||
                        uploadResult.httpStatus === 400 && uploadResult.errorData?.error?.code === 100 ||
                        uploadResult.error?.includes('rate limit') ||
                        uploadResult.error?.includes('Rate limit')

                    if (isRateLimit && retries < maxRetries) {
                        const backoffDelay = Math.min(60000 * (retries + 1), 300000)
                        console.log(`   ⚠️  Rate limit détecté! Pause de ${backoffDelay / 1000}s...`)
                        await new Promise(resolve => setTimeout(resolve, backoffDelay))
                        retries++
                        continue
                    }
                }

                break
            } catch (error) {
                // Erreur de téléchargement ou d'upload
                const isRateLimit = error.response?.status === 429 ||
                    error.response?.status === 400 && error.response?.data?.error?.code === 100 ||
                    error.message.includes('rate limit')

                if (isRateLimit && retries < maxRetries) {
                    const backoffDelay = Math.min(60000 * (retries + 1), 300000)
                    console.log(`   ⚠️  Rate limit détecté! Pause de ${backoffDelay / 1000}s...`)
                    await new Promise(resolve => setTimeout(resolve, backoffDelay))
                    retries++
                    continue
                } else {
                    const errorMsg = error.response?.status
                        ? `Erreur HTTP ${error.response.status}: ${error.message}`
                        : error.message || 'Erreur inconnue'
                    uploadResult = { success: false, error: errorMsg }
                    break
                }
            }
        }

        if (uploadResult && uploadResult.success) {
            successCount++
            console.log(`   ✅ Uploadé: ${uploadResult.url}`)
            if (uploadResult.deleteUrl) {
                console.log(`   🔗 URL de suppression: ${uploadResult.deleteUrl.substring(0, 60)}...`)
            }

            // Mettre à jour le dataset en mémoire
            item.imgbbUrl = uploadResult.url
            item.deleteUrl = uploadResult.deleteUrl || null
            item.uploadedAt = new Date().toISOString()
        } else {
            errorCount++
            console.log(`   ❌ Erreur upload: ${uploadResult?.error || 'Erreur inconnue'}`)
        }

        console.log('')
    }

    // Sauvegarder le dataset mis à jour
    if (!dryRun && successCount > 0) {
        const datasetPath = path.join(__dirname, '..', '..', 'image-dataset.json')
        fs.writeFileSync(datasetPath, JSON.stringify(dataset, null, 2), 'utf8')
        console.log(`💾 Dataset JSON mis à jour avec ${successCount} nouvelles URLs ImgBB`)
        console.log('')
    }

    console.log('✅ Phase 1 terminée!')
    console.log(`   ✅ Uploads réussis: ${successCount}`)
    console.log(`   ❌ Erreurs upload: ${errorCount}`)
    console.log(`   ⏭️  Ignorés (déjà uploadés): ${skippedCount}`)
    console.log('')

    return { successCount, errorCount, skippedCount }
}

/**
 * Phase 2: Batch update de Google Sheets
 */
async function phase2BatchUpdateSheets(dataset, dryRun) {
    console.log('📊 PHASE 2: Batch update de Google Sheets...')
    console.log('')

    // Filtrer les événements avec imgbbUrl
    const itemsWithImgbb = dataset.filter(item =>
        item.imgbbUrl && (item.imgbbUrl.includes('i.ibb.co') || item.imgbbUrl.includes('imgbb.com'))
    )

    console.log(`📋 ${itemsWithImgbb.length} événements avec URL ImgBB dans le dataset`)
    console.log('')

    if (itemsWithImgbb.length === 0) {
        console.log('⚠️  Aucun événement avec URL ImgBB trouvé. Exécutez d\'abord la phase 1.')
        return { updated: 0, errors: 0, notFound: 0 }
    }

    // Récupérer tous les événements depuis Google Sheets
    console.log('📥 Récupération des événements depuis Google Sheets...')
    let allEvents
    try {
        allEvents = await DataServiceV2.getAllActiveData(
            EventsController.EVENTS_RANGE,
            DataServiceV2.mappers.event
        )
        console.log(`✅ ${allEvents.length} événements récupérés depuis Google Sheets`)
        console.log('')
    } catch (error) {
        console.error('❌ Erreur lors de la récupération des événements:', error.message)
        throw error
    }

    // Créer une map eventId -> event pour accès rapide
    const eventsMap = new Map()
    for (const event of allEvents) {
        eventsMap.set(event.id, event)
    }

    // Préparer les mises à jour
    const updates = []
    let notFoundCount = 0

    for (const item of itemsWithImgbb) {
        const event = eventsMap.get(item.eventId)
        if (!event) {
            notFoundCount++
            console.log(`⚠️  Événement non trouvé dans Sheets: ${item.eventId}`)
            continue
        }

        // Vérifier si l'URL a changé (pour éviter les mises à jour inutiles)
        if (event.coverUrl === item.imgbbUrl && event.deleteUrl === item.deleteUrl) {
            continue // Déjà à jour
        }

        const rowData = [
            event.id,
            event.createdAt || new Date().toISOString(),
            event.title || '',
            event.description || '',
            event.startsAt || '',
            event.endsAt || '',
            event.venue?.name || '',
            event.venue?.address || '',
            parseFloat(event.venue?.lat || 0).toFixed(6),
            parseFloat(event.venue?.lng || 0).toFixed(6),
            item.imgbbUrl, // K: Cover URL (nouvelle URL ImgBB)
            event.coverImagePosition ?
                `${event.coverImagePosition.x || 50};${event.coverImagePosition.y || 50}` :
                '50;50',
            event.organizerId || 'admin-fomo',
            event.isPublic ? 'true' : 'false',
            event.isOnline ? 'true' : 'false',
            new Date().toISOString(), // P: ModifiedAt
            event.deletedAt || '',
            event.source || '',
            item.deleteUrl || '' // S: Delete URL
        ]

        updates.push({
            keyValue: item.eventId,
            rowData: rowData
        })
    }

    console.log(`📝 ${updates.length} événements à mettre à jour dans Google Sheets`)
    console.log('')

    if (updates.length === 0) {
        console.log('✅ Aucune mise à jour nécessaire (tous les événements sont déjà à jour)')
        return { updated: 0, errors: 0, notFound: notFoundCount }
    }

    // Batch update
    if (!dryRun) {
        try {
            const result = await DataServiceV2.batchUpdateRows(
                EventsController.EVENTS_RANGE,
                updates,
                0 // keyColumn = ID
            )
            console.log('✅ Batch update terminé!')
            console.log(`   ✅ Lignes mises à jour: ${result.updated}`)
            console.log(`   ❌ Erreurs: ${result.errors}`)
            console.log(`   ⚠️  Événements non trouvés: ${notFoundCount}`)
            return { ...result, notFound: notFoundCount }
        } catch (error) {
            console.error('❌ Erreur lors du batch update:', error.message)
            throw error
        }
    } else {
        console.log('⏭️  Mode dry-run: Google Sheets non modifié')
        console.log(`   (${updates.length} mises à jour seraient effectuées)`)
        return { updated: updates.length, errors: 0, notFound: notFoundCount }
    }
}

/**
 * Fonction principale
 */
async function uploadDatasetToImgbb() {
    const args = process.argv.slice(2)
    const dryRun = args.includes('--dry-run')
    const limit = args.find(arg => arg.startsWith('--limit'))?.split('=')[1]
    const phaseArg = args.find(arg => arg.startsWith('--phase'))?.split('=')[1] || 'both'
    const phase = phaseArg === '1' ? 'phase1' : phaseArg === '2' ? 'phase2' : 'both'

    console.log('🔄 Upload du dataset vers ImgBB (approche optimisée)')
    console.log('')
    if (dryRun) {
        console.log('   ⚠️  MODE TEST (dry-run) - Aucune modification dans Google Sheets')
    }
    if (limit) {
        console.log(`   Limite: ${limit} événements`)
    }
    console.log(`   Phase: ${phase}`)
    console.log('')

    // Lire le dataset
    const datasetPath = path.join(__dirname, '..', '..', 'image-dataset.json')
    if (!fs.existsSync(datasetPath)) {
        console.error('❌ Fichier image-dataset.json introuvable')
        console.error('   Exécutez d\'abord: node scripts/update-image-dataset.js')
        process.exit(1)
    }

    const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'))
    console.log(`✅ ${dataset.length} images trouvées dans le dataset`)
    console.log('')

    // Exécuter les phases
    let phase1Result = null
    let phase2Result = null

    if (phase === 'phase1' || phase === 'both') {
        phase1Result = await phase1UploadImages(dataset, limit, dryRun)
    }

    if (phase === 'phase2' || phase === 'both') {
        // Recharger le dataset si phase 1 vient d'être exécutée
        if (phase === 'both' && phase1Result && phase1Result.successCount > 0) {
            const updatedDataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'))
            phase2Result = await phase2BatchUpdateSheets(updatedDataset, dryRun)
        } else {
            phase2Result = await phase2BatchUpdateSheets(dataset, dryRun)
        }
    }

    // Résumé final
    console.log('')
    console.log('='.repeat(50))
    console.log('✅ TRAITEMENT TERMINÉ!')
    console.log('='.repeat(50))
    if (phase1Result) {
        console.log(`Phase 1 - Uploads réussis: ${phase1Result.successCount}`)
        console.log(`Phase 1 - Erreurs: ${phase1Result.errorCount}`)
    }
    if (phase2Result) {
        console.log(`Phase 2 - Lignes mises à jour: ${phase2Result.updated}`)
        console.log(`Phase 2 - Erreurs: ${phase2Result.errors}`)
        console.log(`Phase 2 - Événements non trouvés: ${phase2Result.notFound || 0}`)
    }
    console.log('='.repeat(50))
}

uploadDatasetToImgbb().catch(error => {
    console.error('❌ Erreur fatale:', error)
    process.exit(1)
})
