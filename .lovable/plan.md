

# Bouton Supprimer visible + Trace d'audit pour la suppression de documents

## Modifications prevues

### 1. Hook `src/hooks/useMatterDocuments.ts` - `useDeleteMatterDocument`

Modifier la mutation de suppression pour enregistrer automatiquement une entree dans la table `audit_logs` avant de supprimer le document. Les details enregistres incluront :
- `action` : `"delete_matter_document"`
- `entity_type` : `"matter_document"`
- `entity_id` : l'ID du document supprime
- `details` : objet JSON contenant `file_name`, `matter_id`, `category`, `version_number`, `file_size`, `mime_type`

Le hook utilisera directement `supabase.from('audit_logs').insert(...)` au sein de la mutation (pas besoin d'importer le hook audit separement car on est deja dans un contexte mutation).

### 2. Composant `src/components/matters/MatterDocumentsSheet.tsx`

- Rendre le bouton Supprimer plus visible en ajoutant un label texte "Supprimer" a cote de l'icone Trash2, comme les boutons Apercu et Telecharger
- Le comportement reste identique : clic ouvre la confirmation AlertDialog, puis suppression effective

### 3. Traductions `fr.json` et `en.json`

- Ajouter `matterDocuments.delete` : "Supprimer" / "Delete"
- Ajouter `matterDocuments.deleteAuditSuccess` (optionnel, pour le toast) si necessaire

## Details techniques

- L'audit log est insere **avant** la suppression physique du fichier pour garantir la tracabilite meme en cas d'echec partiel
- Le `user_id` est recupere via `auth.uid()` cote client (transmis dans l'insert audit_logs)
- La table `audit_logs` a deja une politique RLS INSERT pour tout utilisateur authentifie, donc pas de migration necessaire

