/**
 * FOMO MVP - Modal d'authentification en 2 étapes
 * 
 * Étape 1: Vérification de l'email
 * Étape 2: Connexion ou inscription selon l'existence de l'utilisateur
 */

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'

interface AuthModalProps { }

type AuthStep = 'email' | 'new-user'

export const AuthModal: React.FC<AuthModalProps> = () => {
  const { checkUserByEmail, login, isLoading, isAuthenticated } = useAuth()
  const [currentStep, setCurrentStep] = useState<AuthStep>('email')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [error, setError] = useState('')
  const [isCityValid, setIsCityValid] = useState(true)

  // Reset modal state when opened/closed
  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentStep('email')
      setEmail('')
      setName('')
      setCity('')
      setError('')
      setIsCityValid(true)
    }
  }, [isAuthenticated])


  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('L\'email est requis')
      return
    }

    if (!isValidEmail(email.trim())) {
      setError('Veuillez saisir une adresse email valide')
      return
    }

    try {
      console.log('🔍 [AuthModal] Vérification email:', email.trim())
      const user = await checkUserByEmail(email.trim())
      console.log('🔍 [AuthModal] Résultat checkUserByEmail:', user ? `Utilisateur trouvé: ${user.name}` : 'Aucun utilisateur trouvé')

      if (user) {
        // Connexion directe si l'utilisateur existe
        // Passer l'utilisateur directement à login pour éviter une double vérification
        console.log('🔍 [AuthModal] Tentative de connexion avec:', { name: user.name, email: user.email })
        await login(user.name, user.city, user.email, user)
        console.log('✅ [AuthModal] Connexion réussie')
      } else {
        console.log('ℹ️ [AuthModal] Utilisateur non trouvé, passage à l\'étape new-user')
        setCurrentStep('new-user')
      }
    } catch (error) {
      console.error('❌ [AuthModal] Erreur de vérification:', error)
      setError('Erreur lors de la vérification de l\'email. Réessayez.')
    }
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
    } catch (error) {
      setError('Erreur lors de la création du profil. Réessayez.')
      console.error('Erreur de création:', error)
    }
  }

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  if (isAuthenticated) return null

  const renderEmailStep = () => {
    const isInWelcomeScreen = !isAuthenticated
    return (
      <div className="modal_container">
        <div className={`modal ${isInWelcomeScreen ? 'modal-welcome' : ''}`} onClick={e => e.stopPropagation()}>
          <div className="modal-content">
            <h2 style={{ margin: 0, marginBottom: 'var(--md)', fontSize: 'var(--text-lg)', fontWeight: 'var(--font-weight-semibold)' }}>Bienvenue sur FOMO</h2>
            <p className="auth-subtitle">Renseignez votre email</p>
            <br />
            <form onSubmit={handleEmailSubmit} className="modal-form">
              <div className="form-section">
                <input
                  type="email"
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


  const renderNewUserStep = () => (
    <div className="modal_container">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-content">
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

  return (
    <>
      {currentStep === 'email' && renderEmailStep()}
      {currentStep === 'new-user' && renderNewUserStep()}
    </>
  )
}

export default AuthModal

