

# Agenda prive : acces restreint par utilisateur

## Probleme actuel

La politique RLS actuelle permet aux **owners et assistants** de voir **toutes** les notes d'agenda de tous les utilisateurs via la politique "Owner view all agenda entries". L'utilisateur souhaite que chaque personne ne voie que ses propres notes, sans exception.

## Modifications prevues

### 1. Base de donnees - Politique RLS

Supprimer la politique "Owner view all agenda entries" qui donne acces a tous les owner/assistant, et ne conserver que la politique "View own agenda entries" qui limite la visibilite aux propres notes de chaque utilisateur.

Resultat : chaque utilisateur ne pourra lire, modifier et supprimer que ses propres notes, quel que soit son role.

### 2. Frontend - Filtrage cote client (securite en profondeur)

Ajouter un filtre `.eq('user_id', user.id)` dans la requete du hook `useAgendaEntries` pour s'assurer que seules les notes de l'utilisateur connecte sont demandees (meme si le RLS le garantit deja cote serveur).

---

### Details techniques

**Migration SQL :**
```sql
DROP POLICY "Owner view all agenda entries" ON public.agenda_entries;
```

**Hook `useAgenda.ts` :**
```typescript
// Avant
.select('*')
.order('entry_date', { ascending: true });

// Apres
.select('*')
.eq('user_id', user.id)
.order('entry_date', { ascending: true });
```

