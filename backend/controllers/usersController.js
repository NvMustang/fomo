/**
 * Contrôleur pour les utilisateurs et le système d'amitié - NOUVELLE STRATÉGIE OVERWRITE
 * Gère la logique métier avec overwrite + colonnes système
 */

const DataServiceV2 = require('../utils/dataService')
const ResponsesController = require('./responsesController')
const { sheets, SPREADSHEET_ID } = require('../utils/sheets-config')

class UsersController {
    // Range Google Sheets pour la feuille Users (inclut isVisitor en colonne J)
    static USERS_RANGE = 'Users!A2:Q'

    // ===== MÉTHODES PRIVÉES UTILITAIRES =====

    /**
     * Normaliser un email (trim + lowercase)
     */
    static normalizeEmail(email) {
        return (email || '').trim().toLowerCase()
    }

    /**
     * Normaliser une coordonnée (lat ou lng) pour toujours utiliser un point comme séparateur décimal
     * Même logique que pour les events : parseFloat(value || 0).toFixed(6)
     * @param {number|string|null|undefined} coord - Coordonnée à normaliser
     * @returns {string} Coordonnée normalisée avec point (format: "48.856614")
     */
    static normalizeCoordinate(coord) {
        return parseFloat(coord || 0).toFixed(6)
    }

    /**
     * Récupérer tous les utilisateurs depuis la base
     */
    static async _getAllUsersFromDb() {
        return await DataServiceV2.getAllActiveData(
            UsersController.USERS_RANGE,
            DataServiceV2.mappers.user
        )
    }

    /**
     * Récupérer uniquement les utilisateurs actifs
     */
    static async getActiveUsers() {
        const allUsers = await UsersController._getAllUsersFromDb()
        return allUsers.filter(user => user.isActive === true)
    }

    /**
     * Trouver un visitor actif par email
     * @param {Array} allUsers - Liste de tous les users (optionnel, sera récupéré si non fourni)
     * @param {string} email - Email normalisé
     * @returns {Object|null} Visitor trouvé ou null
     */
    static async findVisitorByEmail(allUsers = null, email) {
        const users = allUsers || await UsersController._getAllUsersFromDb()
        return users.find(u => {
            const userEmail = UsersController.normalizeEmail(u.email)
            return userEmail === email &&
                u.id &&
                u.isVisitor === true &&
                u.isActive === true
        })
    }

    // ===== MÉTHODES PUBLIQUES =====

