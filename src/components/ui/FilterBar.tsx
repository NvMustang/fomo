import { useEffect, useState, useMemo, useCallback } from 'react'
import Select, { components } from 'react-select'
import type { StylesConfig, MenuProps } from 'react-select'
import AsyncSelect from 'react-select/async'
import { useFilters } from '@/hooks'
import { useDataContext } from '@/contexts/DataContext'
import { DateRangePicker } from './DateRangePicker'
import type { UserResponseValue, Event } from '@/types/fomoTypes'
type Option = { value: string; label: string; color?: string; count?: number }
type TagOption = { value: string; label: string; count?: number; popularityScore?: number }

/**
 * Convertit une valeur de réponse en label français propre
 * Gère à la fois null (valeur réelle) et 'null' (string) pour compatibilité
 */
const getResponseLabel = (value: UserResponseValue | string): string => {
    // Gérer le cas où value est null ou la string 'null'
    if (value === null || value === 'null') {
        return 'Nouveaux'
    }

    switch (value) {
        case 'going':
        case 'participe':
            return "J'y vais"
        case 'interested':
            return 'Intéressé'
        case 'maybe':
            return 'Peut-être'
        case 'not_interested':
            return 'Pas intéressé'
        case 'not_there':
            return 'Pas là'
        case 'cleared':
            return 'Non répondu'
        case 'seen':
            return 'Vu'
        case 'invited':
            return 'Invité'
        case 'linked':
            return 'Lié'
        case 'new':
            return 'Nouveau'
        default:
            return String(value)
    }
}

