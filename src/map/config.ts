/**
 * Map configuration - Static config for MapLibre and clusters
 */

export const MAP_CONFIG = {
  defaultStyle: {
    version: 8 as const,
    name: "FOMO Winter",
    sources: {
      "maptiler-winter": {
        type: "raster" as const,
        tiles: [
          `https://api.maptiler.com/maps/pastel/{z}/{x}/{y}.png?key=${import.meta.env.VITE_MAPLIBRE_ACCESS_TOKEN}`
        ],
        tileSize: 256,
        attribution: "© MapTiler © OpenStreetMap contributors",
      },
    },
    layers: [
      {
        id: "maptiler-winter",
        type: "raster" as const,
        source: "maptiler-winter",
        paint: {
          "raster-opacity": 1,
        },
      },
    ],
    glyphs: `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${import.meta.env.VITE_MAPLIBRE_ACCESS_TOKEN}`,
  },

  defaultRegion: {
    latitude: 50.5000, // Bastogne, Belgique
    longitude: 5,
    latitudeDelta: 1,
    longitudeDelta: 1,
  },
}

/**
 * Configuration commune pour les clusters (layers ET sources)
 */
export const CLUSTER_CONFIG = {
  // Configuration de la source GeoJSON
  source: {
    enabled: true,
    radius: 25,      // Rayon réduit : les pins doivent être très proches pour se clusteriser
    maxZoom: 13,      // Zoom maximum augmenté : les clusters persistent jusqu'à zoom 13 pour éviter les chevauchements
    properties: {
      scoreSum: ["+", ["get", "score"]], // Cumule un indicateur d'intérêt
    },
  },
  // Configuration des layers de rendu
  layers: {
    radius: [
      "interpolate",
      ["linear"],
      ["get", "point_count"],
      2, 16,    // 2 événements = 16px
      5, 20,    // 5 événements = 20px
      10, 28,   // 10 événements = 28px
      25, 36,   // 25 événements = 36px
      50, 44,   // 50 événements = 44px
      100, 52,  // 100+ événements = 52px
      250, 60   // 250+ événements = 60px
    ],
    opacity: 0.3,
    blur: 0.6,
    textSize: 14,
  },
}

