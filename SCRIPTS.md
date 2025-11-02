# 🚀 Scripts de Gestion FOMO MVP

## 📋 Scripts Disponibles

### 🎯 Script Principal
```bash
./fomo.sh [commande]
```

### 🔧 Scripts Individuels
- `./start.sh` - Démarre FOMO MVP (PRODUCTION)
- `./start.sh test` - Démarre FOMO MVP en MODE TEST
- `./stop.sh` - Arrête FOMO MVP  
- `./restart.sh` - Redémarre FOMO MVP (PRODUCTION)
- `./restart.sh test` - Redémarre FOMO MVP en MODE TEST
- `./status.sh` - Vérifie le statut des services

## 🚀 Commandes Disponibles

### Démarrage

**Mode Production (défaut):**
```bash
./fomo.sh start
# ou
./start.sh
```

**Mode Test (base de données de test):**
```bash
./start.sh test
```

### Arrêt
```bash
./fomo.sh stop
# ou
./stop.sh
```

### Redémarrage

**Mode Production:**
```bash
./fomo.sh restart
# ou
./restart.sh
```

**Mode Test:**
```bash
./restart.sh test
```

### Statut
```bash
./fomo.sh status
# ou
./status.sh
```

### Logs
```bash
./fomo.sh logs frontend
./fomo.sh logs backend
```

## 🎯 Utilisation Recommandée

### Développement Quotidien

**Mode Production:**
```bash
# Démarrer le projet
./fomo.sh start

# Vérifier le statut
./fomo.sh status

# Voir les logs en temps réel
./fomo.sh logs backend

# Redémarrer après modifications
./fomo.sh restart
```

**Mode Test (pour tester sans affecter la production):**
```bash
# Démarrer en mode test
./start.sh test

# Redémarrer en mode test
./restart.sh test

# Vérifier le statut
./status.sh
```

⚠️ **Important**: En mode test, le backend utilise `GOOGLE_SPREADSHEET_ID_TEST` au lieu de `GOOGLE_SPREADSHEET_ID`. Assurez-vous d'avoir configuré cette variable dans `backend/.env`.

### Dépannage
```bash
# Vérifier l'état des services
./fomo.sh status

# Redémarrer complètement
./fomo.sh restart

# Arrêter tout
./fomo.sh stop
```

## 📊 Ports Utilisés

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001

## 📋 Logs

Les logs sont sauvegardés dans le dossier `logs/`:
- `logs/frontend.log` - Logs du frontend
- `logs/backend.log` - Logs du backend

## 🔧 Fonctionnalités

### Nettoyage Automatique
- Tue tous les processus Node.js existants
- Libère les ports 3000 et 3001
- Vérifie que les ports sont libres avant démarrage

### Vérification de Santé
- Teste la connectivité des services
- Vérifie que les APIs répondent
- Affiche les PIDs des processus

### Gestion d'Erreurs
- Arrêt propre en cas d'erreur
- Messages d'erreur clairs
- Logs détaillés pour le débogage

## 🎉 Exemple Complet

**Mode Production:**
```bash
# Premier démarrage
./fomo.sh start

# Vérifier que tout fonctionne
./fomo.sh status

# Développer...
# (modifications du code)

# Redémarrer après modifications
./fomo.sh restart

# Voir les logs en cas de problème
./fomo.sh logs backend

# Arrêter en fin de journée
./fomo.sh stop
```

**Mode Test:**
```bash
# Démarrer en mode test (base de données de test)
./start.sh test

# Vérifier que tout fonctionne
./status.sh

# Tester vos modifications...
# (modifications du code)

# Redémarrer en mode test
./restart.sh test

# Arrêter
./stop.sh
```

---

*Scripts créés pour FOMO MVP - Version 1.0*
