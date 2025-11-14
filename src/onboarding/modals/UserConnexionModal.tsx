/**
 * FOMO MVP - Modal de connexion utilisateur
 * 
 * Étape 1: Vérification de l'email
 * Si user trouvé → connexion automatique
 * Si user non trouvé → ouvre UserRegistrationModal
 */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components'
import { useModalScrollHint } from '@/hooks'
import { isValidEmail } from '@/utils/emailValidation'
import { useFomoData } from '@/utils/dataManager'

interface UserConnexionModalProps {
  useVisitorStyle?: boolean // Si true, applique le style visitor-modal-dynamic
  onRegistrationRequested?: (email: string) => void // Callback quand inscription demandée avec l'email
}

export const UserConnexionModal: React.FC<UserConnexionModalProps> = ({
  useVisitorStyle = false,
  onRegistrationRequested
}) => {
  const { login, isLoading, user } = useAuth()
  const fomoData = useFomoData()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const emailInputRef = useRef<HTMLInputElement>(null)
  const prevAuthenticatedRef = useRef<boolean>(!user.isVisitor)

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
      const matchedId = await fomoData.matchByEmail(emailToCheck.trim())
      console.log('🔍 [UserConnexionModal] Résultat matchByEmail:', matchedId || 'Aucun utilisateur trouvé')

      if (matchedId) {
        // Récupérer le user complet par son ID (visitor ou user authentifié)
        // Note: Le remplacement de l'ID dans localStorage est géré par AuthContext.login()
        const existingUser = await fomoData.getUserById(matchedId)

        // Si user authentifié trouvé, vérifier s'il y a un visitor temporaire à migrer
        if (existingUser && !existingUser.isVisitor) {
          // Utiliser le user déjà disponible dans le scope du composant
          const visitorUserId = user.isVisitor ? user.id : null

          // Si un visitor temporaire existe et est différent de l'utilisateur trouvé, migrer
          if (visitorUserId && visitorUserId !== existingUser.id) {
            console.log(`🔄 [UserConnexionModal] Migration visitor temporaire ${visitorUserId} vers ${existingUser.id}`)
            try {
              const migrationResult = await fomoData.migrateResponses(visitorUserId, existingUser.id)
              console.log(`✅ [UserConnexionModal] Migration réussie: ${migrationResult.responsesMigrated} réponse(s) migrée(s)`)
              // Note: visitor sera automatiquement remplacé par le user authentifié via AuthContext.login()
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
        } else {
          // Cas où matchedId existe mais getUserById retourne null (erreur de récupération)
          console.error(`❌ [UserConnexionModal] ID trouvé (${matchedId}) mais utilisateur non récupérable depuis la DB`)
          setError('Erreur lors de la récupération de votre compte. Vous pouvez continuer avec l\'inscription.')
          // Rediriger vers l'inscription comme fallback
          onRegistrationRequested?.(emailToCheck.trim())
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
  }, [fomoData, login, onRegistrationRequested, user])

  // Charger l'email du visitor depuis localStorage si disponible
  useEffect(() => {
    if (user.isVisitor) {
      try {
        const visitorEmail = localStorage.getItem('fomo-visit-email')
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
  }, [user.isVisitor])

  // Donner le focus à l'input email après déconnexion
  useEffect(() => {
    // Détecter le passage de authentifié à non-authentifié (déconnexion)
    if (prevAuthenticatedRef.current === false && user.isVisitor === true) {
      // Délai pour s'assurer que le modal est monté
      const timeoutId = setTimeout(() => {
        emailInputRef.current?.focus()
      }, 100)
      return () => clearTimeout(timeoutId)
    }
    // Mettre à jour la référence précédente
    prevAuthenticatedRef.current = !user.isVisitor
  }, [user.isVisitor])

  // Fonction appelée uniquement lors du clic sur "Continuer"
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await handleEmailLogInCheck(email.trim())
  }

  if (!user.isVisitor) return null

  // Dans WelcomeScreen, toujours utiliser modal-welcome pour le style blanc sur fond dégradé
  const isInWelcomeScreen = user.isVisitor
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

