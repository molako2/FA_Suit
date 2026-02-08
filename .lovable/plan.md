

# Module Messagerie (plan mis a jour)

## Objectif
Creer un module de messagerie interne avec badge rouge pour les messages non lus, limite de 256 caracteres par message, et possibilite d'ajouter des emojis.

---

## 1. Base de donnees -- tables `messages` et `message_reads`

### Table `messages`

```text
CREATE TABLE public.messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    uuid NOT NULL,
  recipient_id uuid,              -- NULL = broadcast a tous
  content      text NOT NULL CHECK (char_length(content) <= 256),
  read         boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
```

### Table `message_reads` (suivi lecture des broadcasts)

```text
CREATE TABLE public.message_reads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
```

### Politiques RLS

**messages :**
- SELECT : `sender_id = auth.uid() OR recipient_id = auth.uid() OR recipient_id IS NULL`
- INSERT : `sender_id = auth.uid() AND (recipient_id IS NOT NULL OR is_owner())`
- UPDATE : `recipient_id = auth.uid() OR (recipient_id IS NULL AND auth.uid() IS NOT NULL)`
- DELETE : `sender_id = auth.uid() OR is_owner()`

**message_reads :**
- SELECT : `user_id = auth.uid()`
- INSERT : `user_id = auth.uid()`

### Index + Realtime

```text
CREATE INDEX idx_messages_recipient ON public.messages(recipient_id);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
```

---

## 2. Hook `src/hooks/useMessages.ts`

- **`useMessages(userId)`** -- recupere tous les messages visibles, ordonnes par date
- **`useSendMessage()`** -- mutation avec validation cote client (max 256 caracteres)
- **`useDeleteMessage()`** -- suppression d'un message
- **`useMarkAsRead()`** -- marque un message direct comme lu (`read = true`) ou insere dans `message_reads` pour un broadcast
- **`useUnreadMessagesCount(userId)`** -- compte les messages non lus (directs non lus + broadcasts sans entree dans `message_reads`)

---

## 3. Page `src/pages/Messages.tsx`

### Interface

```text
+---------------------------------------------+
| Messages                    [Nouveau message]|
+---------------------------------------------+
| Liste des messages (ScrollArea)              |
| +------------------------------------------+|
| | [Avatar] Expediteur       Date           ||
| | Contenu du message (avec emojis)...      ||
| | [Badge "Tous" si broadcast]              ||
| | [Bouton supprimer si autorise]           ||
| | [Fond colore si non lu : bg-blue-50]     ||
| +------------------------------------------+|
```

### Dialog "Nouveau message"

```text
+---------------------------------------------+
| Nouveau message                              |
+---------------------------------------------+
| Destinataire : [Select]                      |
|   - Liste des profils actifs                 |
|   - "Tous" (Owner/SysAdmin uniquement)       |
+---------------------------------------------+
| Message :                                    |
| +------------------------------------------+|
| | [Bouton emoji] [Textarea max 256 chars]  ||
| | Compteur : 42/256                        ||
| +------------------------------------------+|
| [Annuler]                       [Envoyer]   |
+---------------------------------------------+
```

### Limite 256 caracteres
- Le champ `Textarea` a un `maxLength={256}`
- Un compteur affiche en temps reel le nombre de caracteres saisis (ex: "42/256")
- La validation Zod cote client bloque l'envoi si le contenu depasse 256 caracteres ou est vide
- La contrainte `CHECK (char_length(content) <= 256)` en base empeche tout contournement

### Selecteur d'emojis
- Un bouton emoji (icone `Smile` de lucide-react) a cote du champ de texte
- Au clic, affiche un Popover avec une grille d'emojis courants organises par categorie :
  - Smileys : les emojis les plus populaires
  - Gestes : pouce, mains, etc.
  - Symboles : coeur, etoile, etc.
- Au clic sur un emoji, celui-ci est insere a la position du curseur dans le textarea
- Le compteur de caracteres se met a jour en temps reel apres insertion
- Pas de dependance externe : grille d'emojis en dur dans le composant (simple et leger)

### Comportements
- Messages non lus : fond `bg-blue-50`, marques comme lus a l'affichage
- Badge rouge dans la navigation se met a jour automatiquement (invalidation du query)
- Bouton supprimer visible selon les regles RLS

---

## 4. Navigation -- `src/components/layout/AppLayout.tsx`

- Ajouter `MessageSquare` (lucide-react) dans `navItemsConfig`
- Route `/messages`, accessible a tous les roles
- Badge rouge (`bg-destructive`) avec compteur de messages non lus, identique au pattern des badges "To Do"
- Le badge disparait quand tous les messages sont lus
- Logique appliquee sur navigation desktop et mobile

---

## 5. Routing -- `src/App.tsx`

- Ajouter la route `/messages` avec `ProtectedRoute` (tous les roles)

---

## 6. Traductions -- `fr.json` et `en.json`

```text
FR:
  nav.messages = "Messages"
  messages.title = "Messages"
  messages.subtitle = "Messagerie interne"
  messages.newMessage = "Nouveau message"
  messages.recipient = "Destinataire"
  messages.everyone = "Tous"
  messages.content = "Message"
  messages.send = "Envoyer"
  messages.noMessages = "Aucun message"
  messages.messageSent = "Message envoyé"
  messages.messageDeleted = "Message supprimé"
  messages.broadcast = "Tous"
  messages.confirmDelete = "Supprimer ce message ?"
  messages.contentRequired = "Le message ne peut pas être vide"
  messages.recipientRequired = "Veuillez sélectionner un destinataire"
  messages.markAsRead = "Marquer comme lu"
  messages.maxChars = "256 caractères max"
  messages.charCount = "{{count}}/256"

EN:
  nav.messages = "Messages"
  messages.title = "Messages"
  messages.subtitle = "Internal messaging"
  messages.newMessage = "New message"
  messages.recipient = "Recipient"
  messages.everyone = "Everyone"
  messages.content = "Message"
  messages.send = "Send"
  messages.noMessages = "No messages"
  messages.messageSent = "Message sent"
  messages.messageDeleted = "Message deleted"
  messages.broadcast = "Everyone"
  messages.confirmDelete = "Delete this message?"
  messages.contentRequired = "Message cannot be empty"
  messages.recipientRequired = "Please select a recipient"
  messages.markAsRead = "Mark as read"
  messages.maxChars = "256 characters max"
  messages.charCount = "{{count}}/256"
```

---

## Resume des fichiers

| Fichier | Action |
|---|---|
| Migration SQL | Creer tables `messages` + `message_reads` + RLS + index + realtime |
| `src/hooks/useMessages.ts` | Creer (hooks CRUD + compteur non lus) |
| `src/pages/Messages.tsx` | Creer (page avec limite 256 chars + selecteur emoji + marquage lu) |
| `src/components/layout/AppLayout.tsx` | Modifier (ajout nav Messages + badge rouge non lus) |
| `src/App.tsx` | Modifier (ajout route /messages) |
| `src/i18n/locales/fr.json` | Modifier (ajout traductions) |
| `src/i18n/locales/en.json` | Modifier (ajout traductions) |

