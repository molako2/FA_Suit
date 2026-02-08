
# Correction des bugs Messagerie

## Bug 1 : "Inconnu" au lieu du nom de l'expediteur

**Cause** : La politique RLS sur la table `profiles` ne permet aux collaborateurs de voir que leur propre profil (`id = auth.uid() OR is_owner_or_assistant()`). Quand un collaborateur charge les messages, la requete pour recuperer le nom de l'expediteur echoue silencieusement pour les profils des autres utilisateurs.

**Correction** : Modifier la politique RLS SELECT sur `profiles` pour permettre a tous les utilisateurs authentifies de lire les profils. C'est une application interne de cabinet -- tous les utilisateurs doivent pouvoir voir les noms de leurs collegues.

### Migration SQL

```text
DROP POLICY "Users can view own profile or managers can view all" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);
```

---

## Bug 2 : Le badge rouge reste a 1 meme apres lecture

**Cause** : L'effet `useEffect` qui marque les messages comme lus dans `Messages.tsx` (lignes 70-86) ne parcourt que les messages de premier niveau (`messages`). Les reponses sont imbriquees dans `msg.replies` et ne sont jamais parcourues. Le compteur `useUnreadMessagesCount` les compte pourtant correctement (`recipient_id = userId AND read = false`), d'ou le badge qui reste bloque.

**Correction** : Dans `src/pages/Messages.tsx`, modifier l'effet de marquage pour aussi parcourir les reponses de chaque message.

### Modification dans `src/pages/Messages.tsx`

Dans l'effet "Mark messages as read on view" (lignes 70-86), ajouter une boucle qui parcourt aussi `msg.replies` pour chaque message de premier niveau :

```text
-- Avant (ne traite que les messages de premier niveau) --

const unreadDirect = messages.filter(
  m => m.recipient_id === user.id && !m.read && m.sender_id !== user.id
);

-- Apres (traite aussi les reponses) --

// Collecter TOUS les messages (top-level + replies)
const allMessages = messages.flatMap(m => [m, ...(m.replies || [])]);

const unreadDirect = allMessages.filter(
  m => m.recipient_id === user.id && !m.read && m.sender_id !== user.id
);
const unreadBroadcasts = allMessages.filter(
  m => m.recipient_id === null && m.sender_id !== user.id && !readBroadcastIds.has(m.id)
);
```

---

## Resume des modifications

| Fichier | Action |
|---|---|
| Migration SQL | Modifier la politique RLS SELECT sur `profiles` pour autoriser tous les utilisateurs authentifies |
| `src/pages/Messages.tsx` | Corriger l'effet de marquage lu pour inclure les reponses imbriquees |
