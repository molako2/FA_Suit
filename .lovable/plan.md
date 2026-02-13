

# Restreindre l'acces documents aux dossiers associes

## Probleme actuel

La politique RLS sur `client_documents` verifie uniquement l'acces au niveau **client** (`user_has_client_access`), pas au niveau **dossier**. Un utilisateur client voit donc tous les documents de son client, y compris ceux des dossiers non coches.

Cote frontend, le filtre par dossier est egalement desactive pour les clients (`effectiveMatterId = undefined`).

## Solution

### Etape 1 -- Creer une fonction de securite `user_has_matter_access`

Nouvelle fonction `SECURITY DEFINER` qui verifie si un utilisateur a acces a un dossier specifique via la table `client_user_matters` :

```text
user_has_matter_access(user_id, matter_id) -> boolean
  - Retourne TRUE si une ligne existe dans client_user_matters
    pour ce user_id et matter_id
```

### Etape 2 -- Mettre a jour la politique RLS sur `client_documents`

Modifier la politique SELECT existante pour ajouter la verification au niveau dossier :

- Si le document a un `matter_id` : verifier que le client a acces a ce dossier (`user_has_matter_access`)
- Si le document n'a pas de `matter_id` (NULL) : verifier uniquement l'acces client (`user_has_client_access`)
- Les utilisateurs internes (owner/assistant/sysadmin) gardent un acces complet

Logique RLS :
```text
is_owner_or_assistant()
OR (
  user_has_client_access(auth.uid(), client_id)
  AND (
    matter_id IS NULL
    OR user_has_matter_access(auth.uid(), matter_id)
  )
)
```

### Etape 3 -- Filtrer les documents cote frontend

Dans `Documents.tsx`, pour les utilisateurs clients :
- Recuperer les `client_user_matters` de l'utilisateur connecte
- Filtrer `clientMatters` pour n'afficher que les dossiers associes
- Permettre au client de naviguer entre ses dossiers associes (selecteur de dossier visible pour les clients aussi)

## Fichiers concernes

| Fichier | Action |
|---|---|
| Migration SQL | Creer `user_has_matter_access`, modifier politique RLS SELECT sur `client_documents` |
| `src/pages/Documents.tsx` | Ajouter import `useClientUserMatters`, filtrer les dossiers affiches, activer le selecteur de dossier pour les clients |

