# Parcours d'intégration d'un visiteur dans FOMO

## Vue d'ensemble

Ce document décrit étape par étape le parcours complet d'un visiteur qui arrive via un lien partagé (`?event=event-id`), depuis son arrivée jusqu'à sa transformation en utilisateur authentifié.

---

## Phase 1 : Arrivée du visiteur (non authentifié)

### 1.1 Arrivée via un lien partagé

**URL** : `https://app.fomo.com/?event=event-12345`

**Ce qui se passe** :
- L'application détecte le paramètre `event` dans l'URL
- Le système vérifie que l'utilisateur n'est pas authentifié
- Un identifiant temporaire de visiteur est créé : `visit-{timestamp}-{random}` (ex: `visit-1234567890-abc123`)
- Cet ID est stocké dans `sessionStorage` sous la clé `fomo-visit-user-id`

**Interface visible** :
- **WelcomeScreen** avec :
  - Logo FOMO (grande taille, 2xl)
  - Spinner de chargement animé
  - Message "Chargement..."
  - Fond dégradé avec animation fluide

### 1.2 Chargement de l'événement visitor

**Ce qui se passe** :
- Requête API vers `/api/events/{event-id}` pour récupérer les détails de l'événement
- L'événement est chargé et stocké dans le contexte `VisitorDataContext`
- Si l'événement n'existe pas ou erreur → message d'erreur affiché

**Interface visible** :
- Spinner continue de tourner pendant le chargement
- En cas d'erreur : message centré "Événement non trouvé" ou "Erreur de chargement"

### 1.3 Affichage de la page Discover en mode visitor

**Ce qui se passe** :
- L'événement est chargé avec succès
- `DiscoverPage` s'affiche en mode visitor (`isVisitorMode={true}`)
- `EventCard` est monté avec l'événement visitor
- La carte affiche l'événement partagé

**Interface visible** :
- **Header** en haut avec :
  - Logo FOMO à gauche (avec indicateur de privacy désactivé)
  - Bouton "Beta" au centre (fonctionnel, permet de donner un retour)
  - Toggle Public/Privé à droite (désactivé initialement, devient actif après complétion du formulaire)
- **Carte interactive** centrée sur l'événement visitor
- **EventCard** affichant :
  - Image de l'événement (ou image par défaut)
  - Titre de l'événement
  - Nom de l'organisateur
  - Date et heure formatées (ex: "mer. 15 jan. 2025 à 19:00")
  - Localisation (adresse complète ou "En ligne")
  - Description (expandable via bouton "Voir plus")
  - Boutons de réponse : **"J'y vais"**, **"Intéressé"**, **"Pas intéressé"** (boutons secondaires, pas encore sélectionnés)

---

## Phase 2 : Première interaction - Saisie des coordonnées

### 2.1 Clic sur un bouton de réponse (première fois)

**Scénario** : Le visiteur clique sur **"J'y vais"**, **"Intéressé"** ou **"Pas intéressé"**

**Ce qui se passe** :
- Le système vérifie si un nom a déjà été saisi (via `sessionStorage.getItem('fomo-visit-name')`)
- Si aucun nom n'est présent → ouverture du modal `VisitorNameModal`
- La réponse choisie est mise en attente (`pendingResponse`)

**Interface visible** :
- **Modal VisitorNameModal** s'ouvre en overlay :
  - **Message personnalisé** : "Laissez vos coordonnées à **{NomOrganisateur}** Pour être tenu informé des détails."
  - **Champ "Nom"** (requis, avec astérisque *) :
    - Input texte avec placeholder "Entrez votre nom"
    - Auto-focus activé
    - Validation requise (ne peut pas être vide)
  - **Champ "Email"** (optionnel) :
    - Input email avec placeholder "votre@email.com"
    - Pas de validation stricte
  - **Message d'aide** : "* Champ requis"
  - **Bouton "Confirmer"** (primary) :
    - Désactivé si le champ nom est vide
    - Devient actif dès qu'un caractère est saisi dans le nom
  - **Bouton "Annuler"** (ghost/secondary) :
    - Ferme le modal sans sauvegarder
    - Annule la réponse en attente

### 2.2 Confirmation du formulaire

