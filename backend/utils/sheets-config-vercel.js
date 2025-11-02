/**
 * Configuration Google Sheets pour Vercel
 * Utilise les variables d'environnement au lieu d'un fichier
 */

const { google } = require('googleapis')

// Pour Vercel, on utilise GOOGLE_SERVICE_ACCOUNT_KEY comme JSON string dans les env vars
function getAuthConfig() {
    // Option 1: Variable d'environnement JSON string
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        try {
            const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY)
            return {
                credentials,
                scopes: [
                    'https://www.googleapis.com/auth/spreadsheets',
                    'https://www.googleapis.com/auth/drive'
                ],
                subject: process.env.GOOGLE_DELEGATED_USER_EMAIL || null
            }
        } catch (error) {
            throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY doit être un JSON valide')
        }
    }

    // Option 2: Fallback vers fichier (pour développement local)
    return {
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || './service-account.json',
        scopes: [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'
        ],
        subject: process.env.GOOGLE_DELEGATED_USER_EMAIL || null
    }
}

// Configuration avec support Vercel
const authConfig = getAuthConfig()
const auth = new google.auth.GoogleAuth(authConfig)

const sheets = google.sheets({ version: 'v4', auth })
const drive = google.drive({ version: 'v3', auth })
const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || null

// Re-export toutes les fonctions du fichier original (qui détecte automatiquement local/Vercel)
const originalConfig = require('./sheets-config')

module.exports = {
    ...originalConfig,
    sheets,
    drive,
    DRIVE_FOLDER_ID
}

