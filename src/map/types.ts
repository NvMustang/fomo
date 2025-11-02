/**
 * FOMO MVP - MapView Types
 *
 * Types partagés entre les implémentations web et React Native
 */

import type { Event } from '@/types/fomoTypes'

// ===== TYPES GEOJSON =====
export interface Point {
  type: 'Point'
  coordinates: [number, number] // [longitude, latitude]
}

export interface Feature<T = any> {
  type: 'Feature'
  geometry: Point
  properties: T
}

export interface FeatureCollection<T = any> {
  type: 'FeatureCollection'
  features: Feature<T>[]
}

export type BBox = [number, number, number, number] // [west, south, east, north]

// ===== TYPES DE BASE =====
export interface MapViewRegion {
  latitude: number
  longitude: number
  latitudeDelta: number
  longitudeDelta: number
}

export interface MapViewCoordinate {
  latitude: number
  longitude: number
}


// ===== PROPS DU COMPOSANT =====
export interface MapViewProps {
  // Données
  events: Event[]
  userResponses?: Record<string, string | null> // eventId -> response (peut être null)

  // Callbacks
  onEventClick?: (event: Event | null) => void
  onClusterClick?: (cluster: any) => void
  onMapReady?: () => void

  // Auto-centrer sur un événement au chargement
  autoCenterEvent?: Event | null

  // Style
  style?: React.CSSProperties

  // Props HTML/RN
  testID?: string
}


