# 9BU-TP-UX-DEC1 — passation

Ticket documentaire seul : **aucune migration, aucune ligne de semis, aucun prix, aucun
écran touché**. Pas de capture — le territoire ne comprend aucun écran.

## 1. Ce que j'ai changé, et ce que ça change pour l'exploitation

Quatre décisions écrites dans `docs/arbitrages.md`, une par réponse d'Alexis du
29/09/2026 (~10h45 NC), aux questions QE-13a, QE-1, QE-2 et QE-13b de
`docs/propositions/ergonomie-2026-09-28/ergonomie-graphisme-usage-2026-09-28.md` (§7) :

- **D137** (QE-13a → b, EN REMPLACEMENT) : `docs/propositions/ergonomie-2026-09-28/
  maquette-toutes-pages.html` (« la maquette du 28/09 ») REMPLACE
  `docs/maquette/CODIPLAN_Maquette.html` comme référence de la disposition des écrans
  que la maquette complète (`codiplan-maquette-complete.html`, D124/D125) ne dessine
  pas. Jamais une règle de gestion ni un contenu (D128 tient). Sur les quatorze écrans
  de la maquette complète, D125 continue de faire foi, sauf les écarts nommés que
  chaque QE-x accepte. L'ancien fichier reste dans le dépôt, en archive.
- **D138** (QE-1 → a) : plus aucun texte sous 12 px, même là où la maquette complète
  descend à 11 px ou 10,5 px. Amende D124 (typographie) et D95 (les tailles narratives
  que le point 4 de D124 laisse adossées à `CODIPLAN_Maquette.html`).
- **D139** (QE-2 → a) : icônes au trait dessinées dans le dépôt, sans bibliothèque.
  N'amende aucune décision — cite `docs/constitution/stack.md`, qui n'est pas modifié :
  aucune dépendance ajoutée.
