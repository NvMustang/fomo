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

// Propriétés d'un Event dans une Feature GeoJSON
export interface EventFeatureProperties {
  id: string
  title: string
  startsAt: string
  endsAt: string
  venue: Event['venue']
  tags: string[]
  coverUrl: string
  description: string
  organizerId: string
  organizerName?: string
  price?: string
  ticketUrl?: string
  isPublic?: boolean
  isOnline?: boolean
  capacity?: number
  isFake?: boolean
  userResponse?: string | null
}

export interface Feature<T = EventFeatureProperties> {
  type: 'Feature'
  geometry: Point
  properties: T
}

export interface FeatureCollection<T = EventFeatureProperties> {
  type: 'FeatureCollection'
  features: Feature<T>[]
}

// Type pour les clusters MapLibre
export interface ClusterProperties {
  cluster: boolean
  cluster_id: number
  point_count: number
  point_count_abbreviated: string
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
  filteredEvents: Event[] // Événements filtrés à afficher

  // Callbacks
  onPinClick?: (event: Event | null) => void
  onClusterClick?: (cluster: Feature<ClusterProperties>) => void
  onMapReady?: () => void

  // Auto-centrer sur un événement au chargement
  autoCenterEvent?: Event | null
  onPinCentered?: () => void

  // Style
  style?: React.CSSProperties

  // Props HTML/RN
  testID?: string
}