export function FilterBar() {
    const { events } = useDataContext()
    const {
        filters,
        setFilters,
        getFilterOptions
    } = useFilters()

    // Valeur pour le Select de dates (pour afficher la date range sélectionnée)
    const customDateValue = useMemo(() => {
        if (filters.customStartDate && filters.customEndDate) {
            const start = filters.customStartDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
            const end = filters.customEndDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
            return { value: 'custom', label: `${start} - ${end}` }
        }
        return null
    }, [filters.customStartDate, filters.customEndDate])

    // Calculer les options de filtrage basées sur les événements filtrés
    // getFilterOptions applique tous les filtres SAUF celui qu'on calcule
    // pour montrer le nombre d'événements disponibles pour chaque option
    const filterOptions = useMemo(() => {
        return getFilterOptions(events)
    }, [events, getFilterOptions])

    // Composant Menu personnalisé pour afficher le DateRangePicker
    const CustomDateMenu = (props: MenuProps<Option, false>) => {
        return (
            <components.Menu {...props}>
                <div style={{ padding: 0 }}>
                    <DateRangePicker
                        startDate={filters.customStartDate}
                        endDate={filters.customEndDate}
                        onDateChange={(start, end) => {
                            if (start && end) {
                                setFilters(prev => ({
                                    ...prev,
                                    customStartDate: start,
                                    customEndDate: end
                                }))
                            } else {
                                setFilters(prev => ({
                                    ...prev,
                                    customStartDate: undefined,
                                    customEndDate: undefined
                                }))
                            }
                        }}
                        excludePastEvents={filters.excludePastEvents}
                        onExcludePastEventsChange={(exclude) => {
                            setFilters(prev => ({
                                ...prev,
                                excludePastEvents: exclude
                            }))
                        }}
                    />
                </div>
            </components.Menu>
        )
    }

    // Format options pour les organisateurs (avec count)
    const allOrganizers = useMemo(() => {
        // Ne garder que les organisateurs avec des événements (count > 0)
        return filterOptions.organizers.counts
            .filter((o: { count: number }) => o.count > 0)
            .map((o: { value: string; label: string; count: number }) => ({
                value: o.value,
                label: o.label,
                count: o.count
            }))
    }, [filterOptions.organizers])

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
        // Mapper les réponses avec leurs labels et counts, ne garder que celles avec count > 0
        return filterOptions.responses.counts
            .filter((r: { count: number }) => r.count > 0)
            .map((r: { value: UserResponseValue; label: string; count: number }) => {
                // Utiliser la fonction getResponseLabel pour obtenir un label français propre
                const isNull = r.value === null
                const label = getResponseLabel(r.value)
                return {
                    value: isNull ? 'null' : (r.value === 'cleared' ? 'non_repondu' : String(r.value)),
                    label: label,
                    count: r.count,
                    sortOrder: isNull ? 1 :
                        r.value === 'going' ? 2 :
                            r.value === 'interested' ? 3 :
                                r.value === 'cleared' ? 4 : 5
                }
            })
            .sort((a: { sortOrder: number }, b: { sortOrder: number }) => a.sortOrder - b.sortOrder)
    }, [filterOptions.responses])

    const selectedResponseOptions = useMemo(() => {
        if (!filters.responses || filters.responses.includes('all')) return []
        return filters.responses
            .map(resp => {
                const responseValue = resp === null ? 'null' : (resp === 'cleared' ? 'non_repondu' : String(resp))
                return responseOptions.find(opt => opt.value === responseValue)
            })
            .filter(Boolean) as Option[]
    }, [filters.responses, responseOptions])

    // Vérifier si les filtres doivent être désactivés (pas d'options ou tous les counts à 0)
    const isResponsesDisabled = useMemo(() => {
        return responseOptions.length === 0 || responseOptions.every(opt => (opt.count || 0) === 0)
    }, [responseOptions])

    const isTagsDisabled = useMemo(() => {
        return filterOptions.tags.counts.length === 0 || filterOptions.tags.counts.every((tag: { count: number }) => (tag.count || 0) === 0)
    }, [filterOptions.tags])

    const isOrganizerDisabled = useMemo(() => {
        return allOrganizers.length === 0 || allOrganizers.every(org => (org.count || 0) === 0)
    }, [allOrganizers])

    // Calculer la popularité globale des tags sur TOUS les événements (DB complète)
    // Cette métrique montre si un tag est globalement populaire, indépendamment des filtres
    const tagGlobalPopularity = useMemo(() => {
        const popularityMap: Record<string, number> = {}
        // Compter les occurrences de chaque tag dans TOUS les événements
        events.forEach((evt: Event) => {
            (evt.tags || []).forEach(tag => {
                const normalized = typeof tag === 'string' ? tag.trim().toLowerCase() : ''
                if (normalized) {
                    popularityMap[normalized] = (popularityMap[normalized] || 0) + 1
                }
            })
        })
        return popularityMap
    }, [events])

    // Calculer le score de popularité (1-5) basé sur la fréquence globale
    const getPopularityScore = useCallback((tagValue: string): number => {
        const count = tagGlobalPopularity[tagValue] || 0
        if (count === 0) return 0
        const maxCount = Math.max(...Object.values(tagGlobalPopularity), 1)
        // Score de 1 à 5 basé sur le pourcentage du max
        const score = Math.ceil((count / maxCount) * 5)
        return Math.max(1, Math.min(5, score))
    }, [tagGlobalPopularity])

    // Format options pour les tags :
    // - count : nombre d'événements FILTRÉS qui ont ce tag (dynamique)
    // - popularityScore : fréquence globale du tag sur TOUS les événements (statique)
    const tagOptions = useMemo(() => {
        const options = filterOptions.tags.counts
            // Ne garder que les tags présents dans les événements filtrés (count > 0)
            .filter((t: { count: number }) => t.count > 0)
            .map((t: { value: string; label: string; count: number }) => {
                const popularityScore = getPopularityScore(t.value)
                return {
                    value: t.value,
                    label: t.label,
                    count: t.count, // Nombre d'événements visibles (filtrés) avec ce tag
                    popularityScore // Popularité globale (sur tous les événements)
                }
            })
        // Trier par popularité globale décroissante, puis par nom alphabétique
        return options.sort((a, b) => {
            if (b.popularityScore !== a.popularityScore) {
                return b.popularityScore - a.popularityScore
            }
            return a.label.localeCompare(b.label)
        })
    }, [filterOptions.tags, getPopularityScore])

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

        // Dates personnalisées
        if (filters.customStartDate && filters.customEndDate) {
            const start = filters.customStartDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
            const end = filters.customEndDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
            badges.push({
                id: 'custom-dates',
                label: `${start} - ${end}`,
                onRemove: () => setFilters(prev => ({ ...prev, customStartDate: undefined, customEndDate: undefined }))
            })
        }

        // Réponses (multiples)
        const activeResponses = (filters.responses || []).filter(r => r !== 'all')
        activeResponses.forEach(resp => {
            const responseValue = resp === null ? 'null' : (resp === 'cleared' ? 'non_repondu' : String(resp))
            const option = responseOptions.find(opt => opt.value === responseValue)
            if (option) {
                badges.push({
                    id: `response-${responseValue}`,
                    label: option.label,
                    onRemove: () => {
                        const newResponses = activeResponses.filter(r => r !== resp)
                        setFilters(prev => ({ ...prev, responses: newResponses.length ? newResponses : ['all'] }))
                    }
                })
            }
        })

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
    }, [selectedResponseOptions, selectedOrganizerOption, filters.tags, filters.responses, filters.customStartDate, filters.customEndDate, responseOptions, setFilters])


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
                    onKeyDown={(e) => {
                        // Masquer les filtres lors de la validation avec Enter (même comportement que clic sur carte)
                        if (e.key === 'Enter') {
                            e.currentTarget.blur()
                            setIsExpanded(false)
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
                {/* Dates personnalisées - Priorité 1 */}
                <Select
                    options={[]}
                    value={customDateValue}
                    onChange={() => {
                        // Reset des dates via le clear button
                        setFilters(prev => ({
                            ...prev,
                            customStartDate: undefined,
                            customEndDate: undefined
                        }))
                    }}
                    components={{ Menu: CustomDateMenu }}
                    placeholder="Dates"
                    isClearable={customDateValue !== null}
                    menuPortalTarget={menuPortalTarget}
                    menuPosition="fixed"
                    styles={secondaryMenuPortalStylesSingle}
                />

                {/* Réponses - Priorité 2 (le plus utilisé) - Multi-sélection */}
                <Select
                    isMulti
                    options={responseOptions}
                    value={selectedResponseOptions}
                    onChange={(opts) => {
                        if (!opts || opts.length === 0) {
                            setFilters(prev => ({ ...prev, responses: ['all'] }))
                            return
                        }
                        // Convertir les valeurs d'options en UserResponseValue[]
                        const responses = (opts as Option[]).map(opt => {
                            const responseValue = opt.value
                            if (responseValue === 'null') {
                                return null
                            } else if (responseValue === 'non_repondu') {
                                return 'cleared'
                            } else {
                                return responseValue as UserResponseValue
                            }
                        })
                        setFilters(prev => ({ ...prev, responses }))
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
                    closeMenuOnSelect={false}
                    placeholder="Réponses"
                    isDisabled={isResponsesDisabled}
                    menuPortalTarget={menuPortalTarget}
                    menuPosition="fixed"
                    styles={secondaryMenuPortalStylesMulti}
                />

                {/* Tags - Priorité 3 */}
                <Select
                    isMulti
                    options={tagOptions}
                    value={(filters.tags || []).filter(t => t !== 'all').map(id => {
                        const tagOption = tagOptions.find(opt => opt.value === id)
                        return {
                            value: id,
                            label: id,
                            popularityScore: tagOption?.popularityScore
                        }
                    })}
                    onChange={(opts) => {
                        const ids = (opts as Option[] | null)?.map(o => o.value) || []
                        setFilters(prev => ({ ...prev, tags: ids.length ? ids : ['all'] }))
                    }}
                    formatOptionLabel={({ label, count, popularityScore }: TagOption & { popularityScore?: number }) => {
                        const score = popularityScore || 0
                        const stars = Array.from({ length: 5 }, (_, i) => i < score)
                        return (
                            <div className="filterbar-tag-option">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                                    <span>{label}</span>
                                    <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
                                        {stars.map((filled, i) => (
                                            <span
                                                key={i}
                                                style={{
                                                    fontSize: '0.75rem',
                                                    color: filled ? '#fbbf24' : '#d1d5db',
                                                    lineHeight: 1
                                                }}
                                            >
                                                ★
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                {count !== undefined && (
                                    <span className="filterbar-tag-count">
                                        {count}
                                    </span>
                                )}
                            </div>
                        )
                    }}
                    closeMenuOnSelect={false}
                    placeholder="Tags"
                    isDisabled={isTagsDisabled}
                    menuPortalTarget={menuPortalTarget}
                    menuPosition="fixed"
                    styles={secondaryMenuPortalStylesMulti}
                />

                {/* Organisateur - Priorité 4 */}
                <AsyncSelect
                    key={`org-${filters.organizerId || 'all'}`}
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
            </div>


        </div>
    )
}


export default FilterBar


