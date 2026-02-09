

# Conversion du bandeau horizontal en sidebar verticale retractable

## Objectif

Remplacer la barre de navigation horizontale en haut de l'ecran par un menu vertical retractable a gauche, en utilisant les composants Sidebar deja disponibles dans le projet (`src/components/ui/sidebar.tsx`).

## Situation actuelle

`AppLayout.tsx` affiche :
- Un `<header>` horizontal sticky avec logo, liens de navigation et menu utilisateur
- Une barre mobile fixee en bas avec les 5 premiers liens
- Le contenu principal dans un `<main>` plein ecran

## Architecture cible

```text
+------------------+------------------------------------+
| Logo + Trigger   |  Contenu principal (main)          |
|                  |                                    |
| - Tableau de bord|                                    |
| - Temps          |                                    |
| - Frais          |                                    |
| - Clients        |                                    |
| - Dossiers       |                                    |
| - Collaborateurs |                                    |
| - Factures       |                                    |
| - Avoirs         |                                    |
| - Achats         |                                    |
| - To Do          |                                    |
| - Messages       |                                    |
| - Parametres     |                                    |
|                  |                                    |
| [User Menu]      |                                    |
+------------------+------------------------------------+
```

En mode retracte, seule l'icone de chaque element est visible (largeur 3rem). Un bouton permet de deployer/replier le sidebar.

## Modifications prevues

### 1. `src/components/layout/AppLayout.tsx` -- Refonte complete

Remplacer la structure actuelle par :

**Structure :**

```text
<SidebarProvider defaultOpen={true}>
  <div className="min-h-screen flex w-full">
    <AppSidebar />          {/* Nouveau composant sidebar */}
    <SidebarInset>
      <header>              {/* Petit header avec SidebarTrigger */}
        <SidebarTrigger />
      </header>
      <main>
        {children}
      </main>
    </SidebarInset>
  </div>
</SidebarProvider>
```

**Sidebar (integre dans AppLayout) :**

- **SidebarHeader** : Logo FlowAssist + nom de l'application
- **SidebarContent** : Liste des liens de navigation filtres par role, utilisant `SidebarMenu` / `SidebarMenuItem` / `SidebarMenuButton`. Chaque item affiche l'icone + le label. Les badges (To Do, Messages) sont affiches via `SidebarMenuBadge`.
- **SidebarFooter** : Menu utilisateur (nom, role, bouton deconnexion)
- **SidebarRail** : Zone cliquable pour replier/deployer le sidebar
- Collapsible mode : `icon` (en mode retracte, les icones restent visibles dans une colonne etroite de 3rem)

**Header simplifie :**

Un petit header en haut de la zone de contenu contenant uniquement le `SidebarTrigger` (bouton pour deployer/replier le sidebar) visible sur desktop. Sur mobile, le sidebar s'ouvre comme un tiroir (Sheet).

**Navigation mobile :**

La barre de navigation mobile en bas (`<nav className="md:hidden ...">`) sera supprimee. Sur mobile, le sidebar s'ouvre via le `SidebarTrigger` dans le header, en mode tiroir (utilise automatiquement le composant Sheet via le composant Sidebar).

### 2. Details d'implementation

**Liens de navigation actifs :**

Chaque `SidebarMenuButton` recevra `isActive={location.pathname === item.href}` pour le style actif (fond accent).

**Badges To Do et Messages :**

Les badges rouges/verts pour les To Do et Messages seront affiches via `SidebarMenuBadge` ou via un `<Badge>` inline a cote du texte du lien.

**Tooltips en mode retracte :**

Chaque `SidebarMenuButton` recevra la prop `tooltip={t(item.labelKey)}` pour afficher le nom de la page au survol quand le sidebar est retracte.

**Menu utilisateur dans le footer :**

Le `DropdownMenu` existant (avatar + nom + role + deconnexion) sera deplace dans `SidebarFooter`. En mode retracte, seul l'avatar sera visible.

**Contenu principal :**

Le `<main>` utilisera `SidebarInset` pour s'adapter automatiquement a la largeur du sidebar (deploye ou retracte), avec une transition fluide.

### 3. Aucune modification dans les autres fichiers

`App.tsx` et les pages restent inchanges. Le composant `NavLink.tsx` ne sera plus utilise par `AppLayout` (on utilisera `Link` de react-router-dom avec `SidebarMenuButton asChild`).

## Resume des fichiers modifies

| Fichier | Action |
|---|---|
| `src/components/layout/AppLayout.tsx` | Refonte : remplacement du header horizontal par un sidebar vertical retractable utilisant SidebarProvider, Sidebar, SidebarContent, SidebarMenu, SidebarInset, etc. |

Aucune modification de base de donnees, aucun nouveau fichier a creer (tous les composants sidebar sont deja disponibles dans `src/components/ui/sidebar.tsx`).
