

# Mise a jour de la banniere CM2A Consulting

## Modification

Remplacer l'image de banniere actuelle (`src/assets/cm2a-banner.png`) par la nouvelle image uploadee. La banniere est affichee en haut de la page de connexion (`src/pages/Login.tsx`) avec un lien cliquable vers `www.cm2a.ma`.

## Etapes

1. **Copier la nouvelle image** dans `src/assets/cm2a-banner.png` (ecrase l'ancienne)
2. **Ajuster le style** de la banniere dans `Login.tsx` pour qu'elle s'affiche en pleine largeur avec un ratio adapte a la nouvelle image (plus large et panoramique que l'ancienne)
   - Passer de `h-16 md:h-20 object-contain` a `w-full max-h-28 md:max-h-36 object-cover` pour une meilleure mise a l'echelle
   - Conserver le lien `href="https://www.cm2a.ma"` et le `target="_blank"`

### Details techniques

Fichiers modifies :
- `src/assets/cm2a-banner.png` : remplacement par la nouvelle image
- `src/pages/Login.tsx` : ajustement des classes CSS de la balise `<img>` (lignes 159-163)

