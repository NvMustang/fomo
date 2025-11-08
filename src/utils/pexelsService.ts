/**
 * Service Pexels pour récupérer des images en fonction d'un titre d'événement
 */

const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY
const PEXELS_API_URL = 'https://api.pexels.com/v1/search'

/**
 * Récupère une image depuis Pexels en fonction d'un titre d'événement
 * @param query - Titre de l'événement ou mots-clés
 * @returns URL de l'image ou null en cas d'erreur
 */
export async function getPexelsImage(query: string): Promise<string | null> {
    try {
        if (!PEXELS_API_KEY) {
            console.warn('[Pexels] Clé API non configurée. Veuillez définir VITE_PEXELS_API_KEY dans .env.local')
            return null
        }

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
 * Mapping de tags français vers queries Pexels en anglais
 */
const TAG_MAPPING: Record<string, string> = {
    'musique': 'music',
    'jazz': 'jazz music',
    'rock': 'rock music',
    'pop': 'pop music',
    'classique': 'classical music',
    'cuisine': 'cooking food',
    'italienne': 'italian food',
    'française': 'french food',
    'sport': 'sport',
    'football': 'football sport',
    'basketball': 'basketball',
    'randonnée': 'hiking nature',
    'vtt': 'mountain biking',
    'art': 'art',
    'exposition': 'art exhibition',
    'peinture': 'painting art',
    'photographie': 'photography',
    'cinéma': 'cinema movie',
    'théâtre': 'theater',
    'danse': 'dance',
    'festival': 'festival',
    'concert': 'concert music',
    'conférence': 'conference',
    'formation': 'training education',
    'tech': 'technology',
    'développement': 'programming code',
    'startup': 'startup business',
    'networking': 'networking business',
    'nature': 'nature',
    'forêt': 'forest nature',
    'plage': 'beach',
    'montagne': 'mountain',
    'culture': 'culture',
    'histoire': 'history',
    'patrimoine': 'heritage',
    'famille': 'family',
    'enfants': 'children',
    'seniors': 'elderly',
    'bien-être': 'wellness',
    'yoga': 'yoga',
    'méditation': 'meditation',
    'santé': 'health',
    'environnement': 'environment',
    'écologie': 'ecology',
    'développement durable': 'sustainability'
}

/**
 * Génère une query contextuelle à partir du titre et des tags pour Pexels
 * @param title - Titre de l'événement
 * @param tags - Tags de l'événement
 * @returns Query optimisée pour Pexels
 */
export function generateContextualQuery(title: string, tags: string[] = []): string {
    // Extraire les mots-clés du titre
    const titleWords = title
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
        .slice(0, 2) // Prendre les 2 premiers mots du titre

    // Mapper les tags vers des queries en anglais
    const tagQueries = tags
        .map(tag => TAG_MAPPING[tag.toLowerCase()] || tag.toLowerCase())
        .filter(Boolean)
        .slice(0, 2) // Prendre les 2 premiers tags

    // Combiner titre + tags
    const allKeywords = [...titleWords, ...tagQueries]
    const query = allKeywords.slice(0, 3).join(' ') // Max 3 mots-clés

    return query || 'event'
}

/**
 * Récupère une image contextuelle depuis Pexels basée sur le titre et les tags d'un événement
 * @param title - Titre de l'événement
 * @param tags - Tags de l'événement
 * @returns URL de l'image ou null en cas d'erreur
 */
export async function getContextualPexelsImage(title: string, tags: string[] = []): Promise<string | null> {
    const query = generateContextualQuery(title, tags)
    return await getPexelsImage(query)
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


