# Scripts d'analyse et maintenance

## Scripts à garder (utiles)

### `analyze-analytics-data.js`
**Usage**: `npm run analyze:analytics:prod`
**Description**: Analyse complète des données analytics (erreurs, doublons, répartition, etc.)
**À garder**: ✅ Oui - Analyse principale

### `analyze-onboarding-data.js`
**Usage**: `npm run analyze:onboarding:prod`
**Description**: Analyse des données d'onboarding (sessions, abandons, durées, etc.)
**À garder**: ✅ Oui - Analyse onboarding

### `analyze-maptiler-requests.js`
**Usage**: `node scripts/analyze-maptiler-requests.js --prod`
**Description**: Analyse détaillée des requêtes MapTiler (tiles vs API, erreurs, patterns)
**À garder**: ✅ Oui - Analyse MapTiler spécifique

### `cleanup-test-data.js`
**Usage**: `npm run cleanup:analytics`
**Description**: Nettoie les données de test et réinitialise avec une valeur MapTiler de référence
**À garder**: ✅ Oui - Maintenance utile

## Scripts redondants (à supprimer)

### `compare-analytics-count.js`
**Raison**: Script de debug ponctuel, redondant avec `analyze-analytics-data.js`
**Action**: ❌ Supprimer

### `analyze-tile-patterns.js`
**Raison**: Redondant avec `analyze-maptiler-requests.js` qui fait déjà l'analyse des tiles
**Action**: ❌ Supprimer

### `analyze-duplicate-patterns.js`
**Raison**: Analyse utile mais peut être intégrée dans `analyze-analytics-data.js`
**Action**: ⚠️ Optionnel - peut être gardé pour analyse spécifique des doublons

