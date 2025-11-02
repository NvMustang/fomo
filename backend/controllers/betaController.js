/**
 * Contrôleur pour les retours Beta
 * Gère l'enregistrement des feedbacks utilisateurs dans Google Sheets
 */

const DataServiceV2 = require('../utils/dataService')

class BetaController {
    /**
     * Créer un nouveau retour beta
     * Structure de la feuille "Beta": userID | Topic | Message | CreateAt
     */
    static async createBetaFeedback(req, res) {
        try {
            const { userID, topic, message, createAt } = req.body

            // Validation des champs requis
            if (!userID || !topic || !message) {
                return res.status(400).json({
                    success: false,
                    error: 'userID, topic et message sont requis'
                })
            }

            console.log(`📝 Création retour beta: ${topic} (user: ${userID})`)

            // Préparer les données pour la feuille Beta
            // Structure: A: userID, B: Topic, C: Message, D: CreateAt
            const rowData = [
                userID,                          // A: UserID
                topic.trim(),                    // B: Topic
                message.trim(),                  // C: Message
                createAt || new Date().toISOString() // D: CreateAt
            ]

            const result = await DataServiceV2.createRow(
                'Beta!A2:D',
                rowData
            )

            console.log(`✅ Retour beta créé avec succès`)
            res.json({
                success: true,
                data: {
                    userID,
                    topic,
                    message,
                    createAt: rowData[3]
                },
                action: result.action
            })
        } catch (error) {
            console.error('❌ Erreur création retour beta:', error)
            res.status(500).json({
                success: false,
                error: error.message || 'Erreur lors de l\'enregistrement du retour'
            })
        }
    }
}

module.exports = BetaController

