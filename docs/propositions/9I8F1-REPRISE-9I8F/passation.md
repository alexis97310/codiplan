# 9I8F1-REPRISE-9I8F — passation

*Revue de 9I8F (solde 619) avant le gel de la démo. Décision d'Alexis du 01/11/2026 ~18:45 :
« Avant le gel ». Trois trous mesurés sur `origin/main` 329fa6f8 (pilote + revue) : une
réactivation silencieuse d'une machine sortie ou fusionnée, une confirmation de sortie du parc
jamais vérifiée côté serveur, `gerer_machine` contournable depuis une demande ou une
intervention.*

`main` était extrait dans un autre worktree (`/home/aplou/codiplan`) au début de cette session :
le travail a été fait sur une branche dédiée `9I8F1-REPRISE-9I8F`, partant d'`origin/main`
(confondu avec `HEAD` au démarrage de ce worktree).

## Ce que j'ai fait (points 1 et 2 — la garde serveur)

- **`lib/machines/garde-statut.ts`** (nouveau) — la garde, en un seul module, sans import de
  `lib/machines/depot.ts` ni de `lib/interventions/depot.ts` : ce module importe déjà
  `STATUTS_INTERVENTION_FERMES` de l'autre, et l'importer en retour aurait fermé le cycle (c'est
  la raison déjà écrite dans la note de tête de `creerIntervention` pour ne pas appeler
  `changerStatutMachineDans` directement).
  - `decisionDepuisLaFiche` — l'écran autonome : une machine `fusionnee` refuse TOUT changement
    (motif nommé `fusionnee`) ; une sortie du parc OU un retour vers un statut actif sans
    `confirmationSortieDuParc` refuse (`sortie_sans_confirmation`) — les deux sens, pas seulement
    la sortie comme le faisait 9I8F.
  - `decisionDepuisUnFormulaireDeCreation` — un formulaire de demande ou d'intervention : une
    valeur qui ne correspond pas au statut COURANT de la machine est IGNORÉE (aucune écriture),
    jamais un refus de toute la création.
  - `resoudreEtatMachineDuFormulaire` — combine capacité (`gerer_machine` EN PLEIN,
    `peutPleinement`) + périmètre QT-2 (`perimetreParcDuTechnicien`, même garde que
    `changerStatutMachine`) PUIS la décision de valeur ci-dessus ; un refus de capacité ou de
    périmètre, SI le champ est renseigné, est un refus nommé de toute la création.
- **`lib/machines/depot.ts`** (`changerStatutMachine`) — relit le statut courant SOUS la
  restriction QT-2 (au lieu de juste vérifier son existence), applique `decisionDepuisLaFiche`
  avant d'écrire. `MotifRefusMachine` porte désormais `fusionnee` et
  `sortie_sans_confirmation`. Signature changée : un quatrième paramètre
  `confirmationSortieDuParc: boolean` avant `client?`.
- **`app/api/machines/[id]/changer-statut/route.ts`** — lit le champ `confirmation` du
  formulaire (`champ()` rend `null` pour une chaîne vide, donc une absence et une chaîne vide
  sont le MÊME refus).
- **`components/machines/changer-statut.tsx`** — un champ caché `confirmation`, dont la valeur
  reflète `optionChoisie?.confirmation` : la seule voie de soumission quand une confirmation est
  requise reste le dialogue (`BoutonAvecConfirmation`, hors territoire, non modifié).
- **`app/(back-office)/parc/presentation.ts`** (`optionsChangerStatutMachine`) — prend
  désormais `statutActuel` en paramètre : la confirmation est exigée dans LES DEUX SENS (sortir,
  revenir), calculée par une différence de camp (`SORTIES_DU_PARC.has(cible) !==
  SORTIES_DU_PARC.has(actuel)`).
- **Capacité et périmètre, dans `lib/demandes/depot.ts` (`deposerDemande`) et
  `lib/interventions/depot.ts` (`creerIntervention`)** — la garde est jugée AVANT la création
  (`tx.demande.create`/`tx.intervention.create`), jamais après : `avecContexteApplicatif` commit
  un retour normal même s'il porte `accepte: false`, donc un refus jugé APRÈS l'écriture
  committerait quand même la fiche. `lib/interventions/depot.ts` écrit toujours directement sur
  `tx.machine` (pas `changerStatutMachineDans`), pour la raison de cycle déjà écrite dans son
  commentaire — seule la DÉCISION vient maintenant de la garde partagée.

