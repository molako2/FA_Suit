

# Module de Gestion Documentaire par Dossier (multi-metier)

## Contexte

Le module de gestion documentaire est rattache a chaque dossier (matter). Il doit couvrir tous les types de cabinets : audit, expertise comptable, conseil fiscal, conseil financier, juridique, et autres. Les categories de documents sont donc universelles et non exclusivement juridiques.

## Categories retenues (14 categories multi-metier)

Au lieu des 12 categories juridiques, les categories couvrent l'ensemble des activites d'un cabinet :

| Categorie | Usage principal |
|---|---|
| `rapport` | Rapports d'audit, rapports de mission, rapports d'expertise |
| `lettre_mission` | Lettres de mission, contrats d'engagement |
| `contrat` | Contrats divers, conventions, accords |
| `correspondance` | Courriers, emails importants, echanges formels |
| `fiscal` | Declarations fiscales, liasses, rescrits |
| `comptable` | Bilans, situations intermediaires, balances, journaux |
| `social` | Bulletins de paie, declarations sociales, contrats de travail |
| `juridique` | PV d'AG, statuts, decisions, actes juridiques |
| `audit` | Programmes de travail, feuilles de travail, confirmations |
| `conseil` | Notes de conseil, memorandums, recommandations |
| `piece_justificative` | Factures, releves bancaires, pieces comptables |
| `presentation` | Supports de presentation, rapports destines aux clients |
| `formulaire` | Formulaires administratifs, declarations, demandes |
| `divers` | Tout document ne rentrant pas dans les autres categories |

## Architecture

Identique au plan precedent avec les ajustements suivants :

### 1. Base de donnees - Migration SQL

**Bucket** : `matter-documents` (prive)

**Table** : `matter_documents`
- id, matter_id (FK CASCADE), category (text), tags (text[]), file_name, file_path, file_size, mime_type, uploaded_by
- parent_id (FK self-reference, pour versioning), is_current (boolean, default true), version_number (integer, default 1)
- created_at (timestamptz)

**RLS** : SELECT/INSERT/UPDATE/DELETE restreints a `is_owner_or_assistant()`

**Storage RLS** : upload/download/delete pour les roles internes authentifies

### 2. Hook - `src/hooks/useMatterDocuments.ts`

- `useMatterDocuments(matterId, category?, tags?)` -- documents courants
- `useMatterDocumentVersions(parentId)` -- historique versions
- `useUploadMatterDocument()` -- upload avec validation 10 Mo, types autorises
- `useNewVersion()` -- nouvelle version d'un document existant
- `useDeleteMatterDocument()` -- suppression fichier + metadonnees
- `useDownloadMatterDocument()` -- URL signee

### 3. Composant - `src/components/matters/MatterDocumentsSheet.tsx`

Panneau lateral (Sheet) depuis la page Dossiers :
- En-tete avec code et libelle du dossier
- Filtre par categorie (Select) + recherche par nom
- Bouton upload avec choix categorie et tags optionnels
- Liste des documents courants avec icone, nom, categorie, taille, date, tags en badges
- Actions : telecharger, versions, supprimer
- Dialog de confirmation pour suppression

### 4. Integration - `src/pages/Matters.tsx`

- Bouton icone sur chaque ligne du tableau
- Ouverture du Sheet avec le matterId
- Visible pour owner/assistant/sysadmin uniquement

### 5. Traductions - `fr.json` et `en.json`

Cles pour les 14 categories, messages d'upload/suppression/erreurs, labels du panneau

## Details techniques

- Bucket `matter-documents` separe de `client-documents`
- Chemin stockage : `{matter_id}/{category}/{timestamp}_{filename}`
- Versioning : ancien record passe a `is_current = false`, nouveau pointe via `parent_id`
- Pas de quota par dossier (ajout possible ulterieurement)
- Acces restreint aux profils internes (owner/assistant/sysadmin)

