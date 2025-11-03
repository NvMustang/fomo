#!/bin/bash

# 🚀 Script de démarrage FOMO MVP
# Tue tous les processus et relance proprement front + back

echo "🔄 Démarrage de FOMO MVP..."


# Fonction pour tuer les processus sur un port
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pids" ]; then
        echo "🔪 Tuage des processus sur le port $port..."
        echo $pids | xargs kill -9 2>/dev/null
        sleep 1
    fi
}

# Fonction pour tuer les processus Node.js
kill_node() {
    echo "🔪 Tuage de tous les processus Node.js..."
    pkill -f "node.*server.js" 2>/dev/null
    pkill -f "npm.*start" 2>/dev/null
    pkill -f "npm.*dev" 2>/dev/null
    pkill -f "vite" 2>/dev/null
    sleep 2
}

# Vérification rapide des ports (sans nettoyage agressif)
check_port() {
    local port=$1
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "❌ Le port $port est encore occupé"
        return 1
    else
        echo "✅ Port $port libre"
        return 0
    fi
}

echo "🔍 Vérification des ports..."
if ! check_port 3000 || ! check_port 3001; then
    echo "⚠️ Des ports sont occupés. Utilisez './stop.sh' d'abord, puis './start.sh'"
    exit 1
fi

# Créer le dossier logs s'il n'existe pas
mkdir -p logs

# Vider les logs pour un démarrage propre
echo "🧹 Nettoyage des logs..."
> /Users/eugene/Projects/FOMO\ MVP/logs/backend.log
> /Users/eugene/Projects/FOMO\ MVP/logs/frontend.log
echo "✅ Logs nettoyés"
echo ""

# Obtenir l'IP du réseau local
get_local_ip() {
    # Essayer différentes méthodes pour obtenir l'IP locale
    local ip=""
    
    # Méthode 1: ifconfig (macOS/Linux)
    if command -v ifconfig >/dev/null 2>&1; then
        ip=$(ifconfig | grep -E "inet.*broadcast" | awk '{print $2}' | head -1)
    fi
    
    # Méthode 2: ip (Linux moderne)
    if [ -z "$ip" ] && command -v ip >/dev/null 2>&1; then
        ip=$(ip route get 1.1.1.1 | awk '{print $7}' | head -1)
    fi
    
    # Méthode 3: hostname (fallback)
    if [ -z "$ip" ]; then
        ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    fi
    
    # Méthode 4: netstat (dernier recours)
    if [ -z "$ip" ]; then
        ip=$(netstat -rn | grep -E "^0\.0\.0\.0" | awk '{print $2}' | head -1)
    fi
    
    echo "$ip"
}

LOCAL_IP=$(get_local_ip)

# Vérifier que l'IP locale est détectée
if [ -z "$LOCAL_IP" ] || [ "$LOCAL_IP" = "127.0.0.1" ]; then
    echo "⚠️  IP locale non détectée. Utilisation de localhost."
    LOCAL_IP="localhost"
    USE_LOCALHOST=true
else
    echo "🌐 IP du réseau local détectée: $LOCAL_IP"
    USE_LOCALHOST=false
fi

# Démarrer le backend
echo "🚀 Démarrage du backend..."
cd /Users/eugene/Projects/FOMO\ MVP/backend
# Le serveur écoute sur 0.0.0.0, donc accessible depuis le réseau
# La détection automatique utilise la DB de test en local
npm run dev > /Users/eugene/Projects/FOMO\ MVP/logs/backend.log 2>&1 &
BACKEND_PID=$!
cd /Users/eugene/Projects/FOMO\ MVP/fomo
echo "🔍 Backend démarré avec PID: $BACKEND_PID"


# Attendre que le backend démarre
echo "⏳ Attente du démarrage du backend..."
sleep 5
echo "✅ Backend démarré (PID: $BACKEND_PID)"
echo ""

# Démarrer le frontend avec l'URL de l'API configurée
echo "🚀 Démarrage du frontend sur le port 3000..."
cd /Users/eugene/Projects/FOMO\ MVP
if [ "$USE_LOCALHOST" = "true" ]; then
    # Mode localhost - pas de variable d'environnement spéciale
    npm run dev > /Users/eugene/Projects/FOMO\ MVP/logs/frontend.log 2>&1 &
else
    # Mode réseau - configurer l'URL de l'API
    VITE_API_URL=http://$LOCAL_IP:3001/api npm run dev > /Users/eugene/Projects/FOMO\ MVP/logs/frontend.log 2>&1 &
fi
FRONTEND_PID=$!
cd /Users/eugene/Projects/FOMO\ MVP/fomo

# Attendre que le frontend démarre
echo "⏳ Attente du démarrage du frontend..."
sleep 8

# Attendre que le frontend démarre
echo "✅ Frontend démarré (PID: $FRONTEND_PID)"

# Afficher les informations de démarrage
echo ""
echo "🎉 FOMO MVP démarré avec succès !"
echo ""

if [ "$USE_LOCALHOST" = "true" ]; then
    echo "📱 Frontend: http://localhost:3000 (PID: $FRONTEND_PID)"
    echo "🔧 Backend:  http://localhost:3001 (PID: $BACKEND_PID)"
    echo ""
    echo "ℹ️  Configuration localhost:"
    echo "   - Frontend: localhost:3000"
    echo "   - Backend:  localhost:3001"
    echo ""
else
    echo "📱 Frontend: http://$LOCAL_IP:3000 (PID: $FRONTEND_PID)"
    echo "🔧 Backend:  http://$LOCAL_IP:3001 (PID: $BACKEND_PID)"
    echo ""

fi
echo "📋 Logs disponibles dans le dossier logs/"
echo "🛑 Pour arrêter: ./fomo/stop.sh"
echo ""

# Mode surveillance optionnel
if [ "$1" = "--watch" ] || [ "$FOMO_WATCH" = "1" ]; then
    echo "👀 Mode watch activé: surveillance des processus..."
else
    echo "ℹ️  Mode par défaut: pas de surveillance; services en arrière-plan."
    echo "   - Pour arrêter: ./fomo/stop.sh"
    echo "   - Pour voir l'état: ./fomo/status.sh"
    exit 0
fi

# Garder le script en vie pour voir les logs
echo "📊 Surveillance des processus (appuyez sur Ctrl+C pour arrêter via ce terminal)..."
echo ""

# Fonction de nettoyage à l'arrêt
cleanup() {
    echo ""
    echo "🛑 Arrêt des services..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    echo "✅ Services arrêtés"
    exit 0
}

# Capturer Ctrl+C
trap cleanup SIGINT

# Surveiller les processus
while true; do
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "❌ Backend arrêté inattendu"
        break
    fi
    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "❌ Frontend arrêté inattendu"
        break
    fi
    sleep 5
done

cleanup
