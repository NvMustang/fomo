/**
 * Service de géocodage avec Mapbox
 * Centralise toute la logique de géocodage
 * Utilise l'API Mapbox Geocoding pour la précision
 */

const axios = require('axios')
const analyticsTracker = require('../utils/analyticsTracker')

class GeocodingService {
    /**
     * Extraire les composants structurés depuis une feature Mapbox
     * Format GeoJSON standard
     */
    static extractComponents(feature) {
        const components = {}
        const context = feature.context || []

        // Mapping simplifié : type -> composant (format Mapbox standard)
        const typeMap = {
            'address': 'street',
            'postcode': 'postcode',
            'place': 'place',
            'region': 'region',
            'country': 'country',
            'locality': 'locality',
            'neighborhood': 'neighborhood'
        }

        // Parser le context (format Mapbox standard)
        context.forEach(item => {
            const id = item.id || ''
            for (const [type, key] of Object.entries(typeMap)) {
                if (id.startsWith(`${type}.`) || id.includes(`.${type}.`)) {
                    components[key] = item.text || item.name || ''
                    if (type === 'country') {
                        components.country_code = item.short_code || item.iso_3166_1 || ''
                    }
                    break
                }
            }
        })

        // Compléter depuis properties si besoin
        if (feature.properties) {
            if (feature.properties.housenumber || feature.properties.address_number) {
                components.address_number = feature.properties.housenumber || feature.properties.address_number
            }
            if (feature.properties.street && !components.street) {
                components.street = feature.properties.street
            }
            if (feature.properties.city && !components.place) {
                components.place = feature.properties.city
            }
        }

        return components
    }

