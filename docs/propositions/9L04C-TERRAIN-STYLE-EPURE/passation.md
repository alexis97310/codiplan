# 9L04C-TERRAIN-STYLE-EPURE — passation

État git au départ : `HEAD` détaché sur `origin/main` (comme les lots précédents de cette série,
aucun autre checkout de `main` rencontré). Tous les commits de ce lot sont donc empilés sur ce
même détachement, à la suite de `fb9b72e00` (9L04B, point 6).

## Ce qui est fait

1. **Les jetons du terrain** (`app/globals.css`, `[data-zone="terrain"]`) : fond blanc, filet
   `#e6e8ec`, encre `#111827`/`#5b6472`, vert `#1b7f3b`, rouge `#c40511`/texte d'alerte `#a3040e`,
   texte d'avertissement `#6b4300`. Une ZONE, jamais une troisième apparence — voir D252
   (`docs/arbitrages.md`) pour le raisonnement complet et les contrastes AA (tous ≥ 4,5:1, calculés
   et vérifiés par `tests/unit/theme/terrain-epure.test.ts`). Le bureau (`[data-apparence="maquette"]`
   et `"tableau"`) est inchangé — prouvé par ce même gardien et par la capture
   `bureau-fiche-intervention-*.png`, **octet-identique** avant/après.
2. **Cadres et cartes retirés** sur `app/(mobile)/terrain/[id]/page.tsx`, `app/(mobile)/terrain/page.tsx`
   (liste via `components/terrain/liste-journee.tsx`) et leur miroir hors réseau
   (`components/terrain/consultation-hors-reseau.tsx`) : `rounded-lg border` devient `border-b`
   (ou `divide-y` pour une liste). Les bannières d'ÉTAT (compteur qui tourne, refus de démarrer,
   badge « nouveau »/statut) gardent leur encadrement — ce ne sont pas des cartes de contenu.
3. **Police** : déjà embarquée (`next/font/local`, Inter, `public/fonts/inter/`), déjà sans aucune
   requête réseau — vérifié, aucun changement nécessaire.
4. **En-tête de fiche sur une ligne**, posé sur la fiche EN LIGNE (`app/(mobile)/terrain/[id]/page.tsx`) :
   retour (icône `chev-l`, `aria-label`), client, « matériel · n° d'intervention » (dessous, tronqué),
   chrono à droite. Voir **écarts documentés** plus bas pour ce qui n'a pas pu suivre la maquette au
   pixel près.
5. Checklist, photos, barre d'action, récapitulatif : **disposition inchangée**, comme demandé — ils
   héritent des jetons et des filets par la seule cascade CSS (`data-zone="terrain"`), sans qu'une
   ligne de ces composants ait bougé.
6. `docs/arbitrages.md` — **D252**, amende D124 pour ce périmètre. Câblée dans
   `tests/unit/docs/amendements-arbitrages.test.ts` et `tests/unit/docs/citations-decisions-code.test.ts`.

## Écarts documentés (tous dans D252, section « CE QUE CETTE DÉCISION N'EST PAS »)

- **17 px (client) et 13-14 px (ligne secondaire) de la maquette → 18 px et 16 px dans le code.**
  `tests/unit/ui/retouches-2a.test.ts` (D143, point 8) tient `app/(mobile)/terrain/[id]/page.tsx`
  au plancher 16/18/24/28 px. Plutôt que de rouvrir ce gardien sans décision nommée pour ce point
  précis, j'ai retenu les deux valeurs de l'échelle existante les plus proches. **Si Alexis veut les
  valeurs exactes de la maquette, c'est une réouverture de D143 (point 8), pas de D252 seule.**
- **Titres de rubrique restés à 700 (`font-bold`), jamais 600.** `tests/unit/ui/retouches-2a.test.ts`
  (D143, point 11) exige au moins 700 pour tout texte de 12 ou 13 px, PARTOUT dans `app/` et
  `components/` — pas seulement sur le terrain. Je les ai fait passer à 13 px (gagné sur la
  maquette), mais pas à 600 (refusé par ce gardien). Même réouverture nécessaire que ci-dessus.
- **L'en-tête condensé n'est PAS mirroré sur la coquille hors réseau**
  (`components/terrain/consultation-hors-reseau.tsx`) : `FicheJSON`
  (`app/api/terrain/instantane/route.ts`) ne porte ni la référence ni le numéro d'intervention, et
  aucune mesure de minutes n'est disponible avant le montage de `BoutonCompteurTerrain`. Ajouter le
  numéro à l'instantané est un changement de FORME de ce payload — hors budget de ce lot. La coquille
  garde un en-tête d'une ligne plus simple (retour, client), sans la ligne « matériel · n° » ni le chrono.
