# Plan de Migration : Système d'historique des réponses

## 🎯 Objectif
Remplacer l'UPSERT par un système d'historique complet où chaque changement crée une nouvelle entrée avec `initialResponse` et `finalResponse`.

## 📊 Nouveau Schéma Google Sheets

### Onglet "Responses"
| Colonne | Description | Exemple |
|---------|-------------|---------|
| A | ID (auto-généré) | `uuid` ou `eventId_userId_timestamp` |
| B | CreatedAt | `2024-01-15T10:30:00Z` |
| C | UserId | `user_123` |
| D | EventId | `event_456` |
| E | InitialResponse | `interested` ou `null` |
| F | FinalResponse | `going` ou `cleared` |
| G | InvitedByUserId | `user_789` (optionnel) |
| H | Email | `user@example.com` (optionnel) |
| I | DeletedAt | (vide si actif) |

**Exemple de données :**
```
ID: resp_001
CreatedAt: 2024-01-15T10:00:00Z
UserId: user_123
EventId: event_456
InitialResponse: null
FinalResponse: interested

ID: resp_002
CreatedAt: 2024-01-15T14:30:00Z
UserId: user_123
EventId: event_456
InitialResponse: interested
FinalResponse: going
```

## 🔄 Utilisations Actuelles à Réadapter

### 1. Backend

#### `responsesController.js`
- ❌ `upsertResponse()` → ✅ `createResponse(initialResponse, finalResponse)`
- ✅ `getAllResponses()` → Retourne TOUTES les entrées (historique)
- ✅ `getLatestResponse(userId, eventId)` → Nouvelle fonction helper
- ✅ `getUserResponses(userId)` → Filtre + déduplique par latest
- ✅ `getEventResponses(eventId)` → Filtre + déduplique par latest

#### `dataService.js`
- ✅ Mapper `response` adapté pour nouveau schéma
- ✅ Pas de `upsertData` pour responses, uniquement `createRow`

### 2. Types Frontend

#### `fomoTypes.ts`
```typescript
export interface UserResponse {
  id: string // Nouveau : ID unique de l'entrée
  userId: string
  eventId: string
  initialResponse: UserResponseValue // Nouveau
  finalResponse: UserResponseValue // Renommé depuis "response"
  createdAt: string
  invitedByUserId?: string
}

// Helper pour obtenir la dernière réponse d'un user pour un event
export function getLatestResponse(
  responses: UserResponse[],
  userId: string,
  eventId: string
): UserResponse | null
```

### 3. Contextes

#### `UserDataContext.tsx`
- ✅ `responses: UserResponse[]` → Contient TOUT l'historique
- ✅ `getLatestUserResponse(userId, eventId)` → Helper interne
- ✅ `addEventResponse(eventId, finalResponse)` → Crée nouvelle entrée avec `initialResponse=current`, `finalResponse=new`

#### `FomoDataProvider.tsx`
- ✅ Passe l'historique complet aux composants
- ✅ Helpers pour obtenir la dernière réponse

### 4. Hooks

#### `useEventResponses.ts`
- ✅ `getEventResponse(eventId)` → Utilise `getLatestResponse()`
- ✅ `toggleResponse()` → Calcule `initialResponse` depuis la dernière réponse, puis crée nouvelle entrée

### 5. Utilitaires

#### `eventResponseUtils.ts`
- ✅ `createOptimisticResponse()` → Adapté pour `initialResponse` + `finalResponse`
- ✅ `updateResponsesOptimistically()` → Ajoute nouvelle entrée au lieu de modifier
- ✅ `getLatestResponse()` → Nouvelle fonction helper

#### `filterTools.ts`
- ✅ `userResponsesMapper()` → Utilise `getLatestResponse()` pour mapper

### 6. Composants

#### `EventCard.tsx`
- ✅ Utilise `getLatestResponse()` pour afficher état actuel
- ✅ Lors du changement : calcule `initialResponse` (current) et `finalResponse` (new)
- ✅ Plus besoin de `notifyResponseChange`, tout est dans le contexte

#### `LastActivities.tsx`
- ✅ Lit directement `initialResponse` et `finalResponse` depuis le contexte
- ✅ Filtre les réponses récentes avec changements (`initialResponse !== finalResponse`)
- ✅ Affiche "initialResponse → finalResponse"

#### `FiltersContext.tsx`
- ✅ Utilise `getLatestResponse()` pour filtrer par réponse utilisateur

## 🚀 Plan d'Implémentation

### Phase 1 : Backend (Sans casser l'existant)
1. ✅ Créer nouvelle structure Google Sheets
2. ✅ Créer `createResponse()` (ne touche pas à `upsertResponse` pour l'instant)
3. ✅ Créer `getLatestResponse()` helper
4. ✅ Adapter `getAllResponses()` pour retourner historique
5. ✅ Script de migration des données existantes

### Phase 2 : Types & Helpers Frontend
1. ✅ Adapter `UserResponse` type
2. ✅ Créer helpers `getLatestResponse()`
3. ✅ Adapter `eventResponseUtils.ts`

### Phase 3 : Contextes & Hooks
1. ✅ Adapter `UserDataContext` pour utiliser historique
2. ✅ Adapter `useEventResponses`
3. ✅ Adapter `filterTools.ts`

### Phase 4 : Composants
1. ✅ Adapter `EventCard` (supprimer `notifyResponseChange`)
2. ✅ Adapter `LastActivities` (lire directement depuis contexte)
3. ✅ Adapter tous les autres usages

### Phase 5 : Nettoyage
1. ✅ Supprimer `upsertResponse()` backend
2. ✅ Supprimer logique de compatibilité
3. ✅ Tests & validation

## 📝 Notes Importantes

- **Performance** : Google Sheets peut gérer jusqu'à 5M de cellules, largement suffisant pour un MVP
- **Migration** : Convertir chaque ligne existante en entrée avec `initialResponse=null`, `finalResponse=current`
- **Rétrocompatibilité** : Aucune, on repart de zéro avec le nouveau système

