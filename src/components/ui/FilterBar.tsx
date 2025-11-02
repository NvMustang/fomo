import { useEffect, useState, useMemo } from 'react'
import Select from 'react-select'
import type { StylesConfig } from 'react-select'
import AsyncSelect from 'react-select/async'
import { useFilters } from '@/contexts/FiltersContext'
import { TIME_PERIODS, mapResponseValuesToSelectOptions, findResponseOption } from '@/utils/filterTools'
import type { Periods, UserResponseValue } from '@/types/fomoTypes'
type PeriodKey = Exclude<Periods, 'all'>
type Option = { value: string; label: string; color?: string }
type TagOption = { value: string; label: string; count?: number }

export function FilterBar() {
    const {
        filters,
        setFilters,
        getLocalTags,
        getLocalPeriods,
        getLocalOrganizers,
        getLocalResponses
    } = useFilters()

    // Format options pour les périodes
    const periodOptions = useMemo(() => {
        const localPeriods = getLocalPeriods()
        const periodMap = new Map(TIME_PERIODS.map(p => [p.key, { value: p.key, label: p.label }]))
        return localPeriods
            .map(period => periodMap.get(period))
            .filter((opt): opt is { value: string; label: string } => opt !== undefined)
    }, [getLocalPeriods])

    const selectedPeriodOption = useMemo(() => {
        if (!filters.period || filters.period === 'all') return null
        const period = TIME_PERIODS.find(p => p.key === filters.period)
        return period ? { value: period.key, label: period.label } : null
    }, [filters.period])

    // Format options pour les organisateurs
    const allOrganizers = getLocalOrganizers()

    const selectedOrganizerOption = useMemo(() => {
        if (!filters.organizerId) return null
        const organizer = allOrganizers.find(o => o.value === filters.organizerId)
        return organizer || null
    }, [filters.organizerId, allOrganizers])

    const loadOrganizerOptions = (query: string) => {
        const lower = (query || '').toLowerCase().trim()
        if (!lower) return Promise.resolve(allOrganizers.slice(0, 20))
        return Promise.resolve(
            allOrganizers
                .filter(o => o.label.toLowerCase().includes(lower))
                .slice(0, 20)
        )
    }

    // Format options pour les réponses avec ordre spécifique
    const responseOptions = useMemo(() => {
        const localResponses = getLocalResponses()
        return mapResponseValuesToSelectOptions(localResponses)
    }, [getLocalResponses])

    const selectedResponseOption = useMemo(() => {
        return findResponseOption(filters.response, responseOptions)
    }, [filters.response, responseOptions])

    const [q, setQ] = useState(filters.searchQuery || '')

    // Debounce texte -> apply (search uniquement)
    useEffect(() => {
        const t = setTimeout(() => {
            const baseSearch = q.trim()
            setFilters(prev => ({ ...prev, searchQuery: baseSearch }))
        }, 300)
        return () => clearTimeout(t)
    }, [q, setFilters])


    const [isExpanded, setIsExpanded] = useState(false)

    // Ensure dropdown menus render above any clipping container
    const menuPortalTarget = typeof document !== 'undefined' ? document.body : null

    // Styles communs pour tous les Select (basés sur CreateEventModal)
    // Les paramètres base et state sont typés implicitement par react-select
    const commonSelectStyles = {
        control: (base: unknown, state: unknown) => {
            const s = state as { isFocused?: boolean }
            const b = base as Record<string, unknown>
            return {
                ...b,
                borderRadius: 'var(--radius)',
                minHeight: 38,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: s.isFocused ? 'var(--current-color)' : 'var(--border)',
                boxShadow: s.isFocused
                    ? '0 0 0 3px var(--current-color-10)'
                    : 'none',
                outline: 'none',
                '&:hover': {
                    borderColor: s.isFocused ? 'var(--current-color)' : 'var(--border)'
                }
            }
        },
        menu: (base: unknown) => {
            const b = base as Record<string, unknown>
            return {
                ...b,
                background: 'var(--bg, #fff)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
                zIndex: 10000,
                overflow: 'hidden'
            }
        },
        menuList: (base: unknown) => {
            const b = base as Record<string, unknown>
            return {
                ...b,
                maxHeight: 240,
                overflowY: 'auto',
                paddingTop: 0,
                paddingBottom: 0
            }
        },
        option: (base: unknown, state: unknown) => {
            const s = state as { isFocused?: boolean; isSelected?: boolean }
            const b = base as Record<string, unknown>
            return {
                ...b,
                padding: 12,
                cursor: 'pointer',
                borderBottom: '1px solid #f0f0f0',
                backgroundColor: s.isFocused || s.isSelected ? 'var(--current-color-10)' : 'transparent',
                color: 'inherit'
            }
        }
    }

    const menuPortalStylesSingle: StylesConfig<Option, false> = {
        ...commonSelectStyles,
        menuPortal: (base) => ({ ...base, zIndex: 9999 })
    } as StylesConfig<Option, false>
    const menuPortalStylesMulti: StylesConfig<Option, true> = {
        ...commonSelectStyles,
        menuPortal: (base) => ({ ...base, zIndex: 9999 })
    } as StylesConfig<Option, true>

    const handleBlurCapture: React.FocusEventHandler<HTMLDivElement> = (e) => {
        const next = e.relatedTarget as Node | null
        if (!e.currentTarget.contains(next)) setIsExpanded(false)
    }

    // Badges actifs à afficher en mode collapsed
    const activeFilterBadges = useMemo(() => {
        const badges: Array<{ id: string; label: string; onRemove: () => void }> = []

        // Réponse
        if (selectedResponseOption) {
            badges.push({
                id: 'response',
                label: selectedResponseOption.label,
                onRemove: () => setFilters(prev => ({ ...prev, response: undefined }))
            })
        }

        // Période
        if (selectedPeriodOption) {
            badges.push({
                id: 'period',
                label: selectedPeriodOption.label,
                onRemove: () => setFilters(prev => ({ ...prev, period: 'all' }))
            })
        }

        // Tags (multiples)
        const activeTags = (filters.tags || []).filter(t => t !== 'all')
        activeTags.forEach(tag => {
            badges.push({
                id: `tag-${tag}`,
                label: tag,
                onRemove: () => {
                    const newTags = activeTags.filter(t => t !== tag)
                    setFilters(prev => ({ ...prev, tags: newTags.length ? newTags : ['all'] }))
                }
            })
        })

        // Organisateur
        if (selectedOrganizerOption) {
            badges.push({
                id: 'organizer',
                label: selectedOrganizerOption.label,
                onRemove: () => setFilters(prev => ({ ...prev, organizerId: undefined }))
            })
        }

        return badges
    }, [selectedResponseOption, selectedPeriodOption, selectedOrganizerOption, filters.tags, setFilters])

    return (
        <div
            className={`filterbar${isExpanded ? '' : ' filterbar--collapsed'}`}
            onBlurCapture={handleBlurCapture}
        >
            {/* Recherche texte (toujours visible) */}
            <div className="filterbar__query">
                <input
                    type="search"
                    placeholder="Rechercher un événement..."
                    value={q}
                    onFocus={() => setIsExpanded(true)}
                    onChange={(e) => {
                        setQ(e.target.value)
                        // Reset immédiat si vide (pas de debounce pour le reset)
                        if (!e.target.value.trim()) {
                            setFilters(prev => ({ ...prev, searchQuery: '' }))
                        }
                    }}
                />
                {/* Badges de filtres actifs (affichés seulement en mode collapsed) */}
                {!isExpanded && activeFilterBadges.length > 0 && (
                    <div className="filter-chips">
                        {activeFilterBadges.map(badge => (
                            <div key={badge.id} className="filter-chip">
                                <span>{badge.label}</span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        e.preventDefault()
                                        badge.onRemove()
                                    }}
                                    onMouseDown={(e) => {
                                        // Empêcher le focus sur le container
                                        e.preventDefault()
                                    }}
                                    aria-label={`Supprimer le filtre ${badge.label}`}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="filterbar__expandable">
                {/* Réponse - Priorité 1 (le plus utilisé) */}
                <Select
                    options={responseOptions}
                    value={selectedResponseOption}
                    onChange={(opt) => {
                        if (!opt) {
                            setFilters(prev => ({ ...prev, response: undefined }))
                            return
                        }
                        const responseValue = opt.value
                        // Convertir les valeurs d'option en UserResponseValue
                        let response: UserResponseValue
                        if (responseValue === 'null') {
                            response = null
                        } else if (responseValue === 'non_repondu') {
                            // Pour "Non répondu", utiliser 'cleared' comme valeur
                            // (peut aussi être 'seen', mais 'cleared' est plus représentatif)
                            response = 'cleared'
                        } else {
                            response = responseValue as UserResponseValue
                        }
                        setFilters(prev => ({ ...prev, response }))
                    }}
                    onMenuOpen={() => {
                        // Si une valeur est déjà sélectionnée, effacer au lieu d'ouvrir le menu
                        if (selectedResponseOption) {
                            setFilters(prev => ({ ...prev, response: undefined }))
                        }
                    }}
                    placeholder="Réponse"
                    isSearchable={false}
                    isClearable
                    menuPortalTarget={menuPortalTarget}
                    menuPosition="fixed"
                    styles={menuPortalStylesSingle}
                />

                {/* Période - Priorité 2 */}
                <Select
                    options={periodOptions}
                    value={selectedPeriodOption}
                    onChange={(opt) => setFilters(prev => ({
                        ...prev,
                        period: (opt?.value ? ((opt.value as PeriodKey) as Periods) : 'all')
                    }))}
                    onMenuOpen={() => {
                        // Si une valeur est déjà sélectionnée, effacer au lieu d'ouvrir le menu
                        if (selectedPeriodOption) {
                            setFilters(prev => ({ ...prev, period: 'all' }))
                        }
                    }}
                    placeholder="Période"
                    isSearchable={false}
                    isClearable
                    menuPortalTarget={menuPortalTarget}
                    menuPosition="fixed"
                    styles={menuPortalStylesSingle}
                />

                {/* Tags - Priorité 3 */}
                <Select
                    isMulti
                    options={getLocalTags()}
                    value={(filters.tags || []).filter(t => t !== 'all').map(id => ({ value: id, label: id }))}
                    onChange={(opts) => {
                        const ids = (opts as Option[] | null)?.map(o => o.value) || []
                        setFilters(prev => ({ ...prev, tags: ids.length ? ids : ['all'] }))
                    }}
                    formatOptionLabel={({ label, count }: TagOption) => (
                        <div className="filterbar-tag-option">
                            <span>{label}</span>
                            {count !== undefined && (
                                <span className="filterbar-tag-count">
                                    {count}
                                </span>
                            )}
                        </div>
                    )}
                    closeMenuOnSelect={false}
                    placeholder="Tags"
                    menuPortalTarget={menuPortalTarget}
                    menuPosition="fixed"
                    styles={menuPortalStylesMulti}
                />

                {/* Organisateur - Priorité 4 */}
                <AsyncSelect
                    key={`org-${filters.period || 'all'}`}
                    defaultOptions
                    loadOptions={loadOrganizerOptions}
                    value={selectedOrganizerOption}
                    onChange={(opt) => {
                        setFilters(prev => ({ ...prev, organizerId: opt?.value || undefined }))
                    }}
                    onMenuOpen={() => {
                        // Si une valeur est déjà sélectionnée, effacer au lieu d'ouvrir le menu
                        if (selectedOrganizerOption) {
                            setFilters(prev => ({ ...prev, organizerId: undefined }))
                        }
                    }}
                    placeholder="Organisateur"
                    isClearable
                    menuPortalTarget={menuPortalTarget}
                    menuPosition="fixed"
                    styles={menuPortalStylesSingle}
                />
            </div>


        </div>
    )
}


export default FilterBar