- **`pnpm exec tsx scripts/captures.mts` (docs/captures/) n'a PAS été rejoué.** La procédure
  (`docs/captures/README.md`) demande une base jetable dédiée, un build de production, ET un geste
  manuel par compte (suivre l'URL de premier accès imprimée, choisir un mot de passe, pour quatre
  comptes distincts) — incompatible avec le budget de 120 minutes de ce lot. Les captures
  spécifiques au ticket (`docs/propositions/9L04C-TERRAIN-STYLE-EPURE/captures/`) en tiennent lieu
  pour la preuve demandée ici ; `docs/captures/README.md` reste à jour du commit `ad4feee9` (lot
  antérieur) et n'a donc PAS été touché — ne pas le croire photographié sur ce lot.
- **La capture « fiche, intervention terminée » montre encore le bouton « Démarrer l'intervention ».**
  La scène de capture flippe `statut` directement en base (`en_cours`/`terminee`) sans rejouer tout
  le cycle de clôture (signature, rapport validé, etc.) — c'est une simplification DE LA SCÈNE DE
  CAPTURE, pas un défaut du code : `peutDemarrerLeCompteur`/`peutTerminer` lisent des champs que
  cette fixture minimale ne pose pas tous. Non creusé, budget de temps oblige.
- **Aucune machine n'est rattachée aux interventions de capture** : la ligne « matériel · n° d'intervention »
  de l'en-tête ne s'affiche donc sur aucune des trois captures de fiche (elle se tait quand aucune
  machine n'est rattachée — voir `sousTitreDeLEnTete`, `app/(mobile)/terrain/[id]/page.tsx`). Le
  code est exercé par les épreuves unitaires, pas par cette capture précise.
- **Retour réapparu sur la fiche en ligne**, retiré par 9G9B (21/10/2026) : la maquette du 13/11,
  plus récente, le redemande explicitement sur la ligne d'en-tête — écart nommé dans D252 plutôt
  qu'un second examen de 9G9B.

## Ce qui N'A PAS été touché (volontairement, hors budget ou hors périmètre de ce lot)

- `checklist-terrain.tsx`, `rapport-automatique.tsx`, `photos-terrain.tsx`, `suspendre-terrain.tsx`,
  `bouton-envoyer.tsx`, `compteur-terrain.tsx`, `bandeau-reseau.tsx`, `bandeau-compteur.tsx`,
  `barre-basse.tsx`, `app/(mobile)/terrain/profil/page.tsx` : leurs COULEURS suivent automatiquement
  (cascade CSS, `data-zone="terrain"`), mais leurs classes de graisse et leurs cadres propres n'ont
  pas été relus ligne à ligne — ce sont les lots 9L04D à 9L04H qui touchent à leur disposition, et un
  passage typographique dédié à ces fichiers serait plus à sa place là plutôt qu'ajouté ici sans
  tourner la page du ticket.
- `ReserveAuxTechniciens` (`app/(mobile)/terrain/page.tsx`) — l'écran de refus pour un rôle de
  bureau, chemin rare, non capturé, non retouché au-delà de l'héritage automatique des jetons.

## Épreuves jouées (premier plan, comme demandé)

- `pnpm test` — 5805 tests, verts.
- `pnpm test:isolation` — 2210 tests, verts.
- `pnpm typecheck`, `pnpm lint` — verts, zéro avertissement.
- E2E ciblés (premier plan, pas la file) : `terrain.spec.ts`, `terrain-largeur.spec.ts`,
  `9i1-scanner-hors-reseau.spec.ts`, `tous-les-ecrans-rendent.spec.ts`,
  `9f4h2-mention-hors-reseau.spec.ts`, `9k22-checklist-hors-reseau.spec.ts`,
  `zz-captures-9g5-terrain-ergonomie.spec.ts`, `9k13-terrain-attente-piece.spec.ts`,
  `rapport-terrain.spec.ts`, et la nouvelle `zz-captures-9l04c-terrain-style-epure.spec.ts` (AVANT
  et APRÈS) — tous verts.
- **`pnpm verify:full` n'a PAS été rejoué en entier** (`test:e2e` seul dépasse 30 minutes, mesuré sur
  ce poste) : laissé à la file de nuit, comme le prévoit le ticket. `CI=1 pnpm verify` (sans e2e) a
  été rejoué en confirmation finale — voir le dernier commit de ce lot.

