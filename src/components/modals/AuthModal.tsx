/**
 * FOMO MVP - Modal d'authentification en 2 étapes
 * 
 * Étape 1: Vérification de l'email
 * Étape 2: Connexion ou inscription selon l'existence de l'utilisateur
 */

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useFomoDataContext } from '@/contexts/FomoDataProvider'
import { Button } from '@/components'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'

interface AuthModalProps {
  useVisitorStyle?: boolean // Si true, applique le style visitor-modal-dynamic
}

type AuthStep = 'email' | 'new-user'

export const AuthModal: React.FC<AuthModalProps> = ({ useVisitorStyle = false }) => {
  const { login, isLoading, isAuthenticated, checkUserByEmail } = useAuth()
  const { matchByEmail } = useFomoDataContext()
  const [currentStep, setCurrentStep] = useState<AuthStep>('email')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [error, setError] = useState('')
  const [isCityValid, setIsCityValid] = useState(true)

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

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
      console.log('🔍 [AuthModal] Vérification email pour connexion:', emailToCheck.trim())
      const matchedId = await matchByEmail(emailToCheck.trim())
      console.log('🔍 [AuthModal] Résultat matchByEmail:', matchedId || 'Aucun utilisateur trouvé')

      if (matchedId) {
        if (matchedId.startsWith('user-')) {
          // User trouvé -> connexion automatique
          console.log('✅ [AuthModal] User trouvé, connexion automatique...')
          // Récupérer les infos du user pour la connexion
          const user = await checkUserByEmail(emailToCheck.trim())
          if (user) {
            await login(user.name, user.city, user.email, user)
            console.log('✅ [AuthModal] Connexion réussie')
            // Marquer le signup pour animation navbar
            try {
              sessionStorage.setItem('fomo-just-signed-up', 'true')
            } catch (e) {
              // Ignorer si sessionStorage indisponible
            }
          }
        } else {
          // User trouvé (peut être visiteur ou user authentifié) -> vérifier isVisitor
          const existingUser = await checkUserByEmail(emailToCheck.trim())
          if (existingUser?.isVisitor === true) {
            // Visiteur trouvé -> rediriger vers inscription
            console.log('⚠️ [AuthModal] Visiteur détecté, passage à l\'inscription')
            setCurrentStep('new-user')
          } else {
            // User authentifié -> connexion automatique
            console.log('✅ [AuthModal] User authentifié trouvé, connexion automatique...')
            await login(existingUser!.name, existingUser!.city, existingUser!.email, existingUser!)
            console.log('✅ [AuthModal] Connexion réussie')
            // Marquer le signup pour animation navbar
            try {
              sessionStorage.setItem('fomo-just-signed-up', 'true')
            } catch (e) {
              // Ignorer si sessionStorage indisponible
            }
          }
        }
      } else {
        // Aucun utilisateur trouvé -> rediriger vers inscription
        console.log('ℹ️ [AuthModal] Aucun utilisateur trouvé, passage à l\'étape new-user')
        setCurrentStep('new-user')
      }
    } catch (error) {
      console.error('❌ [AuthModal] Erreur de vérification:', error)
      setError('Erreur lors de la vérification de l\'email. Réessayez.')
    }
  }, [matchByEmail, login, checkUserByEmail])

  // Charger l'email et le nom du visitor depuis sessionStorage si disponible
  useEffect(() => {
    if (!isAuthenticated) {
      try {
        const visitorEmail = sessionStorage.getItem('fomo-visit-email')
        const visitorName = sessionStorage.getItem('fomo-visit-name')

        if (visitorEmail && visitorEmail.trim()) {
          setEmail(visitorEmail.trim())
          console.log('✅ [AuthModal] Email du visitor pré-rempli:', visitorEmail.trim())
        } else {
          setEmail('')
        }

        if (visitorName && visitorName.trim()) {
          setName(visitorName.trim())
          console.log('✅ [AuthModal] Nom du visitor pré-rempli:', visitorName.trim())
        } else {
          setName('')
        }
      } catch {
        setEmail('')
        setName('')
      }

      setCurrentStep('email')
      setCity('')
      setError('')
      setIsCityValid(true)
    }
  }, [isAuthenticated])

  // Fonction appelée uniquement lors du clic sur "Continuer"
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await handleEmailLogInCheck(email.trim())
  }


  const handleNewUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Le nom est requis')
      return
    }

    if (!city.trim()) {
      setError('La ville est requise')
      return
    }

    try {
      await login(name.trim(), city.trim(), email.trim())
      // Marquer le signup pour animation navbar
      try {
        sessionStorage.setItem('fomo-just-signed-up', 'true')
      } catch (e) {
        // Ignorer si sessionStorage indisponible
      }
    } catch (error) {
      setError('Erreur lors de la création du profil. Réessayez.')
      console.error('Erreur de création:', error)
    }
  }

  if (isAuthenticated) return null

  const renderEmailStep = () => {
    const isInWelcomeScreen = !isAuthenticated
    const modalClass = useVisitorStyle 
      ? 'modal visitor-modal-dynamic' 
      : isInWelcomeScreen 
        ? 'modal modal-welcome' 
        : 'modal'
    return (
      <div className={`modal_container ${isInWelcomeScreen ? 'modal-no-backdrop' : ''}`}>
        <div className={modalClass} onClick={e => e.stopPropagation()}>
          <div className={`modal-content ${useVisitorStyle ? 'visitor-form-dynamic' : ''}`}>
            <h2 style={{ margin: 0, marginBottom: 'var(--md)', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-semibold)' }}>Bienvenue sur FOMO</h2>
            <p className="auth-subtitle">Renseignez votre email</p>
            <br />
            <form onSubmit={handleEmailSubmit} className="modal-form">
              <div className="form-section">
                <input
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
                    {isLoading ? 'Vérification...' : 'Continuer'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }


  const renderNewUserStep = () => {
    const modalClass = useVisitorStyle ? 'modal visitor-modal-dynamic' : 'modal'
    return (
      <div className="modal_container modal-no-backdrop">
        <div className={modalClass} onClick={e => e.stopPropagation()}>
          <div className={`modal-content ${useVisitorStyle ? 'visitor-form-dynamic' : ''}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--md)' }}>
            <h2 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-semibold)' }}>Créer votre profil</h2>
            <button
              className="back-button"
              onClick={() => setCurrentStep('email')}
              disabled={isLoading}
              type="button"
              aria-label="Retour"
            >
              ←
            </button>
          </div>
          <p className="auth-subtitle">Complétez votre profil</p>
          <form onSubmit={handleNewUserSubmit} className="modal-form">
            <div className="form-section">
              <label className="form-label">Votre nom *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ex: Marie Dupont"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>

            <div className="form-section">
              <label className="form-label">Votre ville *</label>
              <AddressAutocomplete
                value={city}
                onChange={setCity}
                onAddressSelect={() => {
                  // Optionnel : on pourrait stocker les coordonnées pour plus tard
                }}
                onValidationChange={setIsCityValid}
                placeholder="Ex: Bruxelles, New York, Paris..."
                className="form-input"
                disabled={isLoading}
              />
            </div>

            <div className="form-section">
              <label className="form-label">Email (confirmé)</label>
              <input
                type="email"
                name="signEmail"
                id="auth-signEmail"
                className="form-input"
                value={email}
                disabled
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
                  disabled={isLoading || !name.trim() || !city.trim() || !isCityValid}
                  variant="primary"
                >
                  {isLoading ? 'Création...' : 'Créer mon profil'}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
    )
  }

  return (
    <>
      {currentStep === 'email' && renderEmailStep()}
      {currentStep === 'new-user' && renderNewUserStep()}
    </>
  )
}

export default AuthModal

