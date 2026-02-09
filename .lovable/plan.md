

# Ajustement visuel des graphiques

## Modifications

### 1. Couleur des heures non facturables
Changer la couleur du rouge fonce `hsl(0, 65%, 30%)` vers un rouge clair `hsl(0, 70%, 60%)` dans la configuration `collabConfig`.

### 2. Epaisseur des barres
Augmenter `barSize` de 50% : passer de `12` a `18` sur les 3 graphiques horizontaux (Heures par collaborateur, Top 10 Clients, Top 10 Dossiers).

## Fichier modifie

| Fichier | Modification |
|---|---|
| `src/pages/DashboardCharts.tsx` | Couleur nonBillable vers rouge clair + barSize de 12 a 18 sur les 3 BarCharts horizontaux |

