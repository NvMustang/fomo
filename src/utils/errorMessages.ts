/**
 * Messages d'erreur centralisés pour l'application
 * Utilisé par App.tsx et DataContext pour afficher des messages d'erreur cohérents
 */

export const ERROR_MESSAGES = {
    eventNotFound: 'On parvient pas à mettre la main sur l\'événement... Vérifie le lien',
    eventLoad: 'Nous ne parvenons pas à charger l\'événement 🤔 Essaye à nouveau dans quelques instant ! 🚀',
    eventsLoad: 'Nous ne parvenons pas à charger tes events 🤔 Essaye à nouveau dans quelques instant ! 🚀',
    dataLoad: 'Nous ne parvenons pas à charger les données 🤔 Essaye à nouveau dans quelques instant ! 🚀',
    eventLoadGeneric: 'Erreur lors du chargement de l\'événement'
} as const

/**
 * Configuration des CTA pour les erreurs
 * CTA spécifique pour eventNotFound (404) : rediriger vers welcome event
 * CTA par défaut pour les autres erreurs : recharger la page
 */
export const ERROR_CTA = {
    eventNotFound: {
        label: 'Découvrir FOMO',
        onClick: () => {
            const base = window.location.origin
            window.location.assign(`${base}/?event=evt_tester_000000`)
        }
    },
    default: {
        label: 'Réessayer',
        onClick: () => window.location.reload()
    }
} as const