    /**
     * Rechercher des adresses avec autocomplétion
     * Utilise Mapbox Geocoding API
     * Support POI, places, addresses, etc.
     */
    static async searchAddresses(query, options = {}) {
        // types peut être omis pour obtenir tous les types de résultats
        const { countryCode, limit = 8, types } = options

        try {
            console.log(`🔍 Recherche d'adresses Mapbox: ${query}${countryCode ? ` (pays: ${countryCode})` : ' (mondiale)'}`)

            // Token Mapbox depuis les variables d'environnement
            const mapboxKey = process.env.MAPBOX_ACCESS_TOKEN
            if (!mapboxKey) {
                console.error('❌ [GeocodingService] MAPBOX_ACCESS_TOKEN non configuré')
                console.error('📋 Variables disponibles:', Object.keys(process.env).filter(k => k.includes('MAP')).join(', ') || 'aucune')
                throw new Error('MAPBOX_ACCESS_TOKEN non configuré dans .env')
            }

            // Construire l'URL Mapbox Geocoding API
            // Documentation: https://docs.mapbox.com/api/search/geocoding/
            // Format: https://api.mapbox.com/geocoding/v5/mapbox.places/{query}.json?access_token={token}&limit={limit}&language=fr
            const encodedQuery = encodeURIComponent(query)
            const countryFilter = countryCode ? `&country=${countryCode}` : ''
            // types est optionnel - si fourni, l'ajouter
            const typesParam = types ? `&types=${encodeURIComponent(types)}` : ''

            // Paramètres Mapbox:
            // - autocomplete=true : active l'autocomplétion (par défaut activé)
            // - language=fr : préfère les résultats en français
            // - limit : nombre de résultats
            const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${mapboxKey}&limit=${limit}&language=fr&autocomplete=true${typesParam}${countryFilter}`

            // Logger l'URL (sans le token) pour debug
            const urlForLog = mapboxUrl.replace(/access_token=[^&]+/, 'access_token=***')
            console.log(`🔗 [GeocodingService] URL: ${urlForLog}`)

            console.log(`🌐 Appel Mapbox Geocoding pour: ${query}`)

            const response = await axios.get(mapboxUrl, {
                timeout: 10000 // Timeout de 10 secondes
            })

            // Logger la structure de la réponse pour debug
            console.log(`📋 [GeocodingService] Réponse Mapbox reçue`)
            console.log(`📋 [GeocodingService] Type de données:`, typeof response.data)
            console.log(`📋 [GeocodingService] Has features:`, !!response.data.features)
            console.log(`📋 [GeocodingService] Features count:`, response.data.features?.length || 0)

            // Logger la structure complète de la réponse si pas de features (pour debug)
            if (!response.data.features) {
                console.error('❌ [GeocodingService] Format de réponse Mapbox invalide - pas de features')
                console.error('📋 [GeocodingService] Structure complète de la réponse:')
                console.error(JSON.stringify(response.data, null, 2))
                analyticsTracker.trackRequest('mapbox', 'geocoding', false, {
                    error: 'Format de réponse Mapbox invalide'
                })
                throw new Error('Format de réponse Mapbox invalide')
            }

            if (response.data.features.length === 0) {
                console.log(`⚠️ [GeocodingService] Aucun résultat trouvé pour: "${query}"`)
                console.log(`📋 [GeocodingService] Cela peut être normal si la requête est trop spécifique ou si Mapbox n'a pas de résultats`)
                console.log(`📋 [GeocodingService] Essayez avec une requête plus générale ou vérifiez la clé API`)
                // Retourner un tableau vide au lieu de lancer une erreur
                return {
                    success: true,
                    data: []
                }
            }

            // Mapbox retourne un format GeoJSON standard
            const results = response.data.features.map((feature, index) => {
                // Mapbox utilise center: [lng, lat]
                const center = feature.center || feature.geometry?.coordinates || [0, 0]

                // Logger le premier résultat pour debug
                if (index === 0) {
                    console.log(`📋 [GeocodingService] Premier résultat:`)
                    console.log(`  - text: ${feature.text || 'N/A'}`)
                    console.log(`  - place_name: ${feature.place_name || 'N/A'}`)
                    console.log(`  - properties.name: ${feature.properties?.name || 'N/A'}`)
                    console.log(`  - center: ${JSON.stringify(center)}`)
                    console.log(`  - id: ${feature.id || 'N/A'}`)
                    console.log(`  - geometry.type: ${feature.geometry?.type || 'N/A'}`)
                }

                // Mapbox utilise 'text' comme nom principal, puis place_name
                const displayName = feature.text || feature.place_name || feature.properties?.name || ''

                // Extraire les components
                const extractedComponents = this.extractComponents(feature)

                // Si la ville n'est pas dans les components mais qu'elle est dans place_name, l'extraire
                // place_name a souvent le format "Rue, Ville, Région, Pays"
                if (!extractedComponents.place && !extractedComponents.locality && feature.place_name) {
                    const placeNameParts = feature.place_name.split(',').map(p => p.trim())
                    // Si on a au moins 2 parties, la deuxième est souvent la ville
                    if (placeNameParts.length >= 2) {
                        // Vérifier si c'est une ville (pas une région ou un pays)
                        const potentialCity = placeNameParts[1]
                        // Si ce n'est pas déjà dans region ou country, c'est probablement la ville
                        if (potentialCity &&
                            potentialCity !== extractedComponents.region &&
                            potentialCity !== extractedComponents.country) {
                            extractedComponents.place = potentialCity
                        }
                    }
                }

                // Séparer le nom du lieu et l'adresse complète
                // name = nom du lieu (rue, POI, etc.) - première partie de place_name ou text
                // address = adresse complète avec ville, région, pays - place_name complet
                let venueName = feature.text || ''
                let venueAddress = feature.place_name || displayName || ''

                // Si place_name existe et contient plusieurs parties, extraire le nom
                if (feature.place_name) {
                    const placeNameParts = feature.place_name.split(',').map(p => p.trim())
                    if (placeNameParts.length > 0) {
                        // Le nom est la première partie (rue, POI, etc.)
                        venueName = placeNameParts[0]
                        // L'adresse est le place_name complet
                        venueAddress = feature.place_name
                    }
                } else if (feature.text) {
                    // Si pas de place_name, utiliser text comme nom
                    venueName = feature.text
                    venueAddress = feature.text
                }

                return {
                    display_name: displayName,
                    name: venueName, // Nom du lieu (ex: "Rue de la Paix")
                    address: venueAddress, // Adresse complète (ex: "Rue de la Paix, Paris, Île-de-France, France")
                    lat: center[1]?.toFixed(6) || '0',
                    lon: center[0]?.toFixed(6) || '0',
                    place_id: feature.id || feature.properties?.id || String(index),
                    properties: feature.properties || {}, // Propriétés brutes de Mapbox
                    components: extractedComponents,
                    context: feature.context || [],
                    // Ajouter aussi place_name complet pour le fallback frontend
                    place_name: feature.place_name || ''
                }
            })

            console.log(`✅ ${results.length} résultats Mapbox trouvés`)

            // Tracker succès
            analyticsTracker.trackRequest('mapbox', 'geocoding', true)

            return {
                success: true,
                data: results
            }
        } catch (error) {
            console.error('❌ [GeocodingService] Erreur recherche Mapbox:', error.message)

            // Logger plus de détails pour le debug
            if (error.response) {
                console.error('📋 [GeocodingService] Status:', error.response.status)
                console.error('📋 [GeocodingService] Status Text:', error.response.statusText)
                if (error.response.data) {
                    console.error('📋 [GeocodingService] Response Data:', JSON.stringify(error.response.data, null, 2))
                }
            } else if (error.request) {
                console.error('📋 [GeocodingService] Pas de réponse du serveur Mapbox')
                console.error('📋 [GeocodingService] Request:', error.request)
            } else {
                console.error('📋 [GeocodingService] Erreur de configuration:', error.message)
            }

            // Tracker erreur
            const errorMsg = error.response?.status
                ? `HTTP ${error.response.status}: ${error.message}`
                : error.message
            analyticsTracker.trackRequest('mapbox', 'geocoding', false, {
                error: errorMsg
            })

            // Si c'est une erreur 401 (token invalide), donner des instructions
            if (error.response?.status === 401) {
                console.error('🔑 [GeocodingService] Token Mapbox invalide - Instructions:')
                console.error('1. Allez sur https://account.mapbox.com/')
                console.error('2. Vérifiez votre clé API dans votre compte')
                console.error('3. Ajoutez MAPBOX_ACCESS_TOKEN=votre_key dans .env du backend')

                return {
                    success: false,
                    error: 'Token Mapbox invalide',
                    instructions: 'Veuillez configurer une clé Mapbox valide'
                }
            }

            // Si c'est une erreur de timeout
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                console.error('⏱️ [GeocodingService] Timeout lors de l\'appel à Mapbox')
                return {
                    success: false,
                    error: 'Timeout lors de la recherche d\'adresses',
                    details: 'Le serveur Mapbox n\'a pas répondu à temps'
                }
            }

            return {
                success: false,
                error: 'Erreur lors de la recherche d\'adresses',
                details: error.response?.data || error.message
            }
        }
    }
}

module.exports = GeocodingService