**Scénario** : Le visiteur remplit son nom (et optionnellement son email) et clique sur **"Confirmer"**

**Ce qui se passe** :
1. Les données sont sauvegardées dans `sessionStorage` :
   - `fomo-visit-name` → nom du visiteur
   - `fomo-visit-email` → email si fourni
2. Le modal se ferme
3. La réponse en attente est exécutée :
   - Si la réponse choisie était déjà active → `cleared` (désélection)
   - Sinon → la nouvelle réponse est appliquée (`going`, `interested`, ou `not_interested`)
4. Si c'était la première fois (formulaire complété) :
   - Le toggle Public/Privé devient actif dans le Header
   - Un **Toast de succès** s'affiche :
     - **Titre** : "{NomOrganisateur} vous remercie pour votre réponse !"
     - **Message** : "Découvrez les événements autour de chez vous via le bouton en haut à droite."
     - **Type** : success
     - **Durée** : 5000ms (5 secondes)

**Interface visible** :
- Modal se ferme avec animation
- Les boutons de réponse dans `EventCard` se mettent à jour :
  - Le bouton correspondant à la réponse devient **primary** (activé)
  - Les autres restent **secondary** (inactifs)
- Toast de succès apparaît en bas de l'écran
- Le toggle Public/Privé dans le Header devient cliquable (opacité normale, curseur pointer)

### 2.3 Interactions suivantes (nom déjà saisi)

**Scénario** : Le visiteur clique sur un autre bouton de réponse

**Ce qui se passe** :
- Plus de modal (nom déjà présent en sessionStorage)
- Réponse appliquée immédiatement via `addEventResponse`
- Mise à jour visuelle instantanée des boutons

**Interface visible** :
- Changement immédiat de l'état des boutons (toggle visuel)
- Pas de modal, interaction fluide

---

## Phase 3 : Découverte et conversion

### 3.1 Utilisation du toggle Public/Privé

**Scénario** : Le visiteur clique sur le toggle Public/Privé (globe 🔓 / lock 🔒) dans le Header

**Ce qui se passe** :
- Le toggle devient actif après la première réponse avec nom
- Clic sur le globe → passage en mode Public
- Clic sur le cadenas → passage en mode Privé
- En mode Public, l'application affiche des **fake events** (événements teaser) sur la carte :
  - 50 pins générés aléatoirement dans un rayon de 50km autour de l'événement visitor
  - Ces pins ont des IDs fictifs (`fake-0`, `fake-1`, etc.)
- Clic sur un fake pin → affichage d'un message teaser (pas d'EventCard)

