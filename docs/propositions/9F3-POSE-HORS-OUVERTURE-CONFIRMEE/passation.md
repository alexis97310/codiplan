# 9F3-POSE-HORS-OUVERTURE-CONFIRMEE — passation

**MIGRATION À APPLIQUER EN PRODUCTION PAR ALEXIS** — `20261017070000_pose_hors_ouverture_confirmee`
(deux colonnes nullables sur `intervention`, sans défaut, sans clé étrangère ; `pnpm db:deploy`).

Mesuré sur `origin/main` d87f0720 au départ (décision n° 93 d'Alexis, 13/10/2026, D211).
Cinq commits livrés : serveur + migration, écrans, épreuves, documentation (D211,
RG-PLA-07), passation.

## Ce que j'ai changé

- **`verdictOuverture` (`lib/interventions/pose.ts`) rend un troisième état** —
  `{etat: "permis" | "refuse" | "a_confirmer"}` au lieu de l'ancien `Verdict` à deux
  issues. `"refuse"` (agence sans calendrier) reste infranchissable ; `"a_confirmer"`
  (jour fermé, heure hors ouverture) REFUSE tant que `confirmer_hors_ouverture` (nouveau
  champ de `schemaDeplacement`, booléen, défaut `false`) ne dit pas le contraire.
- **`verdictALaPose`/`jugerPose` (`lib/interventions/depot.ts`)** : sur `"a_confirmer"`
  non confirmé, refus nommé AVEC la clé existante (`jour_ferme`/`hors_ouverture`) +
  `confirmable: true` ; confirmé, les trois contrôles suivants (habilitation RG-PLA-04,
  absence RG-PLA-06, chevauchement RG-PLA-03) jugent sans rien assouplir, et l'écriture
  est acceptée avec l'avertissement `intervention.avertissement.hors_ouverture`. `confirmable`
  voyage jusqu'à `Resultat<T>` (route `/deplacer`, JSON `confirmable: true/false`) et jusqu'au
  JSON de `GET .../verdict-pose` (`{cle, bloquant: false, confirmable: true}` au lieu de
  `bloquant: true`).
- **Deux colonnes de trace** (`hors_ouverture_confirmee_par`/`_le`, sans clé étrangère —
  même famille que `deplanifiee_absent_id`, `temps_valide_par`) : posées à l'acceptation
  confirmée (instant lu via `instantDeLAgence`, jamais `new Date()` — L0-08), effacées dès
  qu'un déplacement ultérieur retombe dans l'ouverture ou vide la pose. `lireFicheIntervention`
  les résout en `horsOuvertureConfirmee: {par, le} | null` ; `mentionConfirmationHorsOuverture`
  (`app/(back-office)/interventions/presentation.ts`) compose le texte affiché.
- **Écrans** :
  - `FenetrePose` (`components/planning/fenetre-pose.tsx`) : un verdict `confirmable` n'est
    plus `bloquant` ; une `CaseACocher` apparaît et doit être cochée pour activer « Planifier »
    (`peutPlanifier`). **Correctif trouvé en testant** : la sonde « absent » (heuristique déjà
    documentée comme approximative — duree=1 sans créneau) confondait un jour FERMÉ avec une
    absence et bloquait le bouton même confirmé ; elle s'efface désormais une fois la
    confirmation donnée (une vraie absence reste refusée par `jugerPose`, confirmée ou pas).
  - Glisser-déposer direct (`components/planning/pose.tsx`) : `confirmationHorsOuvertureRequise(cible)`
    lit `cible.survol` (même instantané que l'indice de survol, PURE, aucune requête) AVANT
    d'entrer dans le flux d'écriture — donc avant la minuterie « Annuler » (PG-B5). Si
    confirmable et pas encore confirmé, `DialogueConfirmationHorsOuverture` s'ouvre
    (`<dialog data-confirmation-hors-ouverture>`, natif) ; Annuler ne pose rien, Confirmer
    rejoue `executerDepot` avec `main.confirmerHorsOuverture: true`, qui retombe dans le flux
    ordinaire (immédiat pour un redimensionnement, différé 10 s sinon).
  - Fiche (`DialoguePlanifier`, `DialogueDeplacer`) : une `CaseACocher`
    `confirmer_hors_ouverture` toujours présente dans le formulaire plein-page (sans JS,
    sans effet sur une pose dans l'ouverture) ; les textes `intervention.refus.jour_ferme`/
    `hors_ouverture` invitent explicitement à la cocher.
  - Survol de la grille (`components/planning/pose.tsx`) : `motifConfirmable(motif)`
    (type guard sur `"ferie" | "agence_fermee"`) bascule l'indice en orange
    (`bg-app-orange-fond`/`outline-app-orange-bord`), libellé unique
    `planning.survol.a_confirmer` (« Hors ouverture — à confirmer »). `etatDeLaCase`
    (`lib/interventions/survol.ts`) est INCHANGÉE — seule la présentation côté `pose.tsx` change.
  - Fiche : bandeau `mentionConfirmation` (orange) sous les avertissements, visible dès que
    `fiche.horsOuvertureConfirmee !== null`.
- **i18n** : `intervention.avertissement.hors_ouverture`, `intervention.confirmer_hors_ouverture`,
  `intervention.confirmation.hors_ouverture_prefixe`, `planning.survol.a_confirmer`,
  `planning.pose.confirmation_hors_ouverture_titre`, `planning.pose.confirmer_hors_ouverture_bouton` ;
  `intervention.refus.jour_ferme`/`hors_ouverture` amendées (phrase ajoutée, rien retiré) ;
  `planning.survol.ferie`/`agence_fermee_suffixe` retirées (orphelines — `mot("agence")` n'est
  plus composé pour ce motif).
- **Doc** : `docs/arbitrages.md` D211 (nouvelle décision, amende D99 et RG-PLA-07) ;
  `docs/cahier-des-charges.md` RG-PLA-07 amendée (texte amendé, pas supprimé) ; câblage des deux
  gardiens (`tests/unit/docs/amendements-arbitrages.test.ts`,
  `tests/unit/docs/cablage-arbitrages.test.ts`) ; empreinte de L2-08b (`docs/backlog.md`) relue
  et renouvelée — rien n'y change, D211 ne touche pas le chevauchement que D99/RG-PLA-03 y posent.

## Ce que j'ai mesuré

- **Unitaire** : `tests/unit/interventions/pose.test.ts` (verdict à trois états, agence sans
  calendrier toujours un refus plein) ; `tests/unit/interventions/survol.test.ts` (inchangé,
  `etatDeLaCase` ne bouge pas) ; `tests/unit/i18n/vocabulaire-impose.test.ts` (le texte de
  l'avertissement ne nomme jamais « agence » en dur — reformulé sur « le calendrier qui décide
  pour cette intervention », même tournure que les refus existants) ;
  `tests/unit/calendar/sans-date-courante-implicite.test.ts` (L0-08 : l'instant de confirmation
  vient de `instantDeLAgence`, jamais `new Date()`).
- **Isolation** : `tests/isolation/verdict-pose-lecture.test.ts` — paire par motif (sans
  confirmation → refus confirmable ; confirmé → accepté + avertissement + trace posée en base,
  vérifiée par une lecture SQL directe) ; `comparer` (lecture `jugerPose` == écriture
  `deplacerIntervention`) étendu pour confronter aussi `confirmable`, pas seulement `cle`.
  `tests/isolation/absence.test.ts`/`absences-2.test.ts`/`pose-habilitation.test.ts` rejoués
  sans changement (le nouveau champ de `schemaDeplacement` a un défaut).
- **Bout en bout**, `--workers=1` (CI applique déjà `workers: 1` — un faux rouge mesuré sous 4
  workers locaux sur `fiche-trouver-creneau.spec.ts`, un compteur de courriels capturés partagé
  entre specs parallèles, **non lié à ce lot** : vert en 1 worker, donc vert en CI) :
  - `tests/e2e/creation-jour-ferme.spec.ts` : refus confirmable inchangé (même clé, même texte
    étendu) + nouveau scénario confirmé (accepté, avertissement visible, intervention réellement
    planifiée en base).
  - `tests/e2e/glisser-deposer.spec.ts` : l'ancien scénario de refus devient une paire —
    Annuler (dialogue, rien n'est écrit, bloc à son origine) / Confirmé (accepté, même flux
    différé PG-B5 que l'autre scénario de ce fichier). Les sept autres scénarios du fichier
    (chevauchement, erreur serveur, connexion interrompue, redimensionnement…) rejoués sans
    changement — aucun n'implique une case `ferie`/fermée.
  - `tests/e2e/fiche-trouver-creneau.spec.ts` : le scénario « jour fermé, Planifier reste
    inactif » étendu — coche la confirmation, le bouton s'active, la pose aboutit avec
    l'avertissement visible sur la fiche. Les trois autres scénarios du fichier rejoués sans
    changement.
  - `tests/e2e/planning-survol-cases.spec.ts`, `captures-pg-b4-survol-cases.spec.ts` : rejoués
    sans changement (motif « absent », non concerné par D93).
  - **Captures neuves** (`tests/e2e/captures-9f3-pose-hors-ouverture-confirmee.spec.ts`,
    `CAPTURES_9F3=…`) : `fenetre-pose-confirmable-{375,1280}`, `fiche-confirmee-{375,1280}`
    (FenetrePose avertie + case, puis la mention de confirmation sur la fiche),
    `dialogue-confirmation-glisser-depose-1280` (le glisser-déposer n'a pas d'équivalent
    tactile — même réserve que PG-B4 — donc 1280 px seulement). **Pas de capture du survol
    orange** : la grille Semaine exige un défilement horizontal + un agrandissement temporaire
    de fenêtre pour atteindre une case éloignée sous la souris réelle (`tests/e2e/setup/glisser.ts`,
    `agrandirPourContenirLesDeux`) ; reproduire cette mécanique pour un survol SANS dépôt (donc
    sans passer par `glisser()`, qui relâche toujours la souris) n'a pas trouvé de solution dans
    le budget de ce lot — point ouvert ci-dessous.
  - Deux captures d'un AUTRE lot (`AVERT-POSE-FICHE`) régénérées par effet de bord en rejouant
    `fiche-trouver-creneau.spec.ts` — **restaurées** à leur état commité avant ce lot.

## Ce qui reste ouvert

- **Pas de capture du survol orange** « Hors ouverture — à confirmer » (voir ci-dessus) — le
  code est éprouvé (`motifConfirmable`, `classeDeSurvol`), juste pas capturé à l'écran.
- **Le pré-contrôle client du glisser-déposer (`cible.survol`) est un INDICE, pas une
  décision** — même réserve que `survol.ts` lui-même. S'il se trompe (faux négatif : la
  case paraît ouverte mais la pose exacte, à l'heure précise du créneau redimensionné, ne
  l'est pas), le dépôt se refuse normalement côté serveur — avec le texte invitant à
  « cocher la confirmation », qu'aucune case n'est présente pour cocher sur ce chemin
  (glisser-déposer direct, pas de formulaire). Mesuré non déclenché par aucun scénario de
  ce lot ; nommé plutôt que découvert en production.
- **Chaque re-soumission du même créneau hors ouverture redemande confirmation** — y compris
  un déplacement qui ne change QUE le technicien sur une ligne déjà confirmée hors ouverture :
  `jugerPose` rejuge le jour/l'heure à chaque appel, et `saisie.confirmer_hors_ouverture` est
  une saisie de CETTE requête, jamais un état qui survit. Comportement délibéré (la confirmation
  trace un geste, pas un état permanent) mais pas explicitement discuté avec Alexis.

## Fin de lot

`grep -rlE "goto\(.*/(planning|interventions)" tests/e2e` rejoué (fichiers listés ci-dessus) ;
`pnpm format` + `pnpm typecheck` + `pnpm lint` + `pnpm test` + `pnpm test:isolation` verts avant
chaque commit. `CI=1 pnpm verify:full` lancé en entier avant de rendre la main, sur HEAD
`889bb586` (point 5b) — **vert en entier** : format, typecheck, lint, test, test:isolation,
build, `feries:horizon`, `audit:partitions` tous verts, puis `test:e2e` complet (1444 scénarios,
`workers: 1`) :

```
  48 skipped
  1396 passed (54.6m)
```

Aucun échec. `git fetch origin` : `origin/main` toujours à `d87f0720`, la base de départ —
aucun rebase nécessaire. **Rejouer la suite e2e complète en local régénère, par effet de bord,
les captures PNG/PDF de 95+ autres lots** (chaque fichier `captures-*.spec.ts` écrit directement
dans son propre `docs/propositions/.../captures/`, sans garde d'environnement comme celle de ce
lot) — 220 fichiers suivis et 12 fichiers neufs, mesurés par `git status --porcelain` après coup,
tous **restaurés** à leur état commité avant ce lot (`git checkout --` sur les suivis, `rm` sur
les neufs) ; seuls les fichiers de `docs/propositions/9F3-POSE-HORS-OUVERTURE-CONFIRMEE/`
restent. Arbre propre avant ce commit.
