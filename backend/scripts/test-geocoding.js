/**
 * Script de test pour diagnostiquer le problème de géocodage
 * Teste directement l'API MapTiler avec différentes requêtes
 */

require('dotenv').config()
const axios = require('axios')

const maptilerKey = process.env.MAPLIBRE_ACCESS_TOKEN || process.env.VITE_MAPLIBRE_ACCESS_TOKEN

if (!maptilerKey) {
    console.error('❌ MAPLIBRE_ACCESS_TOKEN non configuré')
    process.exit(1)
}

console.log('🔍 Test de l\'API MapTiler Geocoding\n')
console.log(`📋 Clé API (premiers caractères): ${maptilerKey.substring(0, 8)}...\n`)

const testQueries = [
    'Paris',
    'Ronqui',
    'Pont-à-celles',
    'Brussels'
]

async function testQuery(query) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🧪 Test avec: "${query}"`)
    console.log(`${'='.repeat(60)}`)
    
    const encodedQuery = encodeURIComponent(query)
    const url = `https://api.maptiler.com/geocoding/${encodedQuery}.json?key=${maptilerKey}&limit=5&autocomplete=true&fuzzyMatch=true&language=fr`
    
    console.log(`🔗 URL (sans clé): ${url.replace(/key=[^&]+/, 'key=***')}`)
    
    try {
        const response = await axios.get(url, { timeout: 10000 })
        
        console.log(`\n✅ Réponse reçue (status: ${response.status})`)
        console.log(`📋 Type de données: ${typeof response.data}`)
        console.log(`📋 Clés principales: ${Object.keys(response.data).join(', ')}`)
        
        if (response.data.features) {
            console.log(`📋 Nombre de features: ${response.data.features.length}`)
            
            if (response.data.features.length > 0) {
                const first = response.data.features[0]
                console.log(`\n📋 Premier résultat:`)
                console.log(`  - text: ${first.text || 'N/A'}`)
                console.log(`  - place_name: ${first.place_name || 'N/A'}`)
                console.log(`  - id: ${first.id || 'N/A'}`)
                console.log(`  - center: ${JSON.stringify(first.center || 'N/A')}`)
                console.log(`  - geometry.type: ${first.geometry?.type || 'N/A'}`)
                console.log(`  - properties: ${JSON.stringify(first.properties || {}, null, 2).substring(0, 200)}`)
            } else {
                console.log(`\n⚠️ Aucun résultat trouvé`)
            }
        } else {
            console.log(`\n❌ Pas de 'features' dans la réponse`)
            console.log(`📋 Structure complète:`)
            console.log(JSON.stringify(response.data, null, 2).substring(0, 1000))
        }
    } catch (error) {
        console.error(`\n❌ Erreur:`)
        if (error.response) {
            console.error(`  Status: ${error.response.status}`)
            console.error(`  Status Text: ${error.response.statusText}`)
            console.error(`  Data: ${JSON.stringify(error.response.data, null, 2)}`)
        } else if (error.request) {
            console.error(`  Pas de réponse du serveur`)
        } else {
            console.error(`  ${error.message}`)
        }
    }
}

async function runTests() {
    for (const query of testQueries) {
        await testQuery(query)
        // Pause entre les requêtes pour éviter le rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    console.log(`\n${'='.repeat(60)}`)
    console.log('✅ Tests terminés')
    console.log(`${'='.repeat(60)}`)
}

runTests().catch(console.error)

