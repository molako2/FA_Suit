
# Correction du CA Facture a 0 dans le KPI temps passe

## Diagnostic

La facture `2026-0002` de 600 MAD HT existe en base (matter `time_based`, `status: issued`, `issue_date: 2026-02-07`). Elle est correctement filtree par `filteredInvoices`. Le probleme est dans la logique de distribution du CA facture aux lignes du tableau (lignes 256-294 de `KPIAnalytics.tsx`).

### Cause racine (double bug)

**Bug 1 -- Condition manquante dans la distribution** : Quand seul "Collaborateur" est coche (par defaut), la distribution d'invoices entre dans la branche `groupByCollaborator === true` (ligne 261). A l'interieur, elle cherche a matcher les factures avec les lignes existantes via :
- `groupByMatter && row.matterId === inv.matter_id` --> FAUX (groupByMatter est desactive)
- `!groupByMatter && groupByClient && row.clientId === client?.id` --> FAUX (groupByClient est desactive)

Aucune condition ne gere le cas ou SEUL `groupByCollaborator` est actif. Le CA facture n'est donc jamais affecte a aucune ligne.

**Bug 2 -- Pas de ligne pour les dossiers entierement factures** : Les entrees de temps du dossier `revue doc` sont toutes `locked: true` (120 min facturees). Elles sont exclues de `filteredEntries` (filtre WIP). Resultat : aucune ligne n'est creee dans la Map `grouped` pour ce dossier. Meme si la condition de distribution etait corrigee, il n'y aurait aucune ligne cible.

## Solution

Calculer le total `invoicedRevenueCents` directement a partir de `filteredInvoices` au lieu de le sommer depuis les lignes individuelles. Cela garantit que le total est toujours correct, independamment de la logique de distribution par ligne.

Pour les lignes individuelles, ajouter un fallback qui cree une ligne quand aucune ligne existante ne correspond a la facture.

### Modifications dans `src/components/dashboard/KPIAnalytics.tsx`

**1. Calcul des totaux (lignes 300-308)** -- Remplacer le calcul du total `invoicedRevenueCents` qui somme depuis les lignes par un calcul direct depuis `filteredInvoices` :

```text
// Avant (somme depuis les lignes - peut etre 0 si la distribution echoue)
const totals = kpiData.reduce((acc, row) => ({
  ...
  invoicedRevenueCents: acc.invoicedRevenueCents + row.invoicedRevenueCents,
}), ...);

// Apres (calcul direct depuis les factures filtrees)
const totalInvoicedRevenue = useMemo(() => {
  return filteredInvoices.reduce((sum, inv) => sum + inv.total_ht_cents, 0);
}, [filteredInvoices]);

// Les totals pour billableMinutes et billableRevenueCents restent calcules depuis kpiData
// Mais invoicedRevenueCents utilise totalInvoicedRevenue
```

**2. Distribution des factures (lignes 256-294)** -- Corriger la branche `groupByCollaborator` pour gerer le cas ou c'est le seul groupement actif. Quand ni `groupByMatter` ni `groupByClient` ne sont actifs, creer une ligne de fallback ou distribuer a toutes les lignes existantes :

```text
// Ajouter le cas manquant dans la branche groupByCollaborator
if (groupByCollaborator) {
  let distributed = false;
  grouped.forEach((row) => {
    if (groupByMatter && row.matterId === inv.matter_id) {
      row.invoicedRevenueCents += inv.total_ht_cents;
      distributed = true;
    } else if (!groupByMatter && groupByClient && row.clientId === client?.id) {
      row.invoicedRevenueCents += inv.total_ht_cents;
      distributed = true;
    }
  });
  
  // Fallback : si aucune ligne ne matche (seul collaborateur actif, ou dossier sans WIP)
  if (!distributed) {
    const fallbackKey = `invoice_${inv.id}`;
    grouped.set(fallbackKey, {
      key: fallbackKey,
      collaboratorName: '-',
      clientId: groupByClient ? client?.id : undefined,
      clientCode: groupByClient ? (client?.code || '-') : undefined,
      clientName: groupByClient ? (client?.name || '-') : undefined,
      matterId: groupByMatter ? inv.matter_id : undefined,
      matterCode: groupByMatter ? (matter?.code || '-') : undefined,
      matterLabel: groupByMatter ? (matter?.label || '-') : undefined,
      billableMinutes: 0,
      billableRevenueCents: 0,
      invoicedRevenueCents: inv.total_ht_cents,
    });
  }
}
```

**3. Affichage des totaux (cartes recapitulatives en bas)** -- Utiliser `totalInvoicedRevenue` au lieu de `totals.invoicedRevenueCents` pour la carte "CA Facture".

**4. Ligne total du tableau** -- Meme correction : utiliser `totalInvoicedRevenue` pour la cellule total du CA Facture.

---

## Resume des fichiers

| Fichier | Action |
|---|---|
| `src/components/dashboard/KPIAnalytics.tsx` | Corriger : total CA facture calcule directement depuis filteredInvoices + fallback pour les factures sans ligne correspondante |

Aucune modification de base de donnees, de traductions, ni d'autres fichiers necessaire.
