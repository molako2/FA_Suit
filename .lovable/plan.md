

# Corrections du module Documents et renommage du menu

## Resume

Trois corrections a apporter :
1. Le module Documents ne montre pas de selecteur de dossier pour les profils internes -- ajouter un filtre optionnel par dossier
2. Le profil client (ex: abdel@yopmail) voit les documents vides car l'association client_users fonctionne au niveau client, mais la page ne gere pas correctement l'affichage quand il n'y a qu'un seul client lie -- corriger l'auto-selection et s'assurer que le client voit tous les documents de ses clients associes (tous dossiers confondus)
3. Renommer le menu "Collaborateurs" en "Utilisateurs" dans la navigation

---

## Etape 1 -- Ajouter un selecteur de dossier dans Documents.tsx (profils internes)

**Fichier** : `src/pages/Documents.tsx`

- Importer `useMatters` depuis `@/hooks/useMatters`
- Ajouter un state `selectedMatterId` (string, vide par defaut = tous les dossiers)
- Apres le selecteur de client, afficher un selecteur de dossier filtre par le client selectionne
- Option "Tous les dossiers" par defaut
- Passer le `matterId` optionnel au hook `useDocuments`
- Passer le `matterId` lors de l'upload

## Etape 2 -- Modifier le hook useDocuments pour filtrer par dossier

**Fichier** : `src/hooks/useDocuments.ts`

- Ajouter un parametre optionnel `matterId` a `useDocuments(clientId, category, matterId?)`
- Si `matterId` est fourni, ajouter `.eq('matter_id', matterId)` a la requete
- Inclure `matterId` dans le `queryKey`

## Etape 3 -- Corriger l'affichage pour le profil client

**Fichier** : `src/pages/Documents.tsx`

Le probleme est que quand `availableClients.length === 1`, le selecteur ne s'affiche pas mais `selectedClientId` reste vide. Le `effectiveClientId` devrait fonctionner via le fallback, mais il faut verifier que la requete `useClients` retourne bien les clients pour un profil client (RLS). La politique RLS sur `clients` autorise SELECT pour `auth.uid() IS NOT NULL`, donc ca devrait fonctionner.

Le vrai probleme est probablement que `useClientUsers` ne retourne pas les liens car la RLS sur `client_users` utilise `is_owner() OR user_id = auth.uid()`. Il faut verifier que le user connecte a bien le role client et que les associations existent en base.

Correction : s'assurer que l'auto-selection fonctionne meme avec un seul client, et que le selecteur s'affiche meme avec un seul client (pour clarifier le contexte).

## Etape 4 -- Renommer "Collaborateurs" en "Utilisateurs"

**Fichiers** : `src/i18n/locales/fr.json` et `src/i18n/locales/en.json`

- Changer `nav.collaborators` de "Collaborateurs" a "Utilisateurs" (FR) et "Collaborators" a "Users" (EN)
- Mettre a jour le titre de la page dans `collaborators.title` : "Utilisateurs" (FR) / "Users" (EN)

**Fichier** : `src/pages/Collaborators.tsx`

- Mettre a jour le titre en dur "Collaborateurs" (ligne 347) en utilisant la cle i18n

## Fichiers concernes

| Fichier | Action |
|---|---|
| `src/pages/Documents.tsx` | Ajouter selecteur dossier, corriger auto-selection client |
| `src/hooks/useDocuments.ts` | Ajouter filtre optionnel par matter_id |
| `src/i18n/locales/fr.json` | Renommer Collaborateurs -> Utilisateurs |
| `src/i18n/locales/en.json` | Renommer Collaborators -> Users |
| `src/pages/Collaborators.tsx` | Utiliser cle i18n pour le titre |

