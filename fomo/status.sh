#!/bin/bash

# 📊 Script de statut FOMO MVP
# Vérifie l'état des services

echo "📊 Statut de FOMO MVP"
echo "====================="

# Fonction pour vérifier un port
check_port() {
    local port=$1
    local service=$2
    if lsof -ti:$port >/dev/null 2>&1; then
        local pid=$(lsof -ti:$port)
        echo "✅ $service: Port $port (PID: $pid)"
        return 0
    else
        echo "❌ $service: Port $port (arrêté)"
        return 1
    fi
}

# Vérifier les ports
echo ""
echo "🔍 Vérification des services:"
check_port 3000 "Frontend"
check_port 3001 "Backend"

echo ""

# Vérifier les processus Node.js
echo "🔍 Processus Node.js actifs:"
node_processes=$(pgrep -f "node.*server.js\|npm.*start\|npm.*dev\|vite" 2>/dev/null)
if [ ! -z "$node_processes" ]; then
    echo "$node_processes" | while read pid; do
        if [ ! -z "$pid" ]; then
            echo "  PID $pid: $(ps -p $pid -o comm= 2>/dev/null)"
        fi
    done
else
    echo "  Aucun processus Node.js actif"
fi

echo ""

# Obtenir l'IP du réseau local
get_local_ip() {
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
    
    echo "$ip"
}

LOCAL_IP=$(get_local_ip)

# Vérifier que l'IP locale est détectée
if [ -z "$LOCAL_IP" ] || [ "$LOCAL_IP" = "127.0.0.1" ]; then
    LOCAL_IP="localhost"
    USE_LOCALHOST=true
else
    USE_LOCALHOST=false
fi

# Tester la connectivité
echo "🌐 Test de connectivité:"
if curl -s http://localhost:3000 >/dev/null 2>&1; then
    echo "✅ Frontend: http://localhost:3000 (accessible)"
    if [ "$USE_LOCALHOST" = "false" ]; then
        if curl -s http://$LOCAL_IP:3000 >/dev/null 2>&1; then
            echo "✅ Frontend: http://$LOCAL_IP:3000 (accessible mobile)"
        else
            echo "❌ Frontend: http://$LOCAL_IP:3000 (inaccessible mobile)"
        fi
    fi
else
    echo "❌ Frontend: http://localhost:3000 (inaccessible)"
fi

if curl -s http://localhost:3001/api/events >/dev/null 2>&1; then
    echo "✅ Backend:  http://localhost:3001 (accessible)"
    if [ "$USE_LOCALHOST" = "false" ]; then
        if curl -s http://$LOCAL_IP:3001/api/events >/dev/null 2>&1; then
            echo "✅ Backend:  http://$LOCAL_IP:3001 (accessible mobile)"
        else
            echo "❌ Backend:  http://$LOCAL_IP:3001 (inaccessible mobile)"
        fi
    fi
else
    echo "❌ Backend:  http://localhost:3001 (inaccessible)"
fi

echo ""
echo "💡 Commandes disponibles:"
echo "  ./start.sh   - Démarrer FOMO MVP"
echo "  ./stop.sh    - Arrêter FOMO MVP"
echo "  ./reload.sh  - Recharger FOMO MVP"
echo "  ./status.sh  - Vérifier le statut"
