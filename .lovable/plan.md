
# Bouton "Débloquer" pour Owner/SysAdmin sur les tâches bloquées

## Objectif
Ajouter un bouton visible uniquement par les Owner/SysAdmin à côté de chaque tâche au statut "Bloqué". En cliquant dessus, la tâche repasse en statut "En cours" (`in_progress`), le `blocked_reason` est effacé, et le compteur rouge dans le menu diminue automatiquement.

## Comportement attendu
1. Le bouton apparaît dans la colonne Actions, uniquement pour les tâches au statut `blocked`, et uniquement pour les profils Owner/SysAdmin
2. Au clic, la tâche est mise à jour : `status = 'in_progress'` et `blocked_reason = null`
3. Le badge rouge dans le menu "To Do" se met à jour automatiquement (car le compteur requery les tâches bloquées)
4. Côté collaborateur/assistant, la tâche réapparaît en statut "En cours"

## Modifications techniques

### 1. `src/pages/Todos.tsx`
- Ajouter une icône `Unlock` (ou `CheckCircle`) depuis lucide-react
- Dans la vue admin (colonne Actions), ajouter un bouton conditionnel qui n'apparaît que si `todo.status === 'blocked'`
- Au clic, appeler `updateTodo.mutateAsync({ id: todo.id, status: 'in_progress', blocked_reason: null })`
- Afficher un toast de confirmation

### 2. `src/i18n/locales/fr.json` et `en.json`
- Ajouter la clé `todos.unblock` : "Débloquer" / "Unblock"
- Ajouter la clé `todos.taskUnblocked` : "Tâche débloquée" / "Task unblocked"

### Aucune migration de base de données nécessaire
La mise à jour utilise les colonnes `status` et `blocked_reason` existantes. Les politiques RLS permettent déjà aux Owner/SysAdmin de modifier toutes les tâches.

### Fichiers modifiés
1. `src/pages/Todos.tsx` -- ajout du bouton débloquer dans les actions admin
2. `src/i18n/locales/fr.json` -- nouvelles traductions
3. `src/i18n/locales/en.json` -- nouvelles traductions
