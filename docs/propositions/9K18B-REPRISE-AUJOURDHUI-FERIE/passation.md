# 9K18B-REPRISE-AUJOURDHUI-FERIE — passation

**Reporté** : les commits de `9K18A-MATERIEL-RETOUR-ONGLET-garde` (5 commits) et de
`9K19-CHECKLIST-PARAMETRAGE-garde` (4 commits), par `git cherry-pick`, sans les modifier.
Les deux lots étaient recalés pour une cause SANS RAPPORT avec leur propre contenu — voir
ci-dessous. Chacun porte désormais sa propre section « Reprise 9K18B » dans sa passation
(`docs/propositions/9K18A-MATERIEL-RETOUR-ONGLET/passation.md`,
`docs/propositions/9K19-CHECKLIST-PARAMETRAGE/passation.md`).

## La cause

Mesurée par le pilote le 11/11/2026 vers 01:45 (reprise de nuit, règle D23) :
`tests/e2e/planning-filtres-aujourdhui.spec.ts:149` (« « Aujourd'hui », en vue Jour, ouvre le
prochain jour ouvert d'au moins une agence ») attendait `jour=2026-11-12` et recevait
`jour=2026-11-11` — le 11/11 est férié (Armistice 1918, `prisma/seed-data.ts`), et c'est aussi
le jour où `verify:full` tourne.

`app/(back-office)/planning/page.tsx` calculait `jourOuvertLePlusProche` (le jour visé par le
bouton « Aujourd'hui ») à partir de `pourGrille`, dont les calendriers ne couvrent QUE la
fenêtre AFFICHÉE (`fenetreEnJours`) — en vue Jour, un seul jour : celui demandé par `?jour=`.
La scène du test navigue vers `?jour=<lundi>`, pas vers aujourd'hui : le férié du jour COURANT
(11/11) n'était donc jamais chargé, et `estJourOuvre` le traitait comme ouvert par défaut (son
jour de semaine ordinaire, faute d'exception connue). « Demain » n'avait pas ce défaut : il
recharge déjà ses propres calendriers sur une fenêtre dédiée `[J+1, J+16[` (commentaire
`PG-C6-FILTRES-AUJOURDHUI` d'origine, `9CP-PG-G14B-TRANSMETTRE-GROUPE`).

## Le correctif

`app/(back-office)/planning/page.tsx`, lignes ~698-760 : `jourOuvertLePlusProche` lit
désormais des calendriers RECHARGÉS sur une fenêtre dédiée `[aujourd'hui, aujourd'hui + 16[`
(`fenetreOuverture`, `calendriersOuverture`) — jamais `pourGrille`. **Une seule lecture** sert
aux deux usages : « Aujourd'hui » (`prochainJourOuvert(calendriersOuverture, jourDe(aujourdhui))`)
et « Demain » (`prochainJourOuvert(calendriersOuverture, fenetreDemain.du)`), qui chargeait
auparavant ses propres calendriers sur une fenêtre `[J+1, J+16[` strictement incluse dans la
nouvelle — son résultat est inchangé (même fenêtre couverte, mêmes données), et la deuxième
requête disparaît.

Aucune règle « dimanche » ni « férié » écrite en dur (I7) : le calcul reste entièrement porté
par `prochainJourOuvert`/`estJourOuvre` (`lib/calendar/ouverture.ts`), sur des calendriers
correctement chargés.

## Point 2 — autres appels de `prochainJourOuvert`/`estJourOuvre` mesurés

Aucun autre défaut de la même famille (un jour jugé hors de la fenêtre de calendrier chargée) :

- `app/(back-office)/planning/page.tsx` — `etatFerieDuJour` (bannière) et `ouvertePour`
  (`lib/interventions/grille.ts`, grille technicien) ne jugent que des jours DE LA GRILLE
  affichée, toujours à l'intérieur de `fenetreEnJours` : pas de défaut.
- `lib/interventions/pose.ts` (`verdictOuverture`) — pure, prend un `Calendrier` déjà chargé ;
  ses deux appelants (`lib/interventions/depot.ts:1254` et `:2006`) rechargent chacun une
  fenêtre dédiée `[jourVisé - 1, jourVisé + 1[`, centrée sur le jour exact qu'ils jugent :
  pas de défaut.

## Vérification

- `tests/e2e/planning-filtres-aujourdhui.spec.ts` (`CI=1 --workers=1`) : 2 passed — reproduit
  nativement aujourd'hui (férié réel), sans fixer l'horloge.
- `tests/e2e/9k18a-materiel-retour-onglet.spec.ts` + `tests/e2e/9k19-checklist-parametrage.spec.ts`
  (`CI=1 --workers=1`) : 8 passed.
- `tests/e2e/tous-les-ecrans-rendent.spec.ts` (`CI=1 --workers=1`) : 61 passed, 4 skipped
  (inchangé).
- `pnpm test:isolation` : 236 fichiers, 2132 tests, verts.
- `CI=1 pnpm verify` (format, typecheck, lint, test, test:isolation, build) : vert — 516
  fichiers / 5683 tests (unitaires) + 236 fichiers / 2132 tests (isolation).
- `pnpm verify:full` laissé à la file, comme demandé.

## Captures AVANT/APRÈS

`docs/propositions/9K18B-REPRISE-AUJOURDHUI-FERIE/captures/` — les deux états sont
reproductibles AUJOURD'HUI (11/11, le férié en cause), donc capturés tous les deux plutôt que
le seul APRÈS :
- **AVANT** rejoué contre `origin/main` (tip `dfc1373df`, avant ce lot) via un worktree jetable
  (`git worktree add /tmp/9k18b-avant`, `node_modules` symlinké, `.env` copié, `CI=1` pour ne
  jamais réutiliser le serveur 3100 du code corrigé) : la page reste sur « mercredi
  11/11/2026 » après clic sur « Aujourd'hui ».
- **APRÈS** rejoué sur ce lot : « jeudi 12/11/2026 ».

Le spec de capture (`tests/e2e/zz-captures-9k18b.spec.ts`) était jetable, utilisé pour produire
les quatre PNG puis supprimé — aucune épreuve permanente n'en dépend, la reproduction
permanente reste `planning-filtres-aujourdhui.spec.ts:149`.

## État à l'arrivée

Arbre propre, `git fetch origin` + `git rebase origin/main` faits, aucun push. Branche
`9K18B-REPRISE-AUJOURDHUI-FERIE` : un commit de correctif, cinq commits reportés de 9K18A,
quatre commits reportés de 9K19, un commit de captures, un commit de cette passation.
