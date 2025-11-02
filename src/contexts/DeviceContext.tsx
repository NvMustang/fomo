/**
 * FOMO MVP - Device/Platform Context
 * 
 * Contexte centralisé pour gérer la détection de plateforme et navigateur :
 * - Détection de plateforme (mobile vs desktop)
 * - Configuration des variables CSS selon le navigateur
 * - Configuration des contrôles de carte selon la plateforme
 * 
 
 */

import React, { useState, createContext, useContext } from 'react'

export interface PlatformInfo {
    isMobile: boolean
    isDesktop: boolean
    browser: 'chrome' | 'safari' | 'brave' | 'other'
    userAgent: string
}

export interface MapControls {
    dragPan: boolean
    scrollZoom: boolean
    boxZoom: boolean
    touchZoomRotate: boolean
    viewportMonitoring: boolean
}

// Contexte pour partager les informations de plateforme
const DeviceContext = createContext<{
    isInitialized: boolean
    platformInfo: PlatformInfo | null
    mapControls: MapControls | null
}>({
    isInitialized: false,
    platformInfo: null,
    mapControls: null
})

// Hook pour accéder au contexte
export const useDevice = () => useContext(DeviceContext)

// Provider du contexte
export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // === ENVIRONMENT SETUP SYNCHRONE ===
    // Toute la logique de configuration d'environnement est exécutée immédiatement au montage
    const [platformInfo] = useState<PlatformInfo>(() => {
        // === DÉTECTION DE PLATEFORME ===
        const userAgent = navigator.userAgent
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ||
            ('ontouchstart' in window)

        const isDesktop = !isMobile

        // === DÉTECTION DU NAVIGATEUR ===
        const isBrave = /Brave/.test(userAgent)
        const isChrome = /Chrome/.test(userAgent) && !/Brave/.test(userAgent)
        const isSafari = /Safari/.test(userAgent) && !/Chrome/.test(userAgent) && !/Brave/.test(userAgent)

        let browser: PlatformInfo['browser'] = 'other'
        if (isBrave) browser = 'brave'
        else if (isChrome) browser = 'chrome'
        else if (isSafari) browser = 'safari'

        // === CONFIGURATION DES VARIABLES CSS ===
        let navbarHeight = '80px' // Valeur par défaut

        switch (browser) {
            case 'brave':
                navbarHeight = '100px'
                break
            case 'safari':
                navbarHeight = '70px'
                break
            case 'chrome':
                navbarHeight = '80px'
                break
            default:
                navbarHeight = '80px'
        }

        // Définir la variable CSS immédiatement
        document.documentElement.style.setProperty('--navbar-height', navbarHeight)

        // === LOGS DE DEBUG ===
        console.log(`📱 DeviceContext - ${isMobile ? 'Mobile' : 'Desktop'} - ${browser}`)

        // Retourner les informations de plateforme
        return {
            isMobile,
            isDesktop,
            browser,
            userAgent
        }
    })

    const [mapControls] = useState<MapControls>(() => {
        // === CONFIGURATION DES CONTRÔLES DE CARTE ===
        const userAgent = navigator.userAgent
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent) ||
            ('ontouchstart' in window)

        return isMobile ? {
            // Configuration mobile
            dragPan: false, // Désactivé par défaut, contrôlé par viewport
            scrollZoom: false, // Désactivé par défaut, contrôlé par viewport
            boxZoom: false, // Désactivé sur mobile
            touchZoomRotate: true, // Activé pour pinch-zoom
            viewportMonitoring: true // Surveillance du viewport pour la barre d'adresse
        } : {
            // Configuration desktop
            dragPan: true, // Activé immédiatement
            scrollZoom: true, // Activé immédiatement
            boxZoom: true, // Activé sur desktop
            touchZoomRotate: true, // Activé pour compatibilité
            viewportMonitoring: false // Pas de surveillance nécessaire
        }
    })

    return React.createElement(DeviceContext.Provider, {
        value: {
            isInitialized: true, // Toujours true maintenant
            platformInfo,
            mapControls
        }
    }, children)
}