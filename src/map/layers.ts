/**
 * Map layers - Layer creation for MapLibre (clusters, pins, etc.)
 */

import { CLUSTER_CONFIG } from './config'
import { getCSSVariable, getPrivacyColor } from './utils'

export interface Layer {
  id: string
  type: string
  source: string
  filter?: any[]
  paint?: Record<string, any>
  layout?: Record<string, any>
  [key: string]: any
}

/**
 * Génère les 3 layers pour une source de clustering (cluster, cluster-count, unclustered)
 */
export const createClusterLayers = (
  sourceId: string,
  layerPrefix: string,
  clusterColor: string,
  pinColor: any,
  pinOpacity: any
): Layer[] => {
  return [
    // CLUSTERS (cercles)
    {
      id: `${layerPrefix}-cluster`,
      type: "circle",
      source: sourceId,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": ['step', ['get', 'point_count'], clusterColor, 100, clusterColor, 750, clusterColor],
        "circle-radius": CLUSTER_CONFIG.layers.radius,
        "circle-opacity": CLUSTER_CONFIG.layers.opacity,
        "circle-blur": CLUSTER_CONFIG.layers.blur,
      },
      layout: {},
    },
    // TEXTE DES CLUSTERS
    {
      id: `${layerPrefix}-cluster-count`,
      type: "symbol",
      source: sourceId,
      filter: ["has", "point_count"],
      paint: {
        "text-color": "#FFFFFF",
        "text-halo-color": "rgba(0, 0, 0, 0.5)",
        "text-halo-width": 1,
        "text-opacity": 1,
      },
      layout: {
        "text-field": "{point_count}",
        "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        "text-size": CLUSTER_CONFIG.layers.textSize,
        "text-allow-overlap": true,
        "text-ignore-placement": true
      },
    },
    // PINS individuels (non clusterisés)
    {
      id: `${layerPrefix}-${layerPrefix === "events" ? "unclustered" : "pins"}`,
      type: "symbol",
      source: sourceId,
      filter: ["!", ["has", "point_count"]],
      layout: {
        "icon-image": "pin",
        "icon-anchor": "bottom",
        "icon-allow-overlap": true,
        "icon-ignore-placement": true
      },
      paint: {
        "icon-color": pinColor,
        "icon-opacity": pinOpacity
      }
    },
  ]
}

/**
 * Génère l'expression de couleur des pins avec logique de réponses utilisateur
 */
export const getPinColorExpression = (basePinColor: string) => {
  // Récupérer la réponse avec fallback sur chaîne vide si absente
  const getUserResponse = ["coalesce", ["feature-state", "userResponse"], ["get", "userResponse"], ""]
  
  return [
    "case",
    [
      "any",
      ["==", getUserResponse, "seen"],
      ["==", getUserResponse, "cleared"],
      ["==", getUserResponse, "not_there"],
      ["==", getUserResponse, "not_interested"]
    ],
    getCSSVariable('--pin-color-seen', '#64748b'),
    basePinColor
  ]
}

/**
 * Génère l'expression d'opacité des pins avec logique de réponses utilisateur
 * Inclut un effet de pulse pour "linked" et "invited"
 */
export const getPinOpacityExpression = () => {
  // Récupérer la réponse avec fallback sur chaîne vide si absente
  const getUserResponse = ["coalesce", ["feature-state", "userResponse"], ["get", "userResponse"], ""]

  // Opacité de base selon la réponse
  const baseOpacity = [
    "case",
    ["==", getUserResponse, "participe"], 0.8,
    ["==", getUserResponse, "going"], 0.8,
    ["==", getUserResponse, "maybe"], 0.6,
    ["==", getUserResponse, "interested"], 0.6,
    [
      "any",
      ["==", getUserResponse, "seen"],
      ["==", getUserResponse, "cleared"]
    ], 0.8,
    ["==", getUserResponse, "not_there"], 0.2,
    ["==", getUserResponse, "not_interested"], 0.2,
    1.0
  ]

  // Pour "linked" et "invited", utiliser directement le feature-state "pulse" comme opacité
  // L'animation dans MapRenderer met directement la valeur d'opacité (0.2 à 1.0) dans "pulse"
  // Si pulse n'existe pas encore, utiliser 0.2 (opacité minimale) comme valeur par défaut
  // Pour les autres réponses, utiliser l'opacité de base normale
  return [
    "case",
    [
      "any",
      ["==", getUserResponse, "linked"],
      ["==", getUserResponse, "invited"]
    ],
    ["coalesce", ["feature-state", "pulse"], 0.2], // Pulse direct pour linked/invited, défaut 0.2 (opacité minimale)
    baseOpacity // Opacité normale pour les autres réponses
  ]
}

/**
 * Génère les couches pour les événements réels
 */
export const getEventLayers = (isPublicMode: boolean = true): Layer[] => {
  const clusterColor = getPrivacyColor(isPublicMode)
  const basePinColor = getPrivacyColor(isPublicMode)
  const pinColor = getPinColorExpression(basePinColor)
  const pinOpacity = getPinOpacityExpression()

  return createClusterLayers("events", "events", clusterColor, pinColor, pinOpacity)
}

/**
 * Génère les couches pour les fake pins avec animation pop
 */
export const getFakeEventLayers = (isPublicMode: boolean = true): Layer[] => {
  const clusterColor = getPrivacyColor(isPublicMode)
  const basePinColor = getPrivacyColor(isPublicMode)
  const pinColor = getPinColorExpression(basePinColor)
  const basePinOpacity = getPinOpacityExpression()

  const baseLayers = createClusterLayers("fake-events", "fake-events", clusterColor, pinColor, basePinOpacity)

  // Modifier le layer pins pour combiner l'opacité avec l'animation 'pop'
  const pinsLayer = baseLayers.find(l => l.id === 'fake-events-pins')
  if (pinsLayer && pinsLayer.paint) {
    const popMultiplier = [
      'interpolate',
      ['linear'],
      ['coalesce', ['feature-state', 'pop'], 0],
      0, 0.7,
      0.3, 1.0,
      0.7, 1.0,
      1, 0.7
    ]

    pinsLayer.paint['icon-opacity'] = ['*', basePinOpacity, popMultiplier]
  }

  return baseLayers
}

