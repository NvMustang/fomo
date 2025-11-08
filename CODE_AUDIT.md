# Audit du code vs Documentation

**Date** : Audit complet après refactoring
**Objectif** : Vérifier conformité doc/code et simplifier useEffect/useState

---

## ✅ Conformité avec la documentation

### Étape par étape

#### Étape 0 : Détection et chargement
- ✅ Code : `useLoadVisitorEvent` détecte `?event=XXX` et charge l'événement
- ✅ Conforme

#### Étape 1 : Initialisation
- ✅ Code : Toggle désactivé, tracking démarré
- ✅ Cas B : `visitorRegistrationCompleted` devient `true` si `hasUserAndResponse`
- ✅ **Simplifié** : Le useEffect s'exécute une seule fois au montage (pas besoin de réagir aux changements)

#### Étape 2 : FlyTo (commun aux deux cas)
- ✅ Code : FlyTo se lance après 1s (ligne 119-130)
- ✅ Conforme - maintenant commun aux deux cas

#### Étape 3 : Toast après flyTo
- ✅ Cas A : Toast "Tu es invité" (ligne 137-148) - condition `hasExistingResponse`
- ✅ Cas B : Pas de toast invitation
- ✅ Conforme

#### Étape 4 : Clic sur pin
- ✅ Code : `handlePinClick` ferme le toast (ligne 245-250)
- ✅ Conforme

#### Étape 5 : Toast détails (3s après ouverture)
- ✅ Code : `handleEventCardOpened` avec setTimeout 3s (ligne 227-241)
- ✅ Conforme

#### Étape 6 : Clic sur étiquette
- ✅ Code : Callback `onButtonsActivated` passé à EventCard (ligne 257)
- ✅ Conforme - Plus de window function, callback direct

#### Étape 7 : Toast impatience (5s après activation)
- ✅ Code : setTimeout dans `activateButtons` (ligne 285-315)
- ✅ Conforme

#### Étape 8 : Clic sur réponse
- ✅ Cas A : Animation étoiles → Modal → Confirmation → Toast éducatif
- ✅ Cas B : Animation étoiles → Toast "Bonjour" après 4s (ligne 105-114)
- ✅ Conforme

#### Étape 9 : Fermeture EventCard
- ✅ Toast "Merci" immédiat (ligne 407-416)
- ✅ Toast "Pssst!" après 2s (ligne 429-446)
- ✅ Conforme

#### Section 2 : Étape 10 - Toggle privacy
- ✅ Toast "Bienvenu en mode public" immédiatement (ligne 65-73)
- ✅ Fake pins activés (ligne 76)
- ✅ Conforme

#### Section 2 : Étape 11 - Zoom-out
- ✅ Démarre 200ms après toggle (ligne 82-91)
- ✅ Conforme

#### Section 2 : Étape 13-16
- ✅ Conforme

---

## 🔍 useEffect/useState à simplifier

### 1. `useGetVisitorResponse.tsx`

#### ✅ Ligne 72-102 : useEffect pour vérifier hasExistingResponse
**Avant** : Surveillait plusieurs dépendances et se ré-exécutait à chaque changement
**Problème** : Ces valeurs ne changent pas pendant l'exécution du visitor mode
**Solution** : Ajout d'un ref `hasCheckedExistingResponseRef` pour n'exécuter qu'une seule fois au montage
**Action** : ✅ SIMPLIFIÉ - Exécution unique au montage

#### ❌ Ligne 106-154 : useEffect pour flyTo et toast invitation
**Problème** : Contient deux setTimeout imbriqués
**Solution** : Pourrait être simplifié en séparant flyTo et toast
**Action** : ⚠️ SIMPLIFIER - Séparer flyTo et toast invitation

#### ✅ Ligne 167 : Synchronisation selectedEventRef
**Avant** : useEffect qui exposait window.__updateVisitorSelectedEventRef
**Après** : Callback `onUpdateSelectedEventRef` passé directement via props
**Action** : ✅ SIMPLIFIÉ - Plus de window function, callback direct

#### ❌ Ligne 168-209 : useEffect pour isAuthenticated
**Problème** : Logique complexe avec plusieurs setTimeout imbriqués
**Solution** : Nécessaire pour réagir à l'authentification
**Action** : ✅ GARDER - Nécessaire pour réactivité

#### ✅ Ligne 254 : Callbacks exposés via props
**Avant** : useEffect qui exposait window.__onVisitorEventCardOpened, __onVisitorPinClick, __hideVisitorToast
**Après** : Callbacks passés directement via props (onEventCardOpened, onPinClick, onHideToast)
**Action** : ✅ SIMPLIFIÉ - Plus de window functions, callbacks directs

