# 🚀 Scripts de Gestion FOMO MVP

## 📋 Scripts Disponibles

### 🎯 Script Principal
```bash
./fomo.sh [commande]
```

### 🔧 Scripts Individuels
- `./start.sh` - Démarre FOMO MVP
- `./stop.sh` - Arrête FOMO MVP  
- `./restart.sh` - Redémarre FOMO MVP (stop + start)
- `./status.sh` - Vérifie le statut des services

## 🚀 Commandes Disponibles

### Démarrage
```bash
./fomo.sh start
# ou
./start.sh
```

### Arrêt
```bash
./fomo.sh stop
# ou
./stop.sh
```

### Redémarrage
```bash
./fomo.sh restart
# ou
./restart.sh
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

---

*Scripts créés pour FOMO MVP - Version 1.0*
