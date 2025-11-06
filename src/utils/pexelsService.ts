/**
 * Service Pexels pour récupérer des images en fonction d'un titre d'événement
 */

const PEXELS_API_KEY = 'h1mxKSN4dnwZaR4XTLfAZTAcjlzzJkNgnAkWjeQmBQrknFdg5NVr21sX'
const PEXELS_API_URL = 'https://api.pexels.com/v1/search'

/**
 * Récupère une image depuis Pexels en fonction d'un titre d'événement
 * @param query - Titre de l'événement ou mots-clés
 * @returns URL de l'image ou null en cas d'erreur
 */
export async function getPexelsImage(query: string): Promise<string | null> {
    try {
        // Nettoyer la query : extraire les mots-clés principaux
        const cleanQuery = query
            .toLowerCase()
            .replace(/[àáâãäå]/g, 'a')
            .replace(/[èéêë]/g, 'e')
            .replace(/[ìíîï]/g, 'i')
            .replace(/[òóôõö]/g, 'o')
            .replace(/[ùúûü]/g, 'u')
            .replace(/[ç]/g, 'c')
            .replace(/[^a-z0-9\s]/g, '')
            .split(' ')
            .filter(word => word.length > 2)
            .slice(0, 3) // Prendre les 3 premiers mots significatifs
            .join(' ')

        if (!cleanQuery) {
            return null
        }

        const response = await fetch(`${PEXELS_API_URL}?query=${encodeURIComponent(cleanQuery)}&per_page=1&orientation=landscape`, {
            headers: {
                'Authorization': PEXELS_API_KEY
            }
        })

        if (!response.ok) {
            console.warn(`[Pexels] Erreur HTTP ${response.status} pour "${query}"`)
            return null
        }

        const data = await response.json()
        
        if (data.photos && data.photos.length > 0) {
            // Retourner l'URL de l'image en taille moyenne
            const photo = data.photos[0]
            return photo.src?.large || photo.src?.medium || photo.src?.original || null
        }

        return null
    } catch (error) {
        console.error(`[Pexels] Erreur lors de la récupération d'image pour "${query}":`, error)
        return null
    }
}

/**
 * Récupère plusieurs images depuis Pexels (pour préchargement)
 * @param queries - Liste de titres d'événements
 * @returns Map avec query -> image URL
 */
export async function getPexelsImages(queries: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>()
    
    // Limiter les appels simultanés pour éviter de surcharger l'API
    const batchSize = 5
    for (let i = 0; i < queries.length; i += batchSize) {
        const batch = queries.slice(i, i + batchSize)
        const promises = batch.map(async (query) => {
            const imageUrl = await getPexelsImage(query)
            if (imageUrl) {
                results.set(query, imageUrl)
            }
        })
        
        await Promise.all(promises)
        
        // Petit délai entre les batches pour respecter les rate limits
        if (i + batchSize < queries.length) {
            await new Promise(resolve => setTimeout(resolve, 200))
        }
    }
    
    return results
}


