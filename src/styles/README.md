# FOMO Styles

## Files
- base.css: variables, reset, aliases, breakpoints
- layout.css: containers, flex/grid utilities, spacing, responsive helpers
- components.css: main components import file (imports all component modules)
- components/_buttons.css: button styles
- components/_forms.css: form input styles
- components/_modals.css: modal overlay and container styles
- components/_navigation.css: navigation bar and icons
- components/_events.css: event card styles
- components/_overlays.css: overlay and backdrop styles
- components/_friends.css: friends and user card styles
- components/_profile.css: profile page styles
- components/_calendar.css: calendar page styles
- components/_loading.css: loading states and welcome screen
- components/_animations.css: keyframes and animation utilities
- components/_utilities.css: utility classes
- components/_filterbar.css: filter bar styles

## Generic classes
- Buttons: `.button`, `.button.primary`, `.button.secondary`, `.button.ghost`, `.circular-button`
- Cards: `.event-card`, `.card`
- Inputs: `.form-input`, `.form-label`
- Modals: `.modal-overlay`, `.modal-container`, `.modal`, `.modal-content`
- Layout: utilities in layout.css and _utilities.css

## Variables
- Transitions: `--transition-fast: 0.15s ease-in-out;`, `--transition-medium: 0.25s ease-in-out;`
- Colors: `--primary`, `--text`, `--text-muted`, `--white`, `--black`, plus privacy colors (`--color-public`, `--color-private`)
- Spacing: `--xs, --sm, --md, --lg, --xl`
- Typography sizes: `--text-xs, --text-sm, --text-md, --text-lg, --text-xl, --text-2xl`

## Conventions
- BEM allégé: `.component--variant`
- Pas de styles inline; préférer classes génériques
- Réutiliser couleurs, espacements et transitions via variables
