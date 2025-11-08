/**
 * FOMO MVP - Modal de connexion utilisateur
 * 
 * Étape 1: Vérification de l'email
 * Si user trouvé → connexion automatique
 * Si user non trouvé → ouvre UserRegistrationModal
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useFomoDataContext } from '@/contexts/FomoDataProvider'
import { Button } from '@/components'
import { useModalScrollHint } from '@/hooks'
import { isValidEmail } from '@/utils/emailValidation'
import { getApiBaseUrl } from '@/config/env'

interface UserConnexionModalProps {
  useVisitorStyle?: boolean // Si true, applique le style visitor-modal-dynamic
  onRegistrationRequested?: (email: string) => void // Callback quand inscription demandée avec l'email
}

export const UserConnexionModal: React.FC<UserConnexionModalProps> = ({
  useVisitorStyle = false,
  onRegistrationRequested
}) => {
  const { login, isLoading, isAuthenticated, checkUserByEmail } = useAuth()
  const { matchByEmail } = useFomoDataContext()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const emailInputRef = useRef<HTMLInputElement>(null)
  const prevAuthenticatedRef = useRef<boolean>(isAuthenticated)

  // Animation de scroll à l'ouverture du modal
  const modalContentRef = useModalScrollHint(true)

  // Fonction pour vérifier l'email lors de la connexion
  const handleEmailLogInCheck = useCallback(async (emailToCheck: string) => {
    if (!emailToCheck.trim()) {
      setError('L\'email est requis')
      return
    }

    if (!isValidEmail(emailToCheck.trim())) {
      setError('Veuillez saisir une adresse email valide')
      return
    }

    setError('')

    try {
      console.log('🔍 [UserConnexionModal] Vérification email pour connexion:', emailToCheck.trim())
      const matchedId = await matchByEmail(emailToCheck.trim())
      console.log('🔍 [UserConnexionModal] Résultat matchByEmail:', matchedId || 'Aucun utilisateur trouvé')

      if (matchedId) {
        // Vérifier si c'est un user authentifié (pas un visitor)
        const existingUser = await checkUserByEmail(emailToCheck.trim())

        // Si user authentifié trouvé, vérifier s'il y a un visitor temporaire à migrer
        if (existingUser && !existingUser.isVisitor) {
          // Détecter le visitor temporaire actif
          let visitorUserId: string | null = null
          try {
            visitorUserId = sessionStorage.getItem('fomo-visit-user-id')
          } catch (e) {
            // Ignorer si sessionStorage indisponible
          }

          // Si un visitor temporaire existe et est différent de l'utilisateur trouvé, migrer
          if (visitorUserId && visitorUserId !== existingUser.id) {
            console.log(`🔄 [UserConnexionModal] Migration visitor temporaire ${visitorUserId} vers ${existingUser.id}`)
            try {
              const apiUrl = getApiBaseUrl()
              const response = await fetch(`${apiUrl}/users/migrate-responses`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  sourceUserId: visitorUserId,
                  targetUserId: existingUser.id
                })
              })

              if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Erreur inconnue' }))
                console.error('❌ [UserConnexionModal] Erreur migration:', errorData)
                // Continuer quand même avec la connexion
              } else {
                const result = await response.json()
                console.log(`✅ [UserConnexionModal] Migration réussie: ${result.data.responsesMigrated} réponse(s) migrée(s)`)

                // Nettoyer sessionStorage après migration réussie
                try {
                  sessionStorage.removeItem('fomo-visit-user-id')
                  sessionStorage.removeItem('fomo-visit-name')
                  sessionStorage.removeItem('fomo-visit-email')
                } catch (e) {
                  // Ignorer si sessionStorage indisponible
                }
              }
            } catch (error) {
              console.error('❌ [UserConnexionModal] Erreur lors de la migration:', error)
              // Continuer quand même avec la connexion
            }
          }

          // Connexion automatique
          console.log('✅ [UserConnexionModal] User authentifié trouvé, connexion automatique...')
          await login(existingUser.name, existingUser.city, existingUser.email, existingUser)
          console.log('✅ [UserConnexionModal] Connexion réussie')
          // Marquer le signup pour animation navbar
          try {
            sessionStorage.setItem('fomo-just-signed-up', 'true')
          } catch (e) {
            // Ignorer si sessionStorage indisponible
          }
        } else if (existingUser?.isVisitor === true) {
          // Visiteur trouvé -> rediriger vers inscription
          console.log('⚠️ [UserConnexionModal] Visiteur détecté, passage à l\'inscription')
          onRegistrationRequested?.(emailToCheck.trim())
        } else if (matchedId.startsWith('usr-')) {
          // User trouvé (fallback pour compatibilité)
          console.log('✅ [UserConnexionModal] User trouvé, connexion automatique...')
          const user = await checkUserByEmail(emailToCheck.trim())
          if (user) {
            await login(user.name, user.city, user.email, user)
            console.log('✅ [UserConnexionModal] Connexion réussie')
            try {
              sessionStorage.setItem('fomo-just-signed-up', 'true')
            } catch (e) {
              // Ignorer si sessionStorage indisponible
            }
          }
        }
      } else {
        // Aucun utilisateur trouvé -> rediriger vers inscription
        console.log('ℹ️ [UserConnexionModal] Aucun utilisateur trouvé, passage à l\'inscription')
        onRegistrationRequested?.(emailToCheck.trim())
      }
    } catch (error) {
      console.error('❌ [UserConnexionModal] Erreur de vérification:', error)
      setError('Erreur lors de la vérification de l\'email. Réessayez.')
    }
  }, [matchByEmail, login, checkUserByEmail, onRegistrationRequested])

  // Charger l'email du visitor depuis sessionStorage si disponible
  useEffect(() => {
    if (!isAuthenticated) {
      try {
        const visitorEmail = sessionStorage.getItem('fomo-visit-email')
        if (visitorEmail && visitorEmail.trim()) {
          setEmail(visitorEmail.trim())
          console.log('✅ [UserConnexionModal] Email du visitor pré-rempli:', visitorEmail.trim())
        } else {
          setEmail('')
        }
      } catch {
        setEmail('')
      }
      setError('')
    }
  }, [isAuthenticated])

  // Donner le focus à l'input email après déconnexion
  useEffect(() => {
    // Détecter le passage de authentifié à non-authentifié (déconnexion)
    if (prevAuthenticatedRef.current === true && isAuthenticated === false) {
      // Délai pour s'assurer que le modal est monté
      const timeoutId = setTimeout(() => {
        emailInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timeoutId)
    }
    // Mettre à jour la référence précédente
    prevAuthenticatedRef.current = isAuthenticated
  }, [isAuthenticated])

  // Fonction appelée uniquement lors du clic sur "Continuer"
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await handleEmailLogInCheck(email.trim())
  }

  if (isAuthenticated) return null

  // Dans WelcomeScreen, toujours utiliser modal-welcome pour le style blanc sur fond dégradé
  const isInWelcomeScreen = !isAuthenticated
  const modalClass = isInWelcomeScreen
    ? 'modal modal-welcome'
    : useVisitorStyle
      ? 'modal visitor-modal-dynamic'
      : 'modal'

  return (
    <>
      <div className={`modal_container ${isInWelcomeScreen ? 'modal-no-backdrop' : ''}`}>
        <div className={modalClass} onClick={e => e.stopPropagation()}>
          <div ref={modalContentRef} className={`modal-content ${useVisitorStyle && !isInWelcomeScreen ? 'visitor-form-dynamic' : ''}`}>
            <h2 style={{ margin: 0, marginBottom: 'var(--md)', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-semibold)' }}>Bienvenue sur FOMO</h2>
            <p className="auth-subtitle">Renseignez votre email</p>
            <br />
            <form onSubmit={handleEmailSubmit} className="modal-form">
              <div className="form-section">
                <input
                  ref={emailInputRef}
                  type="email"
                  name="logEmail"
                  id="auth-logEmail"
                  className="form-input"
                  placeholder="Ex: marie@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  required
                  autoFocus
                />
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <div className="form-section">
                <div className="form-actions">
                  <Button
                    type="submit"
                    disabled={isLoading || !email.trim()}
                    variant="primary"
                  >
                    Continuer
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

export default UserConnexionModal

