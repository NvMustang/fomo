/**
 * FOMO MVP - Contexte d'authentification
 * 
 * Gestion simple de l'authentification pour la version beta
 */

import React, { createContext, useContext, useState, useCallback } from 'react'
import { User } from '@/types/fomoTypes'
import { FomoDataManager } from '@/utils/dataManager'

// Type étendu pour l'utilisateur avec isPublicProfile
type UserWithPrivacy = User & { isPublicProfile: boolean }

interface AuthContextType {
    user: User | null
    isAuthenticated: boolean
    isLoading: boolean
    login: (name: string, city: string, email: string, existingUserData?: UserWithPrivacy) => Promise<void>
    logout: () => void
    isPublicUser: boolean
    checkUserByEmail: (email: string) => Promise<UserWithPrivacy | null>
    updateUser: (updates: Partial<User>) => Promise<void>
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

    // Charger l'utilisateur depuis localStorage de manière SYNCHRONE
    const [user, setUser] = useState<User | null>(() => {
        try {
            const savedUser = localStorage.getItem('fomo-user')
            if (savedUser) {
                return JSON.parse(savedUser)
            }
        } catch (error) {
            console.error('Erreur lors du chargement de l\'utilisateur depuis localStorage:', error)
        }
        return null
    })

    const [isLoading, setIsLoading] = useState(false) // Plus besoin de loading initial

    // Initialiser isPublicUser depuis user
    const [isPublicUser, setIsPublicUser] = useState(() => {
        try {
            const savedUser = localStorage.getItem('fomo-user')
            if (savedUser) {
                const userData = JSON.parse(savedUser)
                console.log(`👤 AuthContext - User loaded: ${userData.name} (${userData.id})`)
                return userData.isPublicProfile
            }
        } catch (error) {
            console.error('Erreur:', error)
        }
        console.log('🔍 AuthContext - No saved user, defaulting isPublicUser to false')
        return false
    })

    // Créer une instance directe pour éviter la référence circulaire
    const fomoData = new FomoDataManager()

