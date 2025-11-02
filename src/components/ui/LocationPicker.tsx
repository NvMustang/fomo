/**
 * FOMO MVP - Location Picker Component
 * 
 * Composant pour sélectionner un lieu avec un pin fixe au centre de l'écran
 */

import React, { useState, useCallback, useEffect } from 'react'

interface LocationPickerProps {
    isOpen: boolean
    onClose: () => void
    onLocationSelect: (location: { latitude: number; longitude: number; address: string }) => void
    initialLocation?: { latitude: number; longitude: number }
}

export const LocationPicker: React.FC<LocationPickerProps> = ({
    isOpen,
    onClose,
    onLocationSelect,
    initialLocation = { latitude: 50.005, longitude: 5.74 }
}) => {
    const [isLoading, setIsLoading] = useState(false)
    const [currentCenter, setCurrentCenter] = useState(initialLocation)

    // Convertir les coordonnées en adresse (reverse geocoding)
    const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
        try {
            // Pour l'instant, on retourne juste les coordonnées
            // Le reverse geocoding via Mapbox nécessiterait un endpoint backend dédié
            console.log(`Reverse géocodage de ${lat}, ${lng} - non implémenté avec Mapbox`)
            return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        } catch (error) {
            console.error('Erreur reverse geocoding:', error)
            return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
        }
    }, [])

    // Écouter les changements de position de la carte
    useEffect(() => {
        if (!isOpen) return

        const handleMapMove = () => {
            // Récupérer la position actuelle de la carte depuis l'élément DOM
            const mapElement = document.querySelector('.maplibregl-map')
            if (mapElement) {
                const mapInstance = (mapElement as any)._map
                if (mapInstance) {
                    const center = mapInstance.getCenter()
                    setCurrentCenter({
                        latitude: center.lat,
                        longitude: center.lng
                    })
                }
            }
        }

        // Écouter les événements de mouvement de la carte
        const mapElement = document.querySelector('.maplibregl-map')
        if (mapElement) {
            const mapInstance = (mapElement as any)._map
            if (mapInstance) {
                mapInstance.on('moveend', handleMapMove)
                mapInstance.on('dragend', handleMapMove)

                return () => {
                    mapInstance.off('moveend', handleMapMove)
                    mapInstance.off('dragend', handleMapMove)
                }
            }
        }
    }, [isOpen])

    // Confirmer la sélection
    const handleConfirm = useCallback(async () => {
        setIsLoading(true)
        try {
            const address = await reverseGeocode(currentCenter.latitude, currentCenter.longitude)
            onLocationSelect({
                latitude: currentCenter.latitude,
                longitude: currentCenter.longitude,
                address
            })
            onClose()
        } catch (error) {
            console.error('Erreur lors de la confirmation:', error)
        } finally {
            setIsLoading(false)
        }
    }, [currentCenter, reverseGeocode, onLocationSelect, onClose])

    if (!isOpen) return null

    return (
        <div className="location-picker-overlay">
            {/* Pin fixe au centre de l'écran */}
            <div className="location-picker-pin">
                <img
                    src="/pin.png"
                    alt="Pin de sélection"
                    style={{
                        width: '32px',
                        height: '32px',
                        filter: 'brightness(0) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(346deg) brightness(104%) contrast(97%)'
                    }}
                />
            </div>

            {/* Instructions flottantes */}
            <div className="location-picker-instructions">
                <p>Déplacez la carte pour positionner le pin sur votre lieu</p>
            </div>

            {/* Informations de sélection */}
            <div className="location-picker-info">
                <p><strong>Coordonnées:</strong> {currentCenter.latitude.toFixed(6)}, {currentCenter.longitude.toFixed(6)}</p>
                {isLoading && <p>Récupération de l'adresse...</p>}
            </div>

            {/* Boutons d'action */}
            <div className="location-picker-actions">
                <button className="button secondary" onClick={onClose}>
                    Annuler
                </button>
                <button
                    className="button primary"
                    onClick={handleConfirm}
                    disabled={isLoading}
                >
                    {isLoading ? 'Chargement...' : 'Confirmer'}
                </button>
            </div>
        </div>
    )
}
