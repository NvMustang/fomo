import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFomoDataContext } from '@/contexts/FomoDataProvider'

interface AddressSuggestion {
    display_name: string
    lat: string
    lon: string
    place_id: string
}

interface AddressAutocompleteProps {
    value: string
    onChange: (value: string) => void
    onAddressSelect?: (address: { address: string; lat: number; lng: number }) => void
    onValidationChange?: (isValid: boolean) => void
    placeholder?: string
    className?: string
    disabled?: boolean
    minLength?: number
}

export const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
    value,
    onChange,
    onAddressSelect,
    onValidationChange,
    placeholder = "Saisissez une ville ou adresse...",
    className = "",
    disabled = false,
    minLength = 3
}) => {
    const { searchAddresses } = useFomoDataContext()
    const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    // Loading local supprimé (non utilisé)
    const [selectedIndex, setSelectedIndex] = useState(-1)

    const inputRef = useRef<HTMLInputElement>(null)
    const suggestionsRef = useRef<HTMLDivElement>(null)
    const debounceRef = useRef<NodeJS.Timeout>()
    const isFocusedRef = useRef<boolean>(false)
    const suppressNextSearchRef = useRef<boolean>(false)
    const hasSelectedRef = useRef<boolean>(false)
    const clickingSuggestionRef = useRef<boolean>(false)

    // Recherche d'adresses avec géocodage mondial
    const searchAddressesLocal = async (query: string): Promise<AddressSuggestion[]> => {
        console.log('🔍 searchAddressesLocal appelé avec:', query, 'minLength:', minLength)
        if (!query.trim() || query.length < minLength) {
            console.log('❌ Query trop court ou vide')
            return []
        }

        try {
            console.log('🌐 Recherche d\'adresses pour:', query)
            // Recherche mondiale (pas de restriction de pays)
            const results = await searchAddresses(query, { limit: 8 })
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
    }

    // Gestion du focus
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select()
        isFocusedRef.current = true
        // Afficher les suggestions si on a déjà du texte
        if (value.trim().length >= minLength) {
            setShowSuggestions(true)
        }
    }

    const handleBlur = () => {
        isFocusedRef.current = false

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
        const address = suggestion.display_name

        // Mettre à jour la valeur sans déclencher de nouvelle recherche
        suppressNextSearchRef.current = true
        hasSelectedRef.current = true
        clickingSuggestionRef.current = false
        onChange(address)
        onAddressSelect?.({ address, lat, lng })

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
        if (isFocusedRef.current && value.trim().length >= minLength) {
            console.log('⏰ Déclenchement de la recherche dans 300ms...')
            debounceRef.current = setTimeout(async () => {
                console.log('🚀 Recherche lancée pour:', value)
                const results = await searchAddressesLocal(value)
                console.log('📋 Mise à jour des suggestions:', results)
                setSuggestions(results)
                setShowSuggestions(true)
                setSelectedIndex(-1)
            }, 300)
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
    }, [value, minLength])

    // Remonter un état de validation basique si demandé
    useEffect(() => {
        onValidationChange?.(value.trim().length >= minLength)
    }, [value, minLength, onValidationChange])

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
        <div className="address-autocomplete" style={{ position: 'relative' }}>
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
            {showSuggestions && suggestions.length > 0 && createPortal(
                <div
                    ref={suggestionsRef}
                    className="autocomplete-suggestions"
                    style={{
                        position: 'fixed',
                        top: inputRef.current ? inputRef.current.getBoundingClientRect().bottom : 0,
                        left: inputRef.current ? inputRef.current.getBoundingClientRect().left : 0,
                        width: inputRef.current ? inputRef.current.getBoundingClientRect().width : 'auto'
                    }}
                >
                    {suggestions.map((suggestion, index) => {
                        const parts = suggestion.display_name.split(',')
                        const mainLocation = parts[0].trim()
                        const details = parts.slice(1).join(',').trim()

                        return (
                            <div
                                key={suggestion.place_id}
                                className={`suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
                                onClick={() => handleSuggestionSelect(suggestion)}
                                onMouseDown={() => { clickingSuggestionRef.current = true }}
                                onTouchStart={() => { clickingSuggestionRef.current = true }}
                                style={{
                                    borderBottom: index < suggestions.length - 1 ? '1px solid #f0f0f0' : 'none'
                                }}
                            >
                                <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                                    {mainLocation}
                                </div>
                                {details && (
                                    <div style={{ fontSize: '12px', color: '#666' }}>
                                        {details}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>,
                document.body
            )}

        </div>
    )
}

export default AddressAutocomplete