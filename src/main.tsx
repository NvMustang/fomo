/**
 * FOMO MVP - Main Entry Point
 *
 * Point d'entrée principal de l'application
 */


import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

// Initialiser le logger de console AVANT tout le reste
import ConsoleLogger from './utils/consoleLogger'
ConsoleLogger.init()

// ===== RENDU DE L'APPLICATION =====
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

root.render(
  <App />
)
