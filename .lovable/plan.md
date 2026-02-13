

# Associer des clients ET des dossiers aux utilisateurs "Client"

## Objectif

Quand le role "Client" est selectionne dans le formulaire utilisateur, afficher une interface a deux niveaux :
1. Liste de checkboxes des clients
2. Pour chaque client coche, afficher les dossiers (matters) de ce client avec des checkboxes pour en selectionner un ou plusieurs

## Etape 1 -- Creer une table `client_user_matters`

Nouvelle table pour stocker les associations utilisateur-client-dossier :

```text
client_user_matters
- id (uuid, PK)
- user_id (uuid, NOT NULL)
- client_id (uuid, NOT NULL)
- matter_id (uuid, NOT NULL)
- created_at (timestamptz)
```

Politiques RLS :
- ALL pour owner/sysadmin (gestion)
- SELECT pour le user lui-meme (consultation)

## Etape 2 -- Creer un hook `useClientUserMatters`

**Nouveau fichier** : `src/hooks/useClientUserMatters.ts`

- `useClientUserMatters(userId?)` : query SELECT sur la table
- `useSetClientUserMatters()` : mutation qui supprime les anciennes associations d'un user puis insere les nouvelles

## Etape 3 -- Modifier le formulaire utilisateur

**Fichier** : `src/pages/Collaborators.tsx`

- Ajouter un state `selectedMatterIds: Record<string, string[]>` (cle = client_id, valeur = liste de matter_ids)
- Remplacer la section des checkboxes clients par une interface hierarchique :
  - Checkbox client (nom du client)
  - Quand le client est coche, afficher en dessous (indente) les dossiers de ce client avec des checkboxes
- Pre-charger les associations existantes a l'ouverture du dialog (depuis `useClientUserMatters`)
- A la sauvegarde, appeler `setClientUserMatters` avec les associations selectionnees

## Etape 4 -- Mettre a jour la visibilite des documents (optionnel)

La visibilite des documents reste basee sur `client_users` (niveau client). Les associations de dossiers servent a organiser l'acces mais ne bloquent pas la consultation au niveau RLS pour le moment. Cela pourra etre affine plus tard si necessaire.

## Fichiers concernes

| Fichier | Action |
|---|---|
| Migration SQL | Creer table `client_user_matters` avec RLS |
| `src/hooks/useClientUserMatters.ts` | Nouveau hook query + mutation |
| `src/pages/Collaborators.tsx` | Interface hierarchique client > dossiers |

