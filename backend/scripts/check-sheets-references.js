/**
 * Script de vérification des références Google Sheets
 * Vérifie que les ranges utilisés dans le code sont cohérents avec les mappers
 */

const fs = require('fs')
const path = require('path')

// Schéma attendu pour chaque feuille (déduit des mappers)
const EXPECTED_SCHEMAS = {
    'Events': {
        range: 'Events!A2:Q',
        expectedColumns: 17, // A à Q = 17 colonnes (0-16)
        mapper: 'event',
        columns: [
            'A: ID',
            'B: CreatedAt',
            'C: Title',
            'D: Description',
            'E: StartsAt',
            'F: EndsAt',
            'G: Venue Name',
            'H: Venue Address',
            'I: Latitude',
            'J: Longitude',
            'K: Cover URL',
            'L: Image Position',
            'M: Organizer ID',
            'N: Is Public',
            'O: Is Online',
            'P: ModifiedAt',
            'Q: DeletedAt'
        ]
    },
    'Users': {
        range: 'Users!A2:P',
        expectedColumns: 16, // A à P = 16 colonnes (0-15)
        mapper: 'user',
        columns: [
            'A: ID',
            'B: CreatedAt',
            'C: Name',
            'D: Email',
            'E: City',
            'F: Latitude',
            'G: Longitude',
            'H: Friends Count',
            'I: Show Attendance To Friends',
            'J: Is Public Profile',
            'K: Is Active',
            'L: Is Ambassador',
            'M: Allow Requests',
            'N: ModifiedAt',
            'O: DeletedAt',
            'P: LastConnexion'
        ]
    },
    'Responses': {
        range: 'Responses!A2:G',
        expectedColumns: 7, // A à G = 7 colonnes (0-6)
        mapper: 'response',
        columns: [
            'A: ID',
            'B: CreatedAt',
            'C: User ID',
            'D: InvitedByUserId',
            'E: Event ID',
            'F: InitialResponse',
            'G: FinalResponse'
        ]
    },
    'Relations': {
        range: 'Relations!A2:G',
        expectedColumns: 7, // A à G = 7 colonnes (0-6)
        mapper: 'friendship',
        columns: [
            'A: ID',
            'B: CreatedAt',
            'C: From User ID',
            'D: To User ID',
            'E: Status',
            'F: ModifiedAt',
            'G: DeletedAt'
        ]
    },
    'Tags': {
        range: 'Tags!A2:K',
        expectedColumns: 11, // A à K = 11 colonnes (0-10)
        mapper: null, // Pas de mapper, utilisation directe
        columns: [
            'A: Event ID',
            'B: Tag 1',
            'C: Tag 2',
            'D: Tag 3',
            'E: Tag 4',
            'F: Tag 5',
            'G: Tag 6',
            'H: Tag 7',
            'I: Tag 8',
            'J: Tag 9',
            'K: Tag 10'
        ]
    },
    'Beta': {
        range: 'Beta!A2:D',
        expectedColumns: 4, // A à D = 4 colonnes (0-3)
        mapper: null,
        columns: [
            'A: ?',
            'B: ?',
            'C: ?',
            'D: ?'
        ]
    }
}

// Fonction pour convertir une lettre en index (A=0, B=1, etc.)
function letterToIndex(letter) {
    return letter.charCodeAt(0) - 65 // 'A' = 65, donc A = 0
}

// Fonction pour extraire le range depuis une chaîne (ex: "Events!A2:R" -> {sheet: "Events", start: "A", end: "R"})
function parseRange(rangeStr) {
    const match = rangeStr.match(/([A-Za-z]+)!(A\d+):([A-Z]+)/)
    if (!match) return null

    return {
        sheet: match[1],
        startCol: match[2].replace(/\d+/, ''), // "A2" -> "A"
        endCol: match[3],
        startIndex: letterToIndex(match[2].replace(/\d+/, '')),
        endIndex: letterToIndex(match[3]),
        columnCount: letterToIndex(match[3]) - letterToIndex(match[2].replace(/\d+/, '')) + 1
    }
}

// Fonction pour lire tous les fichiers JS dans un répertoire
function getAllJsFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir)

    files.forEach(file => {
        const filePath = path.join(dir, file)
        const stat = fs.statSync(filePath)

        if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
            getAllJsFiles(filePath, fileList)
        } else if (file.endsWith('.js')) {
            fileList.push(filePath)
        }
    })

    return fileList
}

