
/**
 * FOMO MVP - Create Event Modal
 *
 * Modal de création d'événement respectant les règles CSS du projet
 */

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Button } from '@/components'
import { usePrivacy } from '@/contexts/PrivacyContext'
import type { Event } from '@/types/fomoTypes'
import { AddressAutocomplete } from '@/components/AddressAutocomplete'
import { useFomoDataContext } from '@/contexts/FomoDataProvider'
import type { Tag } from '@/types/fomoTypes'
import { useToast } from '@/hooks'
import { useAuth } from '@/contexts/AuthContext'
import { getUser } from '@/utils/filterTools'
import { StockImagePicker } from '@/components/ui/StockImagePicker'
import { FomoDatePicker } from '@/components/ui/DatePicker'
import { format, addHours } from 'date-fns'
import CreatableSelect from 'react-select/creatable'
import { toZonedTime } from 'date-fns-tz'

interface CreateEventModalProps {
  isOpen: boolean
  onClose: () => void
  editMode?: boolean
  initialEvent?: Event | null
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({ isOpen, onClose, editMode = false, initialEvent }) => {
  const { isPublicMode } = usePrivacy()
  const { user, isPublicUser } = useAuth()
  const { createEvent, updateEvent, getTags, addEventResponse, users } = useFomoDataContext()
  const { showToast } = useToast()

  // Fonctions pour gérer les toasts avec le système unifié
  const showError = (message: string) => {
    showToast({
      title: 'Erreur',
      message,
      type: 'error',
      duration: 2000
    })
  }


  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('modal-open')
    }
  }, [isOpen])

  // Fonction pour obtenir la date/heure actuelle au format datetime-local
  const getCurrentDateTime = () => {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const now = toZonedTime(new Date(), userTimezone)
    return format(now, "yyyy-MM-dd'T'HH:mm")
  }

  // Obtenir la date et l'heure actuelles (logique du CreateEventScreen React Native)
  const currentDateTime = getCurrentDateTime() // Utiliser la fonction qui respecte le fuseau horaire local

  // Pré-remplir endDateTime avec startDateTime + 6h par défaut
  const getDefaultEndDateTime = (startDate: string) => {
    const start = new Date(startDate)
    const end = addHours(start, 6) // +6h avec date-fns
    return format(end, "yyyy-MM-dd'T'HH:mm")
  }

  // Fonction pour formater une date ISO en format datetime-local
  const formatDateForInput = (isoDate: string) => {
    const date = new Date(isoDate)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  // États du formulaire (adaptés du CreateEventScreen React Native)
  const [title, setTitle] = useState(editMode && initialEvent ? initialEvent.title : '')
  const [startDateTime, setStartDateTime] = useState(
    editMode && initialEvent ? formatDateForInput(initialEvent.startsAt) : currentDateTime
  )
  const [endDateTime, setEndDateTime] = useState(
    editMode && initialEvent ? formatDateForInput(initialEvent.endsAt) : getDefaultEndDateTime(currentDateTime)
  )
  const [showEndTime, setShowEndTime] = useState(editMode && initialEvent ? true : false)
  const [venue, setVenue] = useState(editMode && initialEvent ? initialEvent.venue.address : '')
  // Tags à venir: on retirera totalement les catégories
  const [description, setDescription] = useState(editMode && initialEvent ? initialEvent.description : '')
  const [coverImage, setCoverImage] = useState<string | null>(null)
  const [coverImageUrl, setCoverImageUrl] = useState<string>(editMode && initialEvent ? initialEvent.coverUrl : '')
  const [imagePosition, setImagePosition] = useState<{ x: number; y: number }>(
    editMode && initialEvent?.coverImagePosition ? initialEvent.coverImagePosition : { x: 50, y: 50 }
  )
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; imageX: number; imageY: number } | null>(null)
  const [externalOrganizerName, setExternalOrganizerName] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [isImagePickerOpen, setIsImagePickerOpen] = useState(false)
  // Tags (max 10, strings)
  type TagOption = { label: string; value: string }
  const [selectedTagOptions, setSelectedTagOptions] = useState<TagOption[]>(
    editMode && initialEvent && Array.isArray(initialEvent.tags)
      ? initialEvent.tags.slice(0, 10).map(t => ({ label: t, value: t }))
      : []
  )

  // Tags depuis la feuille Google (via data manager, avec cache localStorage)
  const [allTags, setAllTags] = useState<Tag[]>([])

  useEffect(() => {
    let mounted = true
    if (isOpen) {
      getTags()
        .then(tags => { if (mounted) setAllTags(tags || []) })
        .catch(() => { /* silencieux: suggestions vides si échec */ })
    }
    return () => { mounted = false }
  }, [isOpen, getTags])

  const tagSuggestionOptions: TagOption[] = useMemo(() => {
    const set = new Set<string>()
    // Prendre les plus populaires en premier si usage_count présent
    const sorted = [...allTags].sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
    for (const t of sorted) {
      const normalized = String(t.tag).trim().toLowerCase()
      if (normalized) set.add(normalized)
    }
    // Inclure les tags sélectionnés pour éviter de les perdre
    for (const t of selectedTagOptions) set.add(t.value)
    return Array.from(set).map(v => ({ label: `#${v}`, value: v }))
  }, [allTags, selectedTagOptions])

  // États pour la localisation
  const [selectedLocation, setSelectedLocation] = useState({
    latitude: 50.005,
    longitude: 5.74,
    address: '',
  })

  // Validation en temps réel
  const [dateError, setDateError] = useState('')

  // Réinitialiser les champs quand le modal s'ouvre avec un événement à modifier
  useEffect(() => {
    if (isOpen && editMode && initialEvent) {
      // Pré-remplir tous les champs avec les données de l'événement
      setTitle(initialEvent.title)
      setStartDateTime(formatDateForInput(initialEvent.startsAt))
      setEndDateTime(formatDateForInput(initialEvent.endsAt))
      setShowEndTime(true)
      setVenue(initialEvent.venue.address)
      setDescription(initialEvent.description || '')
      setCoverImageUrl(initialEvent.coverUrl || '')
      setImagePosition(initialEvent.coverImagePosition || { x: 50, y: 50 })
      setSelectedTagOptions(
        Array.isArray(initialEvent.tags)
          ? initialEvent.tags.slice(0, 10).map(t => ({ label: t, value: t }))
          : []
      )
      setSelectedLocation({
        latitude: initialEvent.venue.lat || 50.005,
        longitude: initialEvent.venue.lng || 5.74,
        address: initialEvent.venue.address || '',
      })
      if (user?.isAmbassador) {
        // Récupérer le nom depuis users, sinon fallback sur organizerName (pour compatibilité avec anciens événements)
        const organizer = initialEvent.organizerId ? getUser(users || [], initialEvent.organizerId) : undefined
        setExternalOrganizerName(organizer?.name || initialEvent.organizerName || '')
      }
    } else if (isOpen && !editMode) {
      // Réinitialiser pour mode création
      setTitle('')
      setStartDateTime(currentDateTime)
      setEndDateTime(getDefaultEndDateTime(currentDateTime))
      setShowEndTime(false)
      setVenue('')
      setDescription('')
      setCoverImage(null)
      setCoverImageUrl('')
      setImagePosition({ x: 50, y: 50 })
      setSelectedTagOptions([])
      setSelectedLocation({
        latitude: 50.005,
        longitude: 5.74,
        address: '',
      })
      setExternalOrganizerName('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editMode, initialEvent])

  // Fonction de validation des dates en temps réel (sans toast)
  const validateDates = (startDate: string, endDate: string) => {
    if (!startDate.trim()) {
      setDateError('')
      return
    }

    const start = new Date(startDate)
    const now = new Date()

    // Comparer seulement les jours (pas les heures)
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    if (startDay < today) {
      setDateError("La date de début doit être aujourd'hui ou dans le futur")
      return
    }

    if (endDate.trim()) {
      const end = new Date(endDate)
      if (end <= start) {
        setDateError("L'heure de fin doit être après l'heure de début")
        return
      }
    }

    setDateError('')
  }

  // Fonction de validation avec toast (appelée lors de la validation finale)
  const validateDatesWithToast = (startDate: string, endDate: string) => {
    if (!startDate.trim()) {
      setDateError('')
      return true
    }

    const start = new Date(startDate)
    const now = new Date()

    // Comparer seulement les jours (pas les heures)
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    if (startDay < today) {
      setDateError("La date de début doit être aujourd'hui ou dans le futur")
      showError("Veuillez sélectionner une date d'aujourd'hui ou dans le futur pour votre événement")
      // Remettre la date actuelle dans le champ
      setStartDateTime(getCurrentDateTime())
      // Mettre à jour aussi endDateTime avec la nouvelle date + 6h
      setEndDateTime(getDefaultEndDateTime(getCurrentDateTime()))
      return false
    }

    if (endDate.trim()) {
      const end = new Date(endDate)
      if (end <= start) {
        setDateError("L'heure de fin doit être après l'heure de début")
        showError("L'heure de fin doit être postérieure à l'heure de début de votre événement")
        // Remettre une heure de fin valide (6h après le début)
        setEndDateTime(getDefaultEndDateTime(startDate))
        return false
      }
    }

    setDateError('')
    return true
  }

  // Validation des dates au chargement initial
  useEffect(() => {
    if (startDateTime) {
      validateDates(startDateTime, endDateTime)
    }
  }, [startDateTime, endDateTime])

  // Gestion du drag de l'image pour le positionnement
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return

      const container = document.querySelector('.image-preview-container') as HTMLElement
      if (!container) return

      const rect = container.getBoundingClientRect()
      // Calculer le delta en pourcentage (inversé pour que l'image suive le mouvement naturel)
      const deltaX = ((e.clientX - dragStartRef.current.x) / rect.width) * 100
      const deltaY = ((e.clientY - dragStartRef.current.y) / rect.height) * 100

      // Appliquer le delta inversé à la position de départ
      const newX = dragStartRef.current.imageX - deltaX
      const newY = dragStartRef.current.imageY - deltaY

      setImagePosition({
        x: Math.max(0, Math.min(100, newX)),
        y: Math.max(0, Math.min(100, newY))
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])



  // Gestion de la sélection d'adresse
  const handleAddressSelect = (addressData: { address: string; lat: number; lng: number }) => {
    setSelectedLocation({
      latitude: addressData.lat,
      longitude: addressData.lng,
      address: addressData.address
    })
    setVenue(addressData.address)
  }

  // Gestion du toggle pour l'heure de fin
  const toggleEndTime = () => {
    setShowEndTime(!showEndTime)
    if (showEndTime) {
      setEndDateTime('') // Réinitialiser si on masque
    }
  }


  // Gestion de la soumission du formulaire (logique du CreateEventScreen React Native)
  const handleSubmit = async () => {
    if (!title.trim()) {
      showError('Veuillez donner un nom à votre événement')
      return
    }

    if (!startDateTime.trim()) {
      showError("Veuillez sélectionner une date et une heure pour votre événement")
      return
    }

    // Vérifier les dates avec toast
    if (!validateDatesWithToast(startDateTime, endDateTime)) {
      return
    }

    if (!venue.trim()) {
      showError('Veuillez sélectionner un lieu pour votre événement')
      return
    }

    // Catégories retirées (on passera aux tags)

    if (!description.trim()) {
      showError('Veuillez ajouter une description pour votre événement')
      return
    }

    if (user?.isAmbassador && !externalOrganizerName.trim()) {
      showError('Veuillez indiquer le nom de l\'organisateur pour cet événement')
      return
    }

    setLoading(true)

    try {
      // Conversion en Date objects (utilise le fuseau horaire local de l'utilisateur)
      const startDate = new Date(startDateTime)
      const endDate = endDateTime
        ? new Date(endDateTime)
        : new Date(startDate.getTime() + 6 * 60 * 60 * 1000) // 6 heures par défaut

      const eventData = {
        title: title.trim(),
        // Conversion en UTC pour le stockage (toISOString() gère automatiquement le fuseau horaire)
        startsAt: startDate.toISOString(),
        endsAt: endDate.toISOString(),
        venue: {
          name: venue.trim(),
          address: venue.trim(),
          lat: selectedLocation.latitude,
          lng: selectedLocation.longitude,
        },
        tags: selectedTagOptions.map(t => t.value),
        coverUrl:
          coverImageUrl || coverImage ||
          'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&h=300&fit=crop&crop=center',
        coverImagePosition: imagePosition,
        description: description.trim(),
        organizerId: user?.isAmbassador ? `amb_${user.id}` : (user?.id || 'user-unknown'),
        organizerName: user?.isAmbassador ? externalOrganizerName.trim() : (user?.name || 'Utilisateur inconnu'),
        stats: {
          going: 0,
          interested: 0,
          friendsGoing: 0,
          goingCount: 0,
          interestedCount: 0,
          notInterestedCount: 0,
          totalResponses: 0,
          friendsGoingCount: 0,
          friendsInterestedCount: 0,
          friendsGoingList: '',
          friendsInterestedList: '',
        },
        isPublic: (isPublicUser && isPublicMode) ? true : false,
        isOnline: true, // Tous les événements créés via l'app sont en ligne
      }

      // Ajouter l'événement temporaire à la map immédiatement
      const tempEvent = { ...eventData, id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}` }
      if ((window as any).addTemporaryEventToMap) {
        (window as any).addTemporaryEventToMap(tempEvent, isPublicMode)
      }

      if (editMode && initialEvent) {
        // Mode édition
        const updatedEvent = await updateEvent(initialEvent.id, { ...initialEvent, ...eventData })

        if (!updatedEvent || !updatedEvent.id) {
          throw new Error('Événement non modifié - réponse invalide du serveur')
        }
      } else {
        // Mode création
        const newEvent = await createEvent(eventData)

        if (!newEvent || !newEvent.id) {
          throw new Error('Événement non créé - réponse invalide du serveur')
        }

        // Ajouter automatiquement la réponse de l'utilisateur créateur avec statut "invited"
        if (user?.id && addEventResponse) {
          addEventResponse(newEvent.id, 'invited')
        }
      }



      setLoading(false)

      // Fermer le modal immédiatement
      onClose()


      // Réinitialiser le formulaire
      setTitle('')
      setStartDateTime(currentDateTime)
      setEndDateTime(getDefaultEndDateTime(currentDateTime))
      setShowEndTime(false)
      setVenue('')
      // reset tags quand ils seront ajoutés
      setDescription('')
      setCoverImage(null)
      setCoverImageUrl('')
      setImagePosition({ x: 50, y: 50 })
      setSelectedTagOptions([])


      // Optionnel : ouvrir les détails de l'événement créé
      // openEventDetailsModal(newEvent.id);
    } catch (error) {
      console.error('❌ Erreur lors de la création de l\'événement:', error)
      setLoading(false)
      showError("Impossible de créer l'événement. Réessayez.")
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal_overlay" onClick={onClose}>
      <div className="modal_container">
        <div
          className={`modal ${isPublicMode ? 'public' : 'private'}`}
          onClick={e => e.stopPropagation()}
        >
          {/* Contenu */}
          <div className="modal-content">
            {/* Message de restriction pour les profils privés */}
            {!isPublicUser && isPublicMode && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',

                }}
              >

                <div style={{ display: 'flex', flexDirection: 'column', }}>
                  <div style={{ fontWeight: 600, fontSize: '18px' }}>  🚫 Événements publics interdits</div>
                  <br />
                  <div style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
                    La création d'événements publics est réservée aux utilisateurs publics.
                    <br />
                    <br />
                    Passez en mode privé pour créer votre événement privé.
                  </div>
                </div>
              </div>
            )}

            {/* Formulaire - seulement si pas de restriction */}
            {!(!isPublicUser && isPublicMode) && (
              <div className="modal-form">
                {/* Sélection d'image */}
                <div className="form-section">
                  {!coverImageUrl ? (
                    <button
                      type="button"
                      onClick={() => setIsImagePickerOpen(true)}
                      className="banner-selector-btn"
                    >
                      <span className="banner-icon">🎨</span>
                      <span className="banner-text">Sélectionner une bannière</span>
                    </button>
                  ) : (
                    <div className="image-preview-container">
                      <img
                        src={coverImageUrl}
                        alt="Cover"
                        className={`image-preview ${isDragging ? 'dragging' : ''}`}
                        style={{
                          objectPosition: `${imagePosition.x}% ${imagePosition.y}%`
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          dragStartRef.current = {
                            x: e.clientX,
                            y: e.clientY,
                            imageX: imagePosition.x,
                            imageY: imagePosition.y
                          }
                          setIsDragging(true)
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          const touch = e.touches[0]
                          dragStartRef.current = {
                            x: touch.clientX,
                            y: touch.clientY,
                            imageX: imagePosition.x,
                            imageY: imagePosition.y
                          }
                          setIsDragging(true)
                        }}
                        onTouchMove={(e) => {
                          if (!isDragging || !dragStartRef.current) return
                          e.preventDefault()
                          const container = e.currentTarget.parentElement
                          if (!container) return

                          const touch = e.touches[0]
                          const rect = container.getBoundingClientRect()

                          // Calculer le delta en pourcentage (inversé pour que l'image suive le mouvement naturel)
                          const deltaX = ((touch.clientX - dragStartRef.current.x) / rect.width) * 100
                          const deltaY = ((touch.clientY - dragStartRef.current.y) / rect.height) * 100

                          // Appliquer le delta inversé à la position de départ
                          const newX = dragStartRef.current.imageX - deltaX
                          const newY = dragStartRef.current.imageY - deltaY

                          setImagePosition({
                            x: Math.max(0, Math.min(100, newX)),
                            y: Math.max(0, Math.min(100, newY))
                          })
                        }}
                        onTouchEnd={() => {
                          setIsDragging(false)
                          dragStartRef.current = null
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setCoverImageUrl('')
                          setImagePosition({ x: 50, y: 50 })
                        }}
                        className="image-remove-btn"
                        aria-label="Supprimer l'image"
                        title="Supprimer"
                      >
                        ✕
                      </button>
                      {coverImageUrl && (
                        <div className="image-position-hint">
                          Glissez l'image pour la repositionner
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Titre */}
                <div className="form-section">
                  <label className="form-label">Nom de l'événement *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Apéro chez..."
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                  />
                </div>

                {/* Tags */}
                <div className="form-section">
                  <label className="form-label">#Tags</label>
                  <CreatableSelect
                    isMulti
                    placeholder="#music, #afterwork, #family"
                    options={tagSuggestionOptions}
                    value={selectedTagOptions}
                    onChange={(options) => {
                      const next = (options ? Array.from(options) : []) as TagOption[]
                      // normaliser labels avec #, value sans #
                      const normalized = next.map(o => {
                        const v = String(o.value).replace(/^#+/, '').trim().toLowerCase()
                        return { label: `#${v}`, value: v }
                      })
                      setSelectedTagOptions(normalized.slice(0, 10))
                    }}
                    onCreateOption={(input) => {
                      const name = input.trim()
                      if (!name) return
                      // normaliser en minuscules, sans doubles espaces
                      const normalized = name.replace(/\s+/g, ' ').trim().toLowerCase().replace(/^#+/, '')
                      if (selectedTagOptions.find(t => t.value === normalized)) return
                      if (selectedTagOptions.length >= 10) return
                      setSelectedTagOptions([...selectedTagOptions, { label: `#${normalized}`, value: normalized }])
                    }}
                    noOptionsMessage={() => 'Aucun tag'}
                    isClearable={false}
                    // Limiter la création quand 10 tags
                    isDisabled={selectedTagOptions.length >= 10}
                    formatCreateLabel={(input) => `Créer #${input.replace(/^#+/, '')}`}
                    formatOptionLabel={(option) => option.label}
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        borderRadius: 'var(--radius)',
                        minHeight: 38,
                        borderWidth: 1,
                        borderStyle: 'solid',
                        borderColor: state.isFocused ? 'var(--current-color)' : 'var(--border)',
                        boxShadow: state.isFocused
                          ? '0 0 0 3px var(--current-color-10)'
                          : 'none',
                        outline: 'none',
                        '&:hover': {
                          borderColor: state.isFocused ? 'var(--current-color)' : 'var(--border)'
                        }
                      }),
                      menu: (base) => ({
                        ...base,
                        background: 'var(--bg, #fff)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius)',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                        zIndex: 10000,
                        overflow: 'hidden'
                      }),
                      menuList: (base) => ({
                        ...base,
                        maxHeight: 240,
                        overflowY: 'auto',
                        paddingTop: 0,
                        paddingBottom: 0
                      }),
                      option: (base, state) => ({
                        ...base,
                        padding: 12,
                        cursor: 'pointer',
                        borderBottom: '1px solid #f0f0f0',
                        backgroundColor: state.isFocused || state.isSelected ? 'var(--current-color-10)' : 'transparent',
                        color: 'inherit'
                      })
                    }}
                  />

                </div>

                {/* Champ organisateur externe pour les ambassadors */}
                {user?.isAmbassador && (
                  <div className="form-section">
                    <label className="form-label">Nom de l'organisateur *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Festival de Jazz, Restaurant XYZ, Association ABC..."
                      value={externalOrganizerName}
                      onChange={e => setExternalOrganizerName(e.target.value)}
                    />
                    <p className="form-help text-xs">
                      En tant qu'ambassador, vous créez cet événement pour une organisation externe
                    </p>
                  </div>
                )}

                {/* Date & Heure de début */}
                <div className="form-section">
                  <label className="form-label">Date et heure de début *</label>

                  <FomoDatePicker
                    selected={startDateTime ? new Date(startDateTime) : null}
                    onChange={(date) => {
                      if (date) {
                        const formattedDate = format(date, "yyyy-MM-dd'T'HH:mm")
                        setStartDateTime(formattedDate)
                        // Mettre à jour automatiquement endDateTime avec startDateTime + 6h
                        const newEndDateTime = getDefaultEndDateTime(formattedDate)
                        setEndDateTime(newEndDateTime)
                        validateDates(formattedDate, newEndDateTime)
                      }
                    }}
                    showTimeSelect
                    placeholder="Sélectionner la date et l'heure de début"
                    minDate={new Date()}
                    required
                    className="form-input"
                  />

                </div>

                {/* Toggle pour l'heure de fin */}
                <div className="form-section">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sm)' }}>
                    <span className="form-label" style={{ margin: 0 }}>Date et heure de fin</span>
                    <button
                      type="button"
                      className="button circular-button circular-button--xs"
                      aria-label={showEndTime ? 'Masquer la date de fin' : 'Afficher la date de fin'}
                      title={showEndTime ? 'Masquer' : 'Afficher'}
                      onClick={toggleEndTime}
                    >
                      <div className="icon-container" style={{ transform: showEndTime ? 'rotate(0deg)' : 'rotate(180deg)' }}>
                        <div className="plus-bar plus-bar-horizontal arrow-bar-left"></div>
                        <div className="plus-bar plus-bar-horizontal arrow-bar-right"></div>
                      </div>
                    </button>
                  </div>

                  {showEndTime && (
                    <div style={{ marginTop: 'var(--sm)' }}>
                      <FomoDatePicker
                        selected={endDateTime ? new Date(endDateTime) : null}
                        onChange={(date) => {
                          if (date) {
                            const formattedDate = format(date, "yyyy-MM-dd'T'HH:mm")
                            setEndDateTime(formattedDate)
                            validateDates(startDateTime, formattedDate)
                          }
                        }}
                        showTimeSelect
                        placeholder="Sélectionner la date et l'heure de fin"
                        minDate={startDateTime ? new Date(startDateTime) : new Date()}
                        className="form-input"
                      />
                    </div>
                  )}
                </div>

                {/* Lieu */}
                <div className="form-section">
                  <label className="form-label">Lieu *</label>
                  <AddressAutocomplete
                    value={venue}
                    onChange={setVenue}
                    onAddressSelect={handleAddressSelect}
                    placeholder="Ville, adresse"
                    className="form-input"
                  />
                </div>


                {/* Description */}
                <div className="form-section">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-input form-textarea"
                    placeholder="Décrivez votre événement..."
                    rows={6}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    required
                  />
                </div>



                {/* Bouton d'action */}
                <div className="form-section">
                  <div className="form-actions">
                    <Button className="response-button"
                      variant="primary"
                      onClick={handleSubmit}
                      disabled={loading || !title.trim() || !description.trim() || dateError !== ''}>
                      {loading ? (editMode ? 'Modification...' : 'Création...') : (editMode ? 'Enregistrer' : 'Créer')}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stock Image Picker Modal */}
        <StockImagePicker
          isOpen={isImagePickerOpen}
          onImageSelect={(imageUrl) => {
            setCoverImageUrl(imageUrl)
            setImagePosition({ x: 50, y: 50 }) // Reset position au centre par défaut
          }}
          onClose={() => setIsImagePickerOpen(false)}

        />

      </div>
    </div>
  )
}

export default CreateEventModal
