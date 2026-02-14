

# Ameliorations du module documentaire : Visionnage, Telechargement et Versioning automatique par nom

## Objectif

Trois ameliorations demandees :
1. **Visionnage** : Previsualiser les fichiers (PDF, images) directement dans le panneau sans les telecharger
2. **Telechargement** : Ajouter un vrai telechargement (actuellement le fichier s'ouvre dans un nouvel onglet, pas de download force)
3. **Versioning automatique par nom** : Si un fichier uploade a le meme nom qu'un document existant dans le dossier, il est automatiquement traite comme une nouvelle version

## Modifications prevues

### 1. Hook `src/hooks/useMatterDocuments.ts`

**Visionnage** : Ajouter un hook `usePreviewMatterDocument()` qui genere une URL signee et retourne l'URL + le type MIME pour affichage inline.

**Telechargement** : Modifier `useDownloadMatterDocument()` pour forcer le telechargement reel du fichier (fetch du blob + creation d'un lien `<a>` avec `download` attribute) au lieu de simplement ouvrir dans un nouvel onglet.

**Versioning auto par nom** : Modifier `useUploadMatterDocument()` pour :
- Avant l'upload, chercher dans `matter_documents` un document avec le meme `file_name` et `is_current = true` dans le meme dossier
- Si un document existant est trouve, basculer automatiquement vers la logique de nouvelle version (`is_current = false` sur l'ancien, `parent_id` et `version_number` incrementes sur le nouveau)
- Sinon, proceder a un upload normal (v1)

### 2. Composant `src/components/matters/MatterDocumentsSheet.tsx`

**Bouton Visionnage** : Ajouter un bouton oeil (`Eye` icon) sur chaque document pour ouvrir un dialog de previsualisation :
- PDF : affiche dans un `<iframe>` avec l'URL signee
- Images (jpeg, png) : affiche dans un `<img>`
- Autres types : message indiquant que la previsualisation n'est pas disponible, avec option de telecharger

**Bouton Telechargement** : Le bouton `Download` existant declenchera desormais un vrai telechargement force.

**Indicateur de version** : Toujours afficher le numero de version (`v1`, `v2`...) meme pour la v1, et afficher un badge "versions" cliquable des qu'il y a plus d'une version.

**Dialog de previsualisation** : Nouveau dialog plein ecran (ou large) avec :
- Le nom du fichier en titre
- Le contenu (iframe pour PDF, img pour images)
- Boutons telecharger et fermer

### 3. Traductions `src/i18n/locales/fr.json` et `en.json`

Ajouter les cles :
- `matterDocuments.preview` : "Apercu" / "Preview"
- `matterDocuments.previewNotAvailable` : "Apercu non disponible pour ce type de fichier" / "Preview not available for this file type"
- `matterDocuments.download` : "Telecharger" / "Download"
- `matterDocuments.autoVersionDetected` : "Version existante detectee, nouvelle version creee automatiquement" / "Existing version detected, new version created automatically"

## Details techniques

- Le visionnage utilise `createSignedUrl` avec une duree de 300 secondes pour les previews
- Le telechargement force utilise `fetch()` + `URL.createObjectURL()` + lien `<a download="filename">`
- La detection de meme nom compare `file_name` en minuscules pour etre insensible a la casse
- Le versioning automatique est transparent : l'utilisateur uploade un fichier, si le nom existe deja le systeme gere la version automatiquement avec un toast d'information

