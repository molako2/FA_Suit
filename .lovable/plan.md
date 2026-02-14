

# Alerte email au owner quand un dossier atteint 80% du budget

## Contexte

Les dossiers "temps passe" peuvent avoir un plafond de facturation (`max_amount_ht_cents`). Lorsque la consommation (heures saisies x taux) atteint 80% de ce plafond, le owner doit recevoir un email d'alerte.

## Approche

Le declenchement se fera cote frontend, apres chaque saisie de temps (creation d'une entree timesheet). Apres insertion reussie, on calculera la consommation totale du dossier et on verifiera si le seuil de 80% est franchi.

## Modifications

### 1. Fichier : `src/hooks/useTimesheet.ts`

Dans `useCreateTimesheetEntry`, apres l'insertion reussie (`onSuccess`), ajouter une logique de verification :

- Recuperer le dossier concerne et verifier s'il a un `max_amount_ht_cents` defini
- Recuperer toutes les entrees timesheet billable du dossier
- Calculer la consommation totale en cents (minutes x taux / 60)
- Si la consommation >= 80% du plafond, envoyer un email au owner via `send-email`

### 2. Logique de calcul

Le calcul reprend la meme formule que dans `src/pages/Matters.tsx` :

```text
consumedCents = somme de (minutes_rounded x rate_cents / 60) pour chaque entree billable
percentage = consumedCents / max_amount_ht_cents * 100
```

Si `percentage >= 80`, declenchement de l'alerte.

### 3. Contenu de l'email

- **Destinataire** : email du/des owner(s) (recupere via `user_roles` + `profiles`)
- **Objet** : `FlowAssist Suite - Alerte budget dossier {code}`
- **Corps** : Message indiquant le code du dossier, le libelle, le pourcentage atteint, le montant consomme et le plafond

### 4. Anti-spam

Pour eviter d'envoyer un email a chaque saisie de temps une fois le seuil franchi, on utilisera `sessionStorage` avec une cle par dossier (`budget-alert-{matter_id}`) pour ne declencher l'alerte qu'une seule fois par session.

## Details techniques

- La verification et l'envoi sont effectues de maniere non-bloquante (silencieux, dans un `try/catch`)
- Les requetes Supabase necessaires :
  - `matters` pour recuperer `max_amount_ht_cents` et `rate_cents`
  - `timesheet_entries` filtrees par `matter_id` et `billable = true`
  - `profiles` pour le `rate_cents` du collaborateur
  - `user_roles` + `profiles` pour trouver l'email du owner
- Aucune modification de base de donnees necessaire
- Aucune nouvelle Edge Function necessaire (reutilisation de `send-email`)