- **D140** (QE-13b → a) : toutes les tuiles de chiffres sont cliquables, avec un
  chevron ; chaque chiffre ouvre la liste exacte qu'il compte. Amende D125 sur ce seul
  point (l'interactivité, jamais la disposition).

**Marques posées** (au préambule de chaque décision amendée, avant son premier
sous-titre — c'est le seul endroit que les gardiens lisent) :

- D95 : `**Amendé par D137, D138.**`
- D124 : `**Amendé par D138.**`
- D125 : `**Amendé par D140.**`

**Effet pour l'exploitation.** Rien ne change à l'écran aujourd'hui : les quatre
décisions posent une RÉFÉRENCE et un PLANCHER pour les lots à venir (TP-UX1 pour le
plancher de 12 px et les icônes, TP-UX3 à TP-UX9 pour la disposition des écrans que la
maquette complète ne dessine pas). Aucun code applicatif n'est touché par ce ticket.

## 2. Ce que j'ai mesuré (comptes AVANT/APRÈS)

**Le câblage des décisions**, `tests/unit/docs/amendements-arbitrages.test.ts` :
quatre paires ajoutées à `AMENDEMENTS_ATTENDUS` — `["D95","D137"]`, `["D95","D138"]`,
`["D124","D138"]`, `["D125","D140"]` — sans en retirer aucune. Le témoin en double
sens a été rejoué à la main (retrait de `**Amendé par D137, D138.**` de D95) : le
gardien rougit avec son message nommé (« D137 déclare amender D95, mais D95 ne porte
pas... », et la paire correspondante disparaît de `accordees`) ; la marque a été
remise et le gardien redevient vert.

**Le backlog** (`tests/unit/docs/coherence-backlog.test.ts`) a signalé, dès l'ajout des
marques sur D95, que le texte de cette source avait changé pour **8 tickets** qui la
citent — parce que D95 est désormais amendée par D137 et D138, et que la clôture des
sources tire ces deux décisions dans le texte relu. Chacun a été relu contre le texte
courant de D95/D137/D138 : dans les huit cas, ce que le ticket dit de D95 porte sur la
**barre de navigation à onze entrées** (une entrée inerte, ou l'absence d'entrée pour un
écran), jamais sur la disposition-reliquat que D137 déplace ni sur une taille de police
que D138 amende — rien à corriger dans le TEXTE des huit tickets, seule l'empreinte
changeait :

| Ticket | Empreinte AVANT | Empreinte APRÈS |
|---|---|---|
| L1-01 | `761d6a2e` | `850db67c` |
| L1-05b | `cd0cde61` | `dcd3e409` |
| L1-11 | `fcc2ce41` | `fd893148` |
| L3-04b | `27296089` | `bf6e5292` |
| L3-06 | `dfd1df43` | `aaa94302` |
| L3-16 | `f5578957` | `476334d5` |
| L7-01 | `3d204d72` | `b77859be` |
| L7-02 | `135de0ce` | `fcb3552e` |

`pnpm test` (unitaires) et `tests/unit/docs/` sont verts après remplacement.

**`CLAUDE.md`** : 21 610 octets avant ce ticket, **21 819 après** (plafond 24 000,
marge 2 181).

**Le tableau mesuré ancienne / nouvelle maquette**, pour TP-UX1 et TP-UX2 — les
sélecteurs lus par `regle()`/`regleComplete()` (`tests/unit/ui/composants-maquette.
test.ts`, `tests/unit/ui/carte-entite.test.ts`), par `.wrap` (`tests/unit/theme/
apparence.test.ts`) et par le menu (`tests/unit/navigation/entrees.test.ts`) —
**aucun n'a été rebranché** ; les valeurs ci-dessous sont une mesure, pas une décision :

| Sélecteur (lu par) | Source actuelle | Valeur actuelle | Maquette du 28/09 |
|---|---|---|---|
| `.wrap` (`apparence.test.ts`, `LARGEUR_UTILE_PX`) | `CODIPLAN_Maquette.html` | `max-width:1400px` | **aucune classe `.wrap`** ; elle porte `.content{max-width:1460px}` |
| `.content` (D124/D125, non lu par un gardien de largeur) | `codiplan-maquette-complete.html` | `max-width:1680px` | `.content{max-width:1460px}` |
| `.card h2 .more` | `CODIPLAN_Maquette.html` (`regle()`) | `font-size:11px` | classe `.card`/`.more` introuvable telle quelle (composants renommés) |
| `.b` (pastille) | `CODIPLAN_Maquette.html` (`regle()`) | `font-size:11px` | `.b{font-weight:700}` — pas de taille propre, hérite d'un jeton |
| `.kpi .l` / `.kpi .d` | `CODIPLAN_Maquette.html` (`regle()`) | `font-size:11px` | classe `.kpi` absente ; remplacée par `.tile`/`.tiles` |
| `th` | `CODIPLAN_Maquette.html` (`regle()`) | `font-size:10.5px` | sélecteur `th` nu introuvable (tableau densifié différemment) |
| `.kv dt` | `codiplan-maquette-complete.html` (`regleComplete()`) | `font-size:11px` | `.kv dt{font-size:var(--fs-xs)}`, et `--fs-xs:12px` — **le plancher QE-1 y est déjà** |
| `.entity-meta span` | `codiplan-maquette-complete.html` (`regle()` local à `carte-entite.test.ts`) | `font-size:11px` | classe `.entity-meta` introuvable telle quelle |
| menu : `.nav-link` / `.nav-group` | `codiplan-maquette-complete.html` (`entrees.test.ts`) | `.nav-link{...}` | **classe renommée `.nav-item`**, plus `.nav-count` (décompte, QE-5, pas encore répondue) ; `.nav-group` existe toujours, à 12px (déjà au plancher) |

Trois faits à retenir pour TP-UX1/TP-UX2 : *(1)* la maquette du 28/09 a déjà le
plancher de 12 px partout où elle a été regardée (`--fs-xs:12px`) — D138 ne fera que
suivre ce qui y est déjà dessiné ; *(2)* les classes de composants (`.card`, `.kpi`,
`.b`, `.entity-meta`) ont été renommées dans la refonte, donc `regle()`/
`regleComplete()` devront chercher de nouveaux sélecteurs, pas seulement de nouvelles
valeurs ; *(3)* `.wrap` (1400px) et `.content` (1680px puis 1460px) mesurent trois
largeurs différentes selon le document — un écart déjà présent AVANT ce ticket
(`codiplan-maquette-complete.html` contre `CODIPLAN_Maquette.html`, non réconcilié, la
spécification du 28/09 le disant elle-même « n'est pas un écart ») ; le rebranchement
ne doit pas confondre les trois.

## 3. Ce que j'ai tranché et pourquoi

- **Les marques d'amendement vont dans le PRÉAMBULE**, avant le premier sous-titre
  `###` de chaque décision. C'est une contrainte du parseur (`scripts/lib/
  cablage-arbitrages.ts` ferme la lecture du corps au premier titre de n'importe quel
  niveau) et non un choix éditorial — vérifié en lisant le module avant d'écrire.
- **D139 ne déclare aucun amendement.** Rien dans D95, D124 ou D125 ne fixait un choix
  de bibliothèque d'icônes ; D139 comble un silence, elle ne corrige personne.
- **Les huit tickets du backlog n'ont pas eu leur PROSE modifiée**, seule l'empreinte
  a changé : la relecture (§2) montre qu'aucun ne dit quelque chose que D137/D138
  rendraient faux.
- **Les trois fichiers de test (`entrees.test.ts`, `apparence.test.ts`,
  `composants-maquette.test.ts`) n'ont reçu qu'un commentaire d'en-tête**, comme
  demandé : ni la cible de `regle()`, ni `.wrap`, ni le menu n'ont été rebranchés — ce
  travail attend TP-UX1/TP-UX2, avec le tableau du §2 comme point de départ.

## 4. Ce que je n'ai PAS fait

- Aucun code applicatif, aucune migration, aucune ligne de semis, aucun prix.
- Aucun rebranchement de `regle()`, de `LARGEUR_UTILE_PX`/`.wrap`, ni des classes de
  menu lues par `entrees.test.ts` — les trois restent sur leurs sources actuelles.
- Aucun écran construit ou capturé.
- Les huit attentes de tests figées à 10,5 px/11 px ne sont pas passées à 12 px — ce
  sera TP-UX1.
- `docs/constitution/erreurs-a-ne-pas-refaire.md`, `organisation-du-code.md`,
  `comment-travailler.md`, `invariants.md` : non touchés, hors territoire.

## 5. Les pièges pour la session suivante

- **Les classes de composants ont changé de nom** dans la maquette du 28/09 (`.tile`
  au lieu de `.kpi`, pas de `.card h2 .more` ni `.entity-meta` retrouvés tels quels) :
  TP-UX1/TP-UX3 devront relire la maquette du 28/09 sélecteur par sélecteur avant de
  rebrancher un gardien, pas seulement remplacer un nom de fichier.
- **`.wrap` et `.content` ne mesurent pas la même chose** entre les trois documents
  (1400 / 1680 / 1460 px) : ne pas prendre l'écart pour une régression sans relire
  D124 (« Plein écran n'est pas un écart »).
- **Le menu gagne un décompte (`.nav-count`)** dans la maquette du 28/09, qui
  correspond à QE-5 — pas encore répondue à la date de ce ticket. `entrees.test.ts`
  devra attendre cette décision avant de rebrancher.
- **D136 est réservé** (décision du 27/09 sur les absences, PG-G15) : ne pas l'utiliser
  par erreur pour une décision future ; D141 est le premier numéro libre après ce
  ticket.

## 6. Ce qui reste à faire

- TP-UX1 : rebrancher les huit attentes de tests à 12 px, construire `components/ui/
  icone.tsx` et la planche SVG (D139), rendre les tuiles cliquables avec chevron
  (D140).
- TP-UX2 : rebrancher le menu (`.nav-item`/`.nav-count`) une fois QE-3 à QE-6 répondues.
- TP-UX3 à TP-UX9 : construire, écran par écran, la disposition que D137 rend
  applicable pour ce que la maquette complète ne dessine pas.