    /**
     * Récupérer tous les utilisateurs actifs
     */
    static async getAllUsers(req, res) {
        const requestId = Math.random().toString(36).substr(2, 9)
        const timestamp = new Date().toISOString()
        try {
            console.log(`👥 [${requestId}] [${timestamp}] Récupération des utilisateurs (overwrite)...`)
            console.log(`👥 [${requestId}] Headers:`, req.headers['user-agent'] || 'unknown')
            console.log(`👥 [${requestId}] IP:`, req.ip || req.connection.remoteAddress)

            const users = await UsersController.getActiveUsers()

            console.log(`✅ [${requestId}] ${users.length} utilisateurs actifs récupérés`)
            res.json({ success: true, data: users })
        } catch (error) {
            console.error(`❌ [${requestId}] Erreur récupération utilisateurs:`, error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Récupérer un utilisateur par ID
     */
    static async getUserById(req, res) {
        try {
            const userId = req.params.id
            console.log(`👥 Récupération utilisateur: ${userId}`)

            const user = await DataServiceV2.getByKey(
                UsersController.USERS_RANGE,
                DataServiceV2.mappers.user,
                0, // key column (ID)
                userId
            )

            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Utilisateur non trouvé'
                })
            }

            console.log(`✅ Utilisateur récupéré: ${user.name}`)
            res.json({ success: true, data: user })
        } catch (error) {
            console.error('❌ Erreur récupération utilisateur:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Créer ou mettre à jour un utilisateur (UPSERT)
     * NOUVELLE LOGIQUE : Plus de migration, on passe juste isVisitor de true à false
     */
    static async upsertUser(req, res) {
        try {
            const userData = req.body
            let userId = userData.id || `usr-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

            const normalizedEmail = UsersController.normalizeEmail(userData.email)

            console.log(`🔄 Upsert utilisateur: ${userId}`)

            // Vérifier si l'utilisateur existe pour préserver createdAt et isVisitor lors d'un update
            const existingUser = await DataServiceV2.getByKey(
                UsersController.USERS_RANGE,
                DataServiceV2.mappers.user,
                0,
                userId
            )

            // createdAt : préserver lors d'un update, définir à maintenant lors d'une création
            const createdAt = existingUser?.createdAt || new Date().toISOString()

            // isVisitor : 
            // - Si userData.isVisitor est explicitement fourni, l'utiliser (permet la conversion visitor → user)
            // - Sinon, préserver la valeur existante si elle existe
            // - Sinon, défaut: true pour nouveaux users (visitors par défaut)
            const isVisitor = userData.isVisitor !== undefined
                ? userData.isVisitor
                : (existingUser ? (existingUser.isVisitor ?? true) : true)

            // Préparer les données pour la feuille (tous les champs explicitement, comme pour events)
            // Structure: A=ID, B=CreatedAt, C=Name, D=Email, E=City, F=Lat, G=Lng, H=FriendsCount, I=ShowAttendanceToFriends, J=isVisitor, K=isPublicProfile, L=isActive, M=isAmbassador, N=allowRequests, O=modifiedAt, P=deletedAt, Q=lastConnexion
            const rowData = [
                userId,                                    // A: ID
                createdAt,                                 // B: CreatedAt (préservé si update, nouveau si create)
                userData.name || '',                      // C: Name
                normalizedEmail || '',                    // D: Email (normalisé)
                userData.city || '',                      // E: City
                UsersController.normalizeCoordinate(userData.lat), // F: Latitude (format avec points, même logique que events)
                UsersController.normalizeCoordinate(userData.lng), // G: Longitude (format avec points, même logique que events)
                userData.friendsCount !== undefined ? userData.friendsCount : 0, // H: Friends Count
                userData.showAttendanceToFriends !== undefined ? userData.showAttendanceToFriends : true, // I: Privacy (défaut: true)
                isVisitor,                                // J: isVisitor (préservé si update, sinon valeur fournie)
                userData.isPublicProfile !== undefined ? userData.isPublicProfile : false, // K: Is Public Profile (défaut: false)
                userData.isActive !== undefined ? userData.isActive : true, // L: Is Active (défaut: true)
                userData.isAmbassador !== undefined ? userData.isAmbassador : false, // M: Is Ambassador (défaut: false)
                userData.allowRequests !== undefined ? userData.allowRequests : true, // N: Allow Requests (défaut: true)
                userData.modifiedAt || new Date().toISOString(), // O: ModifiedAt (fourni ou maintenant)
                '',                                       // P: DeletedAt (vide)
                new Date().toISOString()                  // Q: LastConnexion (toujours mis à jour à maintenant)
            ]

            const result = await DataServiceV2.upsertData(
                UsersController.USERS_RANGE,
                rowData,
                0, // key column (ID)
                userId
            )

            console.log(`✅ Utilisateur ${result.action}: ${userId}`)
            res.json({
                success: true,
                data: { ...userData, id: userId },
                action: result.action
            })
        } catch (error) {
            console.error('❌ Erreur upsert utilisateur:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Mettre à jour un utilisateur (UPDATE uniquement - pas de création)
     * Utilisé pour transformer un visiteur en user (isVisitor: true → false)
     */
    static async updateUser(req, res) {
        try {
            const userData = req.body
            const userId = userData.id

            if (!userId) {
                return res.status(400).json({
                    success: false,
                    error: 'userId est requis'
                })
            }

            console.log(`🔄 Update utilisateur: ${userId}`)

            // Vérifier si l'utilisateur existe
            const existingUser = await DataServiceV2.getByKey(
                UsersController.USERS_RANGE,
                DataServiceV2.mappers.user,
                0,
                userId
            )

            if (!existingUser) {
                return res.status(404).json({
                    success: false,
                    error: 'Utilisateur non trouvé'
                })
            }

            // Récupérer la ligne actuelle pour la mettre à jour
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: UsersController.USERS_RANGE
            })

            const rows = response.data.values || []
            const rowIndex = rows.findIndex(row => row && row[0] === userId)

            if (rowIndex === -1) {
                return res.status(404).json({
                    success: false,
                    error: 'Utilisateur non trouvé dans la feuille'
                })
            }

            // Récupérer la ligne actuelle
            const currentRow = rows[rowIndex]

            // Mettre à jour uniquement les champs fournis dans userData
            const updatedRow = [
                currentRow[0], // A: ID (inchangé)
                currentRow[1], // B: CreatedAt (inchangé)
                userData.name !== undefined ? userData.name : currentRow[2], // C: Name
                userData.email !== undefined ? UsersController.normalizeEmail(userData.email) : currentRow[3], // D: Email
                userData.city !== undefined ? userData.city : currentRow[4], // E: City
                userData.lat !== undefined ? UsersController.normalizeCoordinate(userData.lat) : currentRow[5], // F: Lat (normalisée avec point)
                userData.lng !== undefined ? UsersController.normalizeCoordinate(userData.lng) : currentRow[6], // G: Lng (normalisée avec point)
                userData.friendsCount !== undefined ? userData.friendsCount : currentRow[7], // H: FriendsCount
                userData.showAttendanceToFriends !== undefined ? userData.showAttendanceToFriends : currentRow[8], // I: ShowAttendanceToFriends
                userData.isVisitor !== undefined ? userData.isVisitor : currentRow[9], // J: isVisitor (important pour transformation)
                userData.isPublicProfile !== undefined ? userData.isPublicProfile : currentRow[10], // K: isPublicProfile
                userData.isActive !== undefined ? userData.isActive : currentRow[11], // L: isActive
                userData.isAmbassador !== undefined ? userData.isAmbassador : currentRow[12], // M: isAmbassador
                userData.allowRequests !== undefined ? userData.allowRequests : currentRow[13], // N: allowRequests
                new Date().toISOString(), // O: modifiedAt (toujours mis à jour)
                currentRow[15] || '', // P: deletedAt (inchangé)
                new Date().toISOString() // Q: lastConnexion (toujours mis à jour)
            ]

            // Mettre à jour la ligne
            const sheetName = 'Users'
            const spreadsheet = await sheets.spreadsheets.get({
                spreadsheetId: SPREADSHEET_ID
            })
            const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName)
            if (!sheet) {
                throw new Error(`Feuille "${sheetName}" non trouvée`)
            }

            // Calculer l'index réel dans Google Sheets (rowIndex + 2 car range commence à A2)
            const sheetRowIndex = rowIndex + 2

            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `Users!A${sheetRowIndex}:Q${sheetRowIndex}`,
                valueInputOption: 'RAW',
                resource: { values: [updatedRow] }
            })

            // Récupérer l'utilisateur mis à jour
            const updatedUser = await DataServiceV2.getByKey(
                UsersController.USERS_RANGE,
                DataServiceV2.mappers.user,
                0,
                userId
            )

            console.log(`✅ Utilisateur mis à jour: ${userId}`)
            res.json({
                success: true,
                data: updatedUser,
                action: 'updated'
            })
        } catch (error) {
            console.error('❌ Erreur update utilisateur:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Supprimer un utilisateur (soft delete)
     */
    static async deleteUser(req, res) {
        try {
            const userId = req.params.id
            console.log(`🗑️ Suppression utilisateur: ${userId}`)

            const result = await UsersController.softDeleteUser(userId)

            console.log(`✅ Utilisateur supprimé: ${userId}`)
            res.json({
                success: true,
                message: 'Utilisateur supprimé avec succès',
                deletedAt: result.deletedAt
            })
        } catch (error) {
            console.error('❌ Erreur suppression utilisateur:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Soft delete d'un utilisateur : isActive = false, deletedAt = date actuelle
     * Structure Users: L=isActive (index 11), P=deletedAt (index 15)
     */
    static async softDeleteUser(userId) {
        try {
            // Récupérer la donnée actuelle
            const currentData = await DataServiceV2.getByKey(
                UsersController.USERS_RANGE,
                (row) => row,
                0, // key column (ID)
                userId
            )

            if (!currentData) {
                throw new Error(`Utilisateur non trouvé: ${userId}`)
            }

            const deletedAt = new Date().toISOString()
            const modifiedAt = new Date().toISOString()

            // Mettre à jour isActive (L, index 11) et deletedAt (P, index 15)
            // S'assurer que le tableau a assez d'éléments
            while (currentData.length < 17) {
                currentData.push('')
            }

            currentData[11] = false // L: isActive
            currentData[14] = modifiedAt // O: modifiedAt
            currentData[15] = deletedAt // P: deletedAt

            await DataServiceV2.updateRow(
                UsersController.USERS_RANGE,
                currentData,
                0, // key column (ID)
                userId
            )

            return { action: 'deleted', deletedAt }
        } catch (error) {
            console.error('❌ Erreur soft delete utilisateur:', error)
            throw error
        }
    }

    /**
     * Rechercher des utilisateurs par nom ou email
     */
    static async searchUsers(req, res) {
        try {
            const query = (req.query.query || req.query.email || '').trim().toLowerCase()
            const currentUserId = req.query.currentUserId

            if (!query || query.length < 3) {
                return res.json({ success: true, data: [] })
            }

            if (!currentUserId) {
                return res.status(400).json({
                    success: false,
                    error: 'currentUserId est requis'
                })
            }

            console.log(`🔍 Recherche utilisateurs: "${query}" (par ${currentUserId})`)

            // Récupérer tous les utilisateurs
            const allUsers = await UsersController._getAllUsersFromDb()

            console.log(`  📊 ${allUsers.length} utilisateurs récupérés au total`)
            allUsers.forEach(u => {
                console.log(`    - ${u.name} (${u.email}): isActive=${u.isActive}, allowRequests=${u.allowRequests}`)
            })

            // Récupérer toutes les amitiés pour déterminer le statut
            const allFriendships = await DataServiceV2.getAllActiveData(
                'Relations!A2:G',
                DataServiceV2.mappers.friendship
            )

            // Filtrer les utilisateurs actifs et correspondants (nom ou email)
            const matchingUsers = allUsers.filter(user => {
                // Exclure l'utilisateur courant
                if (user.id === currentUserId) {
                    console.log(`  ❌ ${user.name} exclu: utilisateur courant`)
                    return false
                }

                // Filtrer uniquement les utilisateurs actifs (isActive === true, colonne K)
                if (!user.isActive) {
                    console.log(`  ❌ ${user.name} exclu: inactif (isActive=${user.isActive})`)
                    return false
                }

                // Filtrer uniquement les utilisateurs qui acceptent les demandes d'amitié (allowRequests === true, colonne M)
                if (user.allowRequests === false || user.allowRequests === undefined) {
                    console.log(`  ❌ ${user.name} exclu: allowRequests=${user.allowRequests}`)
                    return false
                }

                // Filtrer par nom ou email
                const nameMatch = user.name && user.name.toLowerCase().includes(query)
                const emailMatch = user.email && user.email.toLowerCase().includes(query)
                if (!nameMatch && !emailMatch) {
                    console.log(`  ❌ ${user.name} exclu: ne correspond pas à la recherche "${query}"`)
                    return false
                }

                console.log(`  ✅ ${user.name} correspond (name=${nameMatch}, email=${emailMatch}, allowRequests=${user.allowRequests})`)
                return true
            })

            // Construire les résultats avec le statut d'amitié
            const results = matchingUsers.map(user => {
                // Trouver le statut d'amitié si elle existe
                let friendshipStatus = 'none'
                const friendship = allFriendships.find(f =>
                    (f.fromUserId === currentUserId && f.toUserId === user.id) ||
                    (f.fromUserId === user.id && f.toUserId === currentUserId)
                )

                if (friendship) {
                    friendshipStatus = friendship.status
                }

                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    city: user.city || '',
                    isActive: user.isActive,
                    allowRequests: user.allowRequests,
                    isPublicProfile: user.isPublicProfile,
                    isAmbassador: user.isAmbassador,
                    friendshipStatus
                }
            })

            console.log(`✅ ${results.length} utilisateurs trouvés`)
            res.json({ success: true, data: results })
        } catch (error) {
            console.error('❌ Erreur recherche utilisateurs:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Récupérer les amis d'un utilisateur
     */
    static async getUserFriends(req, res) {
        const requestId = Math.random().toString(36).substr(2, 9)
        const timestamp = new Date().toISOString()
        try {
            const userId = req.params.id
            const status = req.query.status || 'active'
            console.log(`👥 [${requestId}] [${timestamp}] Récupération amis pour: ${userId} (status: ${status})`)
            console.log(`👥 [${requestId}] Headers:`, req.headers['user-agent'] || 'unknown')
            console.log(`👥 [${requestId}] IP:`, req.ip || req.connection.remoteAddress)

            const allFriendships = await DataServiceV2.getAllActiveData(
                'Relations!A2:G',
                DataServiceV2.mappers.friendship
            )

            // Filtrer les amitiés où l'utilisateur est impliqué
            const userFriendships = allFriendships.filter(f =>
                f.fromUserId === userId || f.toUserId === userId
            )

            // Récupérer les détails des amis
            const allUsers = await UsersController._getAllUsersFromDb()

            const friends = []
            for (const friendship of userFriendships) {
                const friendId = friendship.fromUserId === userId ? friendship.toUserId : friendship.fromUserId
                // Filtrer uniquement les utilisateurs actifs
                const friend = allUsers.find(u => u.id === friendId && u.isActive === true)

                if (friend) {
                    // Construire l'objet friendship complet avec initiatedBy
                    // fromUserId est toujours celui qui a initié la demande
                    const initiatedBy = friendship.fromUserId

                    friends.push({
                        ...friend,
                        friendship: {
                            id: friendship.id,
                            userId1: friendship.fromUserId,
                            userId2: friendship.toUserId,
                            status: friendship.status,
                            createdAt: friendship.createdAt,
                            updatedAt: friendship.modifiedAt,
                            initiatedBy: initiatedBy
                        }
                    })
                }
            }

            console.log(`✅ [${requestId}] ${friends.length} amis récupérés pour ${userId}`)
            res.json({ success: true, data: friends })
        } catch (error) {
            console.error(`❌ [${requestId}] Erreur récupération amis:`, error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Récupérer les suggestions d'amis pour un utilisateur
     * Calcule les suggestions basées sur :
     * - Amis de mes amis (score +10 par ami commun)
     * - Intérêts communs sur événements (score +5 par événement commun)
     */
    static async getFriendSuggestions(req, res) {
        const requestId = Math.random().toString(36).substr(2, 9)
        const timestamp = new Date().toISOString()
        try {
            const userId = req.params.id
            console.log(`💡 [${requestId}] [${timestamp}] Calcul suggestions d'amis pour: ${userId}`)

            // 1. Récupérer toutes les données nécessaires
            const allFriendships = await DataServiceV2.getAllActiveData(
                'Relations!A2:G',
                DataServiceV2.mappers.friendship
            )
            const allUsers = await UsersController._getAllUsersFromDb()
            const allResponses = await DataServiceV2.getAllActiveData(
                'Responses!A2:G',
                DataServiceV2.mappers.response
            )

            // 2. Récupérer les amis actifs de l'utilisateur
            const userFriendships = allFriendships.filter(f =>
                (f.fromUserId === userId || f.toUserId === userId) && f.status === 'active'
            )

            const currentUserFriends = []
            const currentUserFriendIds = new Set()

            for (const friendship of userFriendships) {
                const friendId = friendship.fromUserId === userId ? friendship.toUserId : friendship.fromUserId
                const friend = allUsers.find(u => u.id === friendId && u.isActive === true)
                if (friend) {
                    currentUserFriends.push(friend)
                    currentUserFriendIds.add(friendId)
                }
            }

            console.log(`👥 [${requestId}] ${currentUserFriends.length} amis actifs trouvés`)

            // 3. Pour chaque ami, récupérer ses amis actifs (et les stocker dans friend.friends)
            const friendsOfFriendsMap = new Map() // userId -> { friend: Friend, score: number, commonEvents: number }
            // Map pour stocker eventId -> responseType (pour calculer les scores différenciés)
            const userEventResponses = new Map() // eventId -> finalResponse

            // Récupérer les événements d'intérêt de l'utilisateur
            // Inclure 'going', 'interested', 'participe' et 'maybe'
            const userResponses = allResponses
                .filter(r => r.userId === userId && (
                    r.finalResponse === 'going' ||
                    r.finalResponse === 'interested' ||
                    r.finalResponse === 'participe' ||
                    r.finalResponse === 'maybe'
                ))
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

            // Garder uniquement la dernière réponse par événement
            const latestUserResponses = new Map()
            userResponses.forEach(r => {
                if (!latestUserResponses.has(r.eventId)) {
                    latestUserResponses.set(r.eventId, r)
                    userEventResponses.set(r.eventId, r.finalResponse)
                }
            })

            console.log(`📅 [${requestId}] ${userEventResponses.size} événements d'intérêt pour l'utilisateur`)

            // Pour chaque ami, récupérer ses amis et calculer les scores
            for (const friend of currentUserFriends) {
                const friendFriendships = allFriendships.filter(f =>
                    (f.fromUserId === friend.id || f.toUserId === friend.id) && f.status === 'active'
                )

                const friendFriends = []
                for (const friendship of friendFriendships) {
                    const friendOfFriendId = friendship.fromUserId === friend.id ? friendship.toUserId : friendship.fromUserId
                    // Exclure l'utilisateur courant et les amis déjà existants
                    if (friendOfFriendId !== userId && !currentUserFriendIds.has(friendOfFriendId)) {
                        const friendOfFriend = allUsers.find(u => u.id === friendOfFriendId && u.isActive === true)
                        if (friendOfFriend) {
                            friendFriends.push({
                                ...friendOfFriend,
                                friendship: {
                                    id: friendship.id,
                                    userId1: friendship.fromUserId,
                                    userId2: friendship.toUserId,
                                    status: friendship.status,
                                    createdAt: friendship.createdAt,
                                    updatedAt: friendship.modifiedAt,
                                    initiatedBy: friendship.fromUserId
                                }
                            })
                        }
                    }
                }

                // Stocker les amis de cet ami dans la prop friends
                friend.friends = friendFriends

                // Pour chaque ami de mon ami, calculer le score
                for (const friendOfFriend of friendFriends) {
                    if (!friendsOfFriendsMap.has(friendOfFriend.id)) {
                        // Vérifier les relations existantes (exclure pending, blocked, active)
                        const existingRelation = allFriendships.find(f =>
                            (f.fromUserId === userId && f.toUserId === friendOfFriend.id) ||
                            (f.fromUserId === friendOfFriend.id && f.toUserId === userId)
                        )

                        // Ne suggérer que si pas de relation ou relation inactive/cancelled
                        if (!existingRelation || existingRelation.status === 'inactive' || existingRelation.status === 'cancelled') {
                            friendsOfFriendsMap.set(friendOfFriend.id, {
                                user: friendOfFriend,
                                score: 10, // Score de base pour "ami de mon ami"
                                commonEvents: 0,
                                mutualFriends: [friend.id] // Liste des amis communs
                            })
                        }
                    } else {
                        // Augmenter le score et ajouter l'ami commun
                        const existing = friendsOfFriendsMap.get(friendOfFriend.id)
                        existing.score += 10
                        existing.mutualFriends.push(friend.id)
                    }
                }
            }

            // 4. Calculer les intérêts communs sur événements avec scores différenciés
            for (const [suggestedUserId, suggestion] of friendsOfFriendsMap.entries()) {
                // Récupérer les événements d'intérêt de ce utilisateur suggéré
                // Inclure 'going', 'interested', 'participe' et 'maybe'
                const suggestedUserResponses = allResponses
                    .filter(r => r.userId === suggestedUserId && (
                        r.finalResponse === 'going' ||
                        r.finalResponse === 'interested' ||
                        r.finalResponse === 'participe' ||
                        r.finalResponse === 'maybe'
                    ))
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

                // Map pour stocker eventId -> finalResponse
                const suggestedUserEventResponses = new Map()
                const latestSuggestedResponses = new Map()
                suggestedUserResponses.forEach(r => {
                    if (!latestSuggestedResponses.has(r.eventId)) {
                        latestSuggestedResponses.set(r.eventId, r)
                        suggestedUserEventResponses.set(r.eventId, r.finalResponse)
                    }
                })

                // Compter les événements communs avec scores différenciés
                let commonEventsCount = 0
                let totalScore = 0

                userEventResponses.forEach((userResponse, eventId) => {
                    if (suggestedUserEventResponses.has(eventId)) {
                        commonEventsCount++
                        const suggestedResponse = suggestedUserEventResponses.get(eventId)

                        // Score différencié selon le type de réponse
                        // 'participe' et 'maybe' (événements privés) = +10 points
                        // 'going' et 'interested' (événements publics) = +5 points
                        if (userResponse === 'participe' || userResponse === 'maybe' ||
                            suggestedResponse === 'participe' || suggestedResponse === 'maybe') {
                            // Si au moins un des deux a répondu 'participe' ou 'maybe', c'est un événement privé = score élevé
                            totalScore += 10
                        } else {
                            // Les deux ont répondu 'going' ou 'interested' = événement public = score normal
                            totalScore += 5
                        }
                    }
                })

                if (commonEventsCount > 0) {
                    suggestion.score += totalScore
                    suggestion.commonEvents = commonEventsCount
                }
            }

            // 5. Trier par score décroissant et limiter à 5
            const suggestions = Array.from(friendsOfFriendsMap.values())
                .sort((a, b) => b.score - a.score)
                .slice(0, 5)
                .map(s => {
                    // Vérifier le statut d'amitié pour chaque suggestion
                    const existingRelation = allFriendships.find(f =>
                        (f.fromUserId === userId && f.toUserId === s.user.id) ||
                        (f.fromUserId === s.user.id && f.toUserId === userId)
                    )
                    const friendshipStatus = existingRelation ? existingRelation.status : 'none'

                    return {
                        ...s.user,
                        friendshipStatus, // Ajouter le statut pour le frontend
                        _suggestionScore: s.score,
                        _commonEvents: s.commonEvents,
                        _mutualFriends: s.mutualFriends.length
                    }
                })

            console.log(`✅ [${requestId}] ${suggestions.length} suggestions générées`)

            // 6. Retourner les suggestions avec les amis de chaque ami (pour l'affichage)
            const result = {
                suggestions,
                friendsWithFriends: currentUserFriends.map(f => ({
                    ...f,
                    friends: f.friends || []
                }))
            }

            res.json({ success: true, data: result })
        } catch (error) {
            console.error(`❌ [${requestId}] Erreur calcul suggestions:`, error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Créer ou mettre à jour une amitié (UPSERT)
     * Vérifie si une amitié existe dans les deux sens (A->B ou B->A) avant de créer/mettre à jour
     */
    static async upsertFriendship(req, res) {
        try {
            const { fromUserId, toUserId, status } = req.body

            if (!fromUserId || !toUserId || !status) {
                return res.status(400).json({
                    success: false,
                    error: 'fromUserId, toUserId et status sont requis'
                })
            }

            // Vérifier si une amitié existe déjà dans les deux sens
            const friendshipId1 = `friendship_${fromUserId}_${toUserId}`
            const friendshipId2 = `friendship_${toUserId}_${fromUserId}`

            // Récupérer toutes les amitiés pour vérifier
            const allFriendships = await DataServiceV2.getAllActiveData(
                'Relations!A2:G',
                DataServiceV2.mappers.friendship
            )

            // Chercher une amitié existante (dans les deux sens)
            let existingFriendship = allFriendships.find(f =>
                f.id === friendshipId1 || f.id === friendshipId2
            )

            // Déterminer l'ID à utiliser (celui qui existe ou créer un nouveau)
            const friendshipId = existingFriendship ? existingFriendship.id : friendshipId1

            // Déterminer les bonnes valeurs pour fromUserId/toUserId
            // Si on utilise une amitié existante, garder la direction originale
            const actualFromUserId = existingFriendship ? existingFriendship.fromUserId : fromUserId
            const actualToUserId = existingFriendship ? existingFriendship.toUserId : toUserId

            console.log(`🔄 Upsert amitié: ${friendshipId} (${existingFriendship ? 'UPDATE' : 'CREATE'})`)

            // Préparer les données pour la feuille
            const rowData = [
                friendshipId,                             // A: ID
                existingFriendship ? existingFriendship.createdAt : new Date().toISOString(), // B: CreatedAt (conserver si existe)
                actualFromUserId,                         // C: From User ID
                actualToUserId,                           // D: To User ID
                status,                                   // E: Status
                new Date().toISOString(),                 // F: ModifiedAt
                ''                                        // G: DeletedAt
            ]

            const result = await DataServiceV2.upsertData(
                'Relations!A2:G',
                rowData,
                0, // key column (ID)
                friendshipId
            )

            console.log(`✅ Amitié ${result.action}: ${friendshipId}`)
            res.json({
                success: true,
                data: {
                    id: friendshipId,
                    fromUserId: actualFromUserId,
                    toUserId: actualToUserId,
                    status,
                    createdAt: rowData[1],
                    modifiedAt: rowData[5]
                },
                action: result.action
            })
        } catch (error) {
            console.error('❌ Erreur upsert amitié:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Supprimer une amitié (soft delete)
     */
    static async deleteFriendship(req, res) {
        try {
            const friendshipId = req.params.id
            console.log(`🗑️ Suppression amitié: ${friendshipId}`)

            const result = await DataServiceV2.softDelete(
                'Relations!A2:G',
                0, // key column (ID)
                friendshipId
            )

            console.log(`✅ Amitié supprimée: ${friendshipId}`)
            res.json({
                success: true,
                message: 'Amitié supprimée avec succès',
                deletedAt: result.deletedAt
            })
        } catch (error) {
            console.error('❌ Erreur suppression amitié:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

    /**
     * Rechercher un utilisateur par email et retourner uniquement son ID
     * Retourne: user-xxx (visiteur ou user authentifié) ou null
     * GET /api/users/match-email/:email
     */
    static async matchByEmail(req, res) {
        try {
            const rawEmail = decodeURIComponent(req.params.email || '')
            const normalizedEmail = UsersController.normalizeEmail(rawEmail)
            console.log(`🔍 [matchByEmail] Recherche par email: "${normalizedEmail}"`)

            const activeUsers = await UsersController.getActiveUsers()

            // Chercher un utilisateur (visiteur ou user authentifié) par email
            const user = activeUsers.find(u => {
                const userEmail = UsersController.normalizeEmail(u.email)
                return userEmail === normalizedEmail && u.id
            })

            if (user) {
                const userType = user.isVisitor === true ? 'visiteur' : 'user authentifié'
                console.log(`✅ [matchByEmail] ${userType} trouvé: ${user.id}`)
                return res.json({ success: true, data: user.id })
            }

            console.log(`❌ [matchByEmail] Aucun utilisateur trouvé pour: "${normalizedEmail}"`)
            return res.json({ success: true, data: null })
        } catch (error) {
            console.error('❌ Erreur matchByEmail:', error)
            res.status(500).json({ success: false, error: error.message })
        }
    }

}

module.exports = UsersController
