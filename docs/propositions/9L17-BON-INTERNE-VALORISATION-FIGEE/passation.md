# 9L17-BON-INTERNE-VALORISATION-FIGEE — passation

Démarré le 18/11/2026 à 20:57 (Nouméa), budget 90 min.

## La règle tenue

Décision d'Alexis du 10/11/2026, écrite sous D272 (`docs/arbitrages.md`) :
le bon d'une intervention close lit son taux horaire, son forfait de
déplacement et son total dans `intervention.valorisation_figee` — jamais
dans le barème courant (`tauxEnVigueur`, `montantDuForfait`). Une clôture
antérieure à la migration qui a introduit cette décomposition
(9I8A1-REPRISE-9I8A, 31/10/2026) ne reconstitue ni taux ni forfait : le bon
nomme l'ancienneté et ne reprend que le total déjà écrit en base.

## Ce qui a été mesuré

Sur `81894e0`, `composerBon` (`lib/interventions/bon.ts`) relisait
`tauxEnVigueur`/`montantDuForfait` EN DIRECT pour toute intervention,
close ou non — alors que `montantTotal` venait, lui, de la colonne déjà
figée à la clôture (`montant_ht`). Pour une intervention close, un taux
posé ou retiré après coup changeait donc ce que le bon affiche à côté d'un
total qui, lui, ne bougeait jamais : un bon réimprimé pouvait montrer un
taux qui n'avait jamais servi à établir son propre total.

La capture AVANT (`docs/propositions/9L17-BON-INTERNE-VALORISATION-FIGEE/captures/bon-ancienne-avant-1280.png`)
le montre sur une clôture antérieure à 9I8A1-REPRISE-9I8A, sans aucune
décomposition figée : le bon affiche « Taux horaire en vigueur à cette
date : 7 000 XPF » — le taux RÉGLÉ AUJOURD'HUI, qui n'a jamais servi à
établir le total de 123 456 XPF affiché juste en dessous, lui écrit il y a
deux mois.

## Ce qui est livré

### Point 1 — le bon lit la décomposition figée, jamais le barème

`lib/interventions/bon.ts`, `composerBon` : trois issues, jamais une
quatrième.

- Close AVEC `valorisation_figee` : `taux`, `forfaitMontant` et
  `montantTotal` viennent de `depuisJsonValorisationFigee` (désormais
  exportée par `lib/interventions/depot.ts` — même fonction de décodage
  que `lireFicheIntervention`, qui la lisait déjà pour la fiche).
- Close SANS elle (clôture antérieure à 9I8A1-REPRISE-9I8A) :
  `valorisationAncienne` passe à `true`, `taux` et `forfaitMontant` restent
  `null` (rien ne se reconstitue), `montantTotal` reprend le total déjà
  écrit en base (`montant_ht`).
- Pas encore close : comportement INCHANGÉ — un aperçu calculé en direct,
  rien n'est encore figé.

`app/(back-office)/interventions/[id]/bon/page.tsx` : une branche
`bon.valorisationAncienne` nouvelle, avant la branche `bon.taux === null`
existante — « Valorisation antérieure au 31/10/2026 : seul le total déjà
établi à la clôture est repris, sans détail de taux ni de forfait. »
(`intervention.bon.valorisation_ancienne`, `lib/i18n/fr.ts`), avec la
seule ligne du total.

### Point 2 — la mesure, et ce qui n'est pas fait

Sur `codiplan_test`, au moment de ce ticket : **aucune** ligne `cloturee`
sans `valorisation_figee` en dehors des scènes d'épreuves de bout en bout
qui en simulent une volontairement (`tests/e2e/fiche-intervention.spec.ts`
en pose jusqu'à 3, selon ce qui a tourné avant, puis les retire par son
propre `afterAll`). Rien n'indique qu'une telle ligne existe ailleurs
qu'en environnement hébergé antérieur à 9I8A1-REPRISE-9I8A.

**Aucune donnée n'a été migrée ou reprise par ce ticket** — ce n'était pas
sa demande, et une vraie reprise supposerait de retrouver, pour chaque
ligne ancienne, le taux et le forfait RÉELLEMENT appliqués à sa clôture,
ce qu'aucune colonne ne porte plus (seul `montant_ht`, le total, survit).
**Proposition, si une reprise devient nécessaire un jour** : elle ne peut
venir que d'une source EXTERNE au schéma actuel (un export du taux
horaire et des forfaits valables à chaque date de clôture ancienne, tenu
par ailleurs) — pas d'une déduction depuis les colonnes restantes, qui ne
suffisent pas à distinguer la main-d'œuvre, le forfait et la majoration à
l'intérieur d'un seul total.

### Point 3 — épreuves et captures

- `tests/isolation/bon-intervention.test.ts` : le test existant (« le taux
  disparu APRÈS la clôture efface le total ») testait exactement
  l'ANCIEN comportement que ce ticket corrige — renommé et RETOURNÉ : un
  taux retiré après la clôture ne change plus rien au bon
  (`valorisationAncienne === false`, `taux` et `montantTotal` inchangés).
  Deux cas ajoutés : une intervention PAS ENCORE close, sans taux en
  vigueur, continue de rendre un aperçu qui nomme l'absence (comportement
  INCHANGÉ) ; une clôture antérieure à 9I8A1-REPRISE-9I8A, insérée
  directement comme dans `valorisation-intervention.test.ts`, rend
  `valorisationAncienne === true` et reprend le total brut.
- `tests/e2e/captures-9l17-bon-valorisation-figee.spec.ts` (nouveau) : sa
  propre scène (préfixe `9L17-CAP-`), une intervention insérée déjà close
  sans `valorisation_figee`. Capture AVANT/APRÈS (`CAPTURES_9L17`,
  `CAPTURES_9L17_PHASE`) — rien n'est écrit par `pnpm test:e2e` ordinaire.
  AVANT rejoué sur un `git worktree` jeté sur `757ed7e78` (le commit juste
  avant celui du point 1), serveur sur le port 3101, le port 3100 restant
  réservé au code courant.

## Une correction au passage

Les commentaires du point 1 (et le message du commit correspondant)
citaient « D224 » pour cette décision — D224 est en réalité le temps
facturé arrondi par palier (9I8A-REGLE-DE-FACTURATION-DU-TEMPS), une
décision différente. La bonne référence est D272, écrite par ce ticket ;
le code, le dictionnaire et l'épreuve ont été corrigés dans le commit du
point 2. Le message du commit du point 1, lui, garde sa citation fausse —
aucun commit n'a été réécrit (règle du dépôt : jamais d'amend sauf
demande explicite).

## Ce qui n'a pas été construit, et pourquoi

Rien d'identifié hors du périmètre du ticket : les trois points demandés
sont couverts, `pnpm verify` (format, typecheck, lint, test, isolation,
build) passe sans erreur ni avertissement.
