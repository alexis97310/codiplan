# 60-PLANNING-3-REPRISE — passation

## Ce que j'ai changé

- **Fusion locale de `53-PLANNING-3-garde` dans `main`** (déjà porteur de
  54-STABILITE-2). Aucun conflit : les deux lots ne touchent aucun fichier
  commun. Le comportement livré par 53-PLANNING-3 (le bloc « Charge
  incomplète » sur `/planning` dès qu'une ligne technicien porte au moins
  une intervention sans durée saisie) entre tel quel, sans une ligne
  modifiée dans `app/(back-office)/planning/statistiques.tsx` ni dans
  `lib/i18n/fr.ts`.
- **`tests/e2e/planning-3.spec.ts`** — deux ajouts, aucun retrait :
  - une capture 1280 px du bloc « Charge incomplète », prise à la fin du
    test existant et écrite dans
    `docs/propositions/60-PLANNING-3-REPRISE/captures/charge-incomplete-1280.png`
    (demandée par ce ticket ; 53-PLANNING-3 avait écrit l'épreuve sans
    jamais en tirer d'image) ;
  - `test.describe.configure({ mode: "serial" })`, pour satisfaire le
    gardien `tests/unit/e2e-mise-en-scene.test.ts` posé par
    54-STABILITE-2 **après** que 53-PLANNING-3 a écrit ce fichier : son
    `beforeAll` pose une intervention à identifiant fixe par
    `deleteMany` + `create`, une écriture non idempotente que le gardien
    exige de protéger par la série. Même correctif que celui que
    54-STABILITE-2 avait appliqué à `porte-capacites.spec.ts`,
    `bon-intervention.spec.ts` et `parc-apercu-borne.spec.ts`.
  - **Pour l'exploitation** : rien ne change côté écran — ce lot ne fait
    que porter le correctif SAV-05 sur `main` avec sa preuve visuelle et
    en le rendant conforme au gardien de stabilité écrit entre-temps.

## Ce que j'ai mesuré

- **Après le merge**, `pnpm typecheck` : vert, immédiatement (piège du
  49 — fusion qui mélange deux versions d'un fichier sans marqueur de
  conflit — non rencontré ici : aucun fichier commun aux deux lots).
- **Premier `pnpm verify:full`** : rouge sur UNE épreuve,
  `tests/unit/e2e-mise-en-scene.test.ts` > « tests/e2e/planning-3.spec.ts
  déclare test.describe.configure({ mode: "serial" }) » — échec attendu,
  puisque ce gardien n'existait pas quand 53-PLANNING-3 a écrit son
  `beforeAll`. Corrigé par l'ajout de la série (voir ci-dessus).
- **Second `pnpm verify:full`, en un seul appel, au premier plan** : entièrement
  vert.
  - `format:check`, `typecheck`, `lint` : verts.
  - `pnpm test` (unit) : 2764 tests, 2764 verts (0 échec), y compris le
    gardien `e2e-mise-en-scene.test.ts` (28/28).
  - `pnpm test:isolation` et `pnpm build` : verts.
  - `pnpm feries:horizon` : 2 territoires contrôlés, au moins douze mois
    d'avance partout.
  - `pnpm audit:partitions` : préventif vert (13 partitions, horizon
    jusqu'à 2027-09), détectif vert (partition par défaut à 0 ligne).
  - `pnpm test:e2e` : 231 tests, 228 verts, 3 sautés (dépendances
    Playwright internes à `tous-les-ecrans-rendent.spec.ts`, pas des
    échecs), **0 échec** — dont
    `tests/e2e/avertissements-1.spec.ts:367` (le badge « Nouveau »,
    l'épreuve étrangère qui avait fait recaler 53-PLANNING-3, corrigée
    par 54-STABILITE-2) et `tests/e2e/planning-3.spec.ts` lui-même.
- **La capture** : `docs/propositions/60-PLANNING-3-REPRISE/captures/charge-incomplete-1280.png`
  (167 018 octets), produite par cette même exécution verte. Elle montre
  la ligne « PL3-Témoin · Agence Ducos » avec « au moins 00:00
  engagées · 00:50 de trajet · 08:00 ouvrables · Charge incomplète — 1
  sans durée saisie — elle compte dans le nombre, et pour zéro minute
  dans le taux · Voir les interventions sans durée → » — ni « % » ni
  « Taux » sur la ligne, conforme à ce que 53-PLANNING-3 avait livré.

## Ce que j'ai tranché, et pourquoi

- **Fusionner d'abord, puis ne rien changer au comportement livré par
  53** — le ticket l'imposait, et aucun conflit ne le remettait en
  cause : la seule intervention nécessaire portait sur le harnais e2e
  (un gardien nouveau, pas le code produit).
- **Corriger la mise en scène de `planning-3.spec.ts` en place, plutôt que
  de la contourner** : ce fichier appartient au territoire de ce lot
  (« ce que 53-PLANNING-3-garde touche déjà »), donc ce n'est pas une
  épreuve « étrangère » au sens du piège connu — la série suffisait, sans
  qu'il soit nécessaire de réécrire l'écriture en
  `INSERT … ON CONFLICT DO UPDATE` comme 54-STABILITE-2 l'a fait pour
  `porte-capacites.spec.ts` : le gardien exige la série (ou une exemption
  nommée), pas l'idempotence en soi — la série seule suffit à le
  satisfaire, et c'est la correction minimale.
- **Un seul essai a été nécessaire pour ce correctif** : la règle « deux
  rouges et tu t'arrêtes » ne s'est pas déclenchée.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix.
- Aucun changement dans `app/(back-office)/planning/statistiques.tsx` ni
  dans `lib/i18n/fr.ts` : le comportement de 53-PLANNING-3 est repris
  intact.
- Je n'ai pas touché aux 20 captures PNG d'autres lots (47-AVERTISSEMENTS-1,
  50-INTERVENTIONS-2, 52-REGISTRE-1, 59-ABSENCES-2) que `git status`
  montrait déjà modifiées au début de cette session, avant toute action de
  ce lot — elles sont hors territoire, et je les laisse telles quelles,
  non committées.
- Je n'ai pas ajouté la capture 375 px : le ticket demande explicitement
  « 1280 px », pas les deux largeurs habituelles.
- Je n'ai pas touché `depot/` ni `11-FILE.sh`.

## Les pièges pour la session suivante

- **Un gardien peut naître entre l'écriture d'un fichier e2e et sa
  fusion sur `main`.** `tests/e2e/planning-3.spec.ts` était vert au
  moment où 53-PLANNING-3 l'a écrit ; 54-STABILITE-2, fusionné entre
  temps, a ajouté un gardien statique (`e2e-mise-en-scene.test.ts`) qui
  l'a fait rougir sans qu'aucune ligne du fichier n'ait changé. Après
  toute fusion d'une branche `-garde` ancienne, rejouer `pnpm test`
  (unit) au complet plutôt que de supposer que « ça passait avant »
  suffit encore.
- **Les 20 PNG modifiées au tout début de cette session** (voir git
  status initial : `47-AVERTISSEMENTS-1`, `50-INTERVENTIONS-2`,
  `52-REGISTRE-1`, `59-ABSENCES-2`) restent non committées, exactement
  comme trouvées. Elles proviennent vraisemblablement d'une exécution
  locale antérieure de `pnpm test:e2e` (ces captures sont régénérées à
  chaque exécution des specs correspondants) — je ne les ai ni
  investiguées ni committées, hors territoire de ce ticket.
- Rien de neuf sur le fond métier : SAV-05 est livré et vérifié depuis
  53-PLANNING-3, ce lot ne fait que le porter et le prouver par l'image.

## Ce qui reste à faire

- Rien côté SAV-05 / 53-PLANNING-3 : couvert, vert, capturé.
- Les captures PNG modifiées d'autres lots (voir ci-dessus) mériteraient
  d'être triées par leur propre équipe : soit committées si elles sont la
  nouvelle vérité, soit restaurées si elles ont dérivé sans raison.
- Le reste hors périmètre déjà nommé par la passation de 53-PLANNING-3 :
  nom du technicien figé au défilement, file triable, absence avant
  dépôt, visites à caler (SAV-06).
