# 9H1-RAPPORT-VALIDE-AVANT-CLOTURE — passation

Branche `9h1-rapport-valide-avant-cloture`, partant d'`origin/main` (`f66cce0ec`) — `HEAD`
était détaché sur `origin/main` au démarrage (aucun autre worktree ne tenait `main` à ce
moment précis, mais le harnais livre un HEAD détaché par défaut) : une branche dédiée a été
créée dès le premier commit pour ne rien perdre, comme demandé.

Les quatre points du corps du ticket sont faits, chacun commité séparément, plus un commit
de captures et un de `verify-final.txt`.

## Point 1 — Migration : `rapport_valide_par`/`rapport_valide_le`

- **Avant** : `prisma/schema.prisma` ne portait que `temps_valide_min/par/le` — aucune
  colonne ne disait si le RAPPORT avait été validé (IN-20, audit 9F6).
- **Après** : `prisma/migrations/20261022210000_rapport_valide_avant_cloture/migration.sql`
  — deux colonnes, même régime que `temps_valide_par/le` (D120) : QUI, QUAND. Rattrapage
  des interventions déjà clôturées : `rapport_valide_le` reçoit leur date de clôture,
  `rapport_valide_par` reste `NULL` (personne ne peut signer une validation que personne
  n'a faite). Le déclencheur `intervention_cycle_de_vie` refuse désormais aussi la clôture
  sans `rapport_valide_par`.
- **La contrainte `intervention_rapport_validation_tracee` n'est PAS `NOT VALID`.** J'ai
  mesuré que `scripts/lib/contraintes-non-validees.ts` porte un PLAFOND de quatre entrées
  (actuellement trois), et que son propre test dit noir sur blanc qu'une quatrième serait
  « un arbitrage, jamais une mise à jour de ce fichier ». Le fichier lui-même nomme `NOT
  VALID` comme un assouplissement d'invariant, point d'arrêt du §8 de `CLAUDE.md`. Plutôt
  que de forcer ce point d'arrêt en exécution non interactive, j'ai écrit une contrainte
  **pleinement VALIDÉE dès sa pose** qui tolère l'asymétrie `par NULL / le NOT NULL`
  *uniquement* sur une ligne déjà `cloturee` — et une ligne `cloturee` ne se modifie plus
  jamais (`intervention_cycle_de_vie` l'interdit avant même d'atteindre cette colonne),
  donc l'échappatoire ne s'ouvre qu'au rattrapage de cette migration, jamais à une écriture
  future. **Signalé explicitement ici pour revue** : c'est une décision d'ingénierie prise
  à la place d'un point d'arrêt explicite du corpus, parce que l'exécution est non
  interactive — à confirmer ou à corriger.
- `lib/db/migrations-attendues.ts` et `prisma/schema.prisma` mis à jour en conséquence.
- **Épreuve** : `tests/isolation/intervention.test.ts` (nouveau bloc « la CLÔTURE sans
  rapport validé », DB réelle, JUMEAU compris via le cas qui doit rester vert) ;
  `tests/unit/db/contraintes-non-validees.test.ts` reste vert SANS entrée nouvelle (le
  plafond de 3 est inchangé — la preuve que la décision ci-dessus a été tenue).

## Point 2 — La règle : `peutCloturer`, `peutValiderRapport`, `validerRapport`

- **Avant** : `lib/interventions/cycle-de-vie.ts:95-112` (mesuré sur `9bcb542b`) —
  `peutCloturer` ne jugeait que le statut et le temps mesuré.
- **Après** : `lib/interventions/cycle-de-vie.ts:105-139` — `peutCloturer` prend un
  troisième paramètre `rapportValidePar: string | null` et refuse (clé
  `intervention.refus.rapport_non_valide`) AVANT même de juger le temps mesuré — ordre
  choisi pour suivre la liste « Avant de clôturer » de la maquette. `peutValiderRapport`
  (`lib/interventions/cycle-de-vie.ts:141-161`) : `terminee` + rapport écrit
  (`commentaire_technicien non NULL`) sinon refus `intervention.refus.rapport_absent`.
- `validerRapport` (`lib/interventions/depot.ts:2014-2068`) : écrit `rapport_valide_par`/
  `rapport_valide_le` sous le contexte cloisonné, via `accesSurCetteIntervention(...,
  "valider_rapport", ...)`, même fonction que `cloturerIntervention` mais une capacité
  différente. Route `app/api/interventions/[id]/valider-rapport/route.ts` (nouvelle),
  gardée par `exigerCapacite("valider_rapport")`.
- `enregistrerRapportTexte` (`lib/interventions/depot-rapport-terrain.ts:165-178`) écrit
  désormais toujours `rapport_valide_par: null, rapport_valide_le: null` au même geste
  qu'il écrit le commentaire/la suite à donner : un rapport modifié annule sa validation.
- **Droit — écart mesuré avec le texte du ticket, signalé.** Le ticket dit « Droit : celui
  qui permet de clôturer ». J'ai mesuré `lib/auth/habilitations.ts:77,154` : la capacité
  `valider_rapport` existe DÉJÀ dans la matrice (`complet: [ADMS, DIR, RM, RS]`, **sans**
  l'ADV ni le technicien) et n'était consommée nulle part (IN-20). La maquette
  (`docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html:1897`, `CAN.valider`)
  porte le commentaire explicite « jamais l'ADV ». `cloturer_intervention`, lui, donne le
  ● à l'ADV et le ○ au technicien. Les deux droits ne se recouvrent donc PAS : j'ai utilisé
  `valider_rapport` pour « Valider le rapport » (aucun droit neuf — il existait déjà) et
  gardé `cloturer_intervention`, inchangé, pour « Clôturer ». **À confirmer avec Alexis** :
  le texte du ticket laisse entendre le même droit pour les deux gestes ; la matrice
  mesurée dit le contraire, et je m'y suis tenu plutôt qu'à la paraphrase du ticket.
- **Épreuve** : `tests/unit/interventions/cycle-de-vie.test.ts` (nouveaux blocs
  `peutCloturer`/RG-INT-03, `peutValiderRapport`) ; `tests/isolation/rapport-valide-avant-
  cloture.test.ts` (nouveau, DB réelle : validation, refus sans rapport, rôle sans droit,
  cloisonnement société B) ; `tests/unit/auth/porte.test.ts` (route neuve enregistrée dans
  `ROUTE_CAPACITE`, compte 86).

## Point 3 — L'écran : bloc « Avant de clôturer », bouton « Valider le rapport »

- **Avant** : aucun bloc de ce nom dans l'application réelle (seule la clé
  `intervention.bandeau.prete_a_cloturer` existait) — capture
  `fiche-resume-terminee-avant-*.png` : bandeau « Prête à clôturer. », pas de carte.
- **Après** : `app/(back-office)/interventions/[id]/page.tsx:1507-1573` (composant
  `AvantDeCloturer`), rendu `:1230-1242`, sur l'onglet Résumé d'une `terminee` seulement.
  **Trois lignes, pas quatre** : la maquette en imagine une quatrième, « Temps validé »,
  mais `peutCloturer` ne la juge PAS — le temps validé s'écrit PAR la clôture elle-même
  (D120, `cloturerIntervention`), jamais avant elle dans ce dépôt ; l'ajouter aurait
  inventé une exigence absente de la règle, contre la consigne du ticket (« mesure,
  n'invente pas »). Bouton « Valider le rapport » (`:969-993`, un `<form>` simple comme
  « Reprendre », sans dialogue). `bandeauDeLaFiche`
  (`app/(back-office)/interventions/presentation.ts:1887,1972-1977`) et `DialogueCloturer`
  lisent le même verdict `peutCloturer`, désormais nourri du rapport validé.
- **Épreuve** : `tests/unit/interventions/etapes-et-bandeau-fiche.test.ts` (nouveaux cas
  « rapport non validé » / « rapport validé » du bandeau) ; captures e2e ci-dessous.

## Point 4 — Épreuves

- **Nouveau** : `tests/isolation/rapport-valide-avant-cloture.test.ts` (validation,
  refus sans rapport, rôle sans droit, cloisonnement, puis clôture bout en bout) ;
  `tests/isolation/intervention.test.ts` (garantie base, JUMEAU implicite via le cas
  « doit rester vert ») ; `tests/unit/interventions/cycle-de-vie.test.ts`.
- **Adaptées au plus juste** — RG-INT-03 change leur prémisse implicite (une `terminee`
  menée à `cloturee` exige maintenant un rapport validé), jamais leur objet propre : chaque
  fixture qui portait une intervention jusqu'à `cloturee` pose désormais aussi
  `rapport_valide_par`/`le` au même geste —
  `tests/isolation/droits-cycle-de-vie.test.ts`, `intervention-machines.test.ts`,
  `rapport-terrain.test.ts`, `statut-facturation.test.ts`, `temps-mesure-du-compteur.test.ts`,
  `bon-intervention.test.ts`, `valorisation-intervention.test.ts` (isolation) ;
  `tests/e2e/fiche-cloturer.spec.ts`, `fiche-cloturer-replie.spec.ts`,
  `fiche-entete-bandeau-frise.spec.ts` (e2e — cette dernière isole en plus un cas « rapport
  non validé » du cas « temps manquant », qui se recouvraient sinon).
- **Aucune assertion retirée ni élargie** — chaque fixture gagne une colonne pour que le
  refus qu'elle mesure reste CELUI qu'elle nomme, jamais celui que ce ticket vient d'ajouter
  devant.

## Captures AVANT/APRÈS

```
$ ls -la docs/propositions/9H1-RAPPORT-VALIDE-AVANT-CLOTURE/captures/
-rw-r--r-- 129547 fiche-resume-terminee-apres-1280.png
-rw-r--r--  58255 fiche-resume-terminee-apres-375.png
-rw-r--r-- 114296 fiche-resume-terminee-avant-1280.png
-rw-r--r--  51551 fiche-resume-terminee-avant-375.png
```

Produites par `tests/e2e/zz-captures-9h1-rapport-valide.spec.ts`, joué deux fois (APRÈS sur
ce commit, AVANT sur un `git worktree` planté sur `f66cce0ec`) — même discipline que
`zz-captures-9g1-correctifs.spec.ts`. Le spec ne nomme aucune colonne neuve, pour tourner
identique des deux côtés.

## Fin — `verify-final.txt`

`CI=1 pnpm verify:full` lancé en un seul appel : `format:check`, `typecheck`, `lint`,
`test` (468/468, 5070/5070), `test:isolation` (187/187, 1657/1657), `build`,
`feries:horizon`, `audit:partitions` — TOUS VERTS. `test:e2e` interrompu par la limite de
60 minutes de l'outil (1545 épreuves, 1 worker) — pas un échec mesuré, voir la note ajoutée
en fin de `verify-final.txt` : un seul marqueur d'échec isolé repéré dans le flux, position
hors du territoire de ce ticket, rejoué isolément (26 épreuves) et entièrement vert — non
reproduit, écrit sans certitude absolue faute d'avoir pu le nommer. Les épreuves e2e DU
TERRITOIRE de ce ticket ont toutes été rejouées isolément et sont vertes :
`fiche-cloturer.spec.ts`, `fiche-cloturer-replie.spec.ts`, `fiche-entete-bandeau-frise.spec.ts`,
`zz-captures-9h1-rapport-valide.spec.ts`.

`CI=1 pnpm verify` (sans e2e) rejoué seul, en entier, APRÈS tout le reste : vert, arbre
propre.

Quinze dernières lignes de `verify-final.txt` :

```
Épreuves DIRECTEMENT du territoire de ce ticket, rejouées isolément et
TOUTES VERTES : `fiche-cloturer.spec.ts`, `fiche-cloturer-replie.spec.ts`,
`fiche-entete-bandeau-frise.spec.ts`, `zz-captures-9h1-rapport-valide.spec.ts`
(12 + 2 épreuves, voir la session).
```

(Les quinze dernières lignes réelles du fichier sont la note de passation ajoutée en queue —
reproduites en substance ci-dessus plutôt que redupliquées mot pour mot.)

`git rev-parse --short HEAD` : `22462f917`

## Points ouverts

1. **La décision « contrainte VALIDÉE plutôt que `NOT VALID` »** (point 1 ci-dessus) est une
   décision d'ingénierie prise pour éviter un point d'arrêt du §8 sous exécution non
   interactive. Elle me semble correcte et plus propre que l'alternative, mais elle écarte
   la technique la plus immédiatement disponible (`NOT VALID` + registre) — **à confirmer**.
2. **Le droit de « Valider le rapport »** est `valider_rapport` (déjà dans la matrice),
   pas `cloturer_intervention` comme le texte du ticket le suggérait — **à confirmer**,
   voir le détail et le raisonnement au point 2 ci-dessus.
3. **`test:e2e` complet non mené à son terme** (coupure outil à 60 min, deux fois). Le
   marqueur d'échec isolé observé n'a pas pu être nommé ni reproduit (voir « Fin »
   ci-dessus) — recommande une exécution complète hors de cette session, avec plus de
   temps, avant publication.
4. **Un rapport modifié après validation annule la validation** — mesuré et implémenté
   (`enregistrerRapportTexte`), mais aucune épreuve e2e dédiée (bureau valide → terrain
   modifie le rapport → la validation a disparu) n'a été écrite, faute de temps ; couverte
   seulement en unitaire/isolation indirectement (la colonne est mise à `NULL`, jamais
   observée après un cycle complet depuis l'écran).
5. **Seul un écran a été capturé** (fiche, onglet Résumé, `terminee`) — l'onglet Rapport
   n'a pas reçu de bouton ni de capture dédiée (le ticket dit « Rapport et/ou Résumé » ;
   j'ai choisi Résumé seul, où vit déjà le bandeau d'état et où la maquette place le bloc).

## Reprise 9H1A-REPRISE-9H1 (23/10/2026)

Branche dédiée `9H1A-REPRISE-9H1`, créée à partir de `9H1-RAPPORT-VALIDE-AVANT-CLOTURE-garde`
(7 commits, `cb25b3e04`) puis rebasée sur `origin/main` (`46bd5276e`) — `main` est extrait
ailleurs (`/home/aplou/codiplan`), travail sur branche dédiée comme demandé.

### Le constat du pilote, vérifié puis corrigé

Le pilote avait mesuré ROUGE `tests/e2e/captures-gr14-duree-unique.spec.ts:210` (code
Postgres 23514, RG-INT-03) et écrit que la passation d'origine le disait à tort
« étranger au ticket ». Un recensement complet (`git grep -nE "cloturee" -- tests/
prisma/ scripts/`, puis vérification fichier par fichier de chaque occurrence de
`statut: "cloturee"` et de chaque `UPDATE ... SET "statut" = 'cloturee'`) a confirmé que
**cette scène était la SEULE** à transiter vers `cloturee` par un `.update()` Prisma
(donc soumise au déclencheur `intervention_cycle_de_vie`, `BEFORE UPDATE`) sans poser
`rapport_valide_par`/`le` au préalable :

- Toutes les occurrences via `.create()` (INSERT) sont hors de portée de ce déclencheur
  (`BEFORE UPDATE ON "intervention"`, jamais `BEFORE INSERT`) — `registre-1.spec.ts`,
  `registre-ux3-1.spec.ts`, `equipe-1.spec.ts`, `captures-9es-gestes-2-dialogues.spec.ts`,
  `captures-9eq-fiche-onglets.spec.ts`, `9eg2-tableau-de-bord-direction-admin.spec.ts`,
  `prisma/seed-data.ts`, `tests/isolation/parc-perimetre-technicien.test.ts`,
  `tests/isolation/planning-file-a-traiter.test.ts`.
- Les `UPDATE` bruts restants visent délibérément le refus (`tests/isolation/
  intervention.test.ts`, `intervention-machines.test.ts` : « CLÔTURE sans temps validé »,
  qui rougit avant même d'atteindre la garde du rapport) ou héritent déjà d'un
  `rapport_valide_par` posé plus haut dans la même ligne (`tests/isolation/
  statut-facturation.test.ts`).
- `lib/interventions/depot.ts:1958` (le vrai `cloturerIntervention`) ne touche pas
  `rapport_valide_par` à la clôture : il suppose que `validerRapport` l'a déjà posé plus
  tôt (`peutCloturer`, point 2) — conforme, hors territoire.

**Corrigé** : `tests/e2e/captures-gr14-duree-unique.spec.ts` pose désormais
`rapport_valide_par`/`rapport_valide_le` dans le même `update()` que la clôture, avec
`reperes.technicienDucos` comme validateur — même choix que `fiche-cloturer.spec.ts`,
faute d'une identité « responsable » exposée par `reperesDeLaScene()`.

### Fallout du rebase

- `app/(back-office)/interventions/[id]/page.tsx` : un seul conflit textuel (bloc Résumé)
  — la section devenue `Carte` (9G9C, déjà sur `origin/main`) et le bloc `AvantDeCloturer`
  (9H1) coexistaient ; résolu en posant `AvantDeCloturer` avant la `Carte`. L'import de
  `Icone`, présent sur la garde, avait disparu côté 9G9C (plus utilisé par la `Carte`
  elle-même) ; `tsc` l'a signalé, réimporté.
- Le rebase a fait entrer le gardien `tests/unit/ui/carte-pas-recopiee.test.ts` (9G9A,
  déjà sur `origin/main`) : la section à la main d'`AvantDeCloturer` portait exactement
  le motif qu'il refuse. Converti vers `Carte` plutôt qu'ajouté à la liste d'exemptions —
  c'est du code de ce lot, pas une dette héritée.

### Points ouverts n° 4 et 5, traités dans le budget

- **N° 5 (captures de l'onglet Rapport)** : `tests/e2e/captures-9h1-bouton-valider-
  rapport.spec.ts` (nouveau) — AVANT (bouton visible) et APRÈS (disparu) validation, 375
  et 1280 px. Le bouton reste un geste d'EN-TÊTE (visible sur tout onglet), mais le ticket
  visait l'onglet Rapport lui-même ; capturé là.
- **N° 4 (modifier le rapport annule sa validation, de bout en bout)** :
  `tests/e2e/fiche-rapport-modifie-annule-validation.spec.ts` (nouveau) — RM valide côté
  bureau (jamais l'ADV, qui ne porte pas `valider_rapport`), le technicien réécrit le
  rapport depuis `/terrain/<id>` dans un second contexte navigateur, le bureau relit : le
  bouton « Valider le rapport » et la ligne rouge d'« Avant de clôturer » sont revenus.
  A fait rougir `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` (L0-11) : les deux
  textes de rapport attendus à l'écran étaient en dur plutôt que dans `lib/i18n/fr.ts` —
  corrigé (`terrain.e2e.commentaire`, réutilisée, et `terrain.e2e.commentaire_reecrit`,
  nouvelle).

### Fin

`CI=1 pnpm verify:full` en un seul appel : `verify` complet vert (5072/5072 unitaires,
1657/1657 isolation, build, `feries:horizon`, `audit:partitions`), `test:e2e` interrompu
par la limite d'1h de l'outil en cours de suite — pas un échec mesuré (aucune ligne
« failed » avant la coupure). Les trois scènes du territoire de cette reprise, rejouées
isolément en `CI=1 --workers=1` : toutes vertes. Les captures régénérées comme effet de
bord d'AUTRES épreuves pendant cette suite complète (plus de trois cents fichiers) ont été
restaurées par `git checkout --`, jamais commitées. `CI=1 pnpm verify` (sans e2e) rejoué
seul en dernier : vert, arbre propre.

**Reste ouvert, sciemment** : une exécution complète et ininterrompue de `pnpm test:e2e`
(hors de la limite d'1h d'un outil non interactif) avant publication, pour lever le doute
sur les scénarios jamais atteints par cette session (après le point de coupure).
