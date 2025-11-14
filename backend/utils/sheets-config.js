/**
 * Configuration commune pour Google Sheets
 * 
 * Module centralisé pour éviter la duplication de code
 * dans tous les scripts de migration et le backend.
 */

const { google } = require('googleapis')
const path = require('path')
require('dotenv').config()

// Configuration Google Sheets et Drive avec délégation
// Support pour Vercel (JSON string) et développement local (fichier)
let authConfig

if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    // Vercel/Production : JSON string dans variable d'environnement
    try {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
        authConfig = {
            credentials,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive'
            ],
            subject: process.env.GOOGLE_DELEGATED_USER_EMAIL || null
        }
    } catch (error) {
        // Si ce n'est pas un JSON valide, traiter comme chemin de fichier
        authConfig = {
            keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
            scopes: [
                'https://www.googleapis.com/auth/spreadsheets',
                'https://www.googleapis.com/auth/drive'
            ],
            subject: process.env.GOOGLE_DELEGATED_USER_EMAIL || null
        }
    }
} else {
    // Développement local : fichier service-account.json
    // Utiliser un chemin absolu basé sur __dirname pour garantir la localisation correcte
    // depuis backend/utils/sheets-config.js vers backend/service-account.json
    const serviceAccountPath = path.join(__dirname, '..', 'service-account.json')
    authConfig = {
        keyFile: serviceAccountPath,
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ],
        subject: process.env.GOOGLE_DELEGATED_USER_EMAIL || null
    }
}

const auth = new google.auth.GoogleAuth(authConfig)

const sheets = google.sheets({ version: 'v4', auth })
const drive = google.drive({ version: 'v3', auth })

// Détection automatique de l'environnement :
// - Par défaut : utilise toujours PROD (source de vérité unique)
// - Local avec TEST : si USE_TEST_DB=true, utilise GOOGLE_SPREADSHEET_ID_TEST
// - Vercel (production) : utilise toujours GOOGLE_SPREADSHEET_ID (production)
// 
// Stratégie : Source de vérité unique = PROD par défaut
// Pour utiliser TEST en local, définir USE_TEST_DB=true dans .env
const isLocal = !process.env.VERCEL
const useTestDb = process.env.USE_TEST_DB === 'true'
const testSpreadsheetId = process.env.GOOGLE_SPREADSHEET_ID_TEST
const productionSpreadsheetId = process.env.GOOGLE_SPREADSHEET_ID

const SPREADSHEET_ID = (isLocal && useTestDb && testSpreadsheetId)
    ? testSpreadsheetId  // Local avec USE_TEST_DB=true : utiliser la DB de test
    : productionSpreadsheetId  // Par défaut : toujours utiliser PROD (source de vérité unique)

const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || null

/**
 * Vérifier que la configuration est correcte
 */
function validateConfig() {
    if (!SPREADSHEET_ID) {
        throw new Error('GOOGLE_SPREADSHEET_ID non configuré dans .env')
    }
    return true
}

/**
 * Vérifier que la feuille de calcul existe
 */
async function validateSpreadsheet() {
    validateConfig()

    try {
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: SPREADSHEET_ID
        })

        // Déterminer l'environnement pour l'affichage
        const envType = (isLocal && useTestDb && testSpreadsheetId) ? '🧪 TEST' : '📊 PRODUCTION'
        const sourceNote = envType === '📊 PRODUCTION' ? ' (source de vérité unique)' : ' (mode test)'
        console.log(`${envType}${sourceNote} - Feuille trouvée: ${spreadsheet.data.properties.title}`)
        return spreadsheet.data
    } catch (error) {
        throw new Error(`Impossible d'accéder à la feuille de calcul: ${error.message}`)
    }
}

/**
 * Vérifier qu'un onglet existe dans la feuille
 */
async function validateSheet(sheetName) {
    const spreadsheet = await validateSpreadsheet()

    const sheet = spreadsheet.sheets.find(s => s.properties.title === sheetName)
    if (!sheet) {
        throw new Error(`Onglet "${sheetName}" non trouvé! Créez un onglet "${sheetName}" dans votre Google Sheets`)
    }

    return sheet
}

