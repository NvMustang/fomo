/**
 * Script pour mettre à jour le dataset image-dataset.json
 * 
 * Vérifie chaque URL Facebook du dataset, et si elle est expirée,
 * ré-extrait l'image avec Puppeteer depuis l'URL Facebook de l'événement
 * 
 * Usage:
 *   node scripts/update-image-dataset.js [--delay 4000] [--limit 10]
 */

require('dotenv').config()
const puppeteer = require('puppeteer')
const fs = require('fs')
const path = require('path')
const axios = require('axios')

/**
 * Vérifier si une URL d'image est accessible
 */
async function checkImageUrl(imageUrl) {
    try {
        const response = await axios.head(imageUrl, {
            timeout: 10000,
            maxRedirects: 5,
            validateStatus: (status) => status < 400,
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://www.facebook.com/'
            }
        })
        return response.status < 400
    } catch (error) {
        return false
    }
}

/**
 * Extraire et télécharger l'image depuis une page Facebook event
 */
async function extractAndDownloadImageFromEventUrl(eventUrl, browser) {
    const page = await browser.newPage()
    try {
        await page.goto(eventUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        })

        await new Promise(resolve => setTimeout(resolve, 3000))

        const imageUrl = await page.evaluate(() => {
            const img = document.querySelector('img[data-imgperflogname="profileCoverPhoto"]')
            if (img && img.src) {
                return img.src
            }

            const coverImg = document.querySelector('img[data-testid="event-cover-photo"]')
            if (coverImg && coverImg.src) {
                return coverImg.src
            }

            const images = Array.from(document.querySelectorAll('img[src*="scontent"]'))
                .filter(img => {
                    const src = img.src || ''
                    return !src.includes('profile') &&
                        !src.includes('avatar') &&
                        !src.includes('icon') &&
                        (src.includes('.jpg') || src.includes('.png') || src.includes('.webp'))
                })
                .sort((a, b) => {
                    const sizeA = (a.naturalWidth || a.width || 0) * (a.naturalHeight || a.height || 0)
                    const sizeB = (b.naturalWidth || b.width || 0) * (b.naturalHeight || b.height || 0)
                    return sizeB - sizeA
                })

            if (images.length > 0) {
                return images[0].src
            }

            return null
        })

        await page.close()
        return imageUrl
    } catch (error) {
        console.error(`   ❌ Erreur extraction: ${error.message}`)
        await page.close()
        return null
    }
}

