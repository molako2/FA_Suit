

# Module To-Do List

## Objectif
Ajouter un nouveau module "To Do List" permettant aux Owner/SysAdmin d'attribuer des taches aux collaborateurs avec une deadline, et aux Collaborateurs/Assistants de consulter et mettre a jour le statut de leurs propres taches.

## Regles metier

### Profils Owner / SysAdmin
- Peuvent voir les taches de tous les collaborateurs
- Peuvent creer une tache en choisissant un collaborateur, un texte libre et une date deadline
- Peuvent modifier ou supprimer n'importe quelle tache

### Profils Collaborateur / Assistant
- Ne voient que leurs propres taches
- Peuvent changer le statut d'une tache parmi 3 options :
  - **Realise** (done)
  - **En cours** (in_progress)
  - **Bloque** (blocked) -- ouvre un champ texte obligatoire (max 128 caracteres)
- Ne peuvent pas creer, modifier le contenu, ni supprimer de tache

---

## Etape 1 -- Base de donnees

Creer une table `todos` avec la structure suivante :

```text
todos
----------------------------------------------
id              uuid       PK, default gen_random_uuid()
assigned_to     uuid       NOT NULL (ref profiles.id)
created_by      uuid       NOT NULL (ref profiles.id)
title           text       NOT NULL
deadline        date       NOT NULL
status          text       NOT NULL, default 'pending'
                           (valeurs: pending, in_progress, done, blocked)
blocked_reason  text       NULL (max 128 chars)
created_at      timestamptz NOT NULL, default now()
updated_at      timestamptz NOT NULL, default now()
```

### Politiques RLS

- **SELECT** : Owner/SysAdmin voient tout ; les autres ne voient que `assigned_to = auth.uid()`
- **INSERT** : Seulement Owner/SysAdmin (via `is_owner()`)
- **UPDATE** :
  - Owner/SysAdmin peuvent tout modifier
  - Collaborateur/Assistant ne peut modifier que `status` et `blocked_reason` sur ses propres taches
- **DELETE** : Seulement Owner/SysAdmin (via `is_owner()`)

Trigger `update_updated_at_column` sur la table pour mettre a jour `updated_at` automatiquement.

---

## Etape 2 -- Hook React (`src/hooks/useTodos.ts`)

Creer un hook suivant le meme pattern que `useTimesheet.ts` :

- `useTodos(userId?)` -- query toutes les taches (filtrees par `assigned_to` pour les non-admins)
- `useCreateTodo()` -- mutation INSERT
- `useUpdateTodo()` -- mutation UPDATE (pour modifier titre/deadline par admin, ou status/blocked_reason par collaborateur)
- `useDeleteTodo()` -- mutation DELETE

---

## Etape 3 -- Page (`src/pages/Todos.tsx`)

### Vue Owner/SysAdmin
- Filtre par collaborateur (dropdown avec la liste des profils actifs)
- Bouton "Nouvelle tache" ouvrant un dialogue avec :
  - Select collaborateur (obligatoire)
  - Champ texte libre pour le titre de la tache (obligatoire)
  - Champ date pour la deadline (obligatoire)
- Tableau des taches avec colonnes : Collaborateur, Tache, Deadline, Statut, Actions (modifier/supprimer)
- Badges de couleur pour les statuts :
  - `pending` : gris
  - `in_progress` : bleu
  - `done` : vert
  - `blocked` : rouge (avec tooltip ou texte montrant la raison)
- Indicateur visuel pour les deadlines depassees

### Vue Collaborateur/Assistant
- Liste de ses propres taches uniquement
- Pas de bouton de creation, modification ni suppression
- A cote de chaque tache, 3 boutons radio/toggle :
  - **Realise** -- met le statut a `done`
  - **En cours** -- met le statut a `in_progress`
  - **Bloque** -- ouvre un champ texte (max 128 caracteres, obligatoire) puis met le statut a `blocked`

---

## Etape 4 -- Navigation et routes

- Ajouter l'entree dans `navItemsConfig` de `AppLayout.tsx` :
  - Icone : `CheckSquare` (lucide-react)
  - Label : `nav.todos`
  - Roles : tous les roles (`sysadmin`, `owner`, `assistant`, `collaborator`)
  - URL : `/todos`

- Ajouter la route dans `App.tsx` :
  - Accessible a tous les roles authentifies (pas de restriction `allowedRoles`)

---

## Etape 5 -- Traductions (i18n)

Ajouter les cles suivantes dans `fr.json` et `en.json` :

```text
nav.todos          : "To Do" / "To Do"
todos.title        : "Liste des taches" / "Task List"
todos.subtitle     : "Gerez les taches de l'equipe" / "Manage team tasks"
todos.newTask      : "Nouvelle tache" / "New task"
todos.editTask     : "Modifier la tache" / "Edit task"
todos.task         : "Tache" / "Task"
todos.deadline     : "Deadline" / "Deadline"
todos.assignedTo   : "Attribue a" / "Assigned to"
todos.status       : "Statut" / "Status"
todos.pending      : "A faire" / "Pending"
todos.inProgress   : "En cours" / "In progress"
todos.done         : "Realise" / "Done"
todos.blocked      : "Bloque" / "Blocked"
todos.blockedReason: "Raison du blocage" / "Blocked reason"
todos.noTasks      : "Aucune tache" / "No tasks"
todos.taskCreated  : "Tache creee" / "Task created"
todos.taskUpdated  : "Tache mise a jour" / "Task updated"
todos.taskDeleted  : "Tache supprimee" / "Task deleted"
todos.overdue      : "En retard" / "Overdue"
todos.maxChars     : "128 caracteres maximum" / "128 characters max"
todos.blockedReasonRequired : "La raison du blocage est obligatoire" / "Blocked reason is required"
todos.selectCollaborator    : "Selectionnez un collaborateur" / "Select a collaborator"
```

---

## Details techniques

### Validation
- Titre de la tache : texte non vide, max 500 caracteres
- Raison de blocage : exactement entre 1 et 128 caracteres (obligatoire uniquement quand statut = blocked)
- Deadline : date valide, pas de restriction passee (une tache peut etre creee avec une deadline passee pour regularisation)

### Securite
- Les politiques RLS garantissent que les collaborateurs ne peuvent pas voir les taches des autres
- La politique UPDATE pour les collaborateurs utilise une approche restrictive : ils ne peuvent modifier que `status` et `blocked_reason`, pas le `title` ni la `deadline`
- Pas de suppression possible par un collaborateur/assistant

### Fichiers a creer
1. `src/hooks/useTodos.ts` -- hook de donnees
2. `src/pages/Todos.tsx` -- page principale

### Fichiers a modifier
1. `src/components/layout/AppLayout.tsx` -- ajout navigation
2. `src/App.tsx` -- ajout route
3. `src/i18n/locales/fr.json` -- traductions FR
4. `src/i18n/locales/en.json` -- traductions EN

### Migration base de donnees
1. Creation table `todos`
2. Activation RLS
3. Creation des 4 politiques RLS
4. Ajout trigger `updated_at`

