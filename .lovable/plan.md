

# Ajout d'un plafond de facturation sur les dossiers au temps passe

## Objectif

Ajouter un champ "Montant maximum a facturer" (plafond HT) sur les dossiers factures au temps passe. Lors de la creation ou de l'emission d'une facture, si le montant HT depasse ce plafond (en tenant compte des factures deja emises sur le dossier), une alerte visuelle previent l'utilisateur.

## Modifications prevues

### 1. Base de donnees -- Nouvelle colonne `max_amount_ht_cents`

Ajouter une colonne nullable sur la table `matters` :

```text
ALTER TABLE matters ADD COLUMN max_amount_ht_cents integer DEFAULT NULL;
```

Cette colonne est optionnelle : si elle vaut `NULL`, aucun controle de plafond n'est effectue.

### 2. `src/hooks/useMatters.ts` -- Mise a jour de l'interface

Ajouter le champ `max_amount_ht_cents: number | null` a l'interface `Matter`.

### 3. `src/pages/Matters.tsx` -- Champ de saisie dans le formulaire

Dans le dialogue de creation/modification de dossier, ajouter un champ numerique "Montant maximum HT (MAD)" visible uniquement quand le type de facturation est "temps passe". Ce champ est optionnel.

Modifications :
- Nouveau state : `formMaxAmountHtCents`
- Affichage conditionnel sous le bloc "Taux horaire / TVA" quand `formBillingType === 'time_based'`
- Prise en compte dans `handleSave` (conversion en centimes)
- Pre-remplissage lors de l'edition d'un dossier existant
- Reinitialisation dans `resetForm`

### 4. `src/pages/Invoices.tsx` -- Alerte de depassement du plafond

#### 4a. Calcul du montant deja facture sur le dossier

A partir de la liste des factures existantes (`invoices`), calculer le total HT deja facture (factures emises, non annulees) pour le dossier selectionne :

```text
const alreadyInvoicedHt = invoices
  .filter(i => i.matter_id === selectedMatterId && i.status === 'issued')
  .reduce((sum, i) => sum + i.total_ht_cents, 0);
```

#### 4b. Alerte dans le dialogue de creation

Si le dossier a un `max_amount_ht_cents` defini, comparer `alreadyInvoicedHt + currentInvoiceHt` au plafond. Si le total depasse, afficher une alerte orange/warning dans la zone d'apercu avec un message explicite :

```text
Attention : le montant total facture (X MAD) depassera le plafond
defini pour ce dossier (Y MAD). Deja facture : Z MAD.
```

L'alerte est informative et non bloquante : l'utilisateur peut quand meme creer le brouillon.

#### 4c. Alerte dans le dialogue d'emission

Meme verification lors de l'emission (dialogue de confirmation). Si le plafond est depasse, ajouter un message d'avertissement dans le `AlertDialogDescription` pour que l'utilisateur soit averti avant de confirmer.

## Details techniques

### Nouveau state dans `Matters.tsx`

```text
const [formMaxAmountHtCents, setFormMaxAmountHtCents] = useState('');
```

### Champ dans le formulaire (visible si `time_based`)

```text
<div className="grid gap-2">
  <Label>Montant maximum HT (MAD)</Label>
  <Input
    type="number"
    step="0.01"
    min="0"
    placeholder="Optionnel - laisser vide si pas de plafond"
    value={formMaxAmountHtCents}
    onChange={(e) => setFormMaxAmountHtCents(e.target.value)}
  />
  <p className="text-xs text-muted-foreground">
    Si defini, une alerte sera affichee lors de la facturation si ce montant est depasse.
  </p>
</div>
```

### Calcul de l'alerte dans `Invoices.tsx`

```text
const selectedMatter = getSelectedMatter();
const maxAmountHt = selectedMatter?.max_amount_ht_cents;

const alreadyInvoicedHt = useMemo(() => {
  if (!selectedMatterId) return 0;
  return invoices
    .filter(i => i.matter_id === selectedMatterId && i.status === 'issued')
    .reduce((sum, i) => sum + i.total_ht_cents, 0);
}, [invoices, selectedMatterId]);

const currentEstimatedHt = selectedAmountHt; // du TimesheetEntrySelector
const totalProjectedHt = alreadyInvoicedHt + currentEstimatedHt;
const exceedsCeiling = maxAmountHt != null && totalProjectedHt > maxAmountHt;
```

### Composant d'alerte (utilise le composant `Alert` existant)

```text
{exceedsCeiling && (
  <Alert variant="destructive" className="border-orange-500 bg-orange-50 text-orange-800">
    <AlertTriangle className="h-4 w-4" />
    <AlertTitle>Plafond depasse</AlertTitle>
    <AlertDescription>
      Le montant total facture ({formatCents(totalProjectedHt)}) depassera le plafond
      defini pour ce dossier ({formatCents(maxAmountHt!)}). Deja facture : {formatCents(alreadyInvoicedHt)}.
    </AlertDescription>
  </Alert>
)}
```

## Resume des fichiers modifies

| Fichier | Action |
|---|---|
| Migration SQL | Ajouter colonne `max_amount_ht_cents` a la table `matters` |
| `src/hooks/useMatters.ts` | Ajouter `max_amount_ht_cents: number \| null` a l'interface |
| `src/pages/Matters.tsx` | Ajouter champ de saisie plafond (conditionnel sur `time_based`), gestion dans `handleSave`, `openDialog`, `resetForm` |
| `src/pages/Invoices.tsx` | Calculer le total deja facture, afficher alerte dans le dialogue de creation et dans le dialogue d'emission |

