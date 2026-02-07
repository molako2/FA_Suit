

# Badge rouge "Blocked" sur le menu To Do pour Owner/SysAdmin

## Objectif
Ajouter un compteur rouge sur le lien "To Do" dans la barre de navigation pour les profils Owner et SysAdmin, indiquant le nombre de taches au statut **blocked** (et non pending comme pour les collabs/assistants).

## Modifications

### 1. `src/hooks/useTodos.ts` -- Nouveau hook `useBlockedTodosCount`

Ajouter un hook similaire a `usePendingTodosCount`, mais qui compte toutes les taches au statut `blocked` (sans filtre par `assigned_to`, car les admins voient toutes les taches).

```text
useBlockedTodosCount()
  -> SELECT count(*) FROM todos WHERE status = 'blocked'
  -> Pas de parametre userId (les admins voient tout)
```

### 2. `src/components/layout/AppLayout.tsx` -- Afficher le badge pour les admins

- Importer `useBlockedTodosCount`
- Pour les roles `owner` et `sysadmin`, appeler `useBlockedTodosCount()` et afficher le compteur rouge sur le lien "To Do" quand il y a des taches bloquees
- Le badge existant pour les collabs/assistants (pending count) reste inchange
- Les deux logiques cohabitent : chaque profil voit son propre compteur pertinent

### Logique du badge par role

```text
Role                  | Compteur affiche        | Statut filtre
--------------------- | ----------------------- | -------------
collaborator/assistant| Taches "pending" perso  | pending
owner/sysadmin        | Taches "blocked" globales| blocked
```

### Resume des fichiers modifies

1. **`src/hooks/useTodos.ts`** -- ajout du hook `useBlockedTodosCount`
2. **`src/components/layout/AppLayout.tsx`** -- integration du badge blocked pour owner/sysadmin (desktop + mobile)

### Aucune migration de base de donnees necessaire
La colonne `status` existe deja. Il s'agit uniquement de changements frontend.

