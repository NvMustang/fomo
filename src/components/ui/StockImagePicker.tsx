/**
 * FOMO MVP - Stock Image Picker
 * 
 * Composant pour sélectionner des images gratuites depuis Pexels
 * Plus généreux qu'Unsplash (200 requêtes/heure vs 50)
 */

import React, { useState, useEffect, useCallback } from 'react'

interface StockImage {
  id: string
  src: {
    medium: string
    large: string
    original: string
  }
  alt: string
  photographer: string
  photographer_url: string
}

interface StockImagePickerProps {
  onImageSelect: (imageUrl: string, imageData: StockImage) => void
  onClose: () => void
  isOpen: boolean
}

export const StockImagePicker: React.FC<StockImagePickerProps> = ({
  onImageSelect,
  onClose,
  isOpen
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [images, setImages] = useState<StockImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<StockImage | null>(null)

  // Clé API Pexels (gratuite, 200 requêtes/heure)
  // Utilise VITE_PEXELS_API_KEY depuis les variables d'environnement
  // Fallback pour le développement local (à supprimer en production)
  const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY || 'h1mxKSN4dnwZaR4XTLfAZTAcjlzzJkNgnAkWjeQmBQrknFdg5NVr21sX'

  // Rechercher des images
  const searchImages = useCallback(async (query: string) => {
    if (!query.trim()) return


    setError(null)

    try {
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=10&orientation=landscape`,
        {
          headers: {
            'Authorization': PEXELS_API_KEY
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Erreur API Pexels: ${response.status}`)
      }

      const data = await response.json()
      console.log('Pexels API response:', data)

      if (data.photos && Array.isArray(data.photos)) {
        setImages(data.photos)
      } else {
        console.error('Invalid Pexels API response structure:', data)
        setImages([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la recherche')
      setImages([])
    }
  }, [PEXELS_API_KEY])

  // Recherche initiale avec des images populaires
  useEffect(() => {
    if (isOpen && images.length === 0) {
      searchImages('party event')
    }
  }, [isOpen, images.length, searchImages])

  // Recherche automatique avec délai (1,5s après la dernière frappe)
  useEffect(() => {
    if (!isOpen) return
    const trimmed = searchQuery.trim()
    if (!trimmed) return

    const timerId = setTimeout(() => {
      searchImages(trimmed)
    }, 1000)

    return () => clearTimeout(timerId)
  }, [searchQuery, isOpen, searchImages])

  // Gérer la sélection d'image
  const handleImageSelect = (image: StockImage) => {
    setSelectedImage(image)
    onImageSelect(image.src.large, image)
    onClose()
  }

  // Gérer la recherche
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      searchImages(searchQuery)
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="modal_overlay" onClick={(e) => { e.stopPropagation(); onClose() }}>
      <div className="modal_container">
        <div
          className="modal"
          onClick={e => e.stopPropagation()}
        >
          {/* Contenu */}
          <div className="modal-content">
            <div className="modal-form">
              {/* Barre de recherche */}
              <form onSubmit={handleSearch} className="form-section">
                <label className="form-label">Rechercher des images</label>
                <div className="search-input-group">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Rechercher (party, event, celebration...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />

                </div>
              </form>

              {/* Message d'erreur */}
              {error && (
                <div className="form-section">
                  <p className="form-help">⚠️ {error}</p>
                </div>
              )}

              {/* Grille d'images */}
              <div className="form-section">
                <label className="form-label">Choisissez parmi la galerie</label>
                <div className="stock--image-picker">
                  <div className="stock-image-grid">
                    {images.map((image) => (
                      <div
                        key={image.id}
                        className={`stock-image-item ${selectedImage?.id === image.id ? 'selected' : ''}`}
                        onClick={() => handleImageSelect(image)}
                      >
                        <img
                          src={image.src.medium}
                          alt={image.alt || 'Image Pexels'}
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>


              </div>
            </div>
          </div>
        </div>


      </div>
    </div>
  )
}

export default StockImagePicker