    const login = useCallback(async (name: string, city: string, email: string, existingUserData?: UserWithPrivacy) => {
        try {
            setIsLoading(true)
            console.log('🔍 [AuthContext] login appelé avec:', { name, email, existingUserData: existingUserData ? 'fourni' : 'non fourni' })

            // Si l'utilisateur existe déjà (passé en paramètre depuis AuthModal), l'utiliser directement
            let userToConnect: UserWithPrivacy | null = null

            if (existingUserData) {
                // Vérifier que l'utilisateur fourni est bien un user (pas un visitor)
                if (existingUserData.id && !existingUserData.id.startsWith('user-')) {
                    console.warn('⚠️ [AuthContext] Visitor détecté dans existingUserData, création d\'un nouveau user à la place')
                    existingUserData = undefined // Forcer la création d'un nouveau user
                } else {
                    // Utilisateur existant passé en paramètre (déjà vérifié dans AuthModal)
                    console.log('✅ [AuthContext] Utilisation de l\'utilisateur existant fourni:', existingUserData.name)
                    userToConnect = existingUserData

                    // Mettre à jour lastConnexion lors de la connexion
                    const lastConnexion = new Date().toISOString()
                    try {
                        await fomoData.saveUserToBackend(userToConnect, lastConnexion)
                        console.log('✅ [AuthContext] lastConnexion mis à jour')
                    } catch (error) {
                        console.error('❌ [AuthContext] Erreur mise à jour lastConnexion:', error)
                        // Continue même si la mise à jour échoue
                    }
                }
            }

            if (!userToConnect) {
                // Pas d'utilisateur fourni, vérifier avec matchByEmail pour inscription
                console.log('🔍 [AuthContext] Vérification matchByEmail pour inscription...')
                const matchedId = await fomoData.matchByEmail(email.trim())

                if (matchedId) {
                    if (matchedId.startsWith('user-')) {
                        // User existant trouvé -> connexion directe
                        console.log('✅ [AuthContext] User existant trouvé:', matchedId)
                        const existingUser = await fomoData.checkUserByEmail(email.trim())
                        if (existingUser) {
                            userToConnect = existingUser
                            // Mettre à jour lastConnexion lors de la connexion
                            const lastConnexion = new Date().toISOString()
                            try {
                                await fomoData.saveUserToBackend(userToConnect, lastConnexion)
                                console.log('✅ [AuthContext] lastConnexion mis à jour')
                            } catch (error) {
                                console.error('❌ [AuthContext] Erreur mise à jour lastConnexion:', error)
                            }
                        }
                    } else if (matchedId.startsWith('visit-')) {
                        // Visitor trouvé -> transformer visit-xxx en user-xxx dans le frontend
                        console.log('🔄 [AuthContext] Visitor trouvé:', matchedId, '- Transformation en user-xxx...')
                        const newUserId = matchedId.replace(/^visit-/, 'user-')
                        console.log(`🔄 [AuthContext] Transformation ID: ${matchedId} -> ${newUserId}`)

                        const userData = {
                            id: newUserId, // Nouvel ID user-xxx
                            name: name.trim(),
                            email: email.trim(),
                            city: city.trim(),
                            friendsCount: 0,
                            showAttendanceToFriends: true,
                            isPublicProfile: false,
                            isAmbassador: false
                        } as UserWithPrivacy

                        try {
                            // Utiliser updateUser avec newId pour transformer visit-xxx en user-xxx
                            const migratedUser = await fomoData.updateUser(matchedId, userData, newUserId)
                            if (migratedUser) {
                                console.log(`✅ [AuthContext] Visitor converti en user: ${matchedId} -> ${migratedUser.id}`)
                                userToConnect = migratedUser

                                // Nettoyer le sessionStorage du visitor
                                try {
                                    const keysToRemove: string[] = []
                                    for (let i = 0; i < sessionStorage.length; i++) {
                                        const key = sessionStorage.key(i)
                                        if (key && key.startsWith('fomo-visit-')) {
                                            keysToRemove.push(key)
                                        }
                                    }
                                    keysToRemove.forEach(key => sessionStorage.removeItem(key))
                                    console.log(`✅ [AuthContext] sessionStorage du visitor nettoyé (${keysToRemove.length} clés supprimées)`)
                                } catch (error) {
                                    console.error('⚠️ [AuthContext] Erreur nettoyage sessionStorage:', error)
                                }
                            }
                        } catch (error) {
                            console.error('❌ [AuthContext] Erreur migration visitor:', error)
                            throw error
                        }
                    }
                }

                if (!userToConnect) {
                    // Aucun utilisateur trouvé -> créer nouveau user
                    console.log('📝 [AuthContext] Création d\'un nouveau profil...')
                    userToConnect = {
                        id: '', // Pas d'ID - le backend le générera
                        name: name.trim(),
                        email: email.trim(),
                        city: city.trim(),
                        friendsCount: 0,
                        showAttendanceToFriends: true,
                        isPublicProfile: false,
                        isAmbassador: false
                    } as UserWithPrivacy

                    // Sauvegarder dans le backend
                    try {
                        const savedUser = await fomoData.saveUserToBackend(userToConnect)
                        if (savedUser) {
                            console.log(`✅ [AuthContext] User créé: ${savedUser.id}`)
                            userToConnect = savedUser
                        } else {
                            // Si pas de user retourné, re-vérifier par email
                            const userAfterSave = await fomoData.checkUserByEmail(email.trim())
                            if (userAfterSave) {
                                console.log(`✅ [AuthContext] User trouvé après sauvegarde: ${userAfterSave.id}`)
                                userToConnect = userAfterSave
                            }
                        }
                    } catch (error) {
                        console.error('❌ [AuthContext] Erreur sauvegarde backend:', error)
                        throw error
                    }
                }
            }

            // Sauvegarder dans le localStorage et mettre à jour l'état
            localStorage.setItem('fomo-user', JSON.stringify(userToConnect))
            setUser(userToConnect)
            setIsPublicUser(userToConnect.isPublicProfile)
            console.log('✅ [AuthContext] Utilisateur connecté et sauvegardé dans localStorage')
        } catch (error) {
            console.error('❌ [AuthContext] Erreur lors de la connexion:', error)
            throw error
        } finally {
            setIsLoading(false)
            console.log('🏁 [AuthContext] login terminé, isLoading = false')
        }
    }, [])

    const logout = useCallback(() => {
        localStorage.removeItem('fomo-user')
        setUser(null)
        setIsPublicUser(false)
    }, [])

    const updateUser = useCallback(async (updates: Partial<User>) => {
        if (!user) return

        const updatedUser: User = { ...user, ...updates }

        // Mettre à jour le localStorage
        localStorage.setItem('fomo-user', JSON.stringify(updatedUser))
        setUser(updatedUser)

        // Si isPublicProfile change, mettre à jour isPublicUser
        if (updates.isPublicProfile !== undefined) {
            setIsPublicUser(updates.isPublicProfile)
        }

        // Sauvegarder dans le backend
        try {
            await fomoData.saveUserToBackend(updatedUser as UserWithPrivacy)
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



    const value: AuthContextType = {
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        isPublicUser,
        checkUserByEmail: fomoData.checkUserByEmail,
        updateUser
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    )
})
