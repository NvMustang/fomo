/**
 * FOMO MVP - Main Entry Point
 *
 * Point d'entrée principal de l'application
 */


import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

// Initialiser l'intercepteur HTTP pour analytics
import { initHttpInterceptor } from './utils/httpInterceptor'
initHttpInterceptor()

// Initialiser la sauvegarde automatique des analytics (indépendant du dashboard)
import { autoSaveAnalytics } from './utils/autoSaveAnalytics'
autoSaveAnalytics.init()

// Initialiser la sauvegarde automatique de l'onboarding
import { autoSaveOnboarding } from './onboarding/utils/autoSaveOnboarding'
autoSaveOnboarding.init()

// ===== RENDU DE L'APPLICATION =====
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

root.render(
  <App />
)
