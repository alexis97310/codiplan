# Registre — nuit du 9 septembre 2026

*Protocole de nuit. Écrit au fil de l'eau. Les dates sont lues (`date -u`),
jamais tenues de mémoire.*

**Mesure de la nuit, telle qu'elle m'a été donnée : un écran qu'on peut ouvrir.**

---

## 1. La charte visuelle — 10:42 → 10:47 UTC

Aucune charte n'existait. Écrits :

- `docs/charte-visuelle.md` — palette, trois états de thème, polices, les treize
  règles, et ce que le gardien garde.
- `app/jetons.css` — **le seul fichier du dépôt où une couleur s'écrit.**
- `app/globals.css` — réécrit : il n'aliase plus que les jetons. Les treize
  valeurs `oklch` de shadcn qu'il portait sont remplacées par des renvois.
- `app/layout.tsx` — deux balises `<link>` séparées vers Google Fonts, Archivo et
  Archivo Narrow.
- CLAUDE.md — rang 1.

**Une collision de vocabulaire, corrigée en chemin.** `body` portait
`data-theme={theme.origine}` avec les valeurs `societe` / `defaut` (L0-09) ; la
charte exige `:root[data-theme="dark"]`. Deux vocabulaires sous un même nom
d'attribut. L'attribut de société devient `data-origine-theme` — nom que
`bandeau-societe.tsx` employait déjà. Quatre fichiers de test suivent le
renommage ; aucune assertion n'est affaiblie.

**Le gardien, et pourquoi il y en a un second.** Celui de L0-09 exempte une
FORME d'écriture : dans une feuille de style, une couleur est licite dès qu'elle
est portée par une déclaration de variable. Mesuré : l'état d'avant portait
treize couleurs `oklch` dans `globals.css` et ce gardien était vert — à raison,
ce n'est pas ce qu'il garde. Le nouveau exempte UN FICHIER.

*Mis en échec sur le dépôt réel, dans les deux directions (§9 du 11/09) :*

| Greffe | Verdict |
|---|---|
| `--bleu-provisoire: #0b5cad;` dans `app/globals.css` | **rouge**, nomme le fichier |
| `style={{ color: "#59615c" }}` dans `app/page.tsx` | **rouge**, nomme le fichier |
| `--encre-secondaire: var(--gris);` dans le même `globals.css` | **vert** — un alias n'est pas une couleur, et le fichier vient d'être montré mordable |
| `app/jetons-provisoires.css` | non exempté — le chemin est exact, pas un préfixe |

**Une seule lecture du critère.** Le motif « ceci est une couleur » vivait dans
le gardien de L0-09 ; deux gardiens l'auraient lu deux fois, et deux lectures
d'un même critère divergent en silence (§9, 01/09). Il est extrait dans
`tests/unit/outils/couleurs.ts`, qui ne porte aucun `describe` — sans quoi
l'importer ferait rejouer les scénarios de l'autre.

`pnpm vitest run --project unit tests/unit/theme/` → **50 verts**.

---

## Où reprendre

Voir la fin de ce registre.