async function updateImageDataset() {
    const args = process.argv.slice(2)
    const limit = args.find(arg => arg.startsWith('--limit'))?.split('=')[1]

    console.log('🔄 Mise à jour du dataset image-dataset.json...')
    console.log('')
    if (limit) {
        console.log(`   Limite: ${limit} événements`)
    }
    console.log('')

    // Lire le dataset existant
    const datasetPath = path.join(__dirname, '..', '..', 'image-dataset.json')
    if (!fs.existsSync(datasetPath)) {
        console.error('❌ Fichier image-dataset.json introuvable')
        process.exit(1)
    }

    const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'))
    console.log(`✅ ${dataset.length} événements trouvés dans le dataset`)
    console.log('')

    // Filtrer uniquement les erreurs (sans imgbbUrl)
    const errors = dataset.filter(item => {
        if (!item.imageUrl || !item.imageUrl.trim()) return false
        // Pas d'imgbbUrl = erreur
        return !item.imgbbUrl || !item.imgbbUrl.includes('i.ibb.co')
    })

    console.log(`📋 ${errors.length} événements avec erreur d'upload (sans imgbbUrl)`)
    console.log('')

    if (errors.length === 0) {
        console.log('✅ Aucune erreur trouvée! Toutes les images ont été uploadées.')
        process.exit(0)
    }

    // Nettoyer les URLs Facebook (enlever les paramètres, garder seulement l'ID)
    errors.forEach(item => {
        if (item.facebookUrl) {
            // Extraire l'ID de l'événement et reconstruire l'URL propre
            const match = item.facebookUrl.match(/\/events\/(\d+)/)
            if (match && match[1]) {
                item.facebookUrl = `https://www.facebook.com/events/${match[1]}/`
                console.log(`   🔧 URL nettoyée: ${item.eventId} -> ${item.facebookUrl}`)
            }
        }
    })
    console.log('')

    // Limiter si demandé (par défaut, traiter tous les événements)
    const itemsToProcess = limit ? errors.slice(0, parseInt(limit)) : errors

    let updatedCount = 0
    let errorCount = 0
    let expiredCount = 0
    let validCount = 0

    // Lancer Puppeteer
    console.log('🚀 Lancement de Puppeteer...')
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    })
    console.log('✅ Puppeteer lancé')
    console.log('')

    try {
        console.log('🔄 Vérification et mise à jour...')
        console.log('')

        // Traiter chaque événement
        for (let i = 0; i < itemsToProcess.length; i++) {
            const item = itemsToProcess[i]
            const progress = `[${i + 1}/${itemsToProcess.length}]`

            console.log(`${progress} Event ID: ${item.eventId}`)
            console.log(`   Titre: ${item.eventTitle || 'N/A'}`)

            if (!item.imageUrl) {
                // Pas d'URL dans le dataset, extraire avec Puppeteer
                if (item.facebookUrl) {
                    console.log(`   🔍 Extraction avec Puppeteer (pas d'URL dans le dataset)...`)
                    const newImageUrl = await extractAndDownloadImageFromEventUrl(item.facebookUrl, browser)

                    if (newImageUrl) {
                        item.imageUrl = newImageUrl
                        item.extractedAt = new Date().toISOString()
                        updatedCount++
                        console.log(`   ✅ URL extraite: ${newImageUrl.substring(0, 80)}...`)
                    } else {
                        errorCount++
                        console.log(`   ❌ Impossible d'extraire l'image`)
                    }
                } else {
                    errorCount++
                    console.log(`   ❌ Pas d'URL Facebook disponible`)
                }
            } else {
                // Pour les erreurs d'upload, toujours ré-extraire avec Puppeteer pour obtenir une nouvelle URL
                console.log(`   🔄 Ré-extraction avec Puppeteer (URL signature mismatch)...`)

                if (item.facebookUrl) {
                    const newImageUrl = await extractAndDownloadImageFromEventUrl(item.facebookUrl, browser)

                    if (newImageUrl) {
                        item.imageUrl = newImageUrl
                        item.extractedAt = new Date().toISOString()
                        updatedCount++
                        console.log(`   ✅ URL ré-extraite: ${newImageUrl.substring(0, 80)}...`)
                    } else {
                        errorCount++
                        console.log(`   ❌ Impossible de ré-extraire l'image`)
                    }
                } else {
                    errorCount++
                    console.log(`   ❌ Pas d'URL Facebook pour ré-extraire`)
                }
            }

            // Pas de délai entre les événements

            console.log('')
        }

        // Sauvegarder le dataset mis à jour
        console.log('💾 Sauvegarde du dataset mis à jour...')
        // Mettre à jour les éléments traités dans le dataset original
        itemsToProcess.forEach(processedItem => {
            const index = dataset.findIndex(item => item.eventId === processedItem.eventId)
            if (index !== -1) {
                dataset[index] = processedItem
            }
        })
        fs.writeFileSync(datasetPath, JSON.stringify(dataset, null, 2))
        console.log(`✅ Dataset sauvegardé`)
        console.log('')

    } finally {
        await browser.close()
        console.log('✅ Puppeteer fermé')
    }

    console.log('')
    console.log('✅ Traitement terminé!')
    console.log(`   Total traité: ${itemsToProcess.length}`)
    console.log(`   ✅ URLs valides (non modifiées): ${validCount}`)
    console.log(`   🔄 URLs mises à jour: ${updatedCount}`)
    console.log(`   ⚠️  URLs expirées détectées: ${expiredCount}`)
    console.log(`   ❌ Erreurs: ${errorCount}`)
}

updateImageDataset().catch(error => {
    console.error('❌ Erreur fatale:', error)
    process.exit(1)
})

