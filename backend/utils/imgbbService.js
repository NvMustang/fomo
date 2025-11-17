/**
 * Service ImgBB pour uploader des images depuis une URL
 * Documentation: https://api.imgbb.com/
 */

const axios = require('axios')
// form-data est nécessaire pour les uploads multipart
let FormData
try {
    FormData = require('form-data')
} catch (e) {
    console.warn('⚠️  form-data non installé. Installation requise: npm install form-data')
    FormData = null
}

const IMGBB_API_KEY = process.env.IMGBB_API_KEY
const IMGBB_API_URL = 'https://api.imgbb.com/1/upload'

/**
 * Uploader une image vers ImgBB depuis une URL
 * @param {string} imageUrl - URL de l'image à uploader
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
/**
 * Nettoyer et valider une URL d'image Facebook
 */
function cleanFacebookImageUrl(url) {
    if (!url || typeof url !== 'string') {
        return null
    }

    // Décoder les entités HTML si présentes
    let cleanUrl = url.replace(/&amp;/g, '&').replace(/&quot;/g, '"')

    // Enlever les fragments et certains paramètres qui peuvent causer des problèmes
    // Garder seulement les paramètres essentiels
    try {
        const urlObj = new URL(cleanUrl)

        // Pour les URLs scontent Facebook, garder seulement les paramètres essentiels
        if (urlObj.hostname.includes('scontent') || urlObj.hostname.includes('fbcdn')) {
            // Reconstruire l'URL avec seulement le pathname et les paramètres essentiels
            const essentialParams = ['_nc_cat', '_nc_sid', '_nc_ohc', '_nc_oc', '_nc_zt', '_nc_ht', '_nc_gid', 'oh', 'oe']
            const newParams = new URLSearchParams()

            for (const param of essentialParams) {
                if (urlObj.searchParams.has(param)) {
                    newParams.set(param, urlObj.searchParams.get(param))
                }
            }

            // Reconstruire l'URL
            cleanUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}?${newParams.toString()}`
        }

        return cleanUrl
    } catch (e) {
        // Si l'URL n'est pas valide, retourner l'URL originale nettoyée
        return cleanUrl
    }
}

async function uploadImageFromUrl(imageUrl) {
    if (!IMGBB_API_KEY) {
        console.error('❌ IMGBB_API_KEY non configurée dans les variables d\'environnement')
        return {
            success: false,
            error: 'IMGBB_API_KEY non configurée'
        }
    }

    if (!imageUrl || typeof imageUrl !== 'string') {
        return {
            success: false,
            error: 'URL d\'image invalide'
        }
    }

    // Nettoyer l'URL Facebook avant upload
    const cleanedUrl = cleanFacebookImageUrl(imageUrl)
    if (!cleanedUrl) {
        return {
            success: false,
            error: 'URL d\'image invalide après nettoyage'
        }
    }

    // Vérifier que l'URL est accessible avant de l'uploader vers ImgBB
    try {
        // Afficher l'URL complète pour debug
        console.log(`   🔍 Vérification de l'URL (complète):`)
        console.log(`   ${cleanedUrl}`)
        const headResponse = await axios.head(cleanedUrl, {
            timeout: 10000,
            maxRedirects: 5,
            validateStatus: (status) => status < 400,
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://www.facebook.com/'
            }
        })

        if (headResponse.status >= 400) {
            return {
                success: false,
                error: `URL inaccessible (HTTP ${headResponse.status})`,
                httpStatus: headResponse.status
            }
        }
    } catch (urlError) {
        // Si HEAD échoue, essayer GET avec range pour vérifier l'accessibilité
        try {
            const testResponse = await axios.get(cleanedUrl, {
                timeout: 10000,
                maxRedirects: 5,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Referer': 'https://www.facebook.com/',
                    'Range': 'bytes=0-1023' // Télécharger seulement les premiers 1KB pour vérifier
                },
                validateStatus: (status) => status === 206 || status < 400
            })

            if (testResponse.status >= 400) {
                return {
                    success: false,
                    error: `URL inaccessible (HTTP ${testResponse.status})`,
                    httpStatus: testResponse.status
                }
            }
        } catch (testError) {
            return {
                success: false,
                error: `URL invalide ou expirée: ${testError.message}`,
                httpStatus: testError.response?.status
            }
        }
    }

    try {
        // ImgBB accepte les uploads depuis une URL via le paramètre "image"
        const formData = new FormData()
        formData.append('key', IMGBB_API_KEY)
        formData.append('image', cleanedUrl) // URL nettoyée de l'image

        const response = await axios.post(IMGBB_API_URL, formData, {
            headers: formData.getHeaders(),
            timeout: 30000
        })

        if (response.data && response.data.success) {
            const imgbbUrl = response.data.data.url
            const deleteUrl = response.data.data.delete_url || null
            console.log(`✅ Image uploadée vers ImgBB: ${imgbbUrl}`)
            if (deleteUrl) {
                console.log(`   🔗 URL de suppression: ${deleteUrl}`)
            }
            return {
                success: true,
                url: imgbbUrl,
                deleteUrl: deleteUrl,
                data: response.data.data
            }
        } else {
            // Logger l'erreur complète pour debug
            const errorMsg = response.data?.error?.message || 'Erreur lors de l\'upload ImgBB'
            const errorCode = response.data?.error?.code
            const fullError = response.data?.error
            console.error(`   ❌ Erreur ImgBB complète:`, JSON.stringify(fullError, null, 2))
            console.error(`   ❌ Message: ${errorMsg}`)
            if (errorCode) {
                console.error(`   ❌ Code: ${errorCode}`)
            }
            return {
                success: false,
                error: errorMsg,
                errorCode: errorCode,
                httpStatus: response.status,
                fullError: fullError
            }
        }
    } catch (error) {
        // Logger l'erreur complète pour debug
        const errorMessage = error.message || 'Erreur lors de l\'upload vers ImgBB'
        const httpStatus = error.response?.status
        const errorData = error.response?.data

        console.error(`   ❌ Erreur upload ImgBB (catch):`)
        console.error(`   Message: ${errorMessage}`)
        if (httpStatus) {
            console.error(`   HTTP Status: ${httpStatus}`)
        }
        if (errorData) {
            console.error(`   Réponse complète:`, JSON.stringify(errorData, null, 2))
        }

        return {
            success: false,
            error: httpStatus ? `${httpStatus}: ${errorMessage}` : errorMessage,
            httpStatus: httpStatus,
            errorData: errorData
        }
    }
}