**Interface visible** :
- Animation du toggle (globe ↔ cadenas)
- En mode Public :
  - 50 pins supplémentaires apparaissent sur la carte
  - Clic sur un pin fake → message teaser :
    - "*[Message teaser à définir]*" (actuellement `showTeaserMessage` est géré mais le message exact n'est pas visible dans le code)
- En mode Privé :
  - Seul l'événement visitor reste visible

### 3.2 Cliquer sur le bouton "Beta"

**Scénario** : Le visiteur clique sur le bouton "Beta" dans le Header

**Ce qui se passe** :
- Ouverture du modal `BetaModal`

**Interface visible** :
- **Modal BetaModal** :
  - **Titre** : "Retour Beta"
  - **Bouton de fermeture** (×) en haut à droite
  - **Formulaire** :
    - **Champ "Sujet"** (requis) : Input texte, placeholder "Ex: Bug, Suggestion, Question..."
    - **Champ "Description"** (requis) : Textarea, placeholder "Décrivez votre retour en détail...", 20 lignes, min-height 300px
  - **Message d'erreur** si validation échoue
  - **Bouton "Soumettre"** (primary) :
    - Désactivé si sujet ou description vide
    - Affiche "Envoi..." pendant le chargement
  - Envoi vers `/api/beta` avec :
    - `userID` : ID du visitor (`visit-xxx`)
    - `topic` : sujet
    - `message` : description
    - `createAt` : timestamp ISO
  - **Toast de succès** après envoi : "Merci! Votre retour a été enregistré avec succès."

---

## Phase 4 : Transformation en utilisateur (connexion)

### 4.1 Déclenchement de la connexion

**Scénarios possibles** :

#### 4.1.1 Connexion automatique (visitor avec email existant)

**Quand** : Le visitor a fourni un email qui correspond à un utilisateur existant

**Ce qui se passe** :
1. Lors de la première réponse avec email, `VisitorDataContext` vérifie via `matchByEmail(email)`
2. Si un user avec cet email existe → connexion automatique
3. Le visitor ID (`visit-xxx`) est transformé en user ID (`user-xxx`)
4. Toutes les réponses du visitor sont migrées vers le user
5. `sessionStorage` est nettoyé (suppression de toutes les clés `fomo-visit-*`)
6. L'utilisateur est connecté et sauvegardé dans `localStorage` sous `fomo-user`

**Interface visible** :
- Transition automatique vers l'interface utilisateur complète
- Plus de mode visitor, accès à toutes les fonctionnalités

#### 4.1.2 Connexion via AuthModal (clic sur lien ou navigation)

**Quand** : Le visitor navigue vers la page d'accueil sans paramètre `?event=...` OU accède directement à l'app sans lien partagé

**Interface visible** :
- **WelcomeScreen** avec fond dégradé
- **Modal AuthModal** centré sur l'écran :
  - **Étape 1 : Vérification email**
    - **Titre** : "Bienvenue sur FOMO"
    - **Sous-titre** : "Renseignez votre email"
    - **Input email** :
      - Placeholder : "Ex: marie@exemple.com"
      - Auto-focus activé
      - Validation email (format valide requis)
      - Pré-rempli si email visitor existe dans sessionStorage
    - **Bouton "Continuer"** (primary) :
      - Désactivé si email vide
      - Affiche "Vérification..." pendant le chargement
    - **Message d'erreur** si email invalide ou erreur serveur

### 4.2 Après saisie de l'email

**Ce qui se passe** :
1. Vérification via `matchByEmail(email)`
2. **Cas A : User existant trouvé** (`user-xxx`)
   - Récupération des infos utilisateur via `checkUserByEmail`
   - Connexion automatique avec `login(name, city, email, existingUserData)`
   - Mise à jour de `lastConnexion` dans le backend
   - Transition immédiate vers l'app (pas d'étape 2)

3. **Cas B : Visitor existant trouvé** (`visit-xxx`)
   - Passage à l'étape 2 (création de profil)
   - Email pré-rempli et non modifiable

4. **Cas C : Aucun utilisateur trouvé**
   - Passage à l'étape 2 (création de profil)

**Interface visible - Cas A (User existant)** :
- Spinner pendant la connexion
- Transition fluide vers l'interface utilisateur complète
- Toast de bienvenue (si implémenté)

**Interface visible - Cas B et C (Nouveau profil)** :
- **Étape 2 : Création de profil**
  - **Titre** : "Créer votre profil"
  - **Bouton retour** (←) en haut à droite
  - **Sous-titre** : "Complétez votre profil"
  - **Formulaire** :
    - **Champ "Votre nom"** (requis) :
      - Input texte
      - Placeholder : "Ex: Marie Dupont"
      - Auto-focus
      - Pré-rempli si nom visitor existe dans sessionStorage
    - **Champ "Votre ville"** (requis) :
      - Input avec autocomplétion d'adresse (`AddressAutocomplete`)
      - Placeholder : "Ex: Bruxelles, New York, Paris..."
      - Validation de l'adresse requise (doit être une ville valide)
    - **Champ "Email"** (confirmé, non modifiable) :
      - Input disabled avec l'email de l'étape 1
      - Label : "Email (confirmé)"
  - **Message d'erreur** si :
    - Nom vide
    - Ville vide
    - Ville invalide
    - Erreur serveur lors de la création
  - **Bouton "Créer mon profil"** (primary) :
    - Désactivé si nom vide, ville vide, ou ville invalide
    - Affiche "Création..." pendant le chargement

### 4.3 Confirmation de la création de profil

**Scénario** : Le visiteur remplit nom + ville et clique sur "Créer mon profil"