## Numéro d'arbitrage

**D252** — le suivant libre sur `origin/main` au moment du rebase (dernier existant : D251).

## Reprise 9L04CA (14/11/2026)

9L04C a été RECALÉ à 01:19 : `CI=1 pnpm verify` rougissait deux fois sur les MÊMES deux scènes
(contrat `tickets/recales/9L04C-TERRAIN-STYLE-EPURE.md` — introuvable sur ce poste au moment de la
reprise, ni dans ce worktree ni dans les autres checkouts voisins ; cette section travaille donc
sur le CONTEXTE donné par le ticket 9L04CA lui-même, pas sur le contrat original). Cause UNIQUE,
mesurée par le pilote : l'en-tête sur une ligne posé au point 4 ci-dessus répète, dans un texte
plus court, deux valeurs que des scènes anciennes cherchaient sans portée — `getByText` sans
portée a trouvé DEUX éléments (violation du mode strict de Playwright), là où une seule
intervention terrain existait avant ce lot.

- **`tests/e2e/9di-tp-ter1-journee-fiche.spec.ts`** — `getByText(machineAttendue)` trouvait le nom
  de la machine à la fois dans le `<span>` de la rubrique « Machine » du corps de la fiche ET dans
  le `<p>` de l'en-tête (`<matériel> · <référence>`), puisque ce dernier commence par le même
  libellé. Porté à la rubrique : `page.locator("section").filter({ has: page.getByRole("heading",
  { name: fr["intervention.machine"] }) })`, puis `.getByText(machineAttendue)` sur ce
  sous-ensemble. La scène prouve toujours la MÊME chose — la machine est affichée sur la fiche —
  mais regarde désormais la rubrique qui porte cette preuve, jamais l'en-tête qui ne fait que la
  résumer. Aucune assertion retirée.
- **`tests/e2e/9f4h5-compteur-vivant.spec.ts`** — `getByText(/^\d{2}:\d{2}:\d{2}$/)` trouvait le
  total vivant à la fois dans la rubrique « Compteur » du corps (28 px) ET dans le chrono de
  l'en-tête (16 px), les deux affichant le même composant `CompteurVivant` au même format depuis le
  point 4. Même traitement : porté à la rubrique via `page.locator("section").filter({ has:
  page.getByRole("heading", { name: fr["terrain.compteur"] }) })`. La scène prouve toujours que la
  valeur a changé après 3 s ; elle regarde la rubrique, pas l'en-tête.
- **Recherche des collisions analogues** (`tests/e2e/**`, nom de client/machine ou format d'heure
  pouvant rencontrer l'en-tête) : aucune autre scène visitant `/terrain/${id}` n'utilise un
  `getByText` non borné sur un nom de machine (`libelleMaterielComplet`/`machineAttendue` n'apparaît
  ailleurs que dans `liens-fiches.spec.ts`, sans rapport — un paramètre d'URL du back-office) ni sur
  le motif `HH:MM:SS` (seule occurrence : la scène ci-dessus, déjà corrigée). Le nom du CLIENT,
  lui, n'est affiché qu'une seule fois sur cette fiche (dans l'en-tête) — aucune collision possible.
  Aucune autre correction nécessaire.
- **Aucun écran retouché** pour cette reprise : le cherry-pick des 7 commits de
  `9L04C-TERRAIN-STYLE-EPURE-garde` sur `origin/main` (`fb9b72e00`, 9L04B point 6) s'est appliqué
  SANS CONFLIT — rien à concilier avec 9L04D ni aucun autre lot publié depuis.
- Épreuves rejouées au premier plan (`CI=1 --workers=1`) : les deux scènes réécrites, toutes les e2e
  dont le nom contient `terrain`, `journee` ou `compteur`, `9l04b-gabarit-rattachement.spec.ts`,
  `zz-captures-9l04c-terrain-style-epure.spec.ts` et `tous-les-ecrans-rendent.spec.ts` — **153
  collectées, 4 ignorées (hors portée du filtre), 149 vertes, 0 échec**. Puis `CI=1 pnpm verify`
  (format, typecheck, lint, test, test:isolation, build) — **vert** (un aller-retour `prettier
  --write` sur les deux fichiers réécrits avant le dernier passage).
- `pnpm verify:full` n'a PAS été rejoué ici non plus (même contrainte de budget que 9L04C) — laissé
  à la file de nuit.