/**
 * Vider un onglet (garder les headers)
 */
async function clearSheet(sheetName, startRow = 2) {
    validateConfig()

    try {
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!A${startRow}:Z1000`
        })
        console.log(`🧹 Onglet "${sheetName}" nettoyé`)
    } catch (error) {
        throw new Error(`Erreur lors du nettoyage de l'onglet "${sheetName}": ${error.message}`)
    }
}

/**
 * Ajouter des données à un onglet
 */
async function appendData(sheetName, data, startRow = 2) {
    validateConfig()

    try {
        const range = `${sheetName}!A${startRow}:${String.fromCharCode(65 + data[0].length - 1)}`

        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'RAW',
            resource: {
                values: data
            }
        })

        console.log(`📤 ${data.length} lignes ajoutées à l'onglet "${sheetName}"`)
    } catch (error) {
        throw new Error(`Erreur lors de l'ajout de données à l'onglet "${sheetName}": ${error.message}`)
    }
}

/**
 * Ajouter des données à un onglet avec déduplication
 * 
 * @param {string} sheetName - Nom de l'onglet
 * @param {Array<Array>} data - Données à sauvegarder (array de lignes)
 * @param {Array<number>} keyColumns - Indices des colonnes formant la clé unique (0-based, ex: [0] pour Session ID, [0,1,2] pour Session+Step+Timestamp)
 * @param {number} startRow - Ligne de départ (par défaut 2, après les headers)
 * @param {number} maxReadRows - Nombre maximum de lignes à lire pour la déduplication (par défaut 10000)
 * @param {string} requestId - ID de requête pour les logs (optionnel)
 * @returns {Object} { saved: number, duplicates: number, total: number }
 */
async function appendDataWithDeduplication(sheetName, data, keyColumns, startRow = 2, maxReadRows = 10000, requestId = '') {
    validateConfig()

    if (!data || data.length === 0) {
        return { saved: 0, duplicates: 0, total: 0 }
    }

    if (!keyColumns || keyColumns.length === 0) {
        throw new Error('keyColumns est requis pour la déduplication')
    }

    const logPrefix = requestId ? `[${requestId}] ` : ''

    try {
        // Lire les données existantes pour les colonnes de clé
        let existingKeys = new Set()
        try {
            // Construire le range pour lire les colonnes de clé (ex: A2:A10000 ou A2:C10000)
            const lastColumn = String.fromCharCode(65 + Math.max(...keyColumns)) // A=65, B=66, etc.
            const readRange = `${String.fromCharCode(65 + keyColumns[0])}${startRow}:${lastColumn}${startRow + maxReadRows - 1}`
            const existingData = await readData(sheetName, readRange)
            
            existingKeys = new Set(
                existingData
                    .filter(row => {
                        // Vérifier que toutes les colonnes de clé sont présentes
                        return keyColumns.every(colIndex => row && row[colIndex] && row[colIndex].toString().trim())
                    })
                    .map(row => {
                        // Créer une clé composite en joignant les valeurs des colonnes de clé
                        return keyColumns.map(colIndex => row[colIndex].toString().trim()).join('|')
                    })
            )
            
            if (requestId) {
                console.log(`📊 ${logPrefix}${existingKeys.size} entrées existantes trouvées dans "${sheetName}"`)
            }
        } catch (readError) {
            // Si la lecture échoue (feuille vide ou première sauvegarde), continuer
            if (requestId) {
                console.warn(`⚠️ ${logPrefix}Erreur lecture données existantes (première sauvegarde?):`, readError.message)
            }
            // Continuer avec un Set vide
        }

        // Filtrer les données pour ne garder que les nouvelles
        const newDataToSave = data.filter(row => {
            // Vérifier que toutes les colonnes de clé sont présentes dans la ligne
            if (!keyColumns.every(colIndex => row && row[colIndex] !== undefined && row[colIndex] !== null)) {
                return false // Ignorer les lignes incomplètes
            }
            
            // Créer la clé composite pour cette ligne
            const rowKey = keyColumns.map(colIndex => {
                const value = row[colIndex]
                return value ? value.toString().trim() : ''
            }).join('|')
            
            // Ne garder que si la clé n'existe pas déjà
            return !existingKeys.has(rowKey)
        })

        const duplicatesCount = data.length - newDataToSave.length

        // Sauvegarder seulement les nouvelles données
        if (newDataToSave.length > 0) {
            await appendData(sheetName, newDataToSave, startRow)
            if (requestId) {
                console.log(`✅ ${logPrefix}${newDataToSave.length} nouvelles lignes sauvegardées dans "${sheetName}" (${duplicatesCount} doublons ignorés)`)
            }
        } else {
            if (requestId) {
                console.log(`ℹ️ ${logPrefix}Toutes les lignes existent déjà dans "${sheetName}", aucune nouvelle ligne à sauvegarder`)
            }
        }

        return {
            saved: newDataToSave.length,
            duplicates: duplicatesCount,
            total: data.length
        }
    } catch (error) {
        throw new Error(`Erreur lors de l'ajout de données avec déduplication à l'onglet "${sheetName}": ${error.message}`)
    }
}

