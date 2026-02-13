
# Corriger le selecteur de dossier pour les clients

## Probleme identifie

Le selecteur de dossier ne s'affiche pas pour les clients car la table `matters` a une politique RLS qui utilise la fonction `user_is_assigned_to_matter()`. Cette fonction verifie la table `assignments` (reservee aux collaborateurs internes), pas la table `client_user_matters`. Resultat : `useMatters()` retourne une liste vide pour un client, donc `clientMatters` est vide et le selecteur n'apparait jamais.

## Solution

### Etape 1 -- Mettre a jour la politique RLS sur `matters`

Modifier la politique SELECT existante pour inclure les utilisateurs clients qui ont un lien dans `client_user_matters` :

```text
Nouvelle logique :
  is_owner_or_assistant()
  OR user_is_assigned_to_matter(id)
  OR EXISTS (
    SELECT 1 FROM client_user_matters
    WHERE matter_id = matters.id
    AND user_id = auth.uid()
  )
```

Cela permet au client de "voir" les dossiers auxquels il a ete affecte via son profil, sans modifier le comportement pour les utilisateurs internes.

### Etape 2 -- Aucune modification frontend

Le code frontend est deja correct :
- `useClientUserMatters` recupere les associations du client
- `clientMatters` filtre les dossiers par ces associations
- Le selecteur affiche "Tous les dossiers" + les dossiers individuels
- Le filtrage par `effectiveMatterId` fonctionne deja

Le seul blocage est la politique RLS qui empeche `useMatters()` de retourner les dossiers au client.

## Fichiers concernes

| Fichier | Action |
|---|---|
| Migration SQL | Modifier la politique SELECT sur `matters` pour autoriser les clients via `client_user_matters` |
