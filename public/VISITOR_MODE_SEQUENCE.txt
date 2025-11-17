# Séquence complète du Visitor Mode

## 🎯 Vue d'ensemble

Le visitor mode est déclenché quand un utilisateur arrive sur l'app via un lien contenant `?event=XXX`.

**Architecture :**
- `VisitorIntegrationWrapper` : Point d'entrée (détecte le mode visitor)
- `VisitorModeApp` : Composant wrapper pour le mode visitor
- `VisitorOnboarding` : Orchestrateur principal qui assemble tout

---

## 📋 SÉQUENCE COMPLÈTE

### **ÉTAPE 0 : Détection et chargement** 
**Hook : `useLoadVisitorEvent`** (anciennement `useVisitorOnboarding`)

1. Détecte `?event=XXX` dans l'URL
2. Charge l'événement depuis l'API
3. Retourne `visitorEvent`, `isLoadingVisitorEvent`, `isVisitorMode`

**Fichier :** `src/onboarding/hooks/useLoadVisitorEvent.tsx`

---

### **SECTION 1 : getVisitorResponse** 
**Hook : `useGetVisitorResponse`** (gère toute la section 1)

#### **Étape 1 : Initialisation (0s)**
- Toggle privacy désactivé
- Tracking de session démarré
- **Cas B uniquement** : Si `hasUserAndResponse` est vrai → `visitorRegistrationCompleted` devient `true`

#### **Étape 2 : FlyTo vers l'événement (1s → 4s) - Commun aux deux cas**
- Après 1s : Lance `flyTo` vers l'événement (animation 3s)
- La carte se centre sur l'événement

#### **Étape 3 : Toast après flyTo (4s)**
**Cas A : Nouveau visiteur (pas de réponse existante)**
- Toast en bas : "Tu es invité à [événement]! 👋"
- Message : "Tap sur le pin bleu pour afficher l'événement !"
- Attend le clic sur le pin

**Cas B : Visiteur existant avec réponse (hasUserAndResponse)**
- Toast en haut : "Bonjour [Nom], comment ça va aujourd'hui ? 👋"
- Message : "Voulez-vous modifier votre réponse à [Événement] ?"
- Durée : 8s

#### **Étape 4 : Clic sur le pin**
- L'EventCard s'ouvre
- Le toast invitation se ferme
- Tracking : `eventcard_opened`

#### **Étape 5 : Toast détails (3s après ouverture EventCard)**
- Toast en haut : "Tu veux plus de détails ? 👀"
- Message : "Tap sur l'étiquette de l'événement !"
- Attend le clic sur l'étiquette

