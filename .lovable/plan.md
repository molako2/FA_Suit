

# Badge vert pour les taches debloquees (collab/assistant)

## Objectif
Quand un Owner/SysAdmin debloque une tache, celle-ci repasse en statut `in_progress`. Pour le collaborateur/assistant, un badge **vert** doit apparaitre sur le menu "To Do" indiquant le nombre de taches en cours (`in_progress`), en complement du badge **rouge** existant pour les nouvelles taches (`pending`).

## Comportement attendu

```text
Badge collab/assistant sur le menu "To Do"
------------------------------------------
Rouge  = nombre de nouvelles taches (pending)
Vert   = nombre de taches en cours / debloquees (in_progress)

Les deux badges peuvent coexister simultanement.
```

## Modifications techniques

### 1. `src/hooks/useTodos.ts` -- Nouveau hook `useInProgressTodosCount`
- Ajouter un hook similaire a `usePendingTodosCount` qui compte les taches au statut `in_progress` pour l'utilisateur connecte
- Requete : `SELECT count(*) FROM todos WHERE assigned_to = userId AND status = 'in_progress'`

### 2. `src/components/layout/AppLayout.tsx` -- Afficher le badge vert
- Importer `useInProgressTodosCount`
- Pour les roles `collaborator` et `assistant`, afficher deux badges sur le lien "To Do" :
  - Badge rouge (`bg-destructive`) : taches `pending` (existant)
  - Badge vert (`bg-green-500`) : taches `in_progress`
- Les deux badges s'affichent cote a cote quand les deux compteurs sont > 0
- Meme logique appliquee sur la navigation desktop et mobile

### Fichiers modifies
1. `src/hooks/useTodos.ts` -- ajout du hook `useInProgressTodosCount`
2. `src/components/layout/AppLayout.tsx` -- integration du badge vert a cote du rouge

### Aucune migration de base de donnees necessaire
Le statut `in_progress` existe deja dans la table `todos`.

