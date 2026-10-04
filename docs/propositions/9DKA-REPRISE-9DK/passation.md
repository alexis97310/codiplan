# 9DKA-REPRISE-9DK — passation

## Ce que j'ai changé

Rejoué les 9 commits de la branche locale `9DK-PG-G15A-ABSENCE-ECOURTER-garde`
sur `origin/main` à jour (`git cherry-pick`), puis rebasé une seconde fois en
fin de session sur `origin/main` qui avait avancé pendant la session
(`9DJB-REPRISE-9DJ` y est arrivé en cours de route). Un seul conflit à chaque
étape, tous deux additifs (deux tests/commentaires ajoutés au même endroit par
deux lots différents) — gardés tous les deux, jamais tranchés au sens d'une
décision :

- `tests/unit/auth/habilitations.test.ts` : deux `it()` neufs voisins (D151 et
  TR-5), gardés tous les deux.
- `tests/unit/auth/porte.test.ts` : le compte des routes gardées (9DJ ajoute
  une route, 9DK en ajoute une autre) — passé de 70 à 71 pour compter les
  DEUX.

Au-delà du rejeu, deux défauts RÉELS causés par ce lot ont été trouvés par
`pnpm test:e2e` en entier (870 scénarios — la session précédente n'avait rejoué
qu'un sous-ensemble après son propre rebase) et corrigés sans affaiblir aucune
assertion :

1. **`tests/e2e/planning-cibles-375.spec.ts`** (étranger au lot, 99F-CIBLES-375)
   — scopé à `main` pour viser le lien du contenu plutôt que la barre latérale,
   maintenant homonymes depuis que D136 renomme `absences.titre` en
   « Absences ».
2. **L'excès du ○ du technicien sur `modifier_planning`** (TR-5/D136), qui
   devait s'ouvrir sur la SEULE route `declarer` et s'ouvrait en réalité
   partout où `modifier_planning` est lu — `peutModifierLePlanning`
   (`app/(back-office)/interventions/[id]/page.tsx`) passe de `peut()` à
   `peutPleinement()` ; les routes `app/api/interventions/[id]/{transmettre,
   deplacer,verdict-pose,note-interne}/route.ts` et
   `app/api/interventions/transmettre/route.ts` passent de `exigerCapacite` à
   `exigerCapaciteComplete`. Trois mocks unitaires complétés en conséquence
   (`exigerCapaciteComplete` manquait de leur `vi.mock`).

Pour l'exploitation : avant cette reprise, un technicien pouvait — par une
requête forgée, pas par l'écran, qui refusait déjà visuellement l'essentiel —
transmettre, déplacer ou lire le verdict de pose de N'IMPORTE QUELLE
intervention de sa société, pas seulement la sienne. C'est fermé. Rien ne
change pour les autres rôles (déjà au ● sur `modifier_planning`, donc déjà
`peutPleinement` = vrai).

## Ce que j'ai mesuré

- `pnpm verify` (format:check + typecheck + lint + test + test:isolation +
  build) : vert, deux fois — une fois après le premier rejeu, une seconde
  après le rebase final.
- `pnpm test` (unitaires) : 373 fichiers, 3974 tests, verts.
- `pnpm test:isolation` : 153 fichiers, 1395 tests, verts.
- `pnpm feries:horizon` et `pnpm audit:partitions` : verts.
- `pnpm test:e2e`, la suite COMPLÈTE : 870 scénarios, **863 passés, 7 skippés,
  0 échec**. AVANT correction : 3 échecs reproduits deux fois chacun
  (`planning-cibles-375.spec.ts`, `intervention-technicien-select.spec.ts`,
  et un troisième, `planning-survol-cases.spec.ts`, qui s'est révélé être le
  piège connu du lot — compte faussé par l'exécution en parallèle d'autres
  fichiers — et qui repasse au vert seul, sans aucune correction, dès qu'il
  n'est plus mélangé à d'autres fichiers dans la même commande).
- Vérifié par une comparaison A/B (checkout détaché d'`origin/main` pur,
  `.next` effacé entre les deux) que les deux rouges retenus n'existent PAS
  sur `origin/main` sans les commits de ce lot : la cause est bien ce lot, pas
  un défaut préexistant ni un effet du rebase concurrent de `9DJB-REPRISE-9DJ`.
- Aucune capture à régénérer pour 9DK lui-même : aucun fichier sous
  `docs/propositions/9DK-PG-G15A-ABSENCE-ECOURTER/captures/` n'a changé (les
  corrections touchent `interventions/[id]`, pas les écrans absences/planning
  que 9DK a capturés). Les captures d'AUTRES tickets, régénérées comme effet
  de bord de chaque exécution de `test:e2e` (non-déterminisme de rendu),
  n'ont pas été commitées — restaurées à chaque fois (`git restore` /
  `git clean`).

