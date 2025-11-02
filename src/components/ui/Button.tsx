/**
 * FOMO MVP - Button Component
 * 
 * Composant bouton réutilisable avec différentes variantes
 */

import React from 'react'
import { Link } from 'react-router-dom'


type ButtonBase = {
    variant?: 'primary' | 'secondary' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
    className?: string
    children: React.ReactNode
}

type ButtonAsButton = ButtonBase & {
    as?: 'button'
} & React.ButtonHTMLAttributes<HTMLButtonElement>

type ButtonAsLink = ButtonBase & {
    as: 'link'
    to: string
} & React.AnchorHTMLAttributes<HTMLAnchorElement>

type ButtonAsAnchor = ButtonBase & {
    as: 'a'
    href: string
} & React.AnchorHTMLAttributes<HTMLAnchorElement>

export type ButtonProps = ButtonAsButton | ButtonAsLink | ButtonAsAnchor

export function Button(props: ButtonProps) {
    const {
        variant = 'primary',
        size = 'md',
        children,
        className = 'primary',
        ...rest
    } = props as any

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

    if ((props as ButtonAsLink).as === 'link') {
        const { to, ...linkProps } = rest as any
        return (
            <Link to={to} className={classes} {...linkProps}>
                {children}
            </Link>
        )
    }

    if ((props as ButtonAsAnchor).as === 'a') {
        const { href, ...anchorProps } = rest as any
        return (
            <a href={href} className={classes} {...anchorProps}>
                {children}
            </a>
        )
    }

    return (
        <button className={classes} {...(rest as any)}>
            {children}
        </button>
    )
}
