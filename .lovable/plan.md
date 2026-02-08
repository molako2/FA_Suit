

# Correction du Dashboard : heures WIP et CA forfait facturable

## Probleme identifie

Actuellement, le dashboard comptabilise **toutes** les heures facturables (billable), y compris celles deja facturees (locked). Le champ `locked` sur les entrees de temps indique qu'une entree a ete facturee via une facture emise. Il faut donc filtrer sur `!locked` pour n'afficher que le travail en cours (WIP = Work In Progress).

De plus, il manque un indicateur en haut du dashboard pour le chiffre d'affaires forfaitaire facturable (dossiers au forfait pas encore factures).

---

## Modifications prevues

### 1. `src/pages/Dashboard.tsx` -- Filtrer les heures non facturees + nouvelle carte forfait

**Carte "Heures facturables" (existante)** : Actuellement, elle affiche toutes les heures billable. Elle doit etre renommee/redefinie pour n'afficher que les heures **non encore facturees** (`billable && !locked`).

- `kpiSummary` : filtrer `entries.filter(e => e.billable && !e.locked)` au lieu de `entries.filter(e => e.billable)`
- `kpiByUser` : meme filtre `billable && !locked`
- `kpiByMatter` : meme filtre `billable && !locked`
- Sous-titre de la carte : changer pour indiquer "non facturees" / WIP

**Nouvelle carte "CA Forfait facturable"** : Ajouter une 6e carte en haut, avant ou apres les cartes existantes, qui affiche le total des montants forfaitaires des dossiers `flat_fee` n'ayant pas encore de facture emise. La logique est identique a celle deja implementee dans `KPIAnalyticsFlatFee` :
- Filtrer les matters avec `billing_type === 'flat_fee'`
- Exclure celles qui ont deja une facture emise (`invoices.filter(inv => inv.status === 'issued').map(inv => inv.matter_id)`)
- Sommer les `flat_fee_cents`

La grille passe de 5 a 6 colonnes (`lg:grid-cols-6`).

### 2. `src/components/dashboard/KPIAnalytics.tsx` -- Filtrer les heures WIP uniquement

Dans le calcul de `filteredEntries` (ligne 169), ajouter le filtre `!e.locked` pour que le "CA Facturable" et le "Total Heures Facturables" ne comptent que les heures non encore facturees.

Le composant recoit les `entries` en props depuis `Dashboard.tsx` (sans pre-filtrage), donc c'est le bon endroit pour ajouter le filtre car `KPIAnalytics` a sa propre logique de periode et filtres internes.

### 3. Traductions -- `fr.json` et `en.json`

Nouvelles cles :

```text
FR:
  dashboard.wipHoursCard = "Heures non facturées"
  dashboard.wipHoursSubtitle = "travail en cours (WIP)"
  dashboard.flatFeeBillableCard = "CA Forfait facturable"
  dashboard.flatFeeBillableSubtitle = "dossiers au forfait non facturés"

EN:
  dashboard.wipHoursCard = "Unbilled hours"
  dashboard.wipHoursSubtitle = "work in progress (WIP)"
  dashboard.flatFeeBillableCard = "Billable flat fees"
  dashboard.flatFeeBillableSubtitle = "uninvoiced flat-fee matters"
```

---

## Details techniques

### Filtre `locked` dans Dashboard.tsx

```text
// Avant
const billable = entries.filter(e => e.billable);

// Apres
const billable = entries.filter(e => e.billable && !e.locked);
```

Cela affecte :
- La carte "Heures facturables" du haut
- Le tableau "Par collaborateur"
- Le tableau "Par dossier"

### Calcul du forfait facturable dans Dashboard.tsx

```text
const totalFlatFeeBillable = useMemo(() => {
  const issuedMatterIds = new Set(
    invoices.filter(inv => inv.status === 'issued').map(inv => inv.matter_id)
  );
  return matters
    .filter(m => m.billing_type === 'flat_fee' && !issuedMatterIds.has(m.id))
    .reduce((sum, m) => sum + (m.flat_fee_cents || 0), 0);
}, [matters, invoices]);
```

### Filtre dans KPIAnalytics.tsx (ligne 170)

```text
// Avant
if (!e.billable) return false;

// Apres
if (!e.billable) return false;
if (e.locked) return false;  // Exclure les heures deja facturees
```

---

## Resume des fichiers

| Fichier | Action |
|---|---|
| `src/pages/Dashboard.tsx` | Modifier : filtrer `!locked` sur kpiSummary/kpiByUser/kpiByMatter + nouvelle carte forfait facturable + grille 6 colonnes |
| `src/components/dashboard/KPIAnalytics.tsx` | Modifier : ajouter filtre `!e.locked` dans filteredEntries |
| `src/i18n/locales/fr.json` | Modifier : ajout traductions WIP + forfait facturable |
| `src/i18n/locales/en.json` | Modifier : ajout traductions WIP + forfait facturable |

