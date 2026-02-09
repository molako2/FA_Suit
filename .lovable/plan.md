

# Ajustement des KPI du Tableau de bord

## Objectif

Supprimer les 2 cartes KPI "Collaborateurs actifs" et "Dossiers actifs", et afficher les 4 cartes restantes sur une seule ligne.

## Modifications

### 1. Suppression des 2 cartes KPI

Retirer les cartes suivantes du rendu :
- **Collaborateurs actifs** (lignes 211-220) -- icone `Users`
- **Dossiers actifs** (lignes 222-231) -- icone `FolderOpen`

### 2. Grille sur une seule ligne

Changer la classe de la grille de `grid gap-4 md:grid-cols-2 lg:grid-cols-3` vers `grid gap-4 grid-cols-2 lg:grid-cols-4` pour que les 4 cartes restantes s'affichent sur une seule ligne en desktop (4 colonnes) et 2 par ligne sur mobile.

### 3. Nettoyage des imports inutilises

Retirer `Users` et `FolderOpen` de l'import lucide-react puisqu'ils ne seront plus utilises.

## Cartes conservees (4)

1. Heures WIP facturables
2. CA Forfait facturable
3. CA Facture
4. CA Encaisse

## Fichier modifie

| Fichier | Modification |
|---|---|
| `src/pages/Dashboard.tsx` | Suppression des 2 cartes, grille 4 colonnes, nettoyage imports |