**Ce qui se passe** :
1. **Si visitor existant avec email** :
   - Transformation de `visit-xxx` en `user-xxx`
   - Migration automatique des réponses du visitor vers le user
   - Nettoyage de `sessionStorage` (toutes les clés `fomo-visit-*` supprimées)

2. **Si nouveau utilisateur** :
   - Création d'un nouveau user avec ID `user-{timestamp}-{random}`
   - Sauvegarde dans le backend via `/api/users` (POST)

3. Sauvegarde dans `localStorage` sous `fomo-user`
4. Mise à jour de l'état d'authentification
5. Transition vers l'interface utilisateur complète

**Interface visible** :
- Spinner pendant la création
- Modal se ferme
- **WelcomeScreen** avec spinner (durant le chargement des données)
- Une fois les données chargées :
  - **App complète** s'affiche :
    - Header avec toutes les fonctionnalités
    - Carte avec tous les événements (pas seulement le visitor)
    - NavBar en bas (Map, Calendar, Chat, Profile)
    - Accès à toutes les pages

---

## Phase 5 : Utilisateur authentifié et fonctionnel

### 5.1 Interface complète disponible

**Éléments visibles** :
- **Header** :
  - Logo FOMO avec indicateur privacy actif
  - Bouton "Beta" (formulaire de retour)
  - Toggle Public/Privé (actif, permet de basculer entre modes)

- **Page Discover (Map)** :
  - Carte interactive avec tous les événements autour de l'utilisateur
  - Pins cliquables avec clustering
  - EventCards avec toutes les fonctionnalités
  - FilterBar pour filtrer par tags, dates, etc.

- **NavBar en bas** :
  - **Bouton Map** (page actuelle) : Icône carte
  - **Bouton Calendar** : Icône calendrier (vue liste des événements)
  - **Bouton Chat** : Icône message (conversations avec amis)
  - **Bouton Profile** : Icône utilisateur (profil, événements créés, amis)

### 5.2 Fonctionnalités disponibles

**Toutes les fonctionnalités d'un utilisateur** :
- ✅ Répondre aux événements (going, interested, not_interested)
- ✅ Créer des événements (bouton + dans la NavBar)
- ✅ Partager des événements (bouton partage dans EventCard sur page profil)
- ✅ Voir les événements sur la carte
- ✅ Filtrer les événements (tags, dates, localisation)
- ✅ Gérer son profil (modifier nom, ville, privacy)
- ✅ Ajouter des amis (via recherche ou liens partagés)
- ✅ Voir les conversations avec les amis
- ✅ Basculer entre mode Public et Privé

---

## Résumé du flux complet

```
1. Arrivée via lien → ?event=event-id
   ↓
2. Chargement → WelcomeScreen + spinner
   ↓
3. EventCard affiché → Mode visitor
   ↓
4. Clic sur réponse → Modal VisitorNameModal (nom + email optionnel)
   ↓
5. Confirmation → Réponse sauvegardée + Toast de remerciement
   ↓
6. [Optionnel] Toggle Public → Fake events teaser
   ↓
7. [Optionnel] Navigation sans paramètre → AuthModal
   ↓
8. Saisie email → Vérification (user/visitor/nouveau)
   ↓
9. Création profil (si nécessaire) → Nom + Ville
   ↓
10. Transformation visitor → user (migration automatique)
    ↓
11. Utilisateur connecté → Interface complète disponible
```

---

## Points techniques importants

### Stockage des données visitor
- `sessionStorage` :
  - `fomo-visit-user-id` : ID du visitor (`visit-xxx`)
  - `fomo-visit-name` : Nom du visitor
  - `fomo-visit-email` : Email du visitor (optionnel)

### Migration visitor → user
- Transformation automatique de `visit-xxx` en `user-xxx`
- Migration des réponses via `updateUser` avec `oldId`
- Nettoyage automatique de `sessionStorage` après migration

### Gestion des erreurs
- Événement non trouvé → Message d'erreur centré
- Erreur API → Message dans le modal/input
- Toast d'erreur pour les actions critiques

### Accessibilité
- Labels ARIA sur tous les inputs
- Focus visible (outline)
- Navigation clavier (Tab, Enter, Esc)
- Messages d'erreur clairs

---

*Document généré le : {{date}}*

