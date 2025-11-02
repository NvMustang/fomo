# FOMO MVP

Application de découverte d'événements en temps réel - Version Beta

## 🚀 Démarrage rapide

### Prérequis
- Node.js 18+ 
- npm ou yarn

### Installation

```bash
# Installer les dépendances
npm install

# Backend
cd backend
npm install
```

### Configuration

1. **Backend** : Créer `backend/.env` (voir `backend/.env.example`)
   ```env
   GOOGLE_SERVICE_ACCOUNT_KEY=./service-account.json
   GOOGLE_SPREADSHEET_ID=your_spreadsheet_id
   PORT=3001
   CORS_ORIGIN=http://localhost:5173
   IMGBB_API_KEY=your_imgbb_api_key
   MAPBOX_ACCESS_TOKEN=your_mapbox_token
   ```

2. **Frontend** : Créer `.env` (optionnel)
   ```env
   VITE_PEXELS_API_KEY=your_pexels_key
   VITE_MAPLIBRE_ACCESS_TOKEN=your_maplibre_token
   ```

### Démarrage

#### Option 1: Scripts automatiques
```bash
./fomo/start.sh
```

#### Option 2: Manuel
```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
npm run dev
```

### Build pour production
```bash
npm run build
```

## 📁 Structure

```
├── src/                 # Code source frontend (React + TypeScript)
│   ├── components/      # Composants React réutilisables
│   ├── contexts/         # Contextes React (Auth, Data, etc.)
│   ├── pages/          # Pages principales
│   ├── map/            # Composants de carte
│   ├── hooks/          # Hooks personnalisés
│   ├── utils/           # Utilitaires
│   └── styles/          # CSS (base, layout, components)
├── backend/            # API Express + Google Sheets
│   ├── controllers/    # Contrôleurs
│   ├── routes/         # Routes API
│   └── services/       # Services (géocodage, etc.)
└── dist/               # Build de production
```

## 🔧 Technologies

- **Frontend**: React 18, TypeScript, Vite, MapLibre GL
- **Backend**: Express, Google Sheets API
- **Maps**: MapLibre GL, Mapbox Geocoding
- **Storage**: Google Sheets (temporaire, migration Firebase prévue)

## 📚 Documentation

- [Backend README](backend/README.md) - Documentation API
- [Scripts](SCRIPTS.md) - Scripts de gestion
- [Styles](src/styles/README.md) - Guide de styles CSS

## 🔒 Sécurité

⚠️ **Important**: 
- Ne jamais commiter `backend/service-account.json` ou `.env`
- Tous les secrets doivent être dans les variables d'environnement
- Consultez `.gitignore` pour la liste complète des fichiers exclus

## 📝 Développement

Voir les règles du projet dans `.cursor/rules/` pour :
- Guidelines CSS/React/TypeScript
- Workflow de développement
- Règles de commit/PR

## 🚢 Déploiement

Configuration Vercel dans `vercel.json`.

## 📄 License

MIT