#### ✅ Ligne 275-323 : Callback handleButtonsActivated (remplace useEffect)
**Avant** : useEffect qui exposait window.__activateVisitorButtons
**Problème** : Over-engineered, state dynamique inutile
**Solution** : Callback `onButtonsActivated` passé à EventCard, EventCard gère l'état local des boutons
**Action** : ✅ SIMPLIFIÉ - Plus de state dynamique, EventCard gère l'activation localement

#### ✅ Ligne 340-344 : showCloseEventCardToast exposé directement
**Avant** : useEffect qui exposait window.__showCloseEventCardToast
**Après** : Fonction exposée directement via return du hook, passée à useVisitorResponseHandlers
**Action** : ✅ SIMPLIFIÉ - Plus de window function, fonction exposée directement

### 2. `useVisitorResponseHandlers.tsx`

#### ❌ Ligne 39-40 : useState pour modal
**Problème** : État local pour le modal
**Solution** : Nécessaire pour contrôler l'ouverture/fermeture du modal
**Action** : ✅ GARDER - État UI nécessaire

### 3. `visitorDiscoverPublicMode.tsx`

#### ❌ Ligne 42-43 : useState pour showRegistrationButton et hasShownFakeEventsToast
**Problème** : `hasShownFakeEventsToast` est utilisé uniquement pour déclencher un useEffect
**Solution** : Pourrait utiliser uniquement un ref
**Action** : ⚠️ SIMPLIFIER - Remplacer `hasShownFakeEventsToast` par un ref

#### ❌ Ligne 51-54 : useEffect pour activer toggle
**Problème** : Surveille `visitorRegistrationCompleted`
**Solution** : Pourrait être appelé directement dans le parent
**Action** : ⚠️ SIMPLIFIER - Déplacer dans le parent ou appeler directement

#### ❌ Ligne 57-92 : useEffect pour toggle privacy
**Problème** : Surveille `isPublicMode` et `visitorRegistrationCompleted`
**Solution** : Nécessaire pour réagir au changement de mode
**Action** : ✅ GARDER - Nécessaire pour réactivité

#### ❌ Ligne 96-100 : useEffect pour désactiver fake pins
**Problème** : Surveille `isPublicMode`
**Solution** : Nécessaire pour réagir au changement de mode
**Action** : ✅ GARDER - Nécessaire pour réactivité

#### ❌ Ligne 139-148 : useEffect pour afficher le bouton
**Problème** : Surveille `hasShownFakeEventsToast` (state)
**Solution** : Pourrait utiliser un ref au lieu d'un state
**Action** : ⚠️ SIMPLIFIER - Utiliser un ref

#### ✅ Ligne 140-150 : handleFakeEventCardOpened exposé via ref
**Avant** : useEffect qui exposait window.__onVisitorFakeEventCardOpened
**Après** : Callback exposé via ref (onFakeEventCardOpenedRef), passé à DiscoverPage via visitorMode
**Action** : ✅ SIMPLIFIÉ - Plus de window function, callback via ref

---

## 🎯 Simplifications appliquées

### ✅ 1. Simplifié `hasShownFakeEventsToast` dans visitorDiscoverPublicMode
**Avant** : useState + useEffect séparé
**Après** : Utilisation directe du ref, setTimeout dans handleFakeEventCardOpened
**Résultat** : Suppression d'un useState et d'un useEffect

### ✅ 2. Séparé flyTo et toast invitation dans useGetVisitorResponse
**Avant** : Un seul useEffect avec deux setTimeout imbriqués
**Après** : Trois useEffect séparés (initialisation, flyTo, toast invitation)
**Résultat** : Code plus clair, chaque étape isolée

### ✅ 3. Déplacé l'activation du toggle dans le parent
**Avant** : useEffect dans visitorDiscoverPublicMode
**Après** : useEffect dans visitorOnboarding
**Résultat** : Logique centralisée dans le parent

### ✅ 4. Simplifié l'activation des boutons (remplacement du useEffect)
**Avant** : State `responseButtonsDisabled` dynamique + useEffect qui expose `window.__activateVisitorButtons`
**Après** : Calcul simple `responseButtonsDisabled = !hasExistingResponse` + callback `onButtonsActivated` passé à EventCard
**Résultat** : EventCard gère l'état local des boutons, plus de state dynamique inutile, plus de window function

### ✅ 5. Remplacé toutes les window functions par des props (récent)
**Avant** : 7 window functions utilisées pour communication inter-composants
**Après** : Toutes remplacées par des callbacks passés via props dans `visitorMode`
**Résultat** : 
- `__updateVisitorSelectedEventRef` → `onUpdateSelectedEventRef` prop
- `__onVisitorEventCardOpened` → `onEventCardOpened` prop
- `__onVisitorPinClick` → `onPinClick` prop
- `__hideVisitorToast` → `onHideToast` prop
- `__showCloseEventCardToast` → `showCloseEventCardToast` exposé directement
- `__onVisitorFakeEventCardOpened` → `onFakeEventCardOpened` via ref
- `__closeEventCard` / `__openEventCard` → supprimés (gérés via setSelectedEvent)
**Bénéfices** : Flux de données explicite, typage TypeScript complet, plus facile à tester, pas de pollution globale

