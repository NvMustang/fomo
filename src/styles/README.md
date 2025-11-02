# FOMO Styles

## Files
- base.css: variables, reset, aliases, breakpoints
- layout.css: containers, flex/grid utilities, spacing, responsive helpers
- components.css: generic UI primitives (btn, card, input, badge, modal)
- animations.css: keyframes and animation utilities
- typography.css: headings and text color utilities
- friends.css, events.css: feature-specific styles (temporary during refactor)

## Generic classes
- Buttons: `.btn`, `.btn--primary`, `.btn--outline`, `.btn--success`, `.btn--danger`, `.btn--sm`, `.btn--lg`
- Cards: `.card`, `.card--hover`
- Inputs: `.input`, `.select`, `.textarea`
- Badges: `.badge`, `.badge--neutral|success|warning|error`
- Modals: `.modal-backdrop`, `.modal`, `.modal__header`, `.modal__title`, `.modal__body`, `.modal__footer`
- Layout: `.container`, `.flex`, `.flex-col`, `.items-center`, `.justify-between`, `.grid`, `.grid-auto-200|320`, `.gap-sm|md|lg`
- Typography: `.heading-lg`, `.heading-md`, `.text-muted`, `.text-secondary`

## Variables
- Transitions: `--transition-fast: 0.15s ease-in-out;`, `--transition-medium: 0.25s ease-in-out;`
- Colors: `--primary`, `--text`, `--text-muted`, `--white`, `--black`, plus privacy colors
- Spacing: `--xs, --sm, --md, --lg, --xl`
- Typography sizes: `--text-xs, --text-sm, --text-md, --text-lg, --text-xl, --text-2xl`

## Conventions
- BEM allégé: `.component--variant`
- Pas de styles inline; préférer classes génériques
- Réutiliser couleurs, espacements et transitions via variables


