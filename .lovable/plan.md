
# Affichage des temps saisis dans le module Dossiers

## Probleme

Le module Dossiers affiche actuellement dans la colonne "Montant" uniquement le **taux horaire** du dossier (ex: 1 000 MAD/h pour CLI0002-DOS0001). Les temps effectivement saisis par les collaborateurs sur le dossier ne sont pas visibles. L'utilisateur doit naviguer vers le module Timesheet pour connaitre la consommation reelle.

## Solution

Enrichir le tableau des dossiers avec de nouvelles colonnes montrant la consommation reelle des temps saisis, specifiquement pour les dossiers au "temps passe".

### Nouvelles colonnes ajoutees au tableau

Pour les dossiers de type "temps passe" :

| Colonne actuelle "Montant" | Nouvelle colonne "Heures saisies" | Nouvelle colonne "CA Consomme" |
|---|---|---|
| Taux horaire (ex: 1 000 MAD/h) | Total des heures saisies (ex: 11h00) | Montant HT calcule (ex: 11 000 MAD) |

Pour les dossiers au "forfait", les nouvelles colonnes afficheront "---".

Si un plafond (`max_amount_ht_cents`) est defini sur le dossier, une barre de progression sera affichee sous le montant CA Consomme avec un code couleur :
- Vert : moins de 75% du plafond
- Orange : entre 75% et 100%
- Rouge : plafond depasse

### Donnees necessaires

Charger les entrees de temps via `useTimesheetEntries()` (sans filtre utilisateur ni periode) dans la page Dossiers. Les entrees sont ensuite agregees par `matter_id` via un `useMemo`.

L'agregation produit pour chaque dossier :
- `totalMinutes` : somme de `minutes_rounded` (toutes entrees)
- `billableMinutes` : somme de `minutes_rounded` (entrees facturables uniquement)
- `consumedAmountCents` : calcul base sur le taux du collaborateur ou le taux du dossier pour chaque entree

### Modifications de fichiers

**`src/pages/Matters.tsx`** :

1. Importer `useTimesheetEntries` et `useProfiles`
2. Charger toutes les entrees de temps et les profils
3. Creer un `useMemo` pour calculer les totaux par dossier :

```text
const matterStats = useMemo(() => {
  const stats = new Map();
  timesheetEntries.forEach(entry => {
    const matter = matters.find(m => m.id === entry.matter_id);
    const profile = profiles.find(p => p.id === entry.user_id);
    const rateCents = profile?.rate_cents || matter?.rate_cents || defaultRateCents;
    
    if (!stats.has(entry.matter_id)) {
      stats.set(entry.matter_id, { totalMinutes: 0, billableMinutes: 0, consumedCents: 0 });
    }
    const s = stats.get(entry.matter_id);
    s.totalMinutes += entry.minutes_rounded;
    if (entry.billable) {
      s.billableMinutes += entry.minutes_rounded;
      s.consumedCents += Math.round((entry.minutes_rounded * rateCents) / 60);
    }
  });
  return stats;
}, [timesheetEntries, matters, profiles, defaultRateCents]);
```

4. Ajouter deux colonnes au tableau apres la colonne "Montant" existante :
   - **"Heures saisies"** : affiche `formatMinutesToHours(totalMinutes)` ou `---` si forfait
   - **"CA Consomme"** : affiche `formatCents(consumedCents)` ou `---` si forfait, avec barre de progression si plafond defini

5. Charger `cabinet_settings` pour obtenir le `rate_cabinet_cents` (taux par defaut) via `useCabinetSettings`

6. Mettre a jour le `colSpan` de la ligne "Aucun dossier" pour correspondre au nouveau nombre de colonnes

**`src/hooks/useTimesheet.ts`** : Aucune modification necessaire, le hook existant supporte deja l'appel sans parametres pour charger toutes les entrees.

### Rendu visuel de la barre de progression (plafond)

Quand `max_amount_ht_cents` est defini sur un dossier au temps passe :

```text
CA Consomme
11 000 MAD
[========75%========] / 15 000 MAD
```

Utilise le composant `Progress` existant avec des classes Tailwind conditionnelles pour le code couleur.

## Resume

| Fichier | Action |
|---|---|
| `src/pages/Matters.tsx` | Ajouter imports, calculer stats par dossier, ajouter 2 colonnes "Heures saisies" et "CA Consomme" avec barre de progression plafond |

Aucune modification de base de donnees necessaire.
