

# Correction : Ajouter la valeur 'client' a l'enum app_role

## Probleme

La migration precedente qui devait ajouter `'client'` a l'enum `app_role` n'a pas ete appliquee. L'enum ne contient que : `owner`, `assistant`, `collaborator`, `sysadmin`. Quand on essaie d'assigner le role "client" a un utilisateur, la base de donnees rejette la valeur.

## Solution

Executer une nouvelle migration SQL :

```sql
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';
```

C'est la seule modification necessaire. Le reste du code (types, hooks, pages) est deja en place.

## Fichiers concernes

| Fichier | Action |
|---|---|
| Nouvelle migration SQL | Ajouter `'client'` a l'enum `app_role` |

Aucune modification de code n'est requise, uniquement la migration de base de donnees.
