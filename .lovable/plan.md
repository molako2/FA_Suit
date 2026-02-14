

# Mettre a jour le secret RESEND_API_KEY

## Action requise

Remplacer la valeur actuelle du secret `RESEND_API_KEY` par votre nouvelle cle API Resend.

## Etape

Une fois ce plan approuve, je vous demanderai de saisir votre nouvelle cle API Resend via l'outil securise de gestion des secrets. La cle sera stockee de maniere securisee et immediatement disponible pour la fonction d'envoi d'email.

Aucune modification de code n'est necessaire -- la fonction `send-email` utilise deja `Deno.env.get('RESEND_API_KEY')` et prendra automatiquement la nouvelle valeur.

