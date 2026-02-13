

# Ajouter un mode d'affichage "Tous les dossiers" pour les clients

## Contexte

Actuellement, le client doit selectionner un dossier specifique pour voir ses documents. Il n'a pas la possibilite de voir tous les documents de tous ses dossiers assignes en une seule vue, contrairement au owner.

## Solution

Modifier le selecteur de dossier pour les clients afin d'inclure l'option "Tous les dossiers" (valeur `all`), exactement comme pour les utilisateurs internes.

Le comportement sera :
- **"Tous les dossiers"** selectionne : affiche les documents de tous les dossiers assignes au client (la politique RLS filtre deja automatiquement cote serveur)
- **Un dossier specifique** selectionne : affiche uniquement les documents de ce dossier

## Details techniques

### Fichier : `src/pages/Documents.tsx`

Le selecteur de dossier est deja visible pour les clients (grace au dernier changement). L'option "Tous les dossiers" (`all`) existe deja dans le `Select`. Quand `all` est selectionne, `selectedMatterId` est vide, et `effectiveMatterId` est `undefined`, ce qui fait que la requete ne filtre pas par `matter_id`.

La politique RLS existante garantit que le client ne verra que les documents des dossiers auxquels il a acces, meme sans filtre cote frontend.

**Changement unique** : quand le client selectionne "Tous les dossiers", ne pas passer de filtre `matterId` a la requete. C'est deja le comportement actuel grace a `effectiveMatterId = selectedMatterId || undefined`.

Verification necessaire : confirmer que le code actuel fonctionne deja correctement avec l'option "Tous les dossiers" pour les clients, car :
1. Le selecteur affiche deja "Tous les dossiers" comme premiere option
2. `effectiveMatterId` est deja `undefined` quand rien n'est selectionne
3. La RLS filtre deja par dossier cote serveur

Si le comportement est deja fonctionnel, aucune modification de code n'est necessaire. Si un probleme est detecte lors du test, il faudra simplement s'assurer que le `Select` demarre avec la valeur `all` par defaut.

