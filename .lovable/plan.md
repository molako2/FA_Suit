

# Correction du nom de domaine dans l'adresse d'expedition

## Probleme

L'adresse d'expedition utilise actuellement `FlowAssist.cloud` (avec des majuscules) alors que le domaine reel est `flowassist.cloud` (tout en minuscules). Bien que les domaines soient techniquement insensibles a la casse pour le DNS, Resend peut etre sensible a la casse lors de la verification.

## Modification

### Fichier : `supabase/functions/send-email/index.ts`

- Changer l'adresse par defaut de `FlowAssist <noreply@FlowAssist.cloud>` vers `FlowAssist <noreply@flowassist.cloud>`

## Rappel important

Meme apres cette correction, le domaine `flowassist.cloud` doit etre verifie dans votre compte Resend :

1. Aller sur resend.com/domains
2. Ajouter le domaine `flowassist.cloud`
3. Configurer les enregistrements DNS (MX, SPF, DKIM) chez votre registrar
4. Attendre la verification (quelques minutes a 48h)

Sans cette verification, Resend continuera a rejeter les emails.

