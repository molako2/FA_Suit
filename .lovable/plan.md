

# Ajout de filtres entonnoir sur toutes les colonnes

## Etat actuel

Actuellement, seules certaines colonnes ont le filtre entonnoir :

| Module | Colonnes AVEC filtre | Colonnes SANS filtre |
|---|---|---|
| Clients | Statut | Code, Nom, Adresse, Email facturation, ICE, Contact, Tel. contact |
| Dossiers | Client, Nature intervention, Secteur activite, Facturation, Statut | Code, Libelle, TVA, Montant |
| Factures | Dossier, Client, Statut, Payee | N facture, Periode, Date emission, HT, TTC, Date reglement |

## Modifications prevues

### 1. `src/pages/Clients.tsx`

Ajouter 7 colonnes filtrees au `useColumnFilters` (actuellement seul `status` est declare).

Nouvelles colonnes avec filtre :
- **Code** : valeurs uniques des codes clients
- **Nom** : valeurs uniques des noms clients
- **Adresse** : valeurs uniques (en excluant les vides)
- **Email facturation** : valeurs uniques (en excluant les vides)
- **Numero ICE** : valeurs uniques (en excluant les vides)
- **Contact** : valeurs uniques des noms de contact (en excluant les vides)
- **Tel. contact** : valeurs uniques des telephones (en excluant les vides)

Pour chaque colonne, les options du filtre sont calculees dynamiquement via `useMemo` a partir des donnees `clients`. Le `filteredClients` applique tous les filtres en chaine avec `passesFilter`.

### 2. `src/pages/Matters.tsx`

Ajouter 4 colonnes filtrees (actuellement 5 colonnes sont declarees : client, interventionNature, clientSector, billingType, status).

Nouvelles colonnes avec filtre :
- **Code** : valeurs uniques des codes dossiers
- **Libelle** : valeurs uniques des libelles
- **TVA** : valeurs 0% / 20%
- **Montant** : valeurs uniques des montants (taux horaire ou forfait selon le type)

### 3. `src/pages/Invoices.tsx`

Ajouter 6 colonnes filtrees (actuellement 4 colonnes declarees : matter, client, status, paid).

Nouvelles colonnes avec filtre :
- **N facture** : valeurs uniques des numeros de facture (brouillons inclus)
- **Periode** : valeurs uniques des periodes formatees
- **Date emission** : valeurs uniques des dates d'emission
- **HT** : valeurs uniques des montants HT
- **TTC** : valeurs uniques des montants TTC
- **Date reglement** : valeurs uniques des dates de reglement

---

## Details techniques

### Pattern applique pour chaque nouvelle colonne

1. Ajouter le nom de colonne dans le tableau passe a `useColumnFilters`
2. Calculer les options via `useMemo` a partir des donnees source
3. Remplacer le `<TableHead>Titre</TableHead>` par :

```text
<TableHead>
  <ColumnHeaderFilter
    title="Titre"
    options={titreFilterOptions}
    selectedValues={filters.titre}
    onFilterChange={(v) => setFilter('titre', v)}
  />
</TableHead>
```

4. Ajouter le `passesFilter('titre', valeur)` dans le `filteredXxx` du `useMemo`

### Gestion des valeurs vides

Pour les colonnes pouvant contenir des valeurs nulles/vides (adresse, email, contact, tel, ICE, date reglement, date emission), les options incluent une entree speciale "(Vide)" avec la valeur `"__empty__"`. Le filtre teste `passesFilter('colonne', valeur || '__empty__')` pour matcher les lignes sans valeur.

### Calcul des options pour les montants

Les montants (HT, TTC, Montant) sont affiches en format lisible (ex: "600,00 MAD") comme label, et stockent la valeur en centimes comme `value` pour le matching.

---

## Resume des fichiers

| Fichier | Action |
|---|---|
| `src/pages/Clients.tsx` | Ajouter filtres sur Code, Nom, Adresse, Email, ICE, Contact, Tel |
| `src/pages/Matters.tsx` | Ajouter filtres sur Code, Libelle, TVA, Montant |
| `src/pages/Invoices.tsx` | Ajouter filtres sur N facture, Periode, Date emission, HT, TTC, Date reglement |

Aucune modification de la base de donnees ni du composant `ColumnHeaderFilter` necessaire.