// Fonction pour extraire les ranges d'un fichier
function extractRanges(filePath) {
    const content = fs.readFileSync(filePath, 'utf8')
    const ranges = []

    // Ignorer les commentaires (// et /* */)
    const lines = content.split('\n')
    const activeContent = lines.map((line, idx) => {
        // Retirer les commentaires de ligne (//)
        const lineCommentIndex = line.indexOf('//')
        if (lineCommentIndex !== -1) {
            // Vérifier que ce n'est pas dans une string
            const beforeComment = line.substring(0, lineCommentIndex)
            const quoteCount = (beforeComment.match(/['"]/g) || []).length
            if (quoteCount % 2 === 0) {
                // Nombre pair de quotes = commentaire réel (pas dans une string)
                return null // Ignorer cette ligne
            }
        }
        return line
    }).filter(line => line !== null).join('\n')

    // Pattern pour trouver les ranges: "SheetName!A2:Z" ou "SheetName!A2:Z123"
    // Exclure les exemples dans les commentaires JSDoc
    const rangePattern = /(['"])([A-Za-z]+)!(A\d+):([A-Z]+)\d*\1/g
    let match

    while ((match = rangePattern.exec(activeContent)) !== null) {
        // Vérifier que ce n'est pas dans un commentaire multi-lignes /* */
        const beforeMatch = activeContent.substring(0, match.index)
        const openComments = (beforeMatch.match(/\/\*/g) || []).length
        const closeComments = (beforeMatch.match(/\*\//g) || []).length

        // Si nombre impair de commentaires ouverts, on est dans un commentaire
        if (openComments > closeComments) {
            continue
        }

        const rangeStr = match[2] + '!' + match[3] + ':' + match[4]
        const parsed = parseRange(rangeStr)
        if (parsed) {
            // Vérifier que ce n'est pas un exemple générique (SheetName, TableName, etc.)
            const genericNames = ['SheetName', 'TableName', 'Example', 'Ex']
            if (!genericNames.includes(parsed.sheet)) {
                ranges.push({
                    range: rangeStr,
                    parsed,
                    file: path.relative(path.join(__dirname, '..'), filePath),
                    line: activeContent.substring(0, match.index).split('\n').length
                })
            }
        }
    }

    return ranges
}

// Fonction principale
function checkReferences() {
    console.log('🔍 Vérification des références Google Sheets...\n')

    const backendDir = path.join(__dirname, '..')
    const files = getAllJsFiles(backendDir)

    const allRanges = []
    files.forEach(file => {
        const ranges = extractRanges(file)
        allRanges.push(...ranges.map(r => ({ ...r, file: path.relative(backendDir, file) })))
    })

    // Grouper par feuille
    const rangesBySheet = {}
    allRanges.forEach(range => {
        const sheet = range.parsed.sheet
        if (!rangesBySheet[sheet]) {
            rangesBySheet[sheet] = []
        }
        rangesBySheet[sheet].push(range)
    })

    // Vérifier chaque feuille
    let hasErrors = false

    console.log('📊 RAPPORT DE VÉRIFICATION\n')
    console.log('='.repeat(80))

    for (const [sheetName, ranges] of Object.entries(rangesBySheet)) {
        const schema = EXPECTED_SCHEMAS[sheetName]

        if (!schema) {
            console.log(`\n⚠️  FEUILLE NON DÉFINIE: ${sheetName}`)
            console.log(`   Trouvée dans:`)
            ranges.forEach(r => {
                console.log(`   - ${r.file}:${r.line} -> ${r.range}`)
            })
            hasErrors = true
            continue
        }

        console.log(`\n📋 ${sheetName}`)
        console.log(`   Schéma attendu: ${schema.range} (${schema.expectedColumns} colonnes)`)
        console.log(`   Utilisations trouvées: ${ranges.length}`)

        // Vérifier la cohérence des ranges
        const inconsistentRanges = ranges.filter(r => r.parsed.columnCount !== schema.expectedColumns)

        if (inconsistentRanges.length > 0) {
            console.log(`   ❌ INCOHÉRENCES DÉTECTÉES:`)
            inconsistentRanges.forEach(r => {
                console.log(`   - ${r.file}:${r.line}`)
                console.log(`     Range: ${r.range} (${r.parsed.columnCount} colonnes, attendu: ${schema.expectedColumns})`)
            })
            hasErrors = true
        } else {
            console.log(`   ✅ Tous les ranges sont cohérents`)
        }

        // Afficher les fichiers utilisant cette feuille
        const uniqueFiles = [...new Set(ranges.map(r => r.file))]
        if (uniqueFiles.length > 0) {
            console.log(`   Fichiers: ${uniqueFiles.join(', ')}`)
        }

        // Afficher le schéma des colonnes
        if (schema.columns && schema.columns.length > 0) {
            console.log(`   Colonnes:`)
            schema.columns.forEach((col, idx) => {
                console.log(`     ${col}`)
            })
        }
    }

    // Vérifier les feuilles définies mais non utilisées
    console.log(`\n📋 FEUILLES DÉFINIES MAIS NON UTILISÉES`)
    let unusedCount = 0
    for (const [sheetName, schema] of Object.entries(EXPECTED_SCHEMAS)) {
        if (!rangesBySheet[sheetName]) {
            console.log(`   ⚠️  ${sheetName}: ${schema.range} (non référencée dans le code)`)
            unusedCount++
        }
    }
    if (unusedCount === 0) {
        console.log(`   ✅ Toutes les feuilles définies sont utilisées`)
    }

    console.log('\n' + '='.repeat(80))

    if (hasErrors) {
        console.log('\n❌ Des incohérences ont été détectées. Veuillez les corriger.')
        process.exit(1)
    } else {
        console.log('\n✅ Toutes les références sont cohérentes !')
        process.exit(0)
    }
}

// Exécuter le script
if (require.main === module) {
    checkReferences()
}

module.exports = { checkReferences }

