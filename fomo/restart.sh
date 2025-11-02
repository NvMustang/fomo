#!/bin/bash

# 🔄 Script de redémarrage FOMO MVP
# Arrête puis redémarre tous les services
# Usage: ./restart.sh [test] - Redémarre en mode test si "test" est passé en paramètre

# Détecter le mode test
if [ "$1" = "test" ] || [ "$1" = "--test" ]; then
    USE_TEST_MODE=true
    echo "🔄 Redémarrage de FOMO MVP en MODE TEST..."
    echo "🧪 ATTENTION: Mode TEST activé (base de données de test)"
else
    USE_TEST_MODE=false
    echo "🔄 Redémarrage de FOMO MVP (PRODUCTION)..."
fi

# Arrêter les services
echo "🛑 Arrêt des services..."
bash -lc "/Users/eugene/Projects/FOMO\ MVP/fomo/stop.sh"

# Attendre un peu pour s'assurer que tout est bien arrêté
echo "⏳ Attente de l'arrêt complet..."
sleep 3

# Redémarrer les services
if [ "$USE_TEST_MODE" = "true" ]; then
    echo "🧪 Redémarrage des services en MODE TEST..."
    bash -lc "/Users/eugene/Projects/FOMO\ MVP/fomo/start.sh test"
else
    echo "🚀 Redémarrage des services (PRODUCTION)..."
    bash -lc "/Users/eugene/Projects/FOMO\ MVP/fomo/start.sh"
fi

# Afficher l'IP du réseau local pour les tests mobiles
echo ""
echo "📱 Pour tester avec votre téléphone, utilisez l'IP du réseau local affichée ci-dessus"
echo "   Assurez-vous que votre téléphone est sur le même réseau WiFi"
if [ "$USE_TEST_MODE" = "true" ]; then
    echo "🧪 Mode: TEST (base de données de test)"
fi