#### **Étape 6 : Clic sur l'étiquette**
- Les détails de l'EventCard s'étendent
- Les boutons de réponse s'activent
- Le toast détails se ferme
- Tracking : `details_expanded`, `buttons_activated`
- **Timer du toast impatience démarre** (5s après le clic sur l'étiquette)

#### **Étape 7 : Toast impatience (5s après clic sur l'étiquette)**
- Toast en haut : "[Organisateur] attend ta réponse avec impatience ! ⏰"
- Message : "Seras-tu présent ?"
- Attend le clic sur une réponse

#### **Étape 8 : Clic sur une réponse**
**Hook : `useVisitorResponseHandlers`** (gère les interactions)

1. **Animation des étoiles se joue** (commune aux deux cas)

**Cas A : Nouveau visiteur (pas de réponse existante)**
2. À la fin de l'animation → Modal d'inscription s'ouvre
3. L'utilisateur remplit : nom, email (optionnel), ville (optionnel)
4. À la confirmation :
   - Création/mise à jour du visiteur dans la DB
   - Sauvegarde en sessionStorage
   - `visitorRegistrationCompleted` devient `true`
   - Toast éducatif : "Pour fermer l'event card, tu peux tap en dehors de l'étiquette 🫵" (après 2s) - **Mutualisé avec Cas B**
   - EventCard reste ouverte (l'utilisateur doit la fermer manuellement)

**Cas B : Visiteur existant avec réponse (hasUserAndResponse)**
2. La réponse est sauvegardée directement (pas de modal)
3. Toast éducatif : "Pour fermer l'event card, tu peux tap en dehors de l'étiquette 🫵" (après 2s) - **Mutualisé avec Cas A**
4. EventCard reste ouverte (l'utilisateur peut la fermer manuellement)

#### **Étape 9 : Fermeture de l'EventCard**
**Hook : `useGetVisitorResponse.handleEventCardClose`**

1. La réponse est envoyée à la DB (via `EventCard.handleClose`)
2. Toast remerciement : "Merci pour ta réponse ! 🙏" (immédiat)
3. Tracking : `getVisitorResponse_completed`
4. **Toast "Pssst!" après 5s** (uniquement si le toggle privacy n'a pas été activé) :
   - "Pssst! 👀"
   - "Sait-on que sur FOMO, tu peux aussi découvrir les events publics autour de chez toi ?"
   - "Bascule en mode public via un tap sur le bouton en haut à droite !"
   - **Note :** Ne s'affiche pas si `isPublicMode === true` (toggle privacy déjà activé)
5. Tracking : `pssst_toast_shown`, `visitorDiscoverPublicMode_started`

**Note :** `visitorRegistrationCompleted` devient `true` :
- **Cas A** : À l'étape 8 (confirmation du formulaire)
- **Cas B** : Au début (si `hasUserAndResponse`) ou à l'étape 9 (si réponse modifiée)

**Note :** `VisitorDiscoverPublicMode` s'affiche uniquement en mode public (après clic sur toggle privacy).

**Fichier :** `src/onboarding/hooks/useGetVisitorResponse.tsx`

---

### **SECTION 2 : visitorDiscoverPublicMode**
**Composant : `VisitorDiscoverPublicMode`**

**Condition d'affichage :** `isPublicMode === true && visitorRegistrationCompleted === true` (après clic sur toggle privacy)

**Note :** La section 2 s'affiche uniquement en mode public (après clic sur le toggle privacy).

#### **Étape 10 : Toggle privacy (mode public)**
- Se déclenche quand l'utilisateur clique sur le toggle privacy
- Le toast "Pssst!" se ferme
- **Toast "Bienvenu en mode public" après 1s** :
  - "📍Bienvenu en mode public"
  - "Maintenant, tu peux explorer la carte tranquillement, et voir les détails des événements, mais ça, tu sais déjà 😉"
  - Durée : 10s (se ferme automatiquement)
- Les fake pins apparaissent immédiatement sur la carte
- Tracking : `privacy_toggled`, `exploration_toast_shown`

#### **Étape 11 : Animation zoom-out (automatique en mode public)**
- Se déclenche automatiquement après le toggle privacy (200ms après)
- Animation zoom-out 10s (zoom 8)
- Tracking : `zoomout_started`, `zoomout_completed`

#### **Étape 13 : Clic sur un fake pin**
- FakeEventCard s'ouvre
- Le toast exploration se ferme
- Tracking : `fake_pin_clicked`, `fake_eventcard_opened`

#### **Étape 14 : Toast fake events (30s après ouverture FakeEventCard)**
- Toast en haut : "Ces events te semblent FAKE ? 🤔"
- Message : "C'est normal, ils le sont... C'était un test pour vérifier que tu maîtrises l'app. 💪 Maintenant que tu gères, il est temps de découvrir les VRAIS événements 🚀"
- Pas de durée - attend le clic sur le bouton signup
- Tracking : `fake_events_toast_shown`

#### **Étape 15 : Bouton "S'inscrire sur FOMO"**
- Le bouton apparaît 4s après le toast "Ces events te semblent FAKE ?"
- Bouton fixe en bas de l'écran
- Tracking : `signup_clicked`, `visitorDiscoverPublicMode_completed`

#### **Étape 16 : Clic sur "S'inscrire sur FOMO"**
- Le toast "Ces events te semblent FAKE ?" se ferme
- WelcomeScreen s'affiche avec UserConnexionModal
- L'utilisateur peut créer un compte
- **FIN DE L'ONBOARDING VISITOR**

**Fichier :** `src/onboarding/visitorDiscoverPublicMode.tsx`

---

## 🔧 HOOKS ET LEURS RÔLES

### **`useLoadVisitorEvent`** (74 lignes)
- **Rôle :** Chargeur de données
- **Fait :** Détecte l'URL, charge l'événement depuis l'API
- **Retourne :** `visitorEvent`, `isLoadingVisitorEvent`, `isVisitorMode`
- **Utilisé dans :** `VisitorIntegrationWrapper`

### **`useGetVisitorResponse`** (449 lignes)
- **Rôle :** Gestionnaire de la section 1 "getVisitorResponse"
- **Fait :** Orchestre toute la séquence jusqu'à la fermeture de l'EventCard
  - FlyTo, toasts (invitation, détails, impatience, remerciement, Pssst!)
  - Activation des boutons
  - Gestion ouverture/fermeture EventCard
- **Utilise :** `useVisitorResponseHandlers` pour les interactions
- **Retourne :** `responseButtonsDisabled`, `responseHandlers`, `visitorRegistrationCompleted`, `handleEventCardClose`
- **Utilisé dans :** `VisitorOnboarding`

### **`useVisitorResponseHandlers`** (311 lignes)
- **Rôle :** Gestionnaire des handlers de réponses (clics réponses, modal, création visiteur)
- **Fait :** 
  - Gère les clics sur les réponses
  - Déclenche l'animation des étoiles
  - Ouvre/ferme le modal d'inscription
  - Crée/met à jour le visiteur dans la DB
- **Retourne :** `showVisitorModal`, `handleVisitorResponseClick`, `handleVisitorModalConfirm`, `StarsAnimation`, etc.
- **Utilisé dans :** `useGetVisitorResponse` (privé, pas exporté)

### **`useFakePins`**
- **Rôle :** Gestion des fake pins (événements fictifs)
- **Fait :** Gère l'affichage des fake pins, fake events, welcome screen
- **Utilisé dans :** `VisitorOnboarding` et `VisitorDiscoverPublicMode`

---

## 📊 FLUX DE DONNÉES

```
App.tsx
  └─ VisitorModeApp
      └─ useLoadVisitorEvent() → charge l'événement
      └─ VisitorOnboarding
          └─ useFakePins() → fake pins logic
          └─ useGetVisitorResponse()
              └─ useVisitorResponseHandlers() → interactions
          └─ DiscoverPage (avec EventCard)
          └─ VisitorRegistrationModal
          └─ VisitorDiscoverPublicMode (si isPublicMode && visitorRegistrationCompleted)
```

---

## 🎬 RÉSUMÉ TEMPOREL

| Temps | Action | Toast/Modal |
|-------|--------|-------------|
| 0s | App démarre | - |
| 1s | FlyTo démarre | - |
| 4s | FlyTo terminé | Toast invitation (bas) |
| ~5s | Clic pin → EventCard ouverte | - |
| ~8s | Toast détails (haut) | Toast détails |
| ~10s | Clic étiquette → Boutons activés | - |
| ~15s | Toast impatience (haut) | Toast impatience |
| ~16s | Clic réponse → Animation étoiles | - |
| ~18s | Animation terminée → Modal s'ouvre | Modal inscription |
| ~20s | Formulaire rempli → Modal se ferme | Toast remerciement |
| ~22s | EventCard se ferme | - |
| ~24s | Toast "Pssst!" (haut) | Toast Pssst! |
| ~28s | Toast "Bonjour" (si user+response) | Toast Bonjour |
| ~30s | Clic toggle → Mode public | - |
| ~40s | Zoom-out terminé | Toast exploration |
| ~45s | Clic fake pin → FakeEventCard | - |
| ~48s | Toast fake events (haut) | Toast fake events |
| ~50s | FakeEventCard fermée | Bouton "S'inscrire" |
| ~52s | Clic "S'inscrire" | WelcomeScreen |

---

## 🔑 POINTS CLÉS

1. **Section 1 (getVisitorResponse)** : De l'arrivée jusqu'à la fermeture de l'EventCard avec réponse
2. **Section 2 (visitorDiscoverPublicMode)** : S'affiche uniquement en mode public (après clic sur toggle privacy), jusqu'au clic "S'inscrire"
3. **`visitorRegistrationCompleted`** : Flag qui indique que l'inscription du visiteur est complétée
4. **Toast "Pssst!"** : Déclenché 5s après fermeture EventCard (dans `useGetVisitorResponse`), uniquement si le toggle privacy n'a pas été activé (`!isPublicMode`)
5. **Toast "Bonjour"** : Déclenché 4s après le flyTo (étape 3, Cas B) dans `useGetVisitorResponse` si `hasUserAndResponse` est true
6. **Toast éducatif "Pour fermer l'event card"** : Mutualisé entre Cas A et Cas B, affiché 2s après la confirmation du formulaire (Cas A) ou après la fin de l'animation (Cas B), géré dans `useVisitorResponseHandlers`
7. **Modal inscription** : Géré par `useVisitorResponseHandlers`, ouvert après animation étoiles

