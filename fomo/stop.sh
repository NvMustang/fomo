#!/bin/bash

# 🛑 Script d'arrêt FOMO MVP
# Arrête proprement tous les services

echo "🛑 Arrêt de FOMO MVP..."

# Fonction pour tuer les processus sur un port
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pids" ]; then
        echo "🔪 Arrêt des processus sur le port $port..."
        echo $pids | xargs kill -9 2>/dev/null
    fi
}

# Fonction pour tuer les processus Node.js
kill_node() {
    echo "🔪 Arrêt de tous les processus Node.js..."
    pkill -f "node.*server.js" 2>/dev/null
    pkill -f "npm.*start" 2>/dev/null
    pkill -f "npm.*dev" 2>/dev/null
    pkill -f "npm.*test:dev" 2>/dev/null
    pkill -f "vite" 2>/dev/null
}

# Arrêt des services
echo "🧹 Arrêt des services..."
kill_port 3000  # Frontend
kill_port 3001  # Backend
kill_node

# Attendre que tout soit arrêté
sleep 2

echo "✅ FOMO MVP arrêté avec succès !"
