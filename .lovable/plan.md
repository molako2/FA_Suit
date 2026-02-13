

# Associer les clients aux utilisateurs de role "Client"

## Probleme identifie

La table `client_users` est **vide**. Le module Utilisateurs permet de choisir le role "Client" mais **n'offre aucun moyen d'associer un client** a cet utilisateur. Sans cette association, la politique de securite sur `client_documents` (`user_has_client_access`) bloque l'acces et abdel@yopmail.com ne voit aucun document.

## Solution

Ajouter dans le formulaire de creation/edition d'un utilisateur (page Utilisateurs) un selecteur multi-clients qui apparait uniquement quand le role selectionne est "Client". Lors de la sauvegarde, appeler `useSetClientUsers` pour creer les associations dans la table `client_users`.

---

## Etape 1 -- Ajouter le selecteur de clients dans le formulaire utilisateur

**Fichier** : `src/pages/Collaborators.tsx`

- Importer `useClients` et `useClientUsers`, `useSetClientUsers`
- Ajouter un state `selectedClientIds: string[]`
- Dans `openUserDialog`, pre-charger les clients deja associes si le role est "client"
- Apres le selecteur de role, afficher conditionnellement (quand `formRole === 'client'`) une liste de checkboxes ou un multi-select des clients disponibles
- Dans `resetUserForm`, reinitialiser `selectedClientIds` a `[]`

## Etape 2 -- Sauvegarder les associations lors de handleSaveUser

**Fichier** : `src/pages/Collaborators.tsx`

- Apres la sauvegarde du profil et du role, si `formRole === 'client'`, appeler `setClientUsers.mutateAsync({ userId, clientIds: selectedClientIds })`
- Pour la creation d'un nouveau utilisateur, utiliser l'ID retourne par l'edge function
- Si le role change de "client" vers autre chose, supprimer les associations (appeler avec `clientIds: []`)

## Etape 3 -- Pre-charger les associations existantes a l'edition

**Fichier** : `src/pages/Collaborators.tsx`

- Utiliser `useClientUsers()` (sans filtre) pour avoir toutes les associations
- Dans `openUserDialog`, filtrer par `user_id` pour pre-cocher les clients associes

## Fichiers concernes

| Fichier | Action |
|---|---|
| `src/pages/Collaborators.tsx` | Ajouter selecteur multi-clients conditionnel + sauvegarde associations |

Aucune modification de base de donnees ou de hook necessaire : `useClients`, `useClientUsers` et `useSetClientUsers` existent deja.

