/**
 * Service de géocodage avec Mapbox
 * Centralise toute la logique de géocodage
 */

const axios = require('axios')

class GeocodingService {
    /**
     * Extraire les composants structurés depuis une feature Mapbox
     */
    static extractComponents(feature) {
        const components = {}
        const context = feature.context || []

        // Mapping simplifié : type -> composant
        const typeMap = {
            'address': 'street',
            'postcode': 'postcode',
            'place': 'place',
            'region': 'region',
            'country': 'country'
        }

        // Parser le context
        context.forEach(item => {
            const id = item.id || ''
            for (const [type, key] of Object.entries(typeMap)) {
                if (id.startsWith(`${type}.`)) {
                    components[key] = item.text
                    if (type === 'country') {
                        components.country_code = item.short_code
                    }
                    break
                }
            }
        })

        // Compléter depuis properties si besoin
        if (feature.properties) {
            if (feature.properties.address_number) {
                components.address_number = feature.properties.address_number
            }
            if (feature.properties.street && !components.street) {
                components.street = feature.properties.street
            }
        }

        return components
    }

    /**
     * Rechercher des adresses avec autocomplétion
     */
    static async searchAddresses(query, options = {}) {
        const { countryCode, limit = 5 } = options

        try {
            console.log(`🔍 Recherche d'adresses Mapbox: ${query}${countryCode ? ` (pays: ${countryCode})` : ' (mondiale)'}`)

            // Token Mapbox
            const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN || 'pk.eyJ1IjoibnZtdXN0YW5nIiwiYSI6ImNtZzJ1dDVpajB5dzQya3IzdWYyc2s0b2IifQ.kjf-gDNu4oJKUrnk_8axPA'

            // Construire l'URL Mapbox
            const encodedQuery = encodeURIComponent(query)
            const countryFilter = countryCode ? `&country=${countryCode}` : ''
            const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${mapboxToken}&limit=${limit}&types=place,locality,neighborhood,address,poi${countryFilter}`

            console.log(`🌐 Appel Mapbox pour: ${query}`)

            const response = await axios.get(mapboxUrl)

            if (!response.data.features) {
                throw new Error('Format de réponse Mapbox invalide')
            }

            const results = response.data.features.map(feature => ({
                display_name: feature.place_name,
                lat: feature.center[1].toFixed(6),
                lon: feature.center[0].toFixed(6),
                place_id: feature.id,
                address: feature.properties || {},
                components: this.extractComponents(feature),
                context: feature.context || []
            }))

            console.log(`✅ ${results.length} résultats Mapbox trouvés`)
            return {
                success: true,
                data: results
            }
        } catch (error) {
            console.error('❌ Erreur recherche Mapbox:', error.message)

            // Si c'est une erreur 401 (token invalide), donner des instructions
            if (error.response?.status === 401) {
                console.log('🔑 Token Mapbox invalide - Instructions:')
                console.log('1. Allez sur https://account.mapbox.com/')
                console.log('2. Créez un compte gratuit')
                console.log('3. Copiez votre token (commence par pk.)')
                console.log('4. Ajoutez MAPBOX_ACCESS_TOKEN=votre_token dans .env')

                return {
                    success: false,
                    error: 'Token Mapbox invalide',
                    instructions: 'Veuillez configurer un token Mapbox valide'
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
