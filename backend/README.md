# FOMO Beta Backend

Backend simple pour la phase beta utilisant Google Sheets comme base de données.

## 🚀 Démarrage rapide

```bash
# Installer les dépendances
npm install

# Démarrer le serveur
npm start

# Ou en mode développement
npm run dev


## 📡 API Endpoints

### Événements
- `GET /api/events` - Récupérer tous les événements
- `POST /api/events` - Créer un nouvel événement
- `PUT /api/events/:id` - Mettre à jour un événement
- `DELETE /api/events/:id` - Supprimer un événement

### Utilisateurs
- `GET /api/users` - Récupérer tous les utilisateurs
- `POST /api/users` - Créer un nouvel utilisateur
- `GET /api/users/email/:email` - Récupérer un utilisateur par email
- `PUT /api/users/:id` - Mettre à jour un utilisateur

### Réponses
- `GET /api/responses` - Récupérer toutes les réponses
- `POST /api/responses` - Créer une nouvelle réponse
- `PUT /api/responses/:userId/:eventId` - Mettre à jour une réponse
- `DELETE /api/responses/:userId/:eventId` - Supprimer une réponse

### Utilitaires
- `POST /api/upload-image` - Upload d'image vers ImgBB
- `GET /api/health` - Health check

## 🔧 Configuration

Le backend utilise :
- **Google Sheets** comme base de données
- **ImgBB** pour l'hébergement d'images
- **Service Account** pour l'authentification Google

### Variables d'environnement (.env)

```env
GOOGLE_SERVICE_ACCOUNT_KEY=./service-account.json
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id
PORT=3001
CORS_ORIGIN=http://localhost:5173

# DB de test (pour développement local - détection automatique)
GOOGLE_SPREADSHEET_ID_TEST=1QQJGH17UWDGYHbIIEcqajBYlwv8lplp8m00J6e6EQ-Y
```

### 🧪 Détection automatique de l'environnement

La configuration détecte automatiquement l'environnement :
- **En local** (développement) : utilise toujours la DB de test si `GOOGLE_SPREADSHEET_ID_TEST` est défini
- **Sur Vercel** (production) : utilise automatiquement `GOOGLE_SPREADSHEET_ID`

**Configuration pour le développement local :**

1. **Ajouter dans `backend/.env`** :
   ```env
   GOOGLE_SPREADSHEET_ID_TEST=1QQJGH17UWDGYHbIIEcqajBYlwv8lplp8m00J6e6EQ-Y
   ```

2. **Démarrer le serveur** (toujours en mode test en local) :
   ```bash
   npm run dev
   ```

   Le serveur affichera automatiquement `🧪 TEST` en local et `📊 PRODUCTION` sur Vercel.

## 📊 Structure Google Sheets

### Onglet "Events"
| Colonne | Description |
|---------|-------------|
| A | ID |
| B | Titre |
| C | Description |
| D | Date de début |
| E | Date de fin |
| F | Nom du lieu |
| G | Adresse |
| H | Latitude |
| I | Longitude |
| J | Catégorie |
| K | URL de l'image |
| L | ID de l'organisateur |
| M | Nom de l'organisateur |
| N | Nombre de participants |
| O | Nombre d'intéressés |
| P | Nombre d'amis participants |
| Q | Public (true/false) |
| R | Date de création |

### Onglet "Users"
| Colonne | Description |
|---------|-------------|
| A | ID |
| B | Nom |
| C | Email |
| D | Ville |
| E | Nombre d'amis |
| F | Afficher participation aux amis |
| G | Profil public |
| H | Date de création |

### Onglet "Responses"
| Colonne | Description |
|---------|-------------|
| A | ID utilisateur |
| B | ID événement |
| C | Réponse (going/interested/not_going) |
| D | Date de création |

## 🎯 Pour la beta

- **Gratuit** et sans limite
- **Visuel** : données en temps réel dans Google Sheets
- **Simple** : pas de base de données à gérer
- **Collaboratif** : partage facile avec les testeurs

## 🔄 Scripts de migration

```bash
# Migration complète (utilisateurs + réponses)
npm run migrate

# Migration des utilisateurs uniquement
npm run migrate:users

# Migration des réponses uniquement
npm run migrate:responses
```

## 🔄 Migration future

Quand vous serez prêt pour la production :
1. Migrez vers Supabase/Firebase/PostgreSQL
2. Gardez la même structure d'API
3. Changez juste le backend
4. Le frontend reste identique
