import React, { useState, useEffect, useRef } from 'react'
import { useFomoData } from '@/utils/dataManager'
import type { AddressSuggestion } from '@/types/fomoTypes'

interface AddressAutocompleteProps {
    value: string
    onChange: (value: string) => void
    onAddressSelect?: (address: { name?: string; address: string; lat: number; lng: number }) => void
    onValidationChange?: (isValid: boolean) => void
    placeholder?: string
    className?: string
    disabled?: boolean
    minLength?: number
    debounceDelay?: number // Délai de debounce en millisecondes (défaut: 600ms)
    bbox?: [number, number, number, number] // Bounding box optionnelle [west, south, east, north]
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
    value,
    onChange,
    onAddressSelect,
    onValidationChange,
    placeholder = "Saisissez une ville ou adresse...",
    className = "",
    disabled = false,
    minLength = 3,
    debounceDelay = 600,
    bbox
}) => {
    const fomoData = useFomoData()
    const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    // Loading local supprimé (non utilisé)
    const [selectedIndex, setSelectedIndex] = useState(-1)

    const inputRef = useRef<HTMLInputElement>(null)
    const suggestionsRef = useRef<HTMLDivElement>(null)
    const debounceRef = useRef<NodeJS.Timeout>()
    const [isFocused, setIsFocused] = useState<boolean>(false)
    const suppressNextSearchRef = useRef<boolean>(false)
    const hasSelectedRef = useRef<boolean>(false)
    const clickingSuggestionRef = useRef<boolean>(false)
    const hasValidAddressRef = useRef<boolean>(false) // Suivre si une adresse Mapbox valide a été sélectionnée

    // Recherche d'adresses avec géocodage mondial ou limité par bbox
    const searchAddressesLocal = async (query: string): Promise<AddressSuggestion[]> => {
        console.log('🔍 searchAddressesLocal appelé avec:', query, 'minLength:', minLength, 'bbox:', bbox)
        if (!query.trim() || query.length < minLength) {
            console.log('❌ Query trop court ou vide')
            return []
        }

        try {
            console.log('🌐 Recherche d\'adresses pour:', query, bbox ? `(bbox: [${bbox.join(', ')}])` : '(mondiale)')
            // Recherche avec ou sans bbox selon disponibilité
            const results = await fomoData.searchAddresses(query, { limit: 8, bbox })
            console.log('✅ Résultats reçus:', results)
            return results
        } catch (error) {
            console.error('❌ Erreur lors de la recherche d\'adresses:', error)
            return []
        }
    }


    // Gestion du changement de valeur
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value
        onChange(newValue)
        // L'utilisateur modifie le texte: permettre l'auto-select à nouveau au prochain blur
        hasSelectedRef.current = false
        // Réinitialiser la validation si l'utilisateur modifie manuellement le texte
        if (hasValidAddressRef.current) {
            hasValidAddressRef.current = false
            onValidationChange?.(false)
        }
    }

    // Gestion du focus
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select()
        setIsFocused(true)
        // Afficher les suggestions si on a déjà du texte
        if (value.trim().length >= minLength) {
            setShowSuggestions(true)
        }
    }

    const handleBlur = () => {
        setIsFocused(false)

        // Auto-sélection de la première suggestion si rien n'a été choisi
        const tryAutoselect = async () => {
            // Ne pas auto-sélectionner si l'utilisateur est en train de cliquer une suggestion
            if (clickingSuggestionRef.current) return
            if (hasSelectedRef.current) return
            const trimmed = value.trim()
            if (trimmed.length < minLength) return

            if (suggestions.length > 0) {
                handleSuggestionSelect(suggestions[0])
                return
            }

            const results = await searchAddressesLocal(trimmed)
            if (results.length > 0) {
                handleSuggestionSelect(results[0])
            }
        }

        tryAutoselect()
    }

    // Sélection d'une suggestion
    const handleSuggestionSelect = (suggestion: AddressSuggestion) => {
        const lat = parseFloat(suggestion.lat)
        const lng = parseFloat(suggestion.lon)
        // Utiliser l'adresse complète pour l'affichage dans l'input
        const address = suggestion.address || suggestion.display_name
        const name = suggestion.name || suggestion.display_name.split(',')[0].trim()

        // Mettre à jour la valeur sans déclencher de nouvelle recherche
        suppressNextSearchRef.current = true
        hasSelectedRef.current = true
        clickingSuggestionRef.current = false
        hasValidAddressRef.current = true // Marquer qu'une adresse Mapbox valide a été sélectionnée
        onChange(address)
        onAddressSelect?.({ name, address, lat, lng })
        onValidationChange?.(true) // Notifier que l'adresse est valide

        // Fermer les suggestions et vider la liste
        setShowSuggestions(false)
        setSelectedIndex(-1)
        setSuggestions([])
    }

    // Gestion des touches clavier
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions || suggestions.length === 0) return

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                setSelectedIndex(prev =>
                    prev < suggestions.length - 1 ? prev + 1 : 0
                )
                break
            case 'ArrowUp':
                e.preventDefault()
                setSelectedIndex(prev =>
                    prev > 0 ? prev - 1 : suggestions.length - 1
                )
                break
            case 'Enter':
                e.preventDefault()
                if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                    handleSuggestionSelect(suggestions[selectedIndex])
                } else if (suggestions.length > 0) {
                    handleSuggestionSelect(suggestions[0])
                }
                break
            case 'Escape':
                setShowSuggestions(false)
                setSelectedIndex(-1)
                break
        }
    }

    // Recherche avec debounce - seulement pour les changements manuels
    useEffect(() => {
        console.log('🔄 useEffect déclenché - value:', value, 'minLength:', minLength)

        if (debounceRef.current) {
            clearTimeout(debounceRef.current)
        }

        // Ne pas relancer une recherche juste après une sélection
        if (suppressNextSearchRef.current) {
            suppressNextSearchRef.current = false
            return
        }

        // Rechercher seulement si l'input est focus et la valeur assez longue
        if (isFocused && value.trim().length >= minLength) {
            console.log(`⏰ Déclenchement de la recherche dans ${debounceDelay}ms...`)
            debounceRef.current = setTimeout(async () => {
                console.log('🚀 Recherche lancée pour:', value)
                const results = await searchAddressesLocal(value)
                console.log('📋 Mise à jour des suggestions:', results)
                setSuggestions(results)
                setShowSuggestions(true)
                setSelectedIndex(-1)
            }, debounceDelay)
        } else if (value.trim().length < minLength) {
            console.log('🧹 Nettoyage des suggestions (trop court)')
            setSuggestions([])
            setShowSuggestions(false)
        }

        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current)
            }
        }
    }, [value, minLength, debounceDelay, isFocused, bbox])

    // Remonter l'état de validation : true uniquement si une adresse Mapbox valide a été sélectionnée
    useEffect(() => {
        // Réinitialiser si la valeur est vide
        if (!value.trim() && hasValidAddressRef.current) {
            hasValidAddressRef.current = false
        }
        // Si onValidationChange est fourni, on notifie uniquement quand une adresse valide est sélectionnée
        // Sinon, on ne fait rien (pour ne pas casser les usages existants qui ne passent pas cette prop)
        if (onValidationChange !== undefined) {
            onValidationChange(hasValidAddressRef.current)
        }
    }, [value, onValidationChange])


    // Fermer les suggestions quand on clique ailleurs
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(event.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(event.target as Node)
            ) {
                setShowSuggestions(false)
                setSelectedIndex(-1)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="address-autocomplete">
            <input
                ref={inputRef}
                type="text"
                className={`form-input ${className}`}
                placeholder={placeholder}
                value={value}
                onChange={handleInputChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
                <div
                    ref={suggestionsRef}
                    className="autocomplete-suggestions"
                >
                    {suggestions.map((suggestion, index) => {
                        // Extraire les informations de localisation depuis components
                        const components = suggestion.components || {}
                        // La ville peut être dans 'place' (ville principale) ou 'locality' (localité)
                        const city = components.place || components.locality || ''
                        const region = components.region || ''
                        const country = components.country || ''
                        
                        // Le display_name de MapTiler contient souvent "Nom, Ville, Région, Pays"
                        // On extrait le nom principal (première partie)
                        const displayParts = suggestion.display_name.split(',').map(p => p.trim())
                        const mainLocation = displayParts[0] || suggestion.display_name
                        
                        // Construire les détails de localisation
                        let locationDetails = ''
                        const locationParts: string[] = []
                        
                        // Si on a des components, les utiliser en priorité
                        if (city && city !== mainLocation && !mainLocation.includes(city)) {
                            locationParts.push(city)
                        }
                        if (region && region !== city && !locationParts.includes(region)) {
                            locationParts.push(region)
                        }
                        if (country && country !== region && !locationParts.includes(country)) {
                            locationParts.push(country)
                        }
                        
                        // Si pas de components mais qu'on a place_name, l'utiliser
                        if (locationParts.length === 0 && suggestion.place_name) {
                            const placeNameParts = suggestion.place_name.split(',').map(p => p.trim())
                            if (placeNameParts.length > 1) {
                                // Prendre toutes les parties sauf la première (déjà affichée)
                                locationParts.push(...placeNameParts.slice(1))
                            }
                        }
                        
                        // Fallback final : utiliser les parties du display_name
                        if (locationParts.length === 0 && displayParts.length > 1) {
                            locationParts.push(...displayParts.slice(1))
                        }
                        
                        locationDetails = locationParts.join(', ')

                        return (
                            <div
                                key={suggestion.place_id}
                                className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
                                onClick={() => handleSuggestionSelect(suggestion)}
                                onMouseDown={() => { clickingSuggestionRef.current = true }}
                                onTouchStart={() => { clickingSuggestionRef.current = true }}
                            >
                                <div className="suggestion-item-main">
                                    {mainLocation}
                                </div>
                                {locationDetails && (
                                    <div className="suggestion-item-details">
                                        {locationDetails}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

        </div>
    )
}

export default AddressAutocomplete