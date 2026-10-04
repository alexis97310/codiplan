# 9D0-E2E-PGA6-DIMANCHE — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`tests/e2e/captures-pg-a6-libelle-sans-duree.spec.ts` posait son intervention
sur la **date UTC du jour** (`new Date()` + `Date.UTC(...)`, lignes 67-74
d'avant ce lot) puis ouvrait `/planning` **sans** `?semaine=`, qui retombe sur
la semaine courante **à Nouméa** (UTC+11, sans changement d'heure). Depuis le
dimanche 04/10 ~11:00 Nouméa (= 00:00 UTC), la date UTC du jour devient
« dimanche » alors qu'il est encore dimanche après-midi/soir à Nouméa — et
`/planning`, lu dans le fuseau de la société, ouvre une semaine dont le samedi
est le dernier jour affiché : l'intervention posée au dimanche UTC tombait
hors de la fenêtre lundi-samedi que la page affiche, `sansDuree` n'y comptait
plus l'intervention forgée, le lien `statistiques.charge_incomplete_lien`
n'était pas rendu, et le test 2 (« lien « sans durée » du panneau de charge du
planning ») échouait — **chaque dimanche heure de Nouméa, à partir de 11:00,
et bloquait toute publication de la file jusqu'au lundi**.

Le spec pose désormais l'intervention sur le **prochain jour ouvert de
l'agence DUCOS** à partir d'aujourd'hui **à Nouméa**
(`jourDe(maintenant(reperes.fuseau).local)`, `chargerCalendrierAgence`,
`prochainJourOuvert` sur un horizon de 15 jours — même oracle que
`tests/e2e/captures-pgd2-deux-semaines.spec.ts`), et le test 2 ouvre
explicitement `/planning?semaine=<lundi de la semaine de ce jour>` plutôt que
de compter sur la semaine implicite. Le commentaire de tête (lignes 22-26)
disait `planifiee` alors que l'insertion posait déjà `a_planifier` depuis
l'origine : corrigé pour dire ce que le code fait réellement.

Aucune assertion n'a changé, aucun `skip`/`fixme`, aucun timeout gonflé, aucun
code applicatif touché. Pour l'exploitation : zéro changement de
comportement produit — correction de test seule.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

**Reproduction directe, un vrai dimanche** : la session tourne le
2026-10-04, confirmé dimanche par l'horloge système (`date -u` →
`Sun Oct 4 02:44:45 UTC 2026`, `TZ='Pacific/Noumea' date` →
`Sun Oct 4 13:44:45 +11 2026`). `CI=1 pnpm exec playwright test
tests/e2e/captures-pg-a6-libelle-sans-duree.spec.ts` sur main à jour
(`4de636a1`) avant toute correction : 1 passed (tuile du tableau de bord), 1
failed (lien du panneau de charge — `Locator: getByRole('link', { name: 'Voir
celles à venir, sans durée →' }).first()` introuvable, timeout 5000ms, échoué
deux fois de suite y compris la retentative Playwright), 2 did not run (série
interrompue par `test.describe.configure({ mode: "serial" })`). Rouge exact
annoncé par le ticket.

**Après correction**, même session, même dimanche réel :
`CI=1 pnpm exec playwright test tests/e2e/captures-pg-a6-libelle-sans-duree.spec.ts`
→ 4 passed (1.0 min). `pnpm typecheck` propre.

**`CI=1 pnpm verify` rejoué en entier** (début ~02:51 UTC = 13:51 Nouméa) :
`format:check`, `typecheck`, `lint`, `test` (unitaires), `test:isolation`,
`build` — tous verts, aucune erreur ni avertissement.

**`pnpm test:e2e` (suite complète, 828 tests) rejoué en entier** séparément
(la commande `verify:full` avait été coupée à 30 minutes par l'outil, en plein
milieu de la suite e2e, sans aucun échec observé jusque-là) : lancé à 03:24:36
UTC = 14:24:36 Nouméa, terminé 33.1 min plus tard → **821 passed, 7 skipped, 0
failed**. Les 7 « skipped » portent un message explicite dans le journal
(« ‑‑ ne vaut pas 0 au moment de l'épreuve (18) — capture non prise, voir le
README »), pas des échecs — comportement de scène déjà documenté ailleurs,
sans rapport avec ce lot.

**`pnpm feries:horizon`** (03:57 UTC) : 2 territoires, horizon ≥ 12 mois
partout, vert. **`pnpm audit:partitions`** (même minute) : 13 partitions
couvertes jusqu'à 2027-10, partition par défaut vide, préventif et détectif
verts.

L'ensemble des commandes de `verify:full` a donc été rejoué et observé vert,
LE MÊME DIMANCHE, en plusieurs commandes séparées plutôt qu'un seul
`pnpm verify:full` (voir « ce que je n'ai pas fait »).

**Captures régénérées** : `docs/propositions/PG-A6-LIBELLE-SANS-DUREE/captures/`
portait déjà des captures AVANT/APRÈS d'un ticket antérieur (PG-A6, libellés).
Les 4 fichiers `*-apres-*.png` ont été régénérés avec le spec corrigé
(`CAPTURES_PG_A6=/tmp/... pnpm exec playwright test ...`, même dimanche,
intervention posée lundi 05/10 — prochain jour ouvert) et copiés par-dessus
les anciens : la tuile dit toujours « Sans durée prévue — à planifier ou à
venir », le lien dit toujours « Voir celles à venir, sans durée → » — les
libellés eux-mêmes n'ont pas changé, seule la scène (semaine affichée) est
désormais juste un dimanche. Les 4 fichiers `*-avant-*.png` n'ont pas été
touchés : ils viennent d'un commit antérieur à ce lot et ce lot ne change pas
le code applicatif qu'ils illustrent.

## Ce que j'ai tranché et pourquoi

- **Horizon de recherche à 15 jours**, passé explicitement à
  `chargerCalendrierAgence` (fenêtre) et à `prochainJourOuvert` (paramètre),
  plutôt que le défaut de la fonction (14) : c'est le chiffre que le ticket
  nomme, et l'écrire en dur dans l'appel évite un défaut implicite qui
  diverge silencieusement si la fonction change un jour.
- **`?semaine=<lundi>` explicite au test 2**, plutôt que de compter sur le
  comportement implicite de `/planning` : c'est la racine du bug — compter sur
  « la semaine courante » pour une scène dont le jour peut tomber la semaine
  suivante (si aujourd'hui est fermé et que le prochain jour ouvert est un
  lundi) aurait réintroduit la même classe de défaut sous un autre nom.
- **Pas touché à `tests/e2e/setup/reperes.ts`** : son champ `lundi` est
  calculé depuis `aujourdhui.getUTC*()` (lignes 36-44), même famille de
  défaut en apparence. Mais aucun spec n'a échoué pour cette raison pendant
  cette session — la suite e2e complète (821 passed) a tourné un dimanche réel
  sans aucun rouge — et la consigne du ticket est explicite : ne corriger que
  si quelque chose rougit pour cette raison. Rien n'a rougi ; je ne l'ai donc
  pas touché. Le risque documenté par le ticket (lundi 00:00-11:00 Nouméa, où
  la date UTC est encore dimanche) reste réel en théorie et n'a simplement pas
  été observé à l'exécution ce dimanche après-midi.

## Ce que je n'ai PAS fait

- Je n'ai pas relancé `pnpm verify:full` comme une seule commande jusqu'au
  bout : la première tentative a été coupée par le plafond de 30 minutes de
  l'outil en cours d'exécution de la suite e2e (aucun échec visible dans ce
  qui avait tourné). J'ai donc rejoué séparément `pnpm verify` (déjà passé
  intégralement avant la coupure), puis `pnpm test:e2e` seul avec un délai
  étendu, puis `pnpm feries:horizon` et `pnpm audit:partitions` — les
  quatre briques de `verify:full`, toutes vertes, mais jamais dans une seule
  invocation continue de bout en bout.
- Je n'ai pas touché `tests/e2e/setup/reperes.ts` (voir ci-dessus).
- Je n'ai pas modifié de logique applicative, de migration, de ligne de
  semis, ni d'autre spec.
- Je n'ai pas vérifié si d'autres specs e2e qui posent une date sur
  `new Date()` + UTC (hors `tests/e2e/setup/reperes.ts`) portent le même
  défaut : la suite complète est passée un dimanche réel, donc aucun n'a
  rougi aujourd'hui, mais je n'ai pas fait de recherche exhaustive par
  `grep` pour les recenser — un futur dimanche pourrait en révéler d'autres.

## Pièges pour la session suivante

- **`chargerCalendrierAgence` ne charge les jours particuliers que sur la
  fenêtre passée** (voir la documentation de `lib/calendar/agence.ts`) : si
  un futur spec appelle `prochainJourOuvert` avec un horizon plus large que
  la fenêtre donnée à `chargerCalendrierAgence`, un jour fermé par un jour
  férié situé hors fenêtre ne sera pas détecté comme fermé. Ce lot aligne
  toujours les deux (`horizonJours` identique des deux côtés) — garder
  l'habitude.
- **`reperes.lundi` (`tests/e2e/setup/reperes.ts:36-44`) reste calculé sur la
  date UTC**, pas sur Nouméa. Le risque théorique : un lundi entre 00:00 et
  11:00 heure de Nouméa, où la date UTC est encore dimanche — `reperes.lundi`
  pointerait alors sur la semaine ISO précédente. Une trentaine de specs
  l'utilisent (`grep -rln "reperes\.lundi\b" tests/e2e/*.ts`) ; aucun n'a été
  observé en défaut, mais aucun n'a été rejoué dans cette fenêtre précise
  cette session (la session a tourné l'après-midi, dimanche, jamais un lundi
  matin). À surveiller si la file publie un rouge un lundi matin, heure de
  Nouméa.
- Le spec corrigé pose son intervention sur un jour qui peut être **n'importe
  lequel des 15 prochains jours ouverts**, pas nécessairement « aujourd'hui » :
  toute assertion future sur ce spec qui supposerait implicitement « la
  tuile affiche la date du jour » devra composer avec `jourIntervention`,
  pas avec l'horloge.

## Ce qui reste à faire

Rien de connu dans le périmètre de ce lot : `pnpm verify` et les quatre
briques de `verify:full` (test unitaires, test:isolation, build, e2e complet,
feries:horizon, audit:partitions) sont tous verts, le spec bloquant est
corrigé et reproductible vert sur un dimanche réel, et les captures du ticket
PG-A6 d'origine sont à jour avec le spec corrigé. Au prochain lot : envisager
de recenser par `grep` les autres specs e2e qui lisent `new Date()` en UTC
pour poser une date de scène, et vérifier `reperes.lundi` un lundi matin,
heure de Nouméa, si l'occasion se présente.