/**
 * Mettre à jour des données dans un onglet
 */
async function updateData(sheetName, data, startRow = 2) {
    validateConfig()

    try {
        const range = `${sheetName}!A${startRow}:${String.fromCharCode(65 + data[0].length - 1)}${startRow + data.length - 1}`

        await sheets.spreadsheets.values.update({
            spreadsheetId: SPREADSHEET_ID,
            range: range,
            valueInputOption: 'RAW',
            resource: {
                values: data
            }
        })

        console.log(`🔄 ${data.length} lignes mises à jour dans l'onglet "${sheetName}"`)
    } catch (error) {
        throw new Error(`Erreur lors de la mise à jour de données dans l'onglet "${sheetName}": ${error.message}`)
    }
}

/**
 * Lire des données d'un onglet
 */
async function readData(sheetName, range = 'A2:Z1000') {
    validateConfig()

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!${range}`
        })

        return response.data.values || []
    } catch (error) {
        throw new Error(`Erreur lors de la lecture de l'onglet "${sheetName}": ${error.message}`)
    }
}

/**
 * Insérer une colonne dans un onglet
 */
async function insertColumn(sheetName, columnIndex, sheetId = null) {
    validateConfig()

    try {
        // Si sheetId n'est pas fourni, le trouver
        if (!sheetId) {
            const spreadsheet = await validateSpreadsheet()
            const sheet = spreadsheet.sheets.find(s => s.properties.title === sheetName)
            if (!sheet) {
                throw new Error(`Onglet "${sheetName}" non trouvé`)
            }
            sheetId = sheet.properties.sheetId
        }

        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: SPREADSHEET_ID,
            resource: {
                requests: [{
                    insertDimension: {
                        range: {
                            sheetId: sheetId,
                            dimension: 'COLUMNS',
                            startIndex: columnIndex,
                            endIndex: columnIndex + 1
                        }
                    }
                }]
            }
        })

        console.log(`➕ Colonne insérée à la position ${columnIndex + 1} dans l'onglet "${sheetName}"`)
    } catch (error) {
        throw new Error(`Erreur lors de l'insertion de colonne dans l'onglet "${sheetName}": ${error.message}`)
    }
}

/**
 * Exécuter une migration avec gestion d'erreurs
 */
async function runMigration(migrationName, migrationFunction) {
    try {
        console.log(`🔄 Début de la migration: ${migrationName}\n`)

        await migrationFunction()

        console.log(`\n✅ Migration "${migrationName}" terminée avec succès!`)
        if (SPREADSHEET_ID) {
            console.log(`🔗 Voir les données: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}`)
        }

    } catch (error) {
        console.error(`❌ Erreur lors de la migration "${migrationName}":`, error.message)
        throw error
    }
}

module.exports = {
    // Configuration
    sheets,
    drive,
    SPREADSHEET_ID,
    DRIVE_FOLDER_ID,
    validateConfig,
    validateSpreadsheet,
    validateSheet,

    // Opérations sur les données
    clearSheet,
    appendData,
    appendDataWithDeduplication,
    updateData,
    readData,
    insertColumn,

    // Utilitaires
    runMigration
}
