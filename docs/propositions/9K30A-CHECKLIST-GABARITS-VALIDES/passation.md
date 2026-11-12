# 9K30A-CHECKLIST-GABARITS-VALIDES — passation

Reprise de 9K30 (arrêté le 12/11/2026 à 16h23, sans committer, sur une question de forme —
`traces/9K30-CHECKLIST-GABARITS-VALIDES.txt`). Réponse d'Alexis le 12/11/2026 ~17h10 : **« Table de
liaison »**. Écrite en entier : `docs/arbitrages.md` D246.

## MIGRATION À JOUER par Alexis : staging puis DB migrate & seed, puis Vercel

**`20261112200000_checklist_modele_types_intervention_9k30a`** — une seule migration neuve. Elle
AJOUTE la table `checklist_modele_type_intervention` (RLS, verrou portail écriture, déclencheur
d'audit), REPREND les données de `checklist_modele.type_intervention` (une valeur non nulle devient
une ligne ; `NULL` n'en devient aucune), puis SUPPRIME cette colonne. Elle ne modifie aucune
migration déjà appliquée.

## Ce que ce ticket fait

1. **La table de liaison** (`prisma/schema.prisma`, `ChecklistModeleTypeIntervention`) — forme
   « filiation » (D103) chaînée sur `checklist_modele` (forme « interne », D94), sur le modèle EXACT
   de `prestation_type_intervention` (D243, 9K29). **VIDE = proposé pour TOUS les types**, même sens
   que l'ancien `NULL`. Porte aussi le verrou d'écriture du portail (I3, D237, 9K16) — voir le point
   4 ci-dessous, une mesure qui a corrigé une première lecture trop rapide.

2. **La cascade** (`lib/checklists/cascade.ts`) — `CandidatGabarit.typesIntervention: readonly
   TypeIntervention[]` remplace le scalaire nullable. Le filtre de nature devient `types.length ===
   0 || types.includes(nature)`. Les cinq niveaux et le tri par `code` à égalité (D239) sont
   INCHANGÉS : le filtre de nature reste à part des quatre niveaux de rattachement matériel, sur une
   liste plutôt qu'un scalaire.

3. **Le dépôt et l'écran de paramétrage** (`lib/checklists/depot.ts`, `saisie.ts`,
   `app/(back-office)/parametres/checklists/page.tsx`) — `creerModele` écrit les types par un
   `createMany` SÉPARÉ, jamais nesté sous `checklistModele.create` (Prisma refuse `societe_id` en
   argument nesté quand la relation le porte déjà). L'écran propose des cases à cocher (neuf types),
   partagées par création, duplication et « Partir d'un gabarit de départ » ; la liste et la fiche
   affichent les types cochés, ou « Toutes » si vide.

4. **Vingt-six gabarits de départ** (`lib/checklists/gabarits-de-depart.ts`), recopiés TEL QUEL
   depuis `gabarits-valides-11-11.md` (hors dépôt) — voir « Écart de compte » ci-dessous. Chacun
   porte des `typesSuggeres` et un `rattachementSuggere` EN TEXTE (jamais un identifiant). Le volet
   « Partir d'un gabarit de départ » (`volet-partir-gabarit.tsx`, extrait en composant client POUR
   CETTE SEULE raison : précocher/rafraîchir sans recharger la page quand le gabarit change) précoche
   les cases suggérées et affiche le texte de rattachement ; les cases restent modifiables. `G01`
   (pont 2 colonnes électromécanique, 9K20) garde ses quinze points inchangés.

5. **Le semis de démonstration** (`prisma/seed.ts`) gagne dix modèles supplémentaires (un couple
   entretien/installation pour chacun des cinq sous-types de démonstration qui n'en avaient pas
   encore) — jamais joué en production.

6. **Épreuves** — unitaires (`tests/unit/checklists/{gabarits-de-depart,saisie,cascade}.test.ts`),
   isolation (`tests/isolation/{checklist-parametrage,checklist-domaine}.test.ts` — écriture/lecture
   de la liste, cloisonnement société B, cascade à deux types ET à un seul type face à une autre
   nature), e2e (`tests/e2e/9k30a-checklist-gabarits-valides.spec.ts` — gabarit d'installation
   précochant « Installation », rattachement suggéré affiché, case modifiable, 21 points, captures
   1280/375).

## MESURÉ EN COURS DE ROUTE — deux corrections qui ont changé le plan initial

**1. Le verrou de portail est NÉCESSAIRE même chaîné sur un parent « interne ».** Une première
version de la migration s'appuyait sur le raisonnement de `checklist_version`/`checklist_point`
(9K08) : chaînées sur `checklist_modele`, « interne », elles n'ajoutent aucun verrou propre, la
politique du parent fermant déjà la lecture sous un rôle client. `pnpm test:isolation` l'a démenti :
le gardien `tests/isolation/politiques-rls.test.ts` exige le verrou d'ÉCRITURE (trois politiques
`AS RESTRICTIVE`) sur TOUTE table de la première catégorie de I1 qui n'est pas nommément exemptée —
y compris `checklist_version`/`checklist_point` elles-mêmes, qui le reçoivent en réalité depuis 9K16
(`20261110120000_portail_securite_base_9k16`, une boucle `DO` sur une liste de noms — invisible à la
lecture de la seule migration 9K08). Les trois politiques ont été ajoutées, recopiées verbatim de
`prestation_type_intervention` (9K29). Voir D246, point 2.