/**
 * Uploader une image depuis un buffer (fichier local)
 * @param {Buffer} imageBuffer - Buffer de l'image
 * @param {string} filename - Nom du fichier (optionnel)
 * @returns {Promise<{success: boolean, url?: string, error?: string}>}
 */
async function uploadImageFromBuffer(imageBuffer, filename = 'image.jpg') {
    if (!IMGBB_API_KEY) {
        return {
            success: false,
            error: 'IMGBB_API_KEY non configurée'
        }
    }

    // Détecter le type d'image depuis le buffer (magic bytes)
    let contentType = 'image/jpeg'
    if (imageBuffer[0] === 0x89 && imageBuffer[1] === 0x50 && imageBuffer[2] === 0x4E && imageBuffer[3] === 0x47) {
        contentType = 'image/png'
        if (!filename.endsWith('.png')) {
            filename = filename.replace(/\.(jpg|jpeg)$/i, '.png')
        }
    } else if (imageBuffer[0] === 0x47 && imageBuffer[1] === 0x49 && imageBuffer[2] === 0x46) {
        contentType = 'image/gif'
        if (!filename.endsWith('.gif')) {
            filename = filename.replace(/\.(jpg|jpeg|png)$/i, '.gif')
        }
    } else if (imageBuffer[0] === 0x52 && imageBuffer[1] === 0x49 && imageBuffer[2] === 0x46 && imageBuffer[8] === 0x57 && imageBuffer[9] === 0x45 && imageBuffer[10] === 0x42 && imageBuffer[11] === 0x50) {
        contentType = 'image/webp'
        if (!filename.endsWith('.webp')) {
            filename = filename.replace(/\.(jpg|jpeg|png|gif)$/i, '.webp')
        }
    }

    try {
        const formData = new FormData()
        formData.append('key', IMGBB_API_KEY)
        formData.append('image', imageBuffer, {
            filename: filename,
            contentType: contentType
        })

        const response = await axios.post(IMGBB_API_URL, formData, {
            headers: formData.getHeaders(),
            timeout: 30000
        })

        if (response.data && response.data.success) {
            const imgbbUrl = response.data.data.url
            const deleteUrl = response.data.data.delete_url || null
            console.log(`✅ Image uploadée vers ImgBB: ${imgbbUrl}`)
            if (deleteUrl) {
                console.log(`   🔗 URL de suppression: ${deleteUrl}`)
            }
            return {
                success: true,
                url: imgbbUrl,
                deleteUrl: deleteUrl,
                data: response.data.data
            }
        } else {
            const errorMsg = response.data?.error?.message || 'Erreur lors de l\'upload ImgBB'
            const errorCode = response.data?.error?.code
            const fullError = response.data?.error
            console.error(`   ❌ Erreur ImgBB (buffer):`, JSON.stringify(fullError, null, 2))
            console.error(`   ❌ Message: ${errorMsg}`)
            if (errorCode) {
                console.error(`   ❌ Code: ${errorCode}`)
            }
            return {
                success: false,
                error: errorMsg,
                errorCode: errorCode,
                httpStatus: response.status,
                fullError: fullError
            }
        }
    } catch (error) {
        const errorMessage = error.message || 'Erreur lors de l\'upload vers ImgBB'
        const httpStatus = error.response?.status
        const errorData = error.response?.data

        console.error(`   ❌ Erreur upload ImgBB (buffer, catch):`)
        console.error(`   Message: ${errorMessage}`)
        if (httpStatus) {
            console.error(`   HTTP Status: ${httpStatus}`)
        }
        if (errorData) {
            console.error(`   Réponse complète:`, JSON.stringify(errorData, null, 2))
        }

        return {
            success: false,
            error: httpStatus ? `${httpStatus}: ${errorMessage}` : errorMessage,
            httpStatus: httpStatus,
            errorData: errorData
        }
    }
}

module.exports = {
    uploadImageFromUrl,
    uploadImageFromBuffer
}

