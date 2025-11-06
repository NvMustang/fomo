/**
 * FOMO MVP - Button Component
 * 
 * Composant bouton réutilisable avec différentes variantes
 */

import React from 'react'

type ButtonBase = {
    variant?: 'primary' | 'secondary' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
    className?: string
    children: React.ReactNode
}

type ButtonAsButton = ButtonBase & {
    as?: 'button'
} & React.ButtonHTMLAttributes<HTMLButtonElement>

type ButtonAsAnchor = ButtonBase & {
    as: 'a'
    href: string
} & React.AnchorHTMLAttributes<HTMLAnchorElement>

export type ButtonProps = ButtonAsButton | ButtonAsAnchor

export function Button(props: ButtonProps) {
    const {
        variant = 'primary',
        size = 'md',
        children,
        className = 'primary',
        ...rest
    } = props

    const baseClasses = 'button'
    const variantClasses = {
        primary: 'primary',
        secondary: 'secondary',
        ghost: 'ghost'
    }
    const sizeClasses = {
        sm: '',
        md: '',
        lg: ''
    }

    const classes = [
        baseClasses,
        variantClasses[variant as keyof typeof variantClasses],
        sizeClasses[size as keyof typeof sizeClasses],
        className
    ].filter(Boolean).join(' ')

    if ('as' in props && props.as === 'a') {
        const { href, ...anchorProps } = rest as ButtonAsAnchor
        return (
            <a href={href} className={classes} {...anchorProps}>
                {children}
            </a>
        )
    }

    return (
        <button className={classes} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
            {children}
        </button>
    )
}
