

# Ameliorations du module To Do List

## 3 fonctionnalites a implementer

### 1. Afficher le commentaire de blocage pour Owner/SysAdmin

Actuellement, le badge "Bloque" affiche un tooltip au survol avec la raison, mais cela ne fonctionne qu'au survol. Pour les admins, il faut rendre le commentaire de blocage directement visible dans le tableau.

**Modification** : Dans `src/pages/Todos.tsx`, pour la vue admin, ajouter une colonne ou afficher en dessous du badge "Bloque" le texte de `blocked_reason` directement dans la cellule (pas seulement en tooltip). Le texte sera affiche en rouge/italique sous le badge pour etre clairement visible.

---

### 2. Indicateur rouge sur le menu "To Do" pour collab/assistant

Quand une nouvelle tache est assignee (statut `pending`), le lien "To Do" dans la barre de navigation doit apparaitre avec un badge rouge indiquant le nombre de taches en attente.

**Approche** :
- Creer un hook `usePendingTodosCount` dans `src/hooks/useTodos.ts` qui retourne le nombre de todos au statut `pending` pour l'utilisateur connecte.
- Modifier `src/components/layout/AppLayout.tsx` pour afficher un badge rouge a cote du lien "To Do" quand le compteur est > 0.
- Ce badge ne s'affiche que pour les roles `collaborator` et `assistant`.

---

### 3. Bouton export CSV pour tous les profils

Ajouter un bouton "Exporter" dans la page To Do qui genere un fichier CSV avec toutes les taches visibles (filtrees selon le profil).

**Modifications** :
- Ajouter une fonction `exportTodosCSV` dans `src/lib/exports.ts` avec les colonnes : Collaborateur, Tache, Deadline, Statut, Raison blocage.
- Ajouter un bouton d'export dans l'en-tete de la page `Todos.tsx` (a cote du bouton "Nouvelle tache" pour les admins, ou seul pour les collabs).
- Ajouter les traductions pour le bouton d'export.

---

## Details techniques

### Fichiers a modifier

1. **`src/pages/Todos.tsx`**
   - Ajouter l'affichage direct du `blocked_reason` sous le badge pour les admins
   - Ajouter le bouton d'export CSV dans l'en-tete

2. **`src/hooks/useTodos.ts`**
   - Ajouter le hook `usePendingTodosCount` qui fait un `SELECT count(*)` filtre par `assigned_to = user.id` et `status = 'pending'`

3. **`src/components/layout/AppLayout.tsx`**
   - Importer `usePendingTodosCount` et afficher un badge rouge sur le lien "To Do" pour les non-admins

4. **`src/lib/exports.ts`**
   - Ajouter la fonction `exportTodosCSV`

5. **`src/i18n/locales/fr.json`** et **`src/i18n/locales/en.json`**
   - Ajouter les cles : `todos.export` ("Exporter" / "Export"), `todos.pendingCount` si necessaire

### Aucune migration de base de donnees necessaire
Les donnees `blocked_reason` sont deja stockees dans la table `todos`. Il s'agit uniquement de changements frontend.

