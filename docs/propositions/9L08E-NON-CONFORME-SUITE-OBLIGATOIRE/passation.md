# 9L08E-NON-CONFORME-SUITE-OBLIGATOIRE — passation

Décision d'Alexis du 16/11/2026 (réponse « 1 ») : la suite à donner d'un point de checklist répondu
« non conforme » devient une condition de « Terminer » ; le commentaire reste facultatif. Écrite en
`docs/arbitrages.md` sous **D264**, qui amende **D254** (question qu'elle avait laissée ouverte, avec
sa propre condition de réouverture — exactement celle qui vient de se lever).

## Ce qui a été livré

1. **`lib/checklists/completude.ts`** — `ReponsePourCompletude` porte `suiteDonnee` ; `EtatCompletude`
   porte un nouveau champ `suitesNonConformesManquantes`, calculé en plus de (jamais mêlé à)
   `obligatoiresManquants`. Un point non conforme SANS suite y entre, **obligatoire ou non** — la
   condition porte sur la conformité de la réponse, jamais sur le drapeau `obligatoire`.
2. **`lib/interventions/cycle-de-vie.ts`** — `peutTerminer` reçoit un 6ᵉ paramètre
   `suitesNonConformesManquantes`, jugé après la checklist obligatoire (CK7, D240) et avant la
   signature ; refuse avec la clé `intervention.refus.suite_non_conforme_manquante` et
   `Refus.pointsSansSuite`. `manquesPourTerminer`/`ManquesTerminer` nomment ce 4ᵉ manque EN PLUS des
   trois déjà nommés (9K27), pour la feuille de confirmation.
3. **`lib/checklists/depot.ts`** — `obligatoiresManquantsPourTerminer` renommée
   `manquesChecklistPourTerminer`, qui lit désormais `non_conformite_suite` et retourne les deux
   listes. `checklistDeLIntervention` (lecture bureau/terrain) calcule aussi `suiteDonnee`.
4. **Propagation** jusqu'à l'écran : `depot-rapport-terrain.ts` (`terminerIntervention`),
   `app/api/terrain/[id]/terminer/route.ts` (JSON `pointsSansSuite`), `app/api/terrain/instantane/
   route.ts` (copie hors réseau), `app/(mobile)/terrain/[id]/page.tsx` (refus serveur affiché).
5. **`components/terrain/rapport-automatique.tsx`** — nouvelle fonction
   `suitesNonConformesManquantesDepuisFile` (même patron que `obligatoiresManquantsDepuisFile`),
   nouvel état `suitesManquantesAffichees`/`pointsSansSuiteTerminer`, la feuille de confirmation et la
   bannière de refus en ligne citent chaque point (section — libellé) avec le lien qui déplie la
   rubrique et y saute (`allerAuPointChecklist`, réutilisé tel quel).
6. **`components/terrain/checklist-terrain.tsx`** — `resumeNonConformite` affiche désormais
   « Suite à donner manquante » (nouvelle clé `checklist.non_conformite.suite_manquante`) tant que la
   suite reste vide, à la place d'un résumé muet ou amputé.
7. **`lib/i18n/fr.ts`** — deux nouvelles clés : `terrain.terminer.confirmation.
   manque_suite_non_conforme` et `checklist.non_conformite.suite_manquante`, toutes deux
   « Suite à donner manquante » (même texte, deux contextes distincts — pas de fusion, pour qu'un futur
   changement de l'un ne traîne pas l'autre).
8. **`docs/arbitrages.md`** — D264 écrite, amende D254 (marque posée des deux côtés,
   `tests/unit/docs/amendements-arbitrages.test.ts` mis à jour avec la paire). D240 n'est PAS rouverte :
   un non conforme reste une réponse à part entière pour `obligatoiresManquants` — D264 ajoute un
   second critère orthogonal, jamais une relecture du premier.

## Épreuves

- `tests/unit/checklists/completude.test.ts` — deux nouveaux cas D264 (bloque même non obligatoire,
  ne bloque jamais un point conforme).
