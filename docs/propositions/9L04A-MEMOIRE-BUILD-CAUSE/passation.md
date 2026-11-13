# 9L04A-MEMOIRE-BUILD-CAUSE — passation

Aucune migration. Aucun écran touché, aucune capture. Ce lot modifie uniquement `prisma/schema.prisma`
(annotations `@ignore`, zéro effet en base), `package.json` (plafond mémoire) et `docs/arbitrages.md` (D246
refermée).

## CE QUI ÉTAIT MESURÉ (D246, 9K30A)

`pnpm build` débordait (OOM, « Linting and checking validity of types ») au plafond de 6144 Mo posé par
9K28B. 9K30A avait déjà posé `@ignore` sur sa propre réciproque neuve (`Societe.checklistModeleTypes`) sans
que ça suffise, et avait conclu « par ACCUMULATION, pas par une réciproque identifiable à elle seule cette
fois » — sans chercher plus loin, et relevé le plafond à 7168 Mo en attendant.

## CE QUI A ÉTÉ MESURÉ ICI

**1. Reproduit d'abord.** `pnpm typecheck` à 7168 : vert, pic RSS 6,60 Go. `pnpm build` à 7168 : vert, pic RSS
6,64 Go. `pnpm build` à 6144 : OOM reproduit à l'identique (« Ineffective mark-compacts near heap limit »),
pic RSS 6,46 Go au moment du crash. `pnpm typecheck` seul PASSE à 6144 (6,35 Go) — la cause est spécifique à
l'étape combinée de `next build` (bundling + vérification des types dans le même process Node, qui porte la
mémoire du bundling en plus de celle du type-checking), pas au compilateur TypeScript nu.

**2. La cause : une accumulation, confirmée par un audit exhaustif, pas par une seule réciproque.** Un script
a recensé TOUT champ de relation Prisma à plusieurs (`Modele[]`) non marqué `@ignore`, dans tout le schéma
(119 champs). Pour chacun, deux vérifications : (a) grep sur tout le dépôt hors `schema.prisma` — le nom du
champ n'apparaît NULLE PART (ni `include`, ni `select`, ni accès direct) ; (b) une fois (a) confirmé,
compilation réelle après avoir posé `@ignore`, parce que (a) seul s'est révélé insuffisant trois fois (point
4 ci-dessous).

**TRENTE-QUATRE champs confirmés morts** (jamais navigués, chaque table se lisant toujours par sa propre
requête filtrée sur `societe_id`/`intervention_id` etc., jamais par la réciproque) :

- **Vingt-sept sur `Societe`** — le modèle le plus relié du schéma, importé partout, donc celui dont CHAQUE
  réciproque morte pèse le plus sur le type généré, répété à travers tout le dépôt :
  `trajets_par_zone`, `technicien_calendriers`, `compteurs_numerotation`, `documents_recus`, `import_lots`,
  `import_lot_lignes`, `utilisateur_societes`, `utilisateur_clients`, `perimetres_portail`,
  `techniciens_habilites`, `sites_habilitations`, `sessions_actives`, `familles_materiel`,
  `sous_types_materiel`, `modeles_materiel`, `taux_horaires`, `observations_vgp`, `campagnes_vgp`,
  `interventionPrestations`, `prestationTypesIntervention`, `interventionSignatures`,
  `notificationLectures`, `checklistVersions`, `checklistPoints`, `checklistReponses` (25 nommés ici), plus
  `checklistReponsePhotos` et `checklistModeleTypes` qui portaient déjà `@ignore` avant ce ticket (9K28B,
  9K30A) — 27 au total une fois ce ticket terminé.
- **Sept ailleurs** : `Devise.taux_horaires`, `Site.perimetres`, `Site.habilitations_requises`,
  `Machine.remplacantes` (auto-relation), `Intervention.checklist_reponses`, `Intervention.observations_vgp`,
  `FamilleMateriel.checklist_modeles`, `SousTypeMateriel.checklist_modeles`, `ModeleMateriel.checklist_modeles`
  (neuf, en comptant les trois `checklist_modeles`).

