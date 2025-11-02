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
    login: (name: string, city: string, email: string) => Promise<void>
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

    const login = useCallback(async (name: string, city: string, email: string) => {
        try {
            setIsLoading(true)

            // Vérifier si l'utilisateur existe déjà par email
            const existingUser = await fomoData.checkUserByEmail(email.trim())

            if (existingUser) {
                // Utilisateur existant : se connecter avec ses données existantes
                console.log('🔍 AuthContext - Existing user found:', existingUser)

                // Mettre à jour lastConnexion lors de la connexion
                const lastConnexion = new Date().toISOString()
                try {
                    await fomoData.saveUserToBackend(existingUser as UserWithPrivacy, lastConnexion)
                } catch (error) {
                    console.error('Erreur mise à jour lastConnexion:', error)
                    // Continue même si la mise à jour échoue
                }

                localStorage.setItem('fomo-user', JSON.stringify(existingUser))
                setUser(existingUser)
                setIsPublicUser((existingUser as any).isPublicProfile)
            } else {
                // Nouvel utilisateur : créer un profil
                const newUser: UserWithPrivacy = {
                    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
                    name: name.trim(),
                    email: email.trim(),
                    city: city.trim(),
                    friendsCount: 0,
                    showAttendanceToFriends: true,
                    isPublicProfile: false, // Tous les utilisateurs commencent avec un profil privé
                    isAmbassador: false
                }

                // Sauvegarder dans le localStorage
                localStorage.setItem('fomo-user', JSON.stringify(newUser))

                // Sauvegarder dans le backend (Google Sheets)
                try {
                    await fomoData.saveUserToBackend(newUser)
                } catch (error) {
                    console.error('Erreur sauvegarde backend:', error)
                    // Continue même si la sauvegarde backend échoue
                }

                setUser(newUser)
                setIsPublicUser(false)
            }
        } catch (error) {
            console.error('Erreur lors de la connexion:', error)
            throw error
        } finally {
            setIsLoading(false)
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
