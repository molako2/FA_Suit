

# Ajout de la fonctionnalite de reponse aux messages (discussion)

## Objectif
Permettre au destinataire d'un message de repondre directement, creant ainsi un fil de discussion. Chaque reponse respecte les memes regles : 256 caracteres max, emojis, et les messages sont affiches de maniere groupee (thread).

---

## 1. Base de donnees -- ajout de la colonne `reply_to`

Migration SQL pour ajouter une colonne `reply_to` a la table `messages` :

```text
ALTER TABLE public.messages 
  ADD COLUMN reply_to uuid REFERENCES public.messages(id) ON DELETE CASCADE;

CREATE INDEX idx_messages_reply_to ON public.messages(reply_to);
```

- `reply_to = NULL` : message de premier niveau (comme aujourd'hui)
- `reply_to = uuid` : reponse a un message existant
- `ON DELETE CASCADE` : si le message original est supprime, toutes les reponses sont supprimees aussi

Pas de modification des politiques RLS existantes : les reponses sont des messages normaux, les memes regles s'appliquent (SELECT, INSERT, UPDATE, DELETE).

---

## 2. Hook `src/hooks/useMessages.ts` -- modifications

- **Interface `Message`** : ajouter `reply_to: string | null` et `replies?: Message[]`
- **`useMessages()`** : apres la recuperation, grouper les messages en threads :
  - Recuperer tous les messages (y compris reponses)
  - Construire une structure arborescente : messages de premier niveau (`reply_to = null`) avec un tableau `replies` contenant leurs reponses, ordonnees chronologiquement (ascendant)
  - La liste principale affiche uniquement les messages de premier niveau, tries par date descendante
- **`useSendMessage()`** : accepter un parametre optionnel `replyTo: string | null` pour l'inserer dans la colonne `reply_to`
  - Pour une reponse, le `recipient_id` est automatiquement defini comme le `sender_id` du message original

---

## 3. Page `src/pages/Messages.tsx` -- ajout du bouton "Repondre" et affichage des threads

### Bouton "Repondre"
- Ajouter un bouton `Reply` (icone `Reply` de lucide-react) sur chaque message recu
- Le bouton est visible si l'utilisateur est le destinataire du message (direct ou broadcast) et n'est PAS l'expediteur
- Au clic, un champ de reponse inline s'affiche sous le message :

```text
+------------------------------------------+
| [Avatar] Expediteur       Date           |
| Contenu du message...                    |
| [Repondre] [Supprimer]                   |
+------------------------------------------+
|   +--------------------------------------+
|   | [Emoji] [Textarea 256 chars]  42/256 |
|   | [Annuler]              [Envoyer]     |
|   +--------------------------------------+
+------------------------------------------+
```

### Affichage des reponses (thread)
- Sous chaque message de premier niveau, afficher les reponses avec une indentation (padding-left) et une bordure laterale pour marquer le fil de discussion
- Chaque reponse affiche l'avatar, le nom de l'expediteur, la date et le contenu
- Les reponses sont ordonnees chronologiquement (du plus ancien au plus recent)
- Le bouton "Repondre" est aussi disponible sur les reponses pour permettre une discussion continue (la reponse reste liee au message parent de premier niveau)

### Etat local
- `replyingTo: string | null` : ID du message auquel on repond (controle l'affichage du champ de reponse inline)
- `replyContent: string` : contenu de la reponse en cours
- `replyTextareaRef` : ref pour le textarea de reponse (insertion d'emojis a la position du curseur)

---

## 4. Traductions -- `fr.json` et `en.json`

Nouvelles cles :

```text
FR:
  messages.reply = "Repondre"
  messages.replyPlaceholder = "Votre reponse..."
  messages.replySent = "Reponse envoyee"
  messages.replies = "{{count}} reponse(s)"

EN:
  messages.reply = "Reply"
  messages.replyPlaceholder = "Your reply..."
  messages.replySent = "Reply sent"
  messages.replies = "{{count}} reply(ies)"
```

---

## Resume des fichiers

| Fichier | Action |
|---|---|
| Migration SQL | Ajouter colonne `reply_to` + index |
| `src/hooks/useMessages.ts` | Modifier (interface Message + groupement threads + param replyTo dans send) |
| `src/pages/Messages.tsx` | Modifier (bouton repondre inline + affichage threads indentes + emoji + 256 chars) |
| `src/i18n/locales/fr.json` | Modifier (ajout traductions reply) |
| `src/i18n/locales/en.json` | Modifier (ajout traductions reply) |

### Aucune modification RLS necessaire
Les reponses sont des messages normaux inseres dans la meme table `messages` avec les memes politiques RLS.