### ✅ 6. Simplifié useFakePins : suppression de showTeaserPins et appel API (récent)
**Avant** : 
- `showTeaserPins` state pour contrôler le chargement
- Appel API Pexels pour charger les images
- 2 useEffect pour gérer le chargement et la réinitialisation
- useEffect dans visitorDiscoverPublicMode pour désactiver showTeaserPins en mode privé

**Après** : 
- Fake events chargés en dur avec toutes leurs props (y compris coverUrl)
- Plus d'appel API, plus de `showTeaserPins`
- Filtrage automatique avec `matchPublic()` dans `getAllMapEvents`
- Plus de useEffect pour synchroniser `showTeaserPins` avec `isPublicMode`

**Résultat** : 
- Suppression de 3 useEffect (useFakePins : 2, visitorDiscoverPublicMode : 1)
- Suppression de 1 useState (`showTeaserPins`)
- Suppression de l'appel API Pexels
- Code plus simple : filtrage déclaratif avec `matchPublic()` au lieu de logique impérative

**Bénéfices** : Code plus simple, pas d'appel API inutile, filtrage cohérent avec les événements réels

---

## 📝 useEffect/useState conservés et pourquoi

### useGetVisitorResponse.tsx
1. **Ligne ~72-102** : ✅ Simplifié - S'exécute une seule fois au montage (ref pour éviter les re-exécutions)
2. **Ligne ~106-115** : ✅ Nécessaire - Initialisation (tracking, toggle) - Séparé pour clarté
3. **Ligne ~117-135** : ✅ Nécessaire - FlyTo (commun aux deux cas) - Séparé pour clarté
4. **Ligne ~137-165** : ✅ Nécessaire - Toast invitation (Cas A uniquement) - Séparé pour clarté
5. **Ligne ~167** : ✅ Simplifié - Plus de useEffect, callback `onUpdateSelectedEventRef` passé via props
6. **Ligne ~170-211** : ✅ Nécessaire - Réagit à l'authentification
7. **Ligne ~254** : ✅ Simplifié - Plus de useEffect, callbacks passés directement via props
8. **Ligne ~257-323** : ✅ Simplifié - Callback `handleButtonsActivated` (remplace useEffect + window function)
9. **Ligne ~340-344** : ✅ Simplifié - Plus de useEffect, `showCloseEventCardToast` exposé directement

### useVisitorResponseHandlers.tsx
1. **Ligne 39-40** : ✅ Nécessaire - État UI pour le modal (showVisitorModal, selectedResponseType)
   - **Justification** : Logique complexe encapsulée (animation, conditions, timing). Le parent n'a pas besoin de contrôler directement. Usage unique. MVP > Over-engineering.

### visitorDiscoverPublicMode.tsx
1. **Ligne ~42** : ✅ Nécessaire - État UI pour le bouton d'inscription (showRegistrationButton)
   - **Justification** : Affichage conditionnel dans le JSX (nécessite re-render). Logique de timing encapsulée. Usage unique.
2. **Ligne ~52-92** : ✅ Nécessaire - Réagit au changement de mode public (isPublicMode)
3. **Ligne ~91** : ✅ SIMPLIFIÉ - Plus de useEffect pour désactiver fake pins (filtrage automatique avec matchPublic dans getAllMapEvents)
4. **Ligne ~140-150** : ✅ Simplifié - Plus de window function, callback exposé via ref (onFakeEventCardOpenedRef)

### visitorOnboarding.tsx
1. **Ligne ~136-139** : ✅ Nécessaire - Active le toggle quand visitorRegistrationCompleted devient true
2. **Ligne ~134** : ✅ Nécessaire - Ref pour exposer handleFakeEventCardOpened depuis visitorDiscoverPublicMode

---

## 🎉 État actuel : Toutes les window functions remplacées

**Statut** : ✅ **TERMINÉ** - Toutes les window functions ont été remplacées par des props/callbacks

**Résultat** :
- ✅ Flux de données explicite (top-down via props)
- ✅ Typage TypeScript complet
- ✅ Plus facile à tester (mocks simples)
- ✅ Pas de pollution globale (plus de modification de `window`)
- ✅ Code plus maintenable (dépendances visibles)

**Exception** : `window.__closeEventCard` reste dans `PrivacyContext` pour fermer l'EventCard avant le toggle privacy (cas spécial, peut rester pour l'instant)

