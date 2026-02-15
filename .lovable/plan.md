
# Pieces jointes lors de la creation d'une tache

## Probleme actuel

Le composant `TodoAttachmentManager` n'est affiche que lors de la modification d'une tache (`editingTodo` doit exister), car les pieces jointes necessitent un `todo_id` pour etre enregistrees. Lors de la creation, la tache n'existe pas encore, donc pas de `todo_id` disponible.

## Solution

Modifier le flux de creation pour qu'il se fasse en deux etapes :

1. A la sauvegarde d'une **nouvelle** tache, creer d'abord la tache en base
2. Si la creation reussit, **rouvrir automatiquement le dialog en mode edition** avec la tache fraichement creee, pour que l'utilisateur puisse immediatement ajouter des pieces jointes

Cela permet de reutiliser le `TodoAttachmentManager` existant sans changer la logique de stockage.

En complement, ajouter un **indicateur visuel** dans le dialog de creation pour informer l'admin qu'il pourra ajouter des PJ apres l'enregistrement.

## Modifications prevues

### 1. `src/pages/Todos.tsx` - Flux de creation

Modifier la fonction `handleSave` : apres la creation d'une nouvelle tache (`createTodo.mutateAsync`), recuperer l'objet retourne et ouvrir immediatement le dialog en mode edition avec cette tache.

### 2. `src/pages/Todos.tsx` - Dialog

Supprimer la condition `{editingTodo && ...}` autour du `TodoAttachmentManager`. A la place :
- Si `editingTodo` existe : afficher le gestionnaire de PJ normalement
- Sinon (creation) : afficher un message informatif indiquant que les PJ pourront etre ajoutees apres l'enregistrement

### 3. Traductions

Ajouter une cle pour le message informatif :
- FR : "Enregistrez la tache pour ajouter des pieces jointes"
- EN : "Save the task to add attachments"

---

### Details techniques

**`handleSave` modifie :**
```typescript
if (editingTodo) {
  await updateTodo.mutateAsync({ ... });
  toast({ title: t('todos.taskUpdated') });
  setDialogOpen(false);
} else {
  const newTodo = await createTodo.mutateAsync({ ... });
  toast({ title: t('todos.taskCreated') });
  // Rouvrir en mode edition pour permettre l'ajout de PJ
  setEditingTodo({
    id: newTodo.id,
    title: newTodo.title,
    deadline: newTodo.deadline,
    assigned_to: newTodo.assigned_to,
  });
  // Le dialog reste ouvert, maintenant en mode edition avec PJ disponible
}
```

**Zone PJ dans le dialog :**
```tsx
{editingTodo ? (
  <TodoAttachmentManager todoId={editingTodo.id} userId={user!.id} isAdmin={isAdmin} />
) : (
  <p className="text-sm text-muted-foreground flex items-center gap-1">
    <Paperclip className="w-4 h-4" />
    {t('todos.saveToAddAttachments')}
  </p>
)}
```
