
# Regroupement des KPI et ajout de la balance agee des heures non facturees

## Objectif

Fusionner les deux tableaux KPI du Dashboard ("Par collaborateur" et "Par dossier") en un seul bloc unifie avec des cases a cocher permettant de choisir le regroupement (collaborateur, dossier, client). Ajouter des colonnes de balance agee pour les heures saisies et non facturees, ventilees par tranche d'anciennete.

## Situation actuelle

Le Dashboard contient deux cartes separees (lignes 277-371 de `Dashboard.tsx`) :
- "Par collaborateur" : tableau avec Collaborateur, Email, Minutes, Heures
- "Par dossier" : tableau avec Code, Dossier, Client, Minutes, Heures

Ces deux blocs affichent les heures facturables (non locked) sur la periode selectionnee, mais de maniere independante et sans detail d'anciennete.

## Modifications prevues

### 1. `src/pages/Dashboard.tsx` -- Remplacement des deux cartes par un bloc unifie

**Suppression** des deux cartes "Par collaborateur" et "Par dossier" (lignes 277-371).

**Ajout** d'un nouveau composant `<WIPAgingAnalysis>` qui prend en props les donnees deja chargees (entries, profiles, matters, clients, periodFrom, periodTo).

### 2. Nouveau composant `src/components/dashboard/WIPAgingAnalysis.tsx`

Ce composant regroupe les deux tableaux en un seul, avec les fonctionnalites suivantes :

#### Cases a cocher de regroupement

Trois cases a cocher dans l'en-tete de la carte :
- **Collaborateur** (coche par defaut)
- **Dossier**
- **Client**

Au moins une case doit rester cochee. Les colonnes du tableau s'adaptent dynamiquement selon les cases selectionnees.

#### Colonnes de balance agee

En plus des colonnes existantes (Minutes, Heures), ajouter 5 colonnes de ventilation par anciennete, calculees a partir de la date de chaque entree de temps par rapport a la date du jour :

| Colonne | Signification |
|---|---|
| < 30 J | Entrees de moins de 30 jours |
| 30-60 J | Entrees entre 30 et 60 jours |
| 60-90 J | Entrees entre 60 et 90 jours |
| 90-120 J | Entrees entre 90 et 120 jours |
| > 120 J | Entrees de plus de 120 jours |

Les valeurs sont exprimees en heures (format `Xh XX`).

#### Export CSV

Un bouton "Export CSV" unique qui exporte le tableau selon le regroupement actif, incluant les colonnes de balance agee.

### Structure du composant

```text
interface AgingBuckets {
  under30: number;    // minutes
  d30to60: number;
  d60to90: number;
  d90to120: number;
  over120: number;
}

interface WIPAgingRow {
  key: string;
  // Champs conditionnels selon le regroupement
  userId?: string;
  userName?: string;
  userEmail?: string;
  matterId?: string;
  matterCode?: string;
  matterLabel?: string;
  clientId?: string;
  clientCode?: string;
  clientName?: string;
  // Totaux
  billableMinutes: number;
  // Balance agee
  aging: AgingBuckets;
}
```

### Logique d'agregation

```text
const today = new Date();

filteredEntries.forEach(entry => {
  const entryDate = new Date(entry.date);
  const diffDays = Math.floor((today - entryDate) / (1000 * 60 * 60 * 24));

  // Construire la cle de regroupement
  const keyParts = [];
  if (groupByCollaborator) keyParts.push(entry.user_id);
  if (groupByClient) keyParts.push(clientId);
  if (groupByMatter) keyParts.push(entry.matter_id);
  const key = keyParts.join('|');

  // Ajouter les minutes au bon bucket
  const row = grouped.get(key) || { ...emptyRow, aging: {...emptyAging} };
  row.billableMinutes += entry.minutes_rounded;

  if (diffDays < 30) row.aging.under30 += entry.minutes_rounded;
  else if (diffDays < 60) row.aging.d30to60 += entry.minutes_rounded;
  else if (diffDays < 90) row.aging.d60to90 += entry.minutes_rounded;
  else if (diffDays < 120) row.aging.d90to120 += entry.minutes_rounded;
  else row.aging.over120 += entry.minutes_rounded;
});
```

### Rendu du tableau

```text
| Collaborateur* | Client* | Dossier* | Minutes | Heures | < 30 J | 30-60 J | 60-90 J | 90-120 J | > 120 J |
|----------------|---------|----------|---------|--------|--------|---------|---------|----------|---------|
| Nom collab     | CLI001  | DOS001   | 810     | 13h30  | 5h00   | 4h30    | 2h00    | 1h00     | 1h00    |
```

*Colonnes affichees conditionnellement selon les cases cochees.*

Une ligne "TOTAL" en pied de tableau somme toutes les colonnes.

Les colonnes de balance agee > 0 dans les tranches 90-120J et >120J seront mises en evidence avec une couleur orange/rouge pour signaler les heures anciennes.

### 3. Traductions i18n

Ajouter les cles suivantes dans `fr.json` et `en.json` :

**Francais :**
```text
"wipAging": "Heures facturables non facturees",
"wipAgingDescription": "Balance agee des heures saisies et non facturees",
"under30Days": "< 30 J",
"d30to60Days": "30-60 J",
"d60to90Days": "60-90 J",
"d90to120Days": "90-120 J",
"over120Days": "> 120 J",
"groupBy": "Regrouper par"
```

**Anglais :**
```text
"wipAging": "Unbilled billable hours",
"wipAgingDescription": "Aging balance of logged unbilled hours",
"under30Days": "< 30 D",
"d30to60Days": "30-60 D",
"d60to90Days": "60-90 D",
"d90to120Days": "90-120 D",
"over120Days": "> 120 D",
"groupBy": "Group by"
```

## Resume des fichiers modifies

| Fichier | Action |
|---|---|
| `src/components/dashboard/WIPAgingAnalysis.tsx` | Nouveau composant : tableau unifie avec cases a cocher et colonnes balance agee |
| `src/pages/Dashboard.tsx` | Remplacer les deux cartes KPI par le nouveau composant `WIPAgingAnalysis` |
| `src/i18n/locales/fr.json` | Ajouter cles de traduction pour balance agee |
| `src/i18n/locales/en.json` | Ajouter cles de traduction pour balance agee |

Aucune modification de base de donnees necessaire. Le calcul de l'anciennete se fait cote client a partir du champ `date` deja present dans les entrees de temps.
