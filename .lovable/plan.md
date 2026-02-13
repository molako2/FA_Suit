

# Profil "Client" et Module "Vos Documents"

## Resume

Ajout d'un nouveau role **client** au systeme existant, creation d'un module de partage de documents organise en 6 rubriques, avec stockage sur Lovable Cloud (limite 10 Mo/fichier, 100 Mo/client). Les profils internes uploadent les fichiers, le client ne fait que consulter et telecharger.

---

## Etape 1 -- Migration base de donnees

### 1.1 Ajouter le role `client` a l'enum `app_role`

```sql
ALTER TYPE public.app_role ADD VALUE 'client';
```

### 1.2 Table `client_users` (association manuelle compte-client)

| Colonne | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | ref auth.users, NOT NULL |
| client_id | uuid | ref clients(id), NOT NULL |
| created_at | timestamptz | default now() |

Contrainte UNIQUE(user_id, client_id).

RLS :
- SELECT : `is_owner()` OU `user_id = auth.uid()`
- INSERT/UPDATE/DELETE : `is_owner()`

### 1.3 Table `client_documents` (metadonnees des fichiers)

| Colonne | Type | Notes |
|---|---|---|
| id | uuid | PK |
| client_id | uuid | ref clients(id), NOT NULL |
| matter_id | uuid | ref matters(id), nullable |
| category | text | NOT NULL (factures, comptable, fiscal, juridique, social, divers) |
| file_name | text | NOT NULL |
| file_path | text | NOT NULL (chemin dans le bucket) |
| file_size | integer | NOT NULL |
| mime_type | text | NOT NULL |
| uploaded_by | uuid | NOT NULL |
| created_at | timestamptz | default now() |

RLS :
- SELECT : `is_owner_or_assistant()` OU utilisateur lie au client via `client_users`
- INSERT/DELETE : `is_owner_or_assistant()` uniquement

### 1.4 Fonction helper `user_has_client_access`

Fonction `SECURITY DEFINER` qui verifie si un utilisateur a acces a un client donne via la table `client_users`.

### 1.5 Bucket de stockage `client-documents`

Bucket prive avec politiques RLS :
- Upload : roles internes uniquement (owner, assistant, sysadmin)
- Download : roles internes + utilisateurs lies via `client_users`
- Delete : roles internes uniquement

### 1.6 Mise a jour du trigger `handle_new_user_role`

Permettre au role `client` d'etre assigne lors de la creation d'utilisateur via la page Collaborateurs.

---

## Etape 2 -- Modifications du code

### 2.1 Types (`src/types/index.ts`)

Ajouter `'client'` au type `UserRole`.

### 2.2 Route protegee (`src/components/ProtectedRoute.tsx`)

- Le role `client` redirige vers `/documents` par defaut
- Les routes internes (timesheet, clients, matters, etc.) sont interdites au client

### 2.3 Navigation (`src/components/layout/AppLayout.tsx`)

- Ajouter l'entree "Vos Documents" avec l'icone `FileArchive`
- Visible pour : sysadmin, owner, assistant, client
- Le client ne voit que "Vos Documents" et "Messages" dans le menu
- Ajouter `'client'` dans `roleColors` et `roleLabels`

### 2.4 Routage (`src/App.tsx`)

- Ajouter la route `/documents`
- Rediriger le role `client` vers `/documents` au lieu de `/timesheet`

### 2.5 Nouvelle page (`src/pages/Documents.tsx`)

**Vue profils internes (sysadmin, owner, assistant) :**
1. Selecteur de client (dropdown)
2. Selecteur de dossier optionnel (filtre par client)
3. 6 onglets : Factures / Comptable / Fiscal / Juridique / Social / Divers
4. Bouton d'upload dans chaque rubrique
5. Validation : formats autorises (pdf, doc, docx, ppt, pptx, xls, xlsx, jpg, png, txt, csv), taille max 10 Mo
6. Verification quota client 100 Mo avant upload
7. Liste des fichiers avec nom, date, taille, boutons telecharger et supprimer

**Vue profil client :**
1. Filtre automatique sur ses clients associes (via `client_users`)
2. Si plusieurs clients : selecteur parmi ses associations
3. Memes 6 onglets, en lecture seule
4. Bouton telecharger uniquement (pas d'upload ni suppression)

### 2.6 Hook (`src/hooks/useDocuments.ts`)

- Liste des documents filtres par client, dossier et categorie
- Upload : validation taille (10 Mo), verification quota (100 Mo), upload vers bucket puis insertion en base
- Suppression : suppression fichier du bucket + suppression metadonnees
- Telechargement : generation d'URL signee

### 2.7 Hook (`src/hooks/useClientUsers.ts`)

- CRUD sur la table `client_users`
- Utilise par la page Collaborateurs pour associer des clients a un utilisateur ayant le role `client`

### 2.8 Page Collaborateurs (`src/pages/Collaborators.tsx`)

- Quand le role selectionne est `client`, afficher un champ multi-select pour choisir les clients a associer

### 2.9 Traductions (`src/i18n/locales/fr.json` et `en.json`)

Nouvelles cles :
- Navigation : `nav.documents`
- Categories : factures, comptable, fiscal, juridique, social, divers
- Actions : upload, telecharger, supprimer
- Messages d'erreur : taille max, quota depasse
- Role : client

---

## Etape 3 -- Securite

- Bucket `client-documents` prive : acces uniquement via URL signees
- RLS sur `client_documents` : le client ne voit que ses propres documents
- Fonction `user_has_client_access` en SECURITY DEFINER pour eviter la recursion RLS
- Validation frontend + verification base pour les limites de taille
- Le client ne peut ni uploader ni supprimer

---

## Fichiers concernes

| Fichier | Action |
|---|---|
| Migration SQL | Enum, tables, bucket, RLS, fonctions |
| `src/types/index.ts` | Ajouter client au type UserRole |
| `src/App.tsx` | Route /documents, redirection client |
| `src/components/ProtectedRoute.tsx` | Redirection client |
| `src/components/layout/AppLayout.tsx` | Entree menu, roleColors, roleLabels |
| `src/pages/Documents.tsx` | Nouveau -- module complet |
| `src/hooks/useDocuments.ts` | Nouveau -- hook documents |
| `src/hooks/useClientUsers.ts` | Nouveau -- hook associations |
| `src/pages/Collaborators.tsx` | Champ association client |
| `src/i18n/locales/fr.json` | Traductions FR |
| `src/i18n/locales/en.json` | Traductions EN |

