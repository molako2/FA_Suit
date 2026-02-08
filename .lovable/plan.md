

# Ajout d'une colonne Date dans les listes Frais, Factures et Avoirs

## Etat actuel

Apres verification du code :

- **Frais (Expenses.tsx)** : La colonne "Date" existe deja et affiche `expense_date` (la date du frais). Rien a changer.
- **Avoirs (CreditNotes.tsx)** : La colonne "Date d'emission" existe deja et affiche `issue_date`. Rien a changer.
- **Factures (Invoices.tsx)** : Il manque une colonne "Date d'emission". Seule la "Periode" (period_from / period_to) est affichee. C'est le seul module ou la colonne est absente.

## Modification prevue

### `src/pages/Invoices.tsx` -- Ajouter la colonne "Date d'emission"

Ajouter une nouvelle colonne entre "Periode" et "HT" dans le tableau des factures :

**En-tete du tableau** (ligne 660, apres "Periode") :
- Ajouter `<TableHead>Date d'emission</TableHead>`

**Lignes du tableau** (ligne 688, apres la cellule Periode) :
- Ajouter une cellule affichant `invoice.issue_date` formatee en date francaise
- Si la date n'est pas definie (brouillon), afficher un tiret "---"

**Cellule vide** (colspan) :
- Mettre a jour le colspan de 10 a 11 pour la ligne "Aucune facture"

### Code de la nouvelle cellule

```text
<TableCell className="text-muted-foreground text-sm">
  {invoice.issue_date
    ? new Date(invoice.issue_date).toLocaleDateString('fr-FR')
    : '—'}
</TableCell>
```

## Resume

| Fichier | Action |
|---|---|
| `src/pages/Invoices.tsx` | Ajouter la colonne "Date d'emission" dans le tableau des factures |

Les modules Frais et Avoirs possedent deja leur colonne date respective -- aucune modification necessaire pour ces deux modules.