Chacune alourdit un peu le type Prisma généré pour son modèle ; aucune seule ne fait déborder `next build` —
exactement ce que 9K30A avait observé pour ses deux réciproques neuves, mais qui vaut en fait pour TOUTES
celles accumulées depuis des tickets bien antérieurs à 9K28B (certaines remontent au schéma d'origine).

**3. Aucun effet en base, vérifié par la base elle-même, pas seulement affirmé.** `prisma migrate diff
--from-schema-datamodel <origin/main> --to-schema-datamodel <ce schéma> --script` produit **une migration
vide**. `@ignore` est une annotation Prisma Client pure ; les clés étrangères réelles vivent sur le côté
« plusieurs » de chaque relation (`@relation(fields: [...], references: [...])`), jamais affecté.

**4. UN PIÈGE, mesuré trois fois — le grep seul ne suffit pas.** `@ignore` posé sur UN sens d'une relation à
double sens retire du client généré le PARTENAIRE de cette même relation (l'autre sens), même si CE
partenaire-là est réellement lu. Trois candidates sont tombées dans ce piège, détecté par la compilation
(jamais par le grep, qui les avait classées « sûres ») :

| Champ ignoré (jamais navigué) | Partenaire cassé (réellement lu) | Lecteur |
|---|---|---|
| `Prestation.realisations` | `InterventionPrestation.prestation` | `lib/interventions/depot-rapport-terrain.ts` |
| `FamilleMateriel.campagnes_vgp` | `VgpCampagne.famille` | `lib/vgp/campagne.ts` |
| `Intervention.suites_a_donner_reprise` | `SuiteADonner.intervention_reprise` | `lib/suite-a-donner/lecture.ts` |

Les trois ont été **laissées sans `@ignore`**, documentées sur place dans le schéma (chercher « PAS
`@ignore` » dans `prisma/schema.prisma`) pour que personne ne les re-propose sans relire ce piège. La règle
retenue : **vérifier le PARTENAIRE de la relation, jamais seulement le champ qu'on s'apprête à ignorer** — un
`@ignore` qui casse la compilation le dit immédiatement (erreur de type claire, jamais silencieuse), donc le
risque est détecté, pas caché ; mais il faut recompiler après CHAQUE lot de candidates, pas se fier au grep
seul.

**5. Mesuré après correctif, trois fois de suite.** `pnpm build` à 6144 : vert, pics RSS 6 184 580 / 6 177 716
/ 6 198 152 Ko (6,18-6,20 Go). `pnpm typecheck` à 6144 : vert. `CI=1 pnpm verify` complet (format, typecheck,
lint, 5771 tests unitaires, 2192 tests d'isolation, build) : vert. Plafond ramené de 7168 à 6144 Mo dans
`package.json` (`build` et `typecheck`, tenus au même plafond comme l'exige la méthode de 9K28B/9K30A).

## CE QUI N'A PAS ÉTÉ FAIT

Aucune réduction du client Prisma au-delà des `@ignore` (pas de scission en plusieurs clients, pas de
retrait de modèles). La question de fond que 9K30A avait laissée ouverte (« réduire la mémoire du schéma
généré, scinder le client Prisma, ou provisionner CI en conséquence ») n'est PAS tranchée en droit pour
l'avenir : rien n'empêche un futur ticket d'ajouter une réciproque non ignorée et de refaire déborder le
plafond. Ce qui est vrai AUJOURD'HUI : à schéma identique à `origin/main` plus ce ticket, le pipeline passe
à 6144 avec une marge mesurée (~100 Mo de RSS au-dessus du plafond nominal, qui n'alarme pas puisque RSS
inclut plus que le tas V8 old-space que `--max-old-space-size` borne).

## À SURVEILLER PAR QUI REPREND

Si un futur ticket ajoute une réciproque Prisma sur `Societe` (ou un autre modèle très relié) sans `@ignore`
et sans vérifier qu'elle est lue, c'est exactement le même défaut qui recommencera à s'accumuler. Avant
d'ajouter une relation Prisma à plusieurs, se poser la question : « ce champ sera-t-il navigué par
`include`/`select`, ou seulement sa table lue par sa propre requête filtrée ? » — si la réponse est la
seconde, poser `@ignore` directement, au lieu d'attendre qu'un futur ticket refasse cet audit.

## PORTÉE

`prisma/schema.prisma` (34 `@ignore` posés, documentés en commentaire sur chaque champ ou groupe de champs ;
trois candidates avivées à tort documentées « PAS `@ignore` » avec le motif), `package.json` (plafond mémoire
`build`/`typecheck`, 7168 → 6144), `docs/arbitrages.md` (D246, section « REFERMÉ PAR 9L04A »), ce document.