## Ce que j'ai fait (point 3 — les écrans)

- **`lib/machines/saisie.ts`** (`etatMachineEstProposable`) — LE calcul partagé, « ce champ se
  propose-t-il ? », repris par `components/demandes/champs-nouvelle-demande.tsx`,
  `components/interventions/site-et-machines.tsx` et la tuile Machine de
  `app/(back-office)/interventions/[id]/page.tsx`. Repris aussi PAR LA GARDE SERVEUR
  (`decisionDepuisUnFormulaireDeCreation`) : un seul calcul, pas deux lectures du même critère qui
  pourraient diverger (§9, 01/09).
- Les trois écrans : une machine sortie ou fusionnée affiche son état en lecture (un lien vers la
  fiche machine pour la tuile) au lieu du `<select>` — rien n'est posté.

## Ce que j'ai éprouvé (point 4)

- **Pur** (`tests/unit/machines/garde-statut.test.ts`) — les deux fonctions de décision, dans
  tous les sens (fusionnee, sortie, retour, entre deux sorties, entre deux statuts actifs,
  création ignorée/appliquée), et la mécanique de capacité (`peutPleinement(Role.client,
  "gerer_machine")` est `false` — c'est CE rôle, et lui seul, que le point 2 doit intercepter).
- **Sur la vraie base** (`tests/isolation/`) :
  - `changer-statut-machine.test.ts`, étendu : sortie sans confirmation refusée, avec
    confirmation acceptée, retour exigeant lui aussi une confirmation, et une machine fusionnée
    refusant tout changement — même avec confirmation. `MACHINE_B1` est mutée puis restaurée à
    chaque épreuve (`fileParallelism: false` sur ce projet, cette fixture est sûre à muter).
  - `9i8f1-reprise-9i8f-garde-creation.test.ts` (nouveau) — `resoudreEtatMachineDuFormulaire`
    APPELÉE TELLE QUELLE (pas via la route HTTP complète), sous le contexte applicatif réel :
    `MACHINE_A1` remplacée ou fusionnée ignore un `en_service` forgé ; un technicien hors
    périmètre QT-2 (`MACHINE_A2`) est refusé.

### Ce que je n'ai PAS fait, par manque de temps (budget 110 min)

- **Aucune épreuve de bout en bout nouvelle** pour le point 4 (le scénario « machine sortie
  choisie dans la nouvelle demande → aucun champ, état en lecture » reste à écrire dans
  `tests/e2e/9i8f-statut-machine-modifiable.spec.ts`, qui porte déjà une fixture dédiée
  réutilisable).
- **Aucune capture** (point 5) — ni AVANT/APRÈS, ni aux deux viewports.
- Je n'ai PAS testé `deposerDemande`/`creerIntervention` de bout en bout avec une VRAIE création
  de demande/intervention sur une machine sortie (fixtures site/agence/calendrier plus coûteuses
  à poser correctement dans le temps restant) — seule `resoudreEtatMachineDuFormulaire`,
  directement, est éprouvée contre la vraie base pour ce chemin. La fonction est la MÊME que
  celle appelée par les deux dépôts (pas une variante écrite pour l'épreuve), donc le risque
  résiduel est surtout dans le CÂBLAGE (l'ordre des appels avant/après la création), relu à la
  main dans `lib/demandes/depot.ts` et `lib/interventions/depot.ts`.

## Point 6 — le registre

`docs/arbitrages.md`, D227 complété : les trois trous mesurés, la garde qui les ferme, la
capacité, et les écarts ci-dessus nommés plutôt que cachés.

## Pour la suite

1. Écrire l'épreuve e2e manquante et les captures (point 5), dans
   `tests/e2e/9i8f-statut-machine-modifiable.spec.ts` — la fixture `9I8F-` y est déjà posée et
   nettoyée (`beforeAll`/`afterAll`), il suffit d'y ajouter un cas qui pose `statut = 'remplacee'`
   avant d'ouvrir `/demandes?nouvelle=1`.
2. Envisager une épreuve `deposerDemande`/`creerIntervention` de bout en bout (pas seulement la
   garde) sur une machine sortie, si le temps le permet — modèle : `tests/isolation/demande.test.ts`
   pour `deposerDemande` (SITE_A1_S1/CLIENT_A1 a déjà un calendrier/agence qui fonctionne).
