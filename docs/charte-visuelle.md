# CODIPLAN — Charte visuelle

*Rang 1. Tout écran s'adosse à ce document. Aucune couleur n'est écrite en dur
dans un composant.*

Ce texte dit ce que l'interface doit être ; `app/jetons.css` en est l'unique
application, et c'est le seul fichier du dépôt où une valeur de couleur s'écrit.
Un gardien le tient — `tests/unit/theme/charte-jetons.test.ts`.

**Ce que cette charte n'est pas.** Elle ne remplace pas la charte de SOCIÉTÉ
(L0-09, D51) : celle-ci est une donnée, lue en base, qui colore l'identité d'un
client — deux couleurs et leurs encres calculées. La charte visuelle, elle, est
la grammaire de l'application, la même pour toutes les sociétés. Les jetons
ci-dessous sont ceux de CODIMA NC par défaut ; le contraste est recalculé au
rendu pour la charte de chaque société.

---

## Couleurs

### Thème clair — jetons CSS sur `:root` nu

| Jeton | Valeur | Rôle |
|---|---|---|
| `--acier` | `#E8EAE6` | fond de page (gris machine froid) |
| `--plaque` | `#F8F9F7` | surface, papier, panneau |
| `--noir` | `#000000` | encre, titres, filets structurants |
| `--gris` | `#59615C` | texte secondaire |
| `--trait` | `#C3C9C3` | filets, séparateurs |
| `--bleu` | `#14487E` | action, sélection, lien, intervention facturée |
| `--vert` | `#1F6B45` | conforme, valide, travail interne |
| `--ambre` | `#8F5A02` | forfait, avertissement |
| `--oxyde` | `#A32B1F` | refus, expiration, danger |

Fonds teintés : bleu `.09` · vert `.10` · ambre `.13` · oxyde `.07`.

### Thème sombre — mêmes noms, valeurs redéfinies

| Jeton | Valeur |
|---|---|
| `--acier` | `#141715` |
| `--plaque` | `#1E2220` |
| `--noir` | `#F2F4F1` |
| `--gris` | `#9AA39D` |
| `--trait` | `#343A36` |
| `--bleu` | `#8CB8EC` |
| `--vert` | `#79C08F` |
| `--ambre` | `#E0A93F` |
| `--oxyde` | `#E38878` |

Fonds teintés : `.13` · `.13` · `.15` · `.10`.

### Trois états de thème, obligatoires, dans cet ordre

```css
:root { … }                                       /* clair, palette complète */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { … }           /* sombre par le système   */
}
:root[data-theme="dark"] { … }                    /* sombre par choix        */
```

**Aucune couleur ne doit avoir sa seule définition dans un bloc `@media`.** La
palette complète est sur `:root` nu ; le sombre ne fait que redéfinir. Un
navigateur qui ne comprend pas la requête média rend le thème clair entier,
jamais un thème à trous.

`:root` est l'élément `html`. L'attribut `data-origine-theme` que le serveur pose
sur `body` dit d'où vient la charte de société — c'est un autre objet, et il
porte un autre nom pour cette raison.

---

## Polices

**Archivo** — variable, axes `wdth 62..125` et `wght 400..800` — pour tout.
**Archivo Narrow** — `wght 400..700` — pour les grilles denses et les colonnes du
planning, là où la place manque.

**DEUX balises `<link>` séparées** vers `fonts.googleapis.com`, pour que l'échec
de l'une ne tue pas l'autre. Repli : `'Helvetica Neue', Arial, sans-serif`.

- Titres : Archivo 700, `font-stretch: 118%`, `letter-spacing: -.015em`,
  `line-height: 1.12`, `text-wrap: balance`.
- Interface : Archivo 400/700, 15–16 px, `line-height: 1.6`.
- Chiffres : `font-variant-numeric: tabular-nums`, **partout**.
- **JAMAIS de police à chasse fixe pour des données.**

---

## Les treize règles

1. **La couleur est un signal, jamais une décoration.** Une couleur qui apparaît
   désigne un état qui change l'argent ou la sécurité.
2. **La forme du bloc dit son type** : facturé = fond plaque, filet bleu de 4 px
   à gauche ; forfait = filet ambre, fond ambre teinté ; trajet = hachures à
   135°, bordure pointillée, texte gris, jamais facturé ; interne = fond vert
   teinté, bordure trait ; refus = contour oxyde, fond oxyde très pâle, texte
   oxyde.
3. **Le rayon encode le type d'objet, il n'est pas uniforme** : 0 pour un
   document, 2 px pour un bloc de planning, 26 px pour un cadre de téléphone.
4. **Les ombres ne servent qu'aux objets physiques** (cadre de téléphone). Jamais
   d'ombre douce sous une carte.
5. **Mouvement** : un seul moment orchestré, le remplissage du planning colonne
   par colonne au chargement, 140 ms de décalage par colonne. Rien d'autre ne
   bouge de soi-même. `@media (prefers-reduced-motion: reduce)` le supprime
   entièrement.
6. **Interdits** : étiquettes en capitales espacées ; chaînes jointes par des
   points médians en guise de chrome ; flèche « → » dans un libellé de bouton ;
   numérotation 01/02/03 quand le contenu n'est pas une séquence.
7. **Le libellé d'une action ne change pas au long du parcours** : le bouton
   « Terminer l'intervention » produit « Intervention terminée ».
8. **Une erreur dit ce qui s'est passé et comment le corriger.** Elle ne s'excuse
   pas et ne reste jamais vague. Modèle : « Affectation refusée — habilitation BR
   absente ».
9. **Un écran vide est une invitation à agir, pas un constat de vide.**
10. **Longueur de ligne sous 80 caractères**, viser 60 à 65 pour la prose.
11. **Espace fine insécable (U+202F)** devant `? ! ; :` et à l'intérieur des
    guillemets français.
12. **XPF sans décimale, EUR avec deux**, chiffres tabulaires, séparateur de
    milliers par espace insécable.
13. **Plancher de qualité, non négociable** : lisible jusqu'à 390 px de large
    sans défilement horizontal de la page ; focus clavier visible (`outline 2px
    var(--bleu)`, offset 2 px) ; contraste ≥ 4,5:1 pour tout texte et ≥ 3:1 pour
    toute bordure porteuse de sens. Le contraste est recalculé au rendu pour la
    charte de chaque société — les jetons ci-dessus sont ceux de CODIMA NC par
    défaut.

---

## Le gardien

`tests/unit/theme/charte-jetons.test.ts` échoue si une valeur hexadécimale de
couleur apparaît **ailleurs que dans `app/jetons.css`**.

Il est plus étroit que celui de L0-09 (`sans-couleur-en-dur.test.ts`), et
délibérément : celui-là exempte une FORME d'écriture — « une couleur est licite
dans une déclaration de variable » —, si bien qu'écrire `--rouge-provisoire: #f00`
dans n'importe quelle feuille passait. Celui-ci exempte UN FICHIER. Une exemption
qui nomme un fichier se lit d'un coup d'œil et se compte ; son diff est la charte
qui change.

Deux exemptions, et elles sont nommées : `app/jetons.css`, qui est la palette, et
`lib/theme/`, qui est le mécanisme de la charte de SOCIÉTÉ (D51) — un autre objet,
déjà gardé par L0-09.
