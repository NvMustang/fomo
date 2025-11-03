#!/bin/bash

# 🔄 Script de redémarrage FOMO MVP
# Arrête puis redémarre tous les services

echo "🔄 Redémarrage de FOMO MVP..."
echo ""

# Arrêter les services

bash -lc "/Users/eugene/Projects/FOMO\ MVP/fomo/stop.sh"

# Attendre un peu pour s'assurer que tout est bien arrêté
echo "⏳ Attente de l'arrêt complet..."
echo ""
sleep 3

# Redémarrer les services
echo "🚀 Redémarrage des services..."
echo ""
bash -lc "/Users/eugene/Projects/FOMO\ MVP/fomo/start.sh"
