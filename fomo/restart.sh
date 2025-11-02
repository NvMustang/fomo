#!/bin/bash

# 🔄 Script de redémarrage FOMO MVP
# Arrête puis redémarre tous les services

echo "🔄 Redémarrage de FOMO MVP..."

# Arrêter les services
echo "🛑 Arrêt des services..."
bash -lc "/Users/eugene/Projects/FOMO\ MVP/fomo/stop.sh"

# Attendre un peu pour s'assurer que tout est bien arrêté
echo "⏳ Attente de l'arrêt complet..."
sleep 3

# Redémarrer les services
echo "🚀 Redémarrage des services..."
bash -lc "/Users/eugene/Projects/FOMO\ MVP/fomo/start.sh"

# Afficher l'IP du réseau local pour les tests mobiles
echo ""
echo "📱 Pour tester avec votre téléphone, utilisez l'IP du réseau local affichée ci-dessus"
echo "   Assurez-vous que votre téléphone est sur le même réseau WiFi"
