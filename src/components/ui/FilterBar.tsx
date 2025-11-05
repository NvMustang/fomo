import { useEffect, useState, useMemo, useRef } from 'react'
import Select from 'react-select'
import type { StylesConfig } from 'react-select'
import AsyncSelect from 'react-select/async'
import { useFilters } from '@/contexts/FiltersContext'
import type { Periods, UserResponseValue } from '@/types/fomoTypes'
type PeriodKey = Exclude<Periods, 'all'>
type Option = { value: string; label: string; color?: string; count?: number }
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

    // Format options pour les périodes (avec count)
    const periodOptions = useMemo(() => {
        const localPeriods = getLocalPeriods()
        return localPeriods.map(p => ({
            value: p.value,
            label: p.label,
            count: p.count
        }))
    }, [getLocalPeriods])

    const selectedPeriodOption = useMemo(() => {
        if (!filters.period || filters.period === 'all') return null
        const localPeriods = getLocalPeriods()
        const period = localPeriods.find(p => p.value === filters.period)
        return period ? { value: period.value, label: period.label, count: period.count } : null
    }, [filters.period, getLocalPeriods])

    // Format options pour les organisateurs (avec count)
    const allOrganizers = useMemo(() => {
        return getLocalOrganizers().map(o => ({
            value: o.value,
            label: o.label,
            count: o.count
        }))
    }, [getLocalOrganizers])

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

    // Format options pour les réponses avec count
    const responseOptions = useMemo(() => {
        const localResponses = getLocalResponses()
        // Mapper les réponses avec leurs labels et counts
        return localResponses.map(r => {
            let label = r.label
            // Pour "Non répondu", on doit gérer cleared/seen
            if (r.value === 'cleared') {
                label = 'Non répondu'
            }
            return {
                value: r.value === null ? 'null' : (r.value === 'cleared' ? 'non_repondu' : r.value),
                label: label,
                count: r.count,
                sortOrder: r.value === null ? 1 :
                    r.value === 'going' ? 2 :
                        r.value === 'interested' ? 3 :
                            r.value === 'cleared' ? 4 : 5
            }
        }).sort((a, b) => a.sortOrder - b.sortOrder)
    }, [getLocalResponses])

    const selectedResponseOption = useMemo(() => {
        if (filters.response === undefined) return null
        const responseValue = filters.response === null ? 'null' : (filters.response === 'cleared' ? 'non_repondu' : filters.response)
        return responseOptions.find(opt => opt.value === responseValue) || null
    }, [filters.response, responseOptions])

    // Vérifier si les filtres doivent être désactivés (pas d'options ou tous les counts à 0)
    const isResponseDisabled = useMemo(() => {
        return responseOptions.length === 0 || responseOptions.every(opt => (opt.count || 0) === 0)
    }, [responseOptions])

    const isPeriodDisabled = useMemo(() => {
        return periodOptions.length === 0 || periodOptions.every(opt => (opt.count || 0) === 0)
    }, [periodOptions])

    const isTagsDisabled = useMemo(() => {
        const tags = getLocalTags()
        return tags.length === 0 || tags.every(tag => (tag.count || 0) === 0)
    }, [getLocalTags])

    const isOrganizerDisabled = useMemo(() => {
        return allOrganizers.length === 0 || allOrganizers.every(org => (org.count || 0) === 0)
    }, [allOrganizers])

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

    // Styles pour les Select secondaires (hors query) : plus petits et fond plus sombre
    // Mais blanc quand une valeur est sélectionnée (actif)
    const secondarySelectStyles = {
        control: (base: unknown, state: unknown) => {
            const s = state as { isFocused?: boolean; hasValue?: boolean; value?: unknown }
            const b = base as Record<string, unknown>
            // Si une valeur est sélectionnée, fond blanc comme le query
            // hasValue existe dans react-select, mais on peut aussi vérifier value directement
            const isActive = s.hasValue || (s.value !== null && s.value !== undefined)
            const backgroundColor = isActive ? '#fff' : '#f3f4f6'
            const hoverBackgroundColor = isActive ? '#fff' : '#e5e7eb'
            return {
                ...b,
                borderRadius: 'var(--radius)',
                minHeight: 32, // Plus petit que le query (38px)
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: s.isFocused ? 'var(--current-color)' : 'var(--border)',
                backgroundColor: backgroundColor,
                boxShadow: s.isFocused
                    ? '0 0 0 3px var(--current-color-10)'
                    : 'none',
                outline: 'none',
                '&:hover': {
                    borderColor: s.isFocused ? 'var(--current-color)' : 'var(--border)',
                    backgroundColor: hoverBackgroundColor
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

    const secondaryMenuPortalStylesSingle: StylesConfig<Option, false> = {
        ...secondarySelectStyles,
        menuPortal: (base) => ({ ...base, zIndex: 9999 })
    } as StylesConfig<Option, false>
    const secondaryMenuPortalStylesMulti: StylesConfig<Option, true> = {
        ...secondarySelectStyles,
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

    // Note: L'animation pop de la filterbar est gérée dans DiscoverPage.tsx
    // via la classe 'filterbar-pop' sur 'filterbar-overlay'

    return (
        <div
            className={`filterbar${isExpanded ? '' : ' filterbar--collapsed'}`}
            onBlurCapture={handleBlurCapture}
        >
            {/* Recherche texte (toujours visible) */}
            <div className="filterbar__query">
                <input
                    type="search"
                    name="search"
                    id="filterbar-search"
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
                    formatOptionLabel={({ label, count }: Option) => (
                        <div className="filterbar-tag-option">
                            <span>{label}</span>
                            {count !== undefined && (
                                <span className="filterbar-tag-count">
                                    {count}
                                </span>
                            )}
                        </div>
                    )}
                    placeholder="Réponse"
                    isSearchable={false}
                    isClearable
                    isDisabled={isResponseDisabled}
                    menuPortalTarget={menuPortalTarget}
                    menuPosition="fixed"
                    styles={secondaryMenuPortalStylesSingle}
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
                    formatOptionLabel={({ label, count }: Option) => (
                        <div className="filterbar-tag-option">
                            <span>{label}</span>
                            {count !== undefined && (
                                <span className="filterbar-tag-count">
                                    {count}
                                </span>
                            )}
                        </div>
                    )}
                    placeholder="Période"
                    isSearchable={false}
                    isClearable
                    isDisabled={isPeriodDisabled}
                    menuPortalTarget={menuPortalTarget}
                    menuPosition="fixed"
                    styles={secondaryMenuPortalStylesSingle}
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
                    isDisabled={isTagsDisabled}
                    menuPortalTarget={menuPortalTarget}
                    menuPosition="fixed"
                    styles={secondaryMenuPortalStylesMulti}
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
                    formatOptionLabel={({ label, count }: Option) => (
                        <div className="filterbar-tag-option">
                            <span>{label}</span>
                            {count !== undefined && (
                                <span className="filterbar-tag-count">
                                    {count}
                                </span>
                            )}
                        </div>
                    )}
                    placeholder="Organisateur"
                    isClearable
                    isDisabled={isOrganizerDisabled}
                    menuPortalTarget={menuPortalTarget}
                    menuPosition="fixed"
                    styles={secondaryMenuPortalStylesSingle}
                />

                {/* Toggle "Inclure les événements passés" */}
                <div className="filterbar__toggle-past">
                    <label htmlFor="filterbar-past-toggle" className="filterbar__toggle-label">
                        Inclure les événements passés
                    </label>
                    <button
                        type="button"
                        id="filterbar-past-toggle"
                        role="switch"
                        aria-checked={filters.includePastEvents}
                        aria-label={filters.includePastEvents ? 'Masquer les événements passés' : 'Afficher les événements passés'}
                        onClick={() => setFilters(prev => ({ ...prev, includePastEvents: !prev.includePastEvents }))}
                        className="filterbar__toggle-switch"
                        style={{
                            backgroundColor: filters.includePastEvents ? 'var(--success, #10b981)' : 'var(--text-muted, #9ca3af)',
                            width: '44px',
                            height: '24px',
                            borderRadius: '12px',
                            border: 'none',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'background-color var(--transition-fast)',
                            flexShrink: 0
                        }}
                    >
                        <div style={{
                            position: 'absolute',
                            top: '2px',
                            left: filters.includePastEvents ? '22px' : '2px',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            backgroundColor: '#fff',
                            transition: 'left var(--transition-fast)',
                            boxShadow: 'var(--shadow)'
                        }} />
                    </button>
                </div>
            </div>


        </div>
    )
}


export default FilterBar