## Ce que j'ai tranché, et pourquoi

**Corriger le serveur, pas seulement l'écran.** La piste la plus étroite pour
faire repasser `intervention-technicien-select.spec.ts` au vert était de ne
toucher que `peutModifierLePlanning` dans `page.tsx`. Je ne m'y suis pas
arrêté : cette page dit elle-même, en commentaire (ligne ~268), que sa lecture
de capacité est volontairement la MÊME que celle de la route serveur
correspondante — « jamais une comparaison de rôle inventée ici ». Ne corriger
que l'écran aurait recréé exactement l'écart que ce commentaire interdit, dans
le sens le plus dangereux : l'écran aurait refusé, le serveur aurait accepté
une requête forgée. Les cinq routes listées ci-dessus sont donc passées à
`exigerCapaciteComplete`, en m'appuyant sur le texte de D136 lui-même
(« la porte applicative laisse donc passer le ○ sur la seule route
`declarer` ») : ce n'est pas une décision nouvelle, c'est la correction d'une
implémentation qui contredisait une décision déjà écrite.

**Ne pas toucher `app/api/absences/declarer/route.ts`.** C'est la seule route
que D136/TR-5 nomme explicitement comme devant laisser passer le ○ — elle garde
`exigerCapacite` simple, intacte.

**Ne pas élargir `PORTE_COMPLETE` dans `tests/unit/auth/porte.test.ts`.** Ce
tableau est fermé sur un périmètre différent (D153/TP-S3, le ○ de la
DIRECTION sur treize routes de paramétrage) — les routes `absences/{ecourter,
lever}` que 9DK avait déjà basculées sur `exigerCapaciteComplete` n'y figurent
pas non plus. Les cinq routes de cette reprise suivent le même précédent.

**Le conflit du compte de routes (70 → 71), pas une décision.** Les deux lots
(9DJ et 9DK) ajoutaient chacun une route gardée au même commentaire ; les deux
existent après le rebase, donc le compte est la somme des deux, pas un choix
entre elles.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix — conforme à l'interdit.
- Aucune nouvelle fonctionnalité : les cinq routes et la lecture de page
  existaient déjà, seule la PORTE qu'elles appellent a changé.
- Pas de troisième catégorie de capacité ni de nouvelle clé i18n.
- Je n'ai pas cherché d'autres lectures de `peut(role, "modifier_planning")`
  au-delà de celle qui causait le rouge observé et des cinq routes qui
  partagent son commentaire de conception explicite ; une recherche plus
  large (`grep -rn 'modifier_planning'`) n'a rien trouvé d'autre dans
  `app/`, mais je ne l'ai vérifiée qu'une fois, pas rejouée après chaque
  changement.

## Les pièges pour la session suivante

- **La suite `test:e2e` complète prend ~35 minutes et coupe à 30 min sous
  `timeout` shell** — lancer la commande via le paramètre `timeout` du propre
  outil Bash (jusqu'à 60 min) plutôt que `timeout` shell, ou accepter de la
  rejouer en deux morceaux.
- **`origin/main` peut avancer PENDANT la session** (ce fut le cas ici :
  `9DJB-REPRISE-9DJ` est arrivé après mon premier `git fetch`). Un
  `git checkout origin/main --detach` fait AUTOMATIQUEMENT atterrir sur la
  nouvelle pointe si elle a bougé entre deux commandes — ne pas supposer
  qu'un `origin/main` déjà vérifié une fois reste la même référence toute la
  session ; refaire `git rev-parse origin/main` avant toute comparaison A/B.
- **Une épreuve qui compte « large » peut sembler causée par le lot alors
  qu'elle ne l'est pas** : `planning-survol-cases.spec.ts` a rougi deux fois
  dans la suite complète (parallèle à d'autres fichiers) et JAMAIS seule —
  isoler l'épreuve avant de conclure.
- **`absences.titre` vaut maintenant « Absences »**, identique au libellé de
  l'entrée de navigation `nav.absences` (clé différente, même texte). Tout
  nouveau `getByRole("link"/"heading", { name: fr["absences.titre"] })` non
  scopé à `main` ou à un conteneur précis risque la même violation de mode
  strict que celle corrigée ici.
- **`exigerCapacite("modifier_planning")` laisse maintenant passer le
  technicien.** Toute route FUTURE qui lit cette capacité pour une action qui
  ne doit viser QUE l'auteur (comme `declarer`) doit le dire explicitement
  dans son commentaire, comme le font maintenant `deplacer`, `transmettre`
  (×2), `note-interne` et `verdict-pose`.

## Ce qui reste à faire

- Rien d'identifié au-delà de la liste ci-dessus. Le lot 9DK lui-même reste
  tel que sa propre passation l'a laissé (demi-journée/plage horaire hors
  périmètre, trois précisions du pilote à valider par Alexis).
