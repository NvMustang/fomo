/**
 * Configuration commune pour Google Sheets
 * 
 * Module centralisé pour éviter la duplication de code
 * dans tous les scripts de migration et le backend.
 */

const { google } = require('googleapis')
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
    authConfig = {
        keyFile: './service-account.json',
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
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '14UFZYrfMgljwFQ_M2UQMXgjszzG4FEgeoT7hVv0VGsQ'
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

        console.log(`✅ Feuille trouvée: ${spreadsheet.data.properties.title}`)
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
    updateData,
    readData,
    insertColumn,

    // Utilitaires
    runMigration
}
