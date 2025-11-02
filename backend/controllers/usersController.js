/**
 * Contrôleur pour les utilisateurs et le système d'amitié - NOUVELLE STRATÉGIE OVERWRITE
 * Gère la logique métier avec overwrite + colonnes système
 */

const DataServiceV2 = require('../utils/dataService')

class UsersController {
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

            const allUsers = await DataServiceV2.getAllActiveData(
                'Users!A2:P',
                DataServiceV2.mappers.user
            )

            // Filtrer uniquement les utilisateurs actifs (isActive === true, colonne K)
            const users = allUsers.filter(user => user.isActive === true)

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
                'Users!A2:P',
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
     */
    static async upsertUser(req, res) {
        try {
            const userData = req.body
            const userId = userData.id || `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

            console.log(`🔄 Upsert utilisateur: ${userId}`)

            // Récupérer l'utilisateur existant pour préserver lastConnexion si non fourni
            const existingUser = await DataServiceV2.getByKey(
                'Users!A2:P',
                DataServiceV2.mappers.user,
                0,
                userId
            )

            // Préparer les données pour la feuille
            const rowData = [
                userId,                                    // A: ID
                userData.createdAt || new Date().toISOString(), // B: CreatedAt
                userData.name || '',                      // C: Name
                userData.email || '',                     // D: Email
                userData.city || '',                      // E: City
                userData.lat || '',                       // F: Latitude (NOUVEAU)
                userData.lng || '',                       // G: Longitude (NOUVEAU)
                userData.friendsCount || 0,               // H: Friends Count
                userData.privacy?.showAttendanceToFriends !== undefined
                    ? userData.privacy.showAttendanceToFriends
                    : (existingUser?.showAttendanceToFriends !== undefined ? existingUser.showAttendanceToFriends : true), // I: Privacy (préserver valeur existante)
                userData.isPublicProfile !== undefined
                    ? userData.isPublicProfile
                    : (existingUser?.isPublicProfile !== undefined ? existingUser.isPublicProfile : false), // J: Is Public Profile (préserver valeur existante)
                userData.isActive !== undefined
                    ? userData.isActive
                    : (existingUser?.isActive !== undefined ? existingUser.isActive : false), // K: Status (préserver valeur existante)
                userData.isAmbassador !== undefined
                    ? userData.isAmbassador
                    : (existingUser?.isAmbassador !== undefined ? existingUser.isAmbassador : false), // L: Is Ambassador (préserver valeur existante)
                userData.allowRequests !== undefined
                    ? userData.allowRequests
                    : (existingUser?.allowRequests !== undefined ? existingUser.allowRequests : true), // M: AllowRequests (préserver valeur existante, défaut: true)
                new Date().toISOString(),                 // N: ModifiedAt
                '',                                       // O: DeletedAt
                userData.lastConnexion || (existingUser?.lastConnexion || null) // P: LastConnexion
            ]

            const result = await DataServiceV2.upsertData(
                'Users!A2:P',
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
     * Supprimer un utilisateur (soft delete)
     */
    static async deleteUser(req, res) {
        try {
            const userId = req.params.id
            console.log(`🗑️ Suppression utilisateur: ${userId}`)

            const result = await DataServiceV2.softDelete(
                'Users!A2:P',
                0, // key column (ID)
                userId
            )

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
     * Rechercher un utilisateur par email
     */
    static async getUserByEmail(req, res) {
        try {
            // Décoder l'email depuis l'URL (Express décode automatiquement, mais on s'assure)
            const rawEmail = decodeURIComponent(req.params.email || '')
            // Normaliser l'email (trim + toLowerCase) pour une comparaison insensible à la casse
            const email = rawEmail.trim().toLowerCase()
            console.log(`👥 Recherche utilisateur par email: "${email}" (raw: "${rawEmail}")`)

            const allUsers = await DataServiceV2.getAllActiveData(
                'Users!A2:P',
                DataServiceV2.mappers.user
            )

            console.log(`📊 Total utilisateurs dans la base: ${allUsers.length}`)

            // Filtrer uniquement les utilisateurs actifs (isActive === true, colonne K)
            // Normaliser aussi les emails de la base de données pour la comparaison
            const user = allUsers.find(u => {
                const userEmail = (u.email || '').trim().toLowerCase()
                const emailMatch = userEmail === email
                const isActive = u.isActive === true

                // Log de débogage pour les premiers emails trouvés
                if (userEmail && (userEmail.includes(email.split('@')[0]) || email.includes(userEmail.split('@')[0]))) {
                    console.log(`  🔍 Comparaison: "${userEmail}" === "${email}" ? ${emailMatch} | isActive: ${isActive}`)
                }

                return emailMatch && isActive
            })

            if (!user) {
                // Log tous les emails actifs pour débogage
                const activeUsers = allUsers.filter(u => u.isActive === true)
                console.log(`❌ Utilisateur non trouvé. Emails actifs dans la base:`, activeUsers.map(u => `"${u.email}"`).join(', '))
                return res.status(404).json({
                    success: false,
                    error: 'Utilisateur non trouvé'
                })
            }

            console.log(`✅ Utilisateur trouvé: ${user.name} (${user.email})`)
            res.json({ success: true, data: user })
        } catch (error) {
            console.error('❌ Erreur recherche utilisateur:', error)
            res.status(500).json({ success: false, error: error.message })
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
            const allUsers = await DataServiceV2.getAllActiveData(
                'Users!A2:P',
                DataServiceV2.mappers.user
            )

            console.log(`  📊 ${allUsers.length} utilisateurs récupérés au total`)
            allUsers.forEach(u => {
                console.log(`    - ${u.name} (${u.email}): isActive=${u.isActive}, allowRequests=${u.allowRequests}`)
            })

            // Récupérer toutes les amitiés pour déterminer le statut
            const allFriendships = await DataServiceV2.getAllActiveData(
                'Friendships!A2:G',
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
                'Friendships!A2:G',
                DataServiceV2.mappers.friendship
            )

            // Filtrer les amitiés où l'utilisateur est impliqué
            const userFriendships = allFriendships.filter(f =>
                f.fromUserId === userId || f.toUserId === userId
            )

            // Récupérer les détails des amis
            const allUsers = await DataServiceV2.getAllActiveData(
                'Users!A2:P',
                DataServiceV2.mappers.user
            )

            const friends = []
            for (const friendship of userFriendships) {
                const friendId = friendship.fromUserId === userId ? friendship.toUserId : friendship.fromUserId
                // Filtrer uniquement les utilisateurs actifs (isActive === true, colonne K)
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
                'Friendships!A2:G',
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
                'Friendships!A2:G',
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
                'Friendships!A2:G',
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
}

module.exports = UsersController
