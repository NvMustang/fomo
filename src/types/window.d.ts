/**
 * FOMO MVP - Window Extensions
 * 
 * Déclarations globales pour les extensions Window utilisées dans l'application
 */

import type { Event } from './fomoTypes'

declare global {
    interface Window {
        // Map functions (MapRenderer.tsx)
        addTemporaryEventToMap?: (event: Event, isPublicMode: boolean) => void
        zoomOutMap?: () => void
        centerMapOnEvent?: (event: Event, duration?: number) => void
        getMap?: () => unknown // Type Map de maplibre-gl, évite l'import dans .d.ts
        startPublicModeSequence?: (targetZoom: number, duration: number) => void
        fadeOutFakePins?: () => void

        // Profile/LastActivities (LastActivities.tsx, App.tsx)
        setSelectedEventFromProfile?: (event: Event) => void
        navigateToMapPage?: () => void

        // Visitor onboarding (visitorOnboarding.tsx, DiscoverPage.tsx)
        __updateVisitorSelectedEventRef?: (event: Event | null) => void
        __closeEventCard?: () => void
        __openEventCard?: (event: Event) => void
        __onVisitorPinClick?: () => void
        __onVisitorEventCardOpened?: (event: Event) => void
        __onVisitorFakeEventCardOpened?: (event: Event) => void
        __hideVisitorToast?: () => void
        __onVisitorEventCardCloseWithToast?: () => void
        __showCloseEventCardToast?: () => void

        // Confetti loader (visitorOnboarding.tsx)
        __confettiLoader?: Promise<typeof import('canvas-confetti')>
    }
}

export { }


