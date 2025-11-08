/**
 * FOMO MVP - Email Validation Utility
 * 
 * Fonction de validation d'email partagée entre tous les modals
 */

import { VALID_TLDS } from '@/types/fomoTypes'

/**
 * Valide une adresse email selon les règles FOMO
 * @param email - L'adresse email à valider
 * @returns true si l'email est valide, false sinon
 */
export const isValidEmail = (email: string): boolean => {
    if (!email || !email.trim()) {
        return false
    }

    const emailTrimmed = email.trim()
    const atIndex = emailTrimmed.indexOf('@')
    const dotIndex = emailTrimmed.lastIndexOf('.')

    // Vérifier qu'il y a un @ et un point après le @
    if (atIndex === -1 || dotIndex === -1 || dotIndex <= atIndex) {
        return false
    }

    // Vérifier qu'il y a des caractères avant le @
    if (atIndex === 0) {
        return false
    }

    // Vérifier qu'il y a des caractères entre le @ et le point
    if (dotIndex - atIndex <= 1) {
        return false
    }

    // Vérifier qu'il y a des caractères après le point
    if (dotIndex === emailTrimmed.length - 1) {
        return false
    }

    // Vérifier que le TLD (domaine principal) est valide
    const tld = emailTrimmed.substring(dotIndex + 1).toLowerCase()

    if (!VALID_TLDS.includes(tld as typeof VALID_TLDS[number])) {
        return false
    }

    return true
}

