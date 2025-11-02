# Unification de la logique d'affichage et masquage des EventCards

## Résumé
Unification complète de la gestion de l'affichage et du masquage des EventCards dans DiscoverPage, avec suppression de la différenciation entre mode visitor et mode normal.

## Modifications principales

### 1. Fermeture automatique lors du toggle privacy
- **Ajout** : L'EventCard se ferme automatiquement lors d'un clic sur le toggle privacy
- **Implémentation** : Création de `handleTogglePrivacyClick()` qui ferme l'EventCard via `setSelectedEvent(null)`
- **Fichier** : `src/pages/DiscoverPage.tsx`

### 2. Unification de la logique de fermeture
- **Avant** : Logique différente selon le mode (visitor vs normal) avec gestion de callback parent
- **Après** : Un seul état `selectedEvent` géré localement dans DiscoverPage
- **Supprimé** :
  - Props `visitorSelectedEvent` et `onVisitorSelectedEventChange`
  - Constante `actualSelectedEvent`
  - Fonction `closeEventCard` (remplacée par callback inline)
- **Fichiers modifiés** :
  - `src/pages/DiscoverPage.tsx`
  - `src/App.tsx` (suppression de la gestion d'état dans VisitorModeContent)

### 3. Création de handlers centralisés
- **`handleTogglePrivacyClick()`** : Gère la fermeture de l'EventCard et l'activation des pins fantômes en mode visitor
- **`handleCreateEventClick()`** : Gère la fermeture de l'EventCard lors de l'ouverture du modal de création
- **Fichier** : `src/pages/DiscoverPage.tsx`

### 4. Suppression de l'ouverture automatique en mode visitor
- **Avant** : L'EventCard s'ouvrait automatiquement au chargement si le formulaire n'était pas complété
- **Après** : L'utilisateur doit cliquer sur le pin pour ouvrir l'EventCard (comportement unifié)
- **Supprimé** : `useEffect` qui gérait l'ouverture automatique dans DiscoverPage et VisitorModeContent

### 5. Simplification de `handleEventClick`
- **Avant** : Désactivé en mode visitor avec `return` early
- **Après** : Fonctionne de la même manière dans tous les modes
- **Fichier** : `src/pages/DiscoverPage.tsx`

### 6. Simplification des handlers de fermeture
- Tous les handlers utilisent directement `setSelectedEvent(null)`
- Suppression de la fonction intermédiaire `closeEventCard`
- Callback `onClose` de l'EventCard : `() => setSelectedEvent(null)`

### 7. Simplification de la logique "Pas intéressé" dans EventCard
- **Supprimé** : `useEffect` qui surveillait les changements de réponse vers `"not_interested"`
- **Raison** : Le handler du bouton gère déjà toute la logique (animation + timeout + fermeture)
- **Avant** : Double gestion (handler du bouton + useEffect redondant)
- **Après** : Logique centralisée uniquement dans le handler du bouton
- **Fichier** : `src/components/ui/EventCard.tsx`

## Bénéfices

1. **Code simplifié** : Moins de code, moins de complexité
2. **Comportement unifié** : Même logique pour tous les modes (visitor et normal)
3. **Maintenabilité** : Plus facile à comprendre et modifier
4. **Cohérence** : Tous les handlers utilisent la même approche
5. **Réduction de duplication** : Suppression du useEffect redondant dans EventCard

## Fichiers modifiés

- `src/pages/DiscoverPage.tsx` : Unification de la logique, création de handlers, simplification
- `src/App.tsx` : Suppression de la gestion d'état dans VisitorModeContent
- `src/components/ui/EventCard.tsx` : Suppression du useEffect redondant pour "Pas intéressé"

## Breaking changes

- ⚠️ Suppression des props `visitorSelectedEvent` et `onVisitorSelectedEventChange` dans DiscoverPage
- ⚠️ Plus d'ouverture automatique de l'EventCard en mode visitor (nécessite un clic sur le pin)

