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

            const tags = await this._computeTagsFromEvents()

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

            const tags = await this._computeTagsFromEvents()

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

            const tags = await this._computeTagsFromEvents()

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
        // Récupérer tous les événements avec leurs tags
        const events = await DataServiceV2.getAllActiveData(
            'Events!A2:R',
            DataServiceV2.mappers.event
        )

        // Enrichir avec les tags depuis la feuille Tags
        const tagsMap = await DataServiceV2.getTagsByEventIdMap(10)
        if (tagsMap.size > 0) {
            for (const evt of events) {
                const fromSheet = tagsMap.get(evt.id)
                if (fromSheet && fromSheet.length) {
                    evt.tags = fromSheet
                }
            }
        }

        // Construire un index { tag -> { count, lastUsed, created_at, created_by } }
        const tagMap = new Map()

        const normalize = (t) => (t || '').toString().trim().toLowerCase()

        for (const evt of events) {
            const eventTime = evt.startsAt || ''
            const eventCreatedAt = evt.createdAt || eventTime
            const eventOrganizerName = evt.organizerName || ''

            for (const raw of (evt.tags || [])) {
                const t = typeof raw === 'string' ? normalize(raw) : ''
                if (!t) continue

                const existing = tagMap.get(t)
                if (!existing) {
                    // Première occurrence : utiliser createdAt et organizerName de l'event
                    tagMap.set(t, {
                        usage_count: 1,
                        last_used: eventTime,
                        created_at: eventCreatedAt,
                        created_by: eventOrganizerName
                    })
                } else {
                    const newer = !existing.last_used || (eventTime && eventTime > existing.last_used)
                    tagMap.set(t, {
                        usage_count: existing.usage_count + 1,
                        last_used: newer ? eventTime : existing.last_used,
                        created_at: existing.created_at, // Garder la date de création originale
                        created_by: existing.created_by  // Garder le créateur original
                    })
                }
            }
        }

        // Convertir en array et retourner
        const list = Array.from(tagMap.entries()).map(([tag, info]) => ({
            tag,
            usage_count: info.usage_count,
            last_used: info.last_used || '',
            created_at: info.created_at || '',
            created_by: info.created_by || ''
        }))

        // Trier par popularité décroissante
        list.sort((a, b) => b.usage_count - a.usage_count)

        return list
    }
}

module.exports = TagsController

