/**
 * Map utilities - Pure functions for colors and view state
 */

const warnedCssVars = new Set<string>()

/**
 * Récupère une variable CSS du root avec log si fallback utilisé
 */
export const getCSSVariable = (varName: string, fallback: string): string => {
  const color = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  if (!color) {
    if (!warnedCssVars.has(varName)) {
      console.warn(`[MapRenderer] CSS variable "${varName}" not found, using fallback`)
      warnedCssVars.add(varName)
    }
    return fallback
  }
  return color
}

/**
 * Récupère la couleur selon le mode public/private
 */
export const getPrivacyColor = (isPublicMode: boolean, varSuffix: string = ''): string => {
  const colorVar = isPublicMode ? `--pin-color-public${varSuffix}` : `--pin-color-private${varSuffix}`
  const fallback = isPublicMode ? '#ed4141' : '#3b82f6'
  return getCSSVariable(colorVar, fallback)
}

/**
 * Position par défaut de la carte (Belgique ou ville de l'utilisateur si définie)
 */
export const getDefaultViewState = (userLat?: number | null, userLng?: number | null) => {
  if (userLat && userLng) {
    return {
      latitude: userLat,
      longitude: userLng,
      zoom: 10,
      bearing: 0,
      pitch: 0,
    }
  }
  // Fallback : Belgique
  return {
    latitude: 50.5,
    longitude: 5,
    zoom: 7,
    bearing: 0,
    pitch: 0,
  }
}

