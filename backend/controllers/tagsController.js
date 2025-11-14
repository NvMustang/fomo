/**
 * Contrôleur pour les tags - NOUVELLE STRATÉGIE OVERWRITE
 * Gère la logique métier des tags avec calcul depuis les événements
 */

const DataServiceV2 = require('../utils/dataService')

class TagsController {
    /**
     * Récupérer tous les tags avec leurs statistiques
     * GET /api/tags
     */
    static async getAllTags(req, res) {
        const requestId = Math.random().toString(36).substr(2, 9)
        const timestamp = new Date().toISOString()
        try {
            console.log(`🏷️  [${requestId}] [${timestamp}] Récupération de tous les tags...`)
            console.log(`🏷️  [${requestId}] Headers:`, req.headers['user-agent'] || 'unknown')

            const tags = await TagsController._computeTagsFromEvents()

            console.log(`✅ [${requestId}] ${tags.length} tags récupérés`)
            res.json({ success: true, data: tags })
        } catch (error) {
            console.error(`❌ [${requestId}] Erreur récupération tags:`, error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Récupérer les tags les plus populaires
     * GET /api/tags/popular?limit=20
     */
    static async getPopularTags(req, res) {
        const requestId = Math.random().toString(36).substr(2, 9)
        try {
            const limit = parseInt(req.query.limit) || 20
            console.log(`🏷️  [${requestId}] Récupération des ${limit} tags les plus populaires...`)

            const tags = await TagsController._computeTagsFromEvents()

            // Trier par popularité décroissante
            const sortedTags = tags.sort((a, b) => b.usage_count - a.usage_count)
            const popularTags = sortedTags.slice(0, limit)

            console.log(`✅ [${requestId}] ${popularTags.length} tags populaires récupérés`)
            res.json({ success: true, data: popularTags })
        } catch (error) {
            console.error(`❌ [${requestId}] Erreur récupération tags populaires:`, error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Rechercher des tags par query
     * GET /api/tags/search?q=concert
     */
    static async searchTags(req, res) {
        const requestId = Math.random().toString(36).substr(2, 9)
        try {
            const query = (req.query.q || '').trim().toLowerCase()
            const limit = parseInt(req.query.limit) || 20

            if (!query) {
                return res.status(400).json({
                    success: false,
                    error: 'Paramètre "q" requis pour la recherche'
                })
            }

            console.log(`🏷️  [${requestId}] Recherche de tags: "${query}"`)

            const tags = await TagsController._computeTagsFromEvents()

            // Filtrer les tags qui correspondent à la query
            const matchingTags = tags
                .filter(tag => tag.tag.includes(query))
                .sort((a, b) => b.usage_count - a.usage_count)
                .slice(0, limit)

            console.log(`✅ [${requestId}] ${matchingTags.length} tags trouvés pour "${query}"`)
            res.json({ success: true, data: matchingTags })
        } catch (error) {
            console.error(`❌ [${requestId}] Erreur recherche tags:`, error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Enregistrer l'utilisation d'un tag (pour statistiques futures)
     * POST /api/tags/use
     * Body: { tag: "concert", eventId: "evt_123" }
     */
    static async useTag(req, res) {
        const requestId = Math.random().toString(36).substr(2, 9)
        try {
            const { tag, eventId } = req.body

            if (!tag) {
                return res.status(400).json({
                    success: false,
                    error: 'Paramètre "tag" requis'
                })
            }

            console.log(`🏷️  [${requestId}] Utilisation du tag "${tag}" pour l'événement ${eventId || 'N/A'}`)

            // Pour l'instant, cette route est un placeholder
            // Les tags sont déjà trackés via les événements
            // Pourrait être utilisé pour du tracking additionnel dans le futur

            res.json({
                success: true,
                message: 'Tag enregistré',
                data: { tag, eventId }
            })
        } catch (error) {
            console.error(`❌ [${requestId}] Erreur enregistrement tag:`, error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Méthode privée : Calculer les tags depuis les événements
     * Reconstruit un index de tags avec statistiques depuis tous les événements
     * @returns {Promise<Array<{tag: string, usage_count: number, last_used: string, created_at: string, created_by: string}>>}
     */
    static async _computeTagsFromEvents() {
        try {
            // VERSION OPTIMISÉE : Lit uniquement Tags Sheet (pas besoin de charger tous les events)
            // IMPORTANT: Utiliser sheets-config.js directement (comme dataService.js)
            const { sheets, SPREADSHEET_ID } = require('../utils/sheets-config')
            
            // 1. Lire directement le sheet Tags (beaucoup plus rapide !)
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Tags!A2:K'  // A = eventId, B-K = tag1..tag10
            })
            
            // Vérifier que response.data existe
            if (!response || !response.data) {
                console.warn('⚠️ [TagsController] Réponse Google Sheets invalide (response.data manquant)')
                return []
            }
            
            const rows = response.data.values || []
            const tagMap = new Map()
            const normalize = (t) => (t || '').toString().trim().toLowerCase()
            
            // 2. Parcourir et compter les occurrences
            for (const row of rows) {
                if (!row || !Array.isArray(row)) continue
                
                const eventId = row[0]
                if (!eventId) continue
                
                // Parcourir les colonnes B-K (index 1-10) pour les tags
                for (let i = 1; i <= 10; i++) {
                    const tag = normalize(row[i])
                    if (!tag) continue
                    
                    const existing = tagMap.get(tag)
                    if (!existing) {
                        tagMap.set(tag, { usage_count: 1 })
                    } else {
                        existing.usage_count++
                    }
                }
            }
            
            // 3. Convertir en array et trier par popularité
            const list = Array.from(tagMap.entries()).map(([tag, info]) => ({
                tag,
                usage_count: info.usage_count
            }))
            
            list.sort((a, b) => b.usage_count - a.usage_count)
            
            console.log(`✅ [TagsController] ${list.length} tags calculés depuis Tags Sheet (${rows.length} events)`)
            return list
        } catch (error) {
            // Gestion gracieuse : si le sheet Tags n'existe pas ou erreur Google Sheets, retourner tableau vide
            console.warn('⚠️ [TagsController] Erreur lecture Tags Sheet (feuille absente ou illisible):', error?.message || error)
            // Retourner un tableau vide plutôt que de planter
            return []
        }
    }
}

module.exports = TagsController