- `tests/unit/interventions/cycle-de-vie.test.ts` — `peutTerminer`/`manquesPourTerminer` avec le 6ᵉ/4ᵉ
  paramètre partout, ordre des gardes vérifié (obligatoire avant suite manquante avant signature),
  nouveau describe D264 dédié.
- `tests/isolation/terminer-intervention.test.ts` — le serveur refuse `suite_non_conforme_manquante`
  nommé tant qu'elle manque, et accepte une fois posée (y compris reposée APRÈS un premier refus, sur
  la MÊME réponse). L'ancien cas « non conforme sans suite ne bloque pas » pose désormais une suite
  pour continuer à prouver D240 (ce n'est plus la même affirmation qu'avant ce lot, voir le commentaire
  dans le test).
- `tests/e2e/9l08e-non-conforme-suite-obligatoire.spec.ts` (NOUVEAU) — 375 px, en ligne et mode avion :
  refus nommé → lien qui déplie et saute à la ligne rouge → suite posée → Terminer passe.
- `tests/e2e/9k24-checklist-bons.spec.ts` et `9k25-checklist-fiche-bureau.spec.ts` — ces deux scènes
  seedent directement (Prisma, hors `terminerIntervention`) une intervention déjà `cloturee`/`terminee`
  avec un point non conforme SANS suite ; D264 ne les fait pas échouer (elles ne passent jamais par le
  serveur), mais l'état qu'elles fabriquaient n'était plus atteignable par une vraie intervention. Les
  deux seeds posent désormais une suite pour rester représentatifs — listées explicitement ici comme
  demandé.
- Aucune autre scène e2e ne termine une intervention avec un point non conforme sans suite (mesuré par
  grep avant d'écrire ce lot : `9k21`, `9l04i`, `9l04m` interagissent avec la checklist mais ne
  terminent jamais l'intervention dans ce fichier).

`pnpm typecheck`, `pnpm lint`, `pnpm test` (5941 tests), `pnpm test:isolation` (2276 tests),
`tests/e2e/tous-les-ecrans-rendent.spec.ts` et `CI=1 pnpm verify` (build compris) passent tous,
rejoués en foreground pendant ce lot.

## Ce qui N'A PAS été fait, et pourquoi — à reprendre

**Captures AVANT (ancien commit reconstruit) et régénération de `docs/captures/` par
`pnpm exec tsx scripts/captures.mts`.** Seules les captures APRÈS (375 px, 4 écrans) existent, prises
inline par le spec e2e lui-même (`docs/propositions/9L08E-NON-CONFORME-SUITE-OBLIGATOIRE/captures/`).
Le budget de 90 minutes de ce lot ne couvrait pas, en plus de l'implémentation et des trois familles
d'épreuves : un second worktree sur le commit précédent, son propre `next build`, ET une base jetable
+ seed + amorçage + `scripts/captures.mts` pour rafraîchir `docs/captures/README.md`. Aucun de ces deux
écrans n'était auparavant capturé par `docs/captures/` (ni la feuille de confirmation « Terminer », ni
la ligne rouge d'un point non conforme n'y figurent à ce jour) — ce n'est donc pas une image existante
devenue fausse, seulement une mise à jour absente. **À reprendre** : suivre `docs/captures/README.md`
(base jetable, `pnpm db:deploy` + `pnpm db:seed`, build + `pnpm start -p 3100`, amorçage du premier
compte, puis `scripts/captures.mts`), committer les images rafraîchies avec le commit réellement
photographié et la date lus à la machine (`git rev-parse HEAD`), comme le README l'exige.

## Points d'attention pour la suite

- `manquesChecklistPourTerminer` (ex-`obligatoiresManquantsPourTerminer`) n'a qu'un seul appelant
  (`terminerIntervention`) — le renommage est sans risque, mais `docs/arbitrages.md` D240/D242 le
  citaient sous l'ancien nom en prose (jamais dans une marque câblée) ; non corrigé, car hors du
  périmètre de ce ticket et sans gardien qui l'exige.
- Aucune migration, aucune contrainte en base sur `non_conformite_suite` — la garde reste purement
  applicative, au même rang que CK7 (D240). Si Alexis veut un jour la poser en base, D264 se relit
  (condition de réouverture écrite).
