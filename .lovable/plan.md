

# Notification email au client lors d'un upload de document

## Objectif

Envoyer automatiquement un email au client (via son `billing_email`) chaque fois qu'un document est uploade dans "Vos Documents", avec l'adresse d'expedition `noreply@FlowAssist.cloud`.

## Fonctionnement

1. Apres un upload reussi, le systeme recupere le `billing_email` du client concerne
2. Si le client a un `billing_email` renseigne, un email est envoye via la fonction `send-email` existante
3. L'email contient le nom du fichier, la categorie et la date d'upload
4. L'adresse d'expedition par defaut est mise a jour vers `noreply@FlowAssist.cloud`

## Pre-requis

Le domaine `FlowAssist.cloud` doit etre verifie dans votre compte Resend (ajout des enregistrements DNS MX, SPF, DKIM). Sans cela, Resend refusera d'envoyer depuis cette adresse.

## Modifications techniques

### 1. Mise a jour de l'adresse d'expedition par defaut

**Fichier** : `supabase/functions/send-email/index.ts`
- Changer le `from` par defaut de `FlowAssist <onboarding@resend.dev>` vers `FlowAssist <noreply@FlowAssist.cloud>`

### 2. Envoi de l'email apres upload

**Fichier** : `src/hooks/useDocuments.ts`
- Modifier `useUploadDocument` pour accepter un parametre supplementaire `clientEmail` (le `billing_email` du client)
- Dans le callback `onSuccess` (ou a la fin de `mutationFn`), appeler `supabase.functions.invoke('send-email', ...)` avec :
  - `to` : le `billing_email` du client
  - `subject` : "Nouveau document disponible" (ou equivalent traduit)
  - `html` : un email simple indiquant le nom du fichier, la categorie et la date
  - `from` : `FlowAssist <noreply@FlowAssist.cloud>`
- L'envoi est silencieux (pas de blocage si l'email echoue, juste un log console)

### 3. Passage du billing_email depuis la page Documents

**Fichier** : `src/pages/Documents.tsx`
- Lors de l'appel a `uploadDoc.mutate(...)`, ajouter le `billing_email` du client selectionne dans les parametres
- Recuperer l'email depuis l'objet client deja disponible dans `availableClients`

### 4. Traductions

**Fichiers** : `src/i18n/locales/fr.json` et `src/i18n/locales/en.json`
- Ajouter les cles pour le sujet et le contenu de l'email de notification

## Comportement

- Si le client n'a pas de `billing_email`, aucun email n'est envoye (pas d'erreur)
- L'echec d'envoi d'email ne bloque pas l'upload (l'upload reste reussi)
- L'email est envoye uniquement lors d'un upload par un utilisateur interne (owner/assistant/sysadmin)

