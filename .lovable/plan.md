
# Mise a jour du contenu de l'email de notification

## Modifications

### Fichier : `src/hooks/useDocuments.ts`

Deux changements dans l'appel a `send-email` (lignes 159-163) :

1. **Objet du mail** : Changer de `Nouveau document disponible - {categorie}` vers `FlowAssist Suite - Nouveau document disponible - {categorie}`

2. **Corps du mail** : Ajouter le lien `www.flowassist.cloud` dans la phrase existante. La ligne devient :
   - `Connectez-vous à votre espace FlowAssist pour le consulter : <a href="https://www.flowassist.cloud">www.flowassist.cloud</a>`
