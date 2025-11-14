/**
 * FOMO MVP - Contexte d'authentification (REFACTORISÉ)
 * 
 * Source unique de vérité pour l'identité utilisateur (visitor ou user authentifié)
 * Un User existe TOUJOURS (visitor créé par défaut si localStorage vide)
 */

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { User } from '@/types/fomoTypes'
import { FomoDataManager } from '@/utils/dataManager'

interface AuthContextType {
    user: User  // Jamais null ! Toujours un visitor par défaut ou un user authentifié
    isLoading: boolean
    isLoggingIn: boolean  // Flag pour indiquer qu'une connexion est en cours (évite les race conditions)
    login: (name: string, city: string, email: string, existingUserData?: User, lat?: number | null, lng?: number | null) => Promise<void>
    logout: () => void
    updateUser: (updates: Partial<User>) => Promise<void>
    saveVisitorInfo: (name: string, email?: string) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}

interface AuthProviderProps {
    children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = React.memo(({ children }) => {

    // ===== HELPERS INTERNES (fonctions pures, pas de hooks) =====

    /**
     * Créer un nouveau visitor
     */
    const createNewVisitor = (): User => {
        return {
            id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            name: '',
            email: '',
            city: '',
            friendsCount: 0,
            showAttendanceToFriends: false,
            isPublicProfile: false,
            isAmbassador: false,
            isVisitor: true,
            isNewVisitor: true,
            createdAt: new Date().toISOString()
        }
    }

    /**
     * Remplacer l'ID utilisateur dans localStorage par un nouvel ID
     * Utilisé quand matchByEmail trouve un ID différent
     */
    const replaceUserIdInLocalStorage = (newId: string): void => {
        try {
            const currentUserStr = localStorage.getItem('fomo-user')
            if (currentUserStr) {
                const currentUser = JSON.parse(currentUserStr)
                if (currentUser.id !== newId) {
                    console.log(`🔄 [AuthContext] Remplacement ID utilisateur: ${currentUser.id} → ${newId}`)
                    const updatedUser = { ...currentUser, id: newId }
                    localStorage.setItem('fomo-user', JSON.stringify(updatedUser))
                    console.log('✅ [AuthContext] ID utilisateur remplacé dans localStorage')
                }
            }
        } catch (error) {
            console.warn('⚠️ [AuthContext] Erreur lors du remplacement de l\'ID dans localStorage:', error)
        }
    }

    /**
     * Garantir qu'un User a isVisitor: false et isNewVisitor: false
     */
    const ensureAuthenticatedUser = (user: User): User => {
        return {
            ...user,
            isVisitor: false,
            isNewVisitor: false
        }
    }

    // ===== ÉTATS =====

    // Charger ou créer un utilisateur de manière SYNCHRONE
    const [user, setUser] = useState<User>(() => {
        try {
            const savedUser = localStorage.getItem('fomo-user')
            if (savedUser) {
                const userData: User = JSON.parse(savedUser)

                // Déterminer isNewVisitor au chargement : visitor sans nom = newVisitor
                if (userData.isVisitor) {
                    const hasName = userData.name && userData.name.trim().length > 0
                    userData.isNewVisitor = !hasName
                }

                console.log(`👤 [AuthContext] User chargé: ${userData.name || 'Visitor'} (${userData.id}) - isVisitor: ${userData.isVisitor}, isNewVisitor: ${userData.isNewVisitor}`)
                return userData
            }
        } catch (error) {
            console.error('❌ [AuthContext] Erreur chargement user:', error)
        }

        // Pas de user sauvegardé → créer un nouveau visitor par défaut
        const newVisitor = createNewVisitor()
        localStorage.setItem('fomo-user', JSON.stringify(newVisitor))
        console.log(`✅ [AuthContext] Nouveau visitor créé: ${newVisitor.id}`)
        return newVisitor
    })

    const [isLoading, setIsLoading] = useState(false)
    const [isLoggingIn, setIsLoggingIn] = useState(false)

    // Instance stable de FomoDataManager (créée une seule fois)
    const fomoData = useMemo(() => new FomoDataManager(), [])

    // ===== HELPERS AVEC HOOKS =====

    /**
     * Sauvegarder un user dans localStorage et mettre à jour le state
     */
    const saveUser = useCallback((userToSave: User): void => {
        localStorage.setItem('fomo-user', JSON.stringify(userToSave))
        setUser(userToSave)
    }, [])

    const login = useCallback(async (name: string, city: string, email: string, existingUserData?: User, lat?: number | null, lng?: number | null) => {
        try {
            setIsLoading(true)
            setIsLoggingIn(true)  // Marquer qu'une connexion est en cours
            console.log('🔍 [AuthContext] login appelé avec:', { name, email, existingUserData: existingUserData ? 'fourni' : 'non fourni', lat, lng })

            // Si l'utilisateur existe déjà (passé en paramètre depuis UserConnexionModal), l'utiliser directement
            let userToConnect: User | null = null

            if (existingUserData) {
                // Vérifier que l'utilisateur fourni est bien un user (pas un visitor)
                if (existingUserData.isVisitor === true) {
                    console.warn('⚠️ [AuthContext] Visitor détecté dans existingUserData, refus de connexion')
                    throw new Error('Cannot connect a visitor. Visitors must register first.')
                }

                console.log('✅ [AuthContext] Utilisation de l\'utilisateur existant fourni:', existingUserData.name)

                // Mettre à jour lastConnexion via updateUser
                try {
                    const updatedUser = await fomoData.updateUser(existingUserData.id, {
                        name: existingUserData.name,
                        city: existingUserData.city,
                        lat: existingUserData.lat ?? null,
                        lng: existingUserData.lng ?? null,
                        isVisitor: false,
                        isNewVisitor: false
                    })
                    userToConnect = ensureAuthenticatedUser(updatedUser || existingUserData)
                    console.log('✅ [AuthContext] User connecté et lastConnexion mis à jour')
                } catch (error) {
                    console.error('❌ [AuthContext] Erreur mise à jour lastConnexion:', error)
                    userToConnect = ensureAuthenticatedUser(existingUserData)
                }
            }

            if (!userToConnect) {
                // ÉTAPE 1 : Vérifier email dans DB → si présent, currentId = id de la DB
                const emailTrimmed = email.trim()
                const hasEmail = emailTrimmed.length > 0
                let currentUserId: string | null = null

                // Récupérer l'ID du visitor actuel
                const currentVisitorId = user.isVisitor ? user.id : null

                if (hasEmail) {
                    console.log('🔍 [AuthContext] Étape 1: Vérification email dans DB...')

                    const matchedId = await fomoData.matchByEmail(emailTrimmed)

                    if (matchedId) {
                        console.log(`✅ [AuthContext] Email trouvé: ${matchedId}`)
                        currentUserId = matchedId

                        // Remplacer l'ID utilisateur actuel dans localStorage par l'ID trouvé via matchByEmail
                        replaceUserIdInLocalStorage(matchedId)

                        // Si on a un visitor ID ET un user ID existant (email match)
                        // → Migrer les responses du visitor vers le user
                        if (currentVisitorId && currentVisitorId !== matchedId) {
                            console.log(`🔄 [AuthContext] Migration responses: ${currentVisitorId} → ${matchedId}`)
                            try {
                                const migrationResult = await fomoData.migrateResponses(currentVisitorId, matchedId)
                                console.log(`✅ [AuthContext] ${migrationResult.responsesMigrated} réponse(s) migrée(s) avec succès`)
                            } catch (migrationError) {
                                console.error('❌ [AuthContext] Erreur migration responses:', migrationError)
                            }
                        }
                    }
                }

                // Si pas d'ID trouvé par email, utiliser visitor ID s'il existe
                if (!currentUserId && currentVisitorId) {
                    currentUserId = currentVisitorId
                    console.log(`✅ [AuthContext] Utilisation visitor ID pour conversion: ${currentUserId}`)
                }

                // Si toujours pas d'ID, générer un nouvel ID
                if (!currentUserId) {
                    currentUserId = `usr-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
                    console.log(`🔨 [AuthContext] Nouvel ID généré: ${currentUserId}`)
                }

                // ÉTAPE 2 : Vérifier si currentId existe dans DB
                console.log(`🔍 [AuthContext] Étape 2: Vérification si ID existe dans DB: ${currentUserId}`)
                const existingUser = await fomoData.getUserById(currentUserId)

                // ÉTAPE 3 : Si existe → UPDATE, sinon → CREATE
                if (existingUser) {
                    console.log('✅ [AuthContext] Étape 3: ID existe dans DB → UPDATE')

                    if (existingUser.isVisitor) {
                        console.log('🔄 [AuthContext] Visitor détecté, transformation en user authentifié...')
                    }

                    // Mettre à jour l'utilisateur avec les nouvelles données
                    const updatedUser = await fomoData.updateUser(currentUserId, {
                        isVisitor: false,
                        isNewVisitor: false,
                        name: name.trim(),
                        email: emailTrimmed,
                        city: city.trim(),
                        lat: lat ?? null,
                        lng: lng ?? null
                    })

                    userToConnect = updatedUser || existingUser
                    console.log(`✅ [AuthContext] Utilisateur mis à jour: ${userToConnect.id}`)
                } else {
                    console.log('🔨 [AuthContext] Étape 3: ID n\'existe pas dans DB → CREATE')

                    // Créer un nouvel utilisateur
                    const newUser = await fomoData.createUser({
                        id: currentUserId,
                        name: name.trim(),
                        email: emailTrimmed,
                        city: city.trim(),
                        lat: lat ?? null,
                        lng: lng ?? null,
                        friendsCount: 0,
                        showAttendanceToFriends: true,
                        isPublicProfile: false,
                        isAmbassador: false,
                        allowRequests: true,
                        isVisitor: false,
                        isNewVisitor: false
                    })

                    if (newUser) {
                        console.log(`✅ [AuthContext] Nouvel utilisateur créé: ${newUser.id}`)
                        userToConnect = newUser
                    } else {
                        console.error('❌ [AuthContext] Échec de la création de l\'utilisateur')
                        throw new Error('Impossible de créer votre compte. Service non disponible.')
                    }
                }
            }

            // S'assurer que userToConnect a bien isVisitor: false avant sauvegarde
            const finalUser = ensureAuthenticatedUser(userToConnect)

            // Sauvegarder dans le localStorage et mettre à jour l'état
            saveUser(finalUser)

            console.log('✅ [AuthContext] Utilisateur connecté et sauvegardé')

            // Attendre un tick pour s'assurer que le state React est mis à jour avant de continuer
            await new Promise(resolve => setTimeout(resolve, 0))
        } catch (error) {
            console.error('❌ [AuthContext] Erreur lors de la connexion:', error)
            throw error
        } finally {
            setIsLoading(false)
            setIsLoggingIn(false)  // Marquer que la connexion est terminée
            console.log('🏁 [AuthContext] login terminé')
        }
    }, [user, fomoData])

    const logout = useCallback(() => {
        // Créer un nouveau visitor
        const newVisitor = createNewVisitor()
        saveUser(newVisitor)

        // Nettoyer les flags UX
        try {
            sessionStorage.removeItem('fomo-just-signed-up')
            sessionStorage.removeItem('fomo-pop-filterbar')
        } catch (error) {
            // Ignorer si storage indisponible
        }

        console.log('✅ [AuthContext] Logout complet, nouveau visitor créé')
    }, [])

    const updateUser = useCallback(async (updates: Partial<User>) => {
        // Mettre à jour le backend
        try {
            const updatedUser = await fomoData.updateUser(user.id, updates)

            if (updatedUser) {
                localStorage.setItem('fomo-user', JSON.stringify(updatedUser))
                setUser(updatedUser)
            } else {
                // Si updateUser retourne null, mettre à jour localement quand même (optimiste)
                const updatedUserLocal: User = { ...user, ...updates }
                localStorage.setItem('fomo-user', JSON.stringify(updatedUserLocal))
                setUser(updatedUserLocal)

                console.warn('⚠️ [AuthContext] updateUser retourné null, mise à jour locale uniquement')
            }
        } catch (error) {
            console.error('Erreur lors de la mise à jour de l\'utilisateur:', error)
            // Rollback en cas d'erreur
            const savedUser = localStorage.getItem('fomo-user')
            if (savedUser) {
                setUser(JSON.parse(savedUser))
            }
            throw error
        }
    }, [user, fomoData])

    /**
     * Sauvegarder le nom du visitor dans l'objet User
     * Met à jour isNewVisitor à false
     * 
     * NOUVEAU : Crée/met à jour le visitor dans le backend pour :
     * - Traçabilité : savoir qui a complété le formulaire
     * - Analytics : compter les conversions visitor → user
     * - Cohérence : données persistées même si localStorage est supprimé
     * - Migration future : retrouver le visitor s'il se connecte plus tard
     */
    const saveVisitorInfo = useCallback(async (name: string, email?: string) => {
        try {
            const emailTrimmed = email?.trim()
            const currentVisitorId = user.id
            let targetUserId = currentVisitorId // Par défaut, utiliser l'ID du visitor actuel
            let shouldMigrate = false

            // Si email fourni, chercher un user existant avec cet email
            let matchedUser: User | null = null
            if (emailTrimmed) {
                try {
                    const matchedUserId = await fomoData.matchByEmail(emailTrimmed)
                    if (matchedUserId && matchedUserId !== currentVisitorId) {
                        // User trouvé avec cet email → récupérer ses données complètes
                        console.log(`🔗 [AuthContext] Email matché avec user existant: ${matchedUserId}`)

                        // Remplacer l'ID utilisateur actuel dans localStorage par l'ID trouvé via matchByEmail
                        replaceUserIdInLocalStorage(matchedUserId)

                        matchedUser = await fomoData.getUserById(matchedUserId)
                        if (matchedUser) {
                            targetUserId = matchedUserId
                            shouldMigrate = true
                            console.log(`✅ [AuthContext] User trouvé: ${matchedUser.name} (isVisitor: ${matchedUser.isVisitor})`)
                        }
                    }
                } catch (matchError) {
                    // Erreur non bloquante : continuer avec l'ID du visitor actuel
                    console.warn('⚠️ [AuthContext] Erreur matching email (non bloquant):', matchError)
                }
            }

            // Migrer les réponses si nécessaire (visitor temporaire → user existant)
            // Utiliser la méthode générique migrateResponses (pas besoin de supprimer le visitor ici)
            if (shouldMigrate) {
                try {
                    const migrationResult = await fomoData.migrateResponses(currentVisitorId, targetUserId)
                    console.log(`✅ [AuthContext] ${migrationResult.responsesMigrated} réponse(s) migrée(s) vers ${targetUserId}`)
                } catch (migrationError) {
                    // Erreur non bloquante : continuer quand même
                    console.error('⚠️ [AuthContext] Erreur migration réponses (non bloquant):', migrationError)
                }
            }

            // Mise à jour optimiste : sauvegarder dans localStorage immédiatement
            // Si user matché, utiliser ses données existantes (notamment isVisitor)
            const updatedUser: User = matchedUser ? {
                ...matchedUser, // Utiliser les données du user existant
                name: name.trim(), // Mettre à jour le nom (peut avoir changé)
                email: emailTrimmed || matchedUser.email, // Mettre à jour l'email
                isNewVisitor: false
            } : {
                ...user,
                id: targetUserId, // Utiliser l'ID matché ou l'ID actuel
                name: name.trim(),
                email: emailTrimmed || user.email,
                isNewVisitor: false
            }
            localStorage.setItem('fomo-user', JSON.stringify(updatedUser))
            setUser(updatedUser)
            console.log(`✅ [AuthContext] Visitor info sauvegardé localement: ${name} (userId: ${targetUserId})`)

            // Sauvegarder dans le backend (non bloquant)
            // Logique upsert : essayer updateUser d'abord, puis createUser si l'utilisateur n'existe pas
            try {
                let backendUser: User | null = null

                // Essayer de mettre à jour (si l'utilisateur existe déjà)
                try {
                    // Si user matché, respecter son statut isVisitor existant
                    // Sinon, rester visitor (pas de conversion automatique)
                    const shouldStayVisitor = matchedUser ? matchedUser.isVisitor : true
                    backendUser = await fomoData.updateUser(targetUserId, {
                        name: name.trim(),
                        email: emailTrimmed || user.email || '',
                        isVisitor: shouldStayVisitor, // Respecter le statut du user existant ou rester visitor
                        isNewVisitor: false
                    })
                } catch (updateError: any) {
                    // Si 404 (utilisateur n'existe pas), créer avec createUser
                    if (updateError?.message?.includes('404') || updateError?.message?.includes('non trouvé')) {
                        console.log(`📝 [AuthContext] User n'existe pas dans le backend, création...`)
                        backendUser = await fomoData.createUser({
                            id: targetUserId,
                            name: name.trim(),
                            email: emailTrimmed || user.email || '',
                            city: user.city || '',
                            lat: user.lat ?? null,
                            lng: user.lng ?? null,
                            friendsCount: 0,
                            showAttendanceToFriends: false,
                            isPublicProfile: false,
                            isAmbassador: false,
                            allowRequests: true,
                            isVisitor: true, // Rester visitor
                            isNewVisitor: false
                        })
                    } else {
                        // Autre erreur, la propager
                        throw updateError
                    }
                }

                if (backendUser) {
                    // Mettre à jour avec les données du backend (peut contenir des infos supplémentaires)
                    // Respecter le statut isVisitor du backend (peut être false si user authentifié)
                    const finalUser: User = {
                        ...updatedUser,
                        ...backendUser,
                        id: targetUserId, // S'assurer qu'on utilise le bon ID
                        // isVisitor est déjà correct dans backendUser (respecte le statut existant)
                        isNewVisitor: false
                    }
                    localStorage.setItem('fomo-user', JSON.stringify(finalUser))
                    setUser(finalUser)
                    console.log(`✅ [AuthContext] User créé/mis à jour dans le backend: ${targetUserId}`)
                }
            } catch (backendError) {
                // Erreur backend non bloquante : on garde la sauvegarde locale
                console.error('⚠️ [AuthContext] Erreur sauvegarde backend (non bloquant):', backendError)
                // L'utilisateur peut continuer, les données sont dans localStorage
            }
        } catch (error) {
            console.error('❌ [AuthContext] Erreur sauvegarde visitor info:', error)
        }
    }, [user, fomoData])

    const value: AuthContextType = {
        user,
        isLoading,
        isLoggingIn,
        login,
        logout,
        updateUser,
        saveVisitorInfo
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
})
