/**
 * Service utilitaire pour les opérations communes sur les données
 * NOUVELLE STRATÉGIE : Overwrite + Colonnes système
 * 
 * Principe :
 * - Chaque table reflète uniquement l'état actuel
 * - Pas de versioning, pas d'append-only
 * - Colonnes système : modifiedAt, deletedAt
 * - Logs séparés pour le suivi des actions
 */

const { sheets, SPREADSHEET_ID } = require('./sheets-config')

// Normalisation unique des booléens provenant de Google Sheets
// Accepte: true/false, 'true'/'false', 'TRUE'/'FALSE', 1/0, '1'/'0', 'yes'/'no'
const toBool = (v) => {
    const s = (v ?? 'false').toString().trim().toLowerCase()
    return s === 'true' || s === '1' || s === 'yes'
}

class DataServiceV2 {
    /**
     * Récupérer toutes les données actives d'une table
     * @param {string} range - Range Google Sheets (ex: 'Events!A2:Q')
     * @param {function} mapper - Fonction pour mapper une ligne vers un objet
     * @returns {Array} Données mappées (uniquement les données actives)
     */
    static async getAllActiveData(range, mapper) {
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: range
            })

            const rows = response.data.values || []
            const activeData = []

            for (const row of rows) {
                // Pour l'instant, toutes les lignes sont considérées comme actives
                // (les colonnes système ne sont pas encore implémentées)
                activeData.push(mapper(row))
            }

            return activeData
        } catch (error) {
            console.error('❌ Erreur récupération données actives:', error)
            return []
        }
    }

    /**
     * Récupérer une donnée par sa clé unique
     * @param {string} range - Range Google Sheets
     * @param {function} mapper - Fonction pour mapper une ligne
     * @param {number} keyColumn - Index de la colonne clé (0-based)
     * @param {string} keyValue - Valeur de la clé à rechercher
     * @returns {Object|null} Donnée trouvée ou null
     */
    static async getByKey(range, mapper, keyColumn, keyValue) {
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: range
            })

            const rows = response.data.values || []

            for (const row of rows) {
                if (row[keyColumn] === keyValue) {
                    // Pour les réponses, on retourne toujours la ligne même si elle a un deletedAt
                    // car on veut pouvoir la mettre à jour (suppression soft -> nouvelle réponse)
                    return mapper(row)
                }
            }

            return null
        } catch (error) {
            console.error('❌ Erreur récupération par clé:', error)
            return null
        }
    }

    /**
     * Créer ou mettre à jour une donnée (UPSERT)
     * @param {string} range - Range Google Sheets
     * @param {Array} rowData - Données de la ligne
     * @param {number} keyColumn - Index de la colonne clé
     * @param {string} keyValue - Valeur de la clé
     * @returns {Object} Résultat de l'opération
     */
    static async upsertData(range, rowData, keyColumn, keyValue) {
        try {
            // D'abord, vérifier si la donnée existe
            const existingData = await this.getByKey(range, (row) => row, keyColumn, keyValue)

            if (existingData) {
                // Mettre à jour la ligne existante
                return await this.updateRow(range, rowData, keyColumn, keyValue)
            } else {
                // Créer une nouvelle ligne
                return await this.createRow(range, rowData)
            }
        } catch (error) {
            console.error('❌ Erreur upsert:', error)
            throw error
        }
    }

    /**
     * Créer une nouvelle ligne
     * @param {string} range - Range Google Sheets
     * @param {Array} rowData - Données de la ligne
     */
    static async createRow(range, rowData) {
        try {
            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: range,
                valueInputOption: 'RAW',
                resource: { values: [rowData] }
            })

            // Logger l'action
            await this.logAction('CREATE', range, rowData)

            return { action: 'created', data: rowData }
        } catch (error) {
            console.error('❌ Erreur création ligne:', error)
            throw error
        }
    }

    /**
     * Mettre à jour une ligne existante
     * @param {string} range - Range Google Sheets
     * @param {Array} rowData - Nouvelles données
     * @param {number} keyColumn - Index de la colonne clé
     * @param {string} keyValue - Valeur de la clé
     */
    static async updateRow(range, rowData, keyColumn, keyValue) {
        try {
            // Récupérer toutes les données pour trouver l'index de la ligne
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: range
            })

            const rows = response.data.values || []
            let rowIndex = -1

            for (let i = 0; i < rows.length; i++) {
                if (rows[i][keyColumn] === keyValue) {
                    rowIndex = i
                    break
                }
            }

            if (rowIndex === -1) {
                throw new Error(`Ligne non trouvée pour la clé: ${keyValue}`)
            }

            // Calculer la range de la ligne spécifique
            const sheetName = range.split('!')[0]
            const startCol = range.split('!')[1].split(':')[0].replace(/\d+/g, '')
            const endCol = range.split('!')[1].split(':')[1].replace(/\d+/g, '')
            const actualRowIndex = rowIndex + 2 // +2 car on commence à la ligne 2 (après les headers)

            const specificRange = `${sheetName}!${startCol}${actualRowIndex}:${endCol}${actualRowIndex}`

            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: specificRange,
                valueInputOption: 'RAW',
                resource: { values: [rowData] }
            })

            // Logger l'action
            await this.logAction('UPDATE', range, rowData, { keyColumn, keyValue })

            return { action: 'updated', data: rowData }
        } catch (error) {
            console.error('❌ Erreur mise à jour ligne:', error)
            throw error
        }
    }

    /**
     * Supprimer logiquement une donnée (soft delete)
     * @param {string} range - Range Google Sheets
     * @param {number} keyColumn - Index de la colonne clé
     * @param {string} keyValue - Valeur de la clé
     */
    static async softDelete(range, keyColumn, keyValue) {
        try {
            // Récupérer la donnée actuelle
            const currentData = await this.getByKey(range, (row) => row, keyColumn, keyValue)

            if (!currentData) {
                throw new Error(`Donnée non trouvée pour la clé: ${keyValue}`)
            }

            // Mettre à jour les colonnes response et deletedAt
            const deletedAt = new Date().toISOString()
            currentData[4] = 'cleared' // Colonne E = response
            currentData[5] = deletedAt // Colonne F = modifiedAt
            currentData[6] = deletedAt // Colonne G = deletedAt

            await this.updateRow(range, currentData, keyColumn, keyValue)

            // Logger l'action
            await this.logAction('DELETE', range, currentData, { keyColumn, keyValue })

            return { action: 'deleted', deletedAt }
        } catch (error) {
            console.error('❌ Erreur suppression logique:', error)
            throw error
        }
    }

    /**
     * Suppression complète d'une ligne (hard delete)
     * @param {string} range - Plage de données (ex: 'Responses!A2:H')
     * @param {number} keyColumn - Index de la colonne clé (0-based)
     * @param {string} keyValue - Valeur de la clé à supprimer
     */
    static async hardDelete(range, keyColumn, keyValue) {
        try {
            // Récupérer la donnée actuelle pour le log
            const currentData = await this.getByKey(range, (row) => row, keyColumn, keyValue)

            if (!currentData) {
                throw new Error(`Donnée non trouvée pour la clé: ${keyValue}`)
            }

            // Supprimer complètement la ligne
            await this.deleteRow(range, keyColumn, keyValue)

            // Logger l'action
            await this.logAction('HARD_DELETE', range, currentData, { keyColumn, keyValue })

            return { action: 'hard_deleted', keyValue }
        } catch (error) {
            console.error('❌ Erreur hardDelete:', error)
            throw error
        }
    }

    /**
     * Supprimer une ligne complètement de Google Sheets
     * @param {string} range - Plage de données
     * @param {number} keyColumn - Index de la colonne clé
     * @param {string} keyValue - Valeur de la clé
     */
    static async deleteRow(range, keyColumn, keyValue) {
        try {
            // Récupérer toutes les données
            const allData = await this.getAllData(range, (row) => row)

            // Trouver l'index de la ligne à supprimer
            const rowIndex = allData.findIndex(row => row[keyColumn] === keyValue)

            if (rowIndex === -1) {
                throw new Error(`Ligne non trouvée pour la clé: ${keyValue}`)
            }

            // Calculer l'index réel dans Google Sheets (rowIndex + 2 car on commence à A2)
            const sheetRowIndex = rowIndex + 2

            // Supprimer la ligne
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: 0, // ID de la feuille (0 = première feuille)
                                dimension: 'ROWS',
                                startIndex: sheetRowIndex - 1, // Google Sheets utilise 0-based
                                endIndex: sheetRowIndex
                            }
                        }
                    }]
                }
            })

            console.log(`✅ Ligne supprimée: ${keyValue} (index: ${sheetRowIndex})`)
        } catch (error) {
            console.error('❌ Erreur deleteRow:', error)
            throw error
        }
    }

    /**
     * Logger une action dans la feuille Logs
     * @param {string} action - Type d'action (CREATE, UPDATE, DELETE)
     * @param {string} table - Table concernée
     * @param {Array} data - Données
     * @param {Object} metadata - Métadonnées supplémentaires
     */
    static async logAction(action, table, data, metadata = {}) {
        try {
            const logEntry = [
                new Date().toISOString(), // timestamp
                action,                   // action
                table,                    // table
                JSON.stringify(data),     // payload
                JSON.stringify(metadata)  // metadata
            ]

            await sheets.spreadsheets.values.append({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Logs!A:E',
                valueInputOption: 'RAW',
                resource: { values: [logEntry] }
            })
        } catch (error) {
            console.error('❌ Erreur logging:', error)
            // Ne pas faire échouer l'opération principale si le logging échoue
        }
    }

    /**
     * Mappers pour les différents types de données avec colonnes système
     */
    static mappers = {
        event: (row) => ({
            id: row[0],
            createdAt: row[1] || new Date().toISOString(),
            title: row[2] || '',
            description: row[3] || '',
            startsAt: row[4] || '',
            endsAt: row[5] || '',
            venue: {
                name: row[6] || '',
                address: row[7] || '',
                lat: parseFloat((row[8] || '').replace(',', '.')) || 0,
                lng: parseFloat((row[9] || '').replace(',', '.')) || 0
            },

            // Les tags proviennent désormais uniquement de la feuille Tags
            tags: [],
            coverUrl: row[10] || '',
            coverImagePosition: (() => {
                const parts = (row[11] || '').split(';')
                return parts.length === 2 ? { x: parseFloat(parts[0]) || 50, y: parseFloat(parts[1]) || 50 } : undefined
            })(),
            organizerId: row[12] || 'user-1',
            organizerName: row[13] || '',
            isPublic: toBool(row[14]),
            isOnline: toBool(row[15]),
            modifiedAt: row[16] || new Date().toISOString(),
            deletedAt: row[17] || null
        }),

        user: (row) => ({
            id: row[0],
            createdAt: row[1] || new Date().toISOString(),
            name: row[2] || '',
            email: row[3] || '',
            city: row[4] || '',
            lat: parseFloat(row[5]) || null, // NOUVEAU: latitude
            lng: parseFloat(row[6]) || null, // NOUVEAU: longitude
            friendsCount: parseInt(row[7]) || 0,
            showAttendanceToFriends: toBool(row[8]),
            isPublicProfile: toBool(row[9]),
            isActive: toBool(row[10]), // Colonne K: Status (normalisé en booléen)
            isAmbassador: toBool(row[11]),
            allowRequests: toBool(row[12]), // Colonne M: AllowRequests
            modifiedAt: row[13] || new Date().toISOString(),
            deletedAt: row[14] || null,
            lastConnexion: row[15] || null // Colonne P: LastConnexion
        }),

        response: (row) => ({
            id: row[0], // A - ID (eventId_userId)
            createdAt: row[1] || new Date().toISOString(), // B - Timestamp
            userId: row[2], // C - User ID
            invitedByUserId: row[3] || undefined, // D - InvitedByUserId
            eventId: row[4], // E - Event ID (décalé de D à E)
            response: row[5], // F - Response (décalé de E à F)
            modifiedAt: row[6] || new Date().toISOString(), // G - ModifiedAt (décalé de F à G)
            deletedAt: row[7] || null, // H - DeletedAt (décalé de G à H)

        }),

        friendship: (row) => ({
            id: row[0],
            createdAt: row[1] || new Date().toISOString(),
            fromUserId: row[2],
            toUserId: row[3],
            status: row[4] || 'active',
            modifiedAt: row[5] || new Date().toISOString(),
            deletedAt: row[6] || null
        })
    }

    /**
     * Lire la feuille Tags et retourner une map eventId -> liste de tags (normalisés)
     * Structure attendue de la feuille `Tags` (au minimum):
     *  - Col A: eventId
     *  - Col B: tag

     * Les tags sont normalisés en minuscules, trim, sans doublons, et limités à 10 par event.
     * @param {number} maxPerEvent - Nombre max de tags par événement (par défaut 10)
     * @returns {Promise<Map<string, string[]>>}
     */
    static async getTagsByEventIdMap(maxPerEvent = 10) {
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'Tags!A2:K' // A = eventId, B..K = tag1..tag10
            })

            const rows = response.data.values || []
            const result = new Map()

            const normalize = (t) => (t || '').toString().trim().toLowerCase()

            for (const row of rows) {
                const eventId = (row[0] || '').toString().trim()
                if (!eventId) continue

                if (!result.has(eventId)) {
                    result.set(eventId, [])
                }
                const list = result.get(eventId)

                // Parcourir les colonnes B..K (index 1..10)
                for (let i = 1; i <= 10; i++) {
                    const tagRaw = row[i]
                    const tag = normalize(tagRaw)
                    if (!tag) continue
                    if (list.includes(tag)) continue
                    if (list.length >= maxPerEvent) break
                    list.push(tag)
                }
            }

            return result
        } catch (error) {
            console.warn('⚠️  Lecture Tags: feuille "Tags" absente ou illisible. Fallback K/L/M.', error?.message)
            return new Map()
        }
    }

    /**
     * Upsert des tags pour un événement dans la feuille `Tags` (A=eventId, B..K=tag1..tag10)
     * Écrase les valeurs existantes pour cet eventId, avec normalisation/déduplication et cap à 10.
     * @param {string} eventId
     * @param {string[]} tags
     * @param {number} maxPerEvent
     */
    static async upsertEventTags(eventId, tags = [], maxPerEvent = 10) {
        try {
            const normalize = (t) => (t || '').toString().trim().toLowerCase()
            const unique = []
            for (const raw of tags) {
                const t = normalize(raw)
                if (!t) continue
                if (unique.includes(t)) continue
                unique.push(t)
                if (unique.length >= maxPerEvent) break
            }

            // Construire la ligne: A + 10 colonnes tags
            const rowData = [eventId]
            for (let i = 0; i < 10; i++) {
                rowData.push(unique[i] || '')
            }

            // Vérifier si la ligne existe déjà
            const existing = await this.getByKey('Tags!A2:K', (row) => row, 0, eventId)

            if (existing) {
                // Mettre à jour la ligne existante
                const result = await this.updateRow('Tags!A2:K', rowData, 0, eventId)
                return result
            } else {
                // Créer une nouvelle ligne avec append (utiliser 'Tags!A:K' pour éviter problèmes si vide)
                try {
                    await sheets.spreadsheets.values.append({
                        spreadsheetId: SPREADSHEET_ID,
                        range: 'Tags!A:K',
                        valueInputOption: 'RAW',
                        insertDataOption: 'INSERT_ROWS',
                        resource: { values: [rowData] }
                    })
                    return { action: 'created', data: rowData }
                } catch (appendError) {
                    throw appendError
                }
            }
        } catch (error) {
            console.error(`❌ Erreur écriture Tags pour ${eventId}:`, error.message)
            console.error('Stack:', error.stack)
            throw error
        }
    }
}

module.exports = DataServiceV2
