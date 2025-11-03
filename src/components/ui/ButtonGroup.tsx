import React from 'react'
import { Button } from '@/components'

type ButtonSize = 'sm' | 'md' | 'lg'
type ButtonVariant = 'primary' | 'secondary'

export interface ButtonGroupItem<V extends string> {
  value: V
  label: React.ReactNode
  disabled?: boolean
}

export interface ButtonGroupProps<V extends string> {
  items: ReadonlyArray<ButtonGroupItem<V>>
  value?: V | null // contrôlé (optionnel). Si omis -> mode non contrôlé
  defaultValue?: V | null // valeur initiale en mode non contrôlé
  onChange: (next: V | null) => void
  clearOnClickActive?: boolean // si true, re-cliquer l'actif remet à null
  size?: ButtonSize
  className?: string
  buttonClassName?: string
  ariaLabel?: string
}

/**
 * ButtonGroup générique contrôlé (exclusif) avec logique de toggle optionnelle.
 * - Source de vérité externe via props.value
 * - Aucune gestion d'état interne durable
 */
export function ButtonGroup<V extends string>(props: ButtonGroupProps<V>) {
  const {
    items,
    value,
    defaultValue = null,
    onChange,
    clearOnClickActive = true,
    size = 'md',
    className,
    buttonClassName,
    ariaLabel,
  } = props

  // Mode non contrôlé: conserver la sélection en interne si value n'est pas fourni
  const [internalValue, setInternalValue] = React.useState<V | null>(defaultValue)
  const selected: V | null = value !== undefined ? value : internalValue

  return (
    <div className={className} role="group" aria-label={ariaLabel}>
      {items.map((item) => {
        const isActive = selected === item.value
        const variant: ButtonVariant = isActive ? 'primary' : 'secondary'

        const handleClick = () => {
          const next = isActive && clearOnClickActive ? null : item.value
          // Mettre à jour l'état interne uniquement en mode non contrôlé
          if (value === undefined) {
            setInternalValue(next)
          }
          onChange(next)
        }

        return (
          <Button
            key={item.value}
            variant={variant}
            size={size}
            onClick={handleClick}
            className={buttonClassName}
            disabled={item.disabled}
          >
            {item.label}
          </Button>
        )
      })}
    </div>
  )
}

export default ButtonGroup