**2. `pnpm build` déborde du plafond mémoire posé par 9K28B — relevé, signalé comme ressource
partagée.** `ChecklistModeleTypeIntervention` fait déborder `next build` (OOM, « Linting and
checking validity of types ») au plafond de 6144 Mo que 9K28B avait posé le jour même, déjà à sa
propre limite mesurée. `Societe.checklistModeleTypes` porte `@ignore` (même motif que
`checklistReponsePhotos`, 9K28B : jamais navigué) — **et le dépassement persiste malgré ce
`@ignore`**, par accumulation plutôt que par une réciproque identifiable à elle seule cette fois.
Relevé à 7168 Mo (`build` ET `typecheck`, tenus au même plafond comme le veut la méthode de 9K28B),
vérifié stable sur quatre `next build` consécutifs et deux exécutions complètes de la suite e2e.

**Point d'arrêt signalé, pas tranché ici** (voir D246, dernière section) : ce plafond est désormais
une ressource PARTAGÉE entre tickets — chaque ticket qui ajoute au schéma le rapproche de la limite
suivante, et la mémoire réellement provisionnée en CI n'est pas connue d'ici. Deux options, pour
Alexis :
- **(a)** Continuer à relever le plafond au coup par coup, comme ce ticket et 9K28B l'ont fait —
  simple, mais sans fin visible : le schéma ne cesse de grossir.
- **(b)** Réduire la mémoire du schéma généré (auditer systématiquement les réciproques `@ignore`-
  ables, ou scinder le client Prisma), ou provisionner CI en conséquence — plus de travail
  maintenant, mais répond à la cause plutôt qu'au symptôme.

## `CI=1 pnpm verify` — jouée au complet, vert

`format:check`, `typecheck`, `lint`, `test` (5765 passés), `test:isolation` (2171 passés) et `build`
(plafond 7168 Mo) : vert de bout en bout, une fois après le dernier correctif.

## Écart de compte entre le ticket et la source — signalé, pas forcé

Le ticket parlait de « 24 gabarits nouveaux ». La source (`gabarits-valides-11-11.md`) porte
QUATORZE codes d'entretien (G00 à G13, comptés avec `grep -oE '^### [GI][0-9]+'`) et DOUZE
d'installation (I00 à I11) — vingt-six au total, vingt-cinq nouveaux une fois `G01` ôté. L'instruction
du ticket étant de recopier la source TEL QUEL, ce compte a primé sur le chiffre « 24 » de la prose
du ticket. Voir D246.

## NON FAIT — budget de temps, signalé plutôt que bâclé

- **`scripts/captures.mts` (la prise de vue globale, `docs/captures/README.md`) n'a PAS été
  rejouée.** La procédure exige une base jetable sur un port distinct (5433), un premier accès par
  lien de courriel pour choisir un mot de passe, et un second compte multi-société — un montage
  d'environnement distinct de celui déjà en place pour `pnpm test:e2e`. Plutôt que de le monter dans
  la dernière fraction du budget de temps et risquer un état cassé, ce point reste DÛ. Les captures
  PAR TICKET (`docs/propositions/9K30A-CHECKLIST-GABARITS-VALIDES/captures/`, prises par l'épreuve
  e2e de ce lot — volet gabarit avec une installation choisie, 1280 et 375 px) sont, elles, à jour ;
  les captures 9K19/9K20 (`docs/propositions/{9K19-CHECKLIST-PARAMETRAGE,9K20-CHECKLIST-DUPLIQUER-
  DEPART}/captures/`), dont l'écran a changé (colonne « Types », cases à cocher), ont été
  régénérées en rejouant leurs épreuves existantes et sont commitées.
- **Captures « liste des modèles » et « création d'un modèle d'installation » hors du flux
  gabarit** (ex. via « Ajouter un modèle » avec les cases cochées à la main) : non prises
  séparément — la colonne « Types » de la liste est visible sur les captures 9K19 régénérées
  ci-dessus, mais aucune capture dédiée au flux « Créer un modèle » avec des cases cochées
  manuellement n'existe.
- **Relecture du gardien `getByText`/`getByRole` non exacts sur « Type »/« gabarit »** dans
  `tests/e2e/**` (consigne permanente) : non faite au-delà du fichier neuf de ce ticket, qui
  utilise déjà des correspondances exactes partout (clés du dictionnaire).

## Portée (fichiers touchés)

Voir `docs/arbitrages.md` D246, section « Portée ».
