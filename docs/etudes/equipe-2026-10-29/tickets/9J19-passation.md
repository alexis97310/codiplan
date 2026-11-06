# 9J19-SUITE-A-DONNER-NOTIFICATIONS — passation

Budget : T0 01:09 (Pacific/Noumea), limite 140 min. Terminé à T0+45, sans code neuf après.

## Prérequis vérifiés

`git log origin/main` contenait bien `9J09-NOTIFICATIONS-SCHEMA` et
`9J17-SUITE-A-DONNER-SCHEMA` avant tout code.

## Point par point

1. **Migration** (`20261107010000_suite_a_donner_notifications_9j19`) —
   `Notification.suite_a_donner_id` (troisième cible disjointe,
   `num_nonnulls` passé à trois colonnes), `Societe.delai_relance_suite_jours`
   (nullable, sans défaut, CHECK `> 0`), et `suite_a_donner` gagne
   `UNIQUE(societe_id, id)` pour porter la clé étrangère composite. Trois
   valeurs ajoutées à `EvenementNotification` (FLX-2/3/8).
2. **FLX-2/FLX-3** — `devisEnRetard`/`accordAttenduEnRetard`
   (`lib/suite-a-donner/depot.ts`) : lectures calculées, même patron que
   `enRetard` (`lib/interventions/retard.ts`), jamais une tâche planifiée.
   Si `delai_relance_suite_jours` est nul, rendent `[]` sans rien poser — une
   absence de réglage n'est pas un réglage à zéro jour (CLAUDE.md §8). Sinon,
   comparent en JOUR CIVIL dans le fuseau de la société (L0-08) et posent, au
   plus une fois par dossier et par événement, une notification
   `consulter_parc_complet`.
   - **`accord_attendu_en_retard` se compte depuis `modifie_le`, pas une
     colonne dédiée** : `suite_a_donner` ne porte aucune date d'entrée dans
     `accord_attendu` (la transition `qualifiee` → `accord_attendu`
     elle-même reste hors territoire, comme en 9J17). C'est un choix
     d'implémentation documenté dans le code, pas une règle métier inventée
     — à relire si un jour une colonne dédiée est jugée nécessaire.
3. **FLX-8** — `marquerPieceRecue` pose en plus sa notification
   `piece_recue`, DANS LA MÊME TRANSACTION que le passage à
   `a_replanifier` (écrite directement sur `tx`, jamais via
   `poserNotification`, qui ouvrirait sa propre transaction — même choix que
   `creerReprise` documente déjà pour la même raison).
4. **Aucun écran n'appelle ces quatre fonctions** — ni `devisEnRetard`/
   `accordAttenduEnRetard` (neuves), ni `enregistrerAccord`/
   `marquerPieceRecue` (déjà exemptées depuis 9J17). Le territoire de ce
   ticket est le MÉCANISME, pas l'écran qui le visite ; exemptions à jour
   dans `scripts/lib/chemins-de-depot.ts`.
5. **Le réglage** — `lireDelaiRelanceSuite`/`enregistrerDelaiRelanceSuite`
   (`lib/societes/identite.ts`, même doctrine que les réglages voisins) ; une
   carte de plus sur `/parametres/societe`, champ vide = NULL (jamais zéro) ;
   route `POST /api/parametres/societe/delai-relance-suite`, même garde
   (`parametrer_societe`) que les routes sœurs.

## Écart signalé plutôt que suivi aveuglément

Le ticket demandait une épreuve « notification lue par les bons rôles, pas
par un `responsable_sav` qui n'a pas la capacité ». **Mesuré faux** : la
matrice actuelle (`lib/auth/habilitations.ts`) place `responsable_sav` au ●
de `consulter_parc_complet`, au même niveau qu'ADV et responsable_materiel.
Le rôle réellement sans AUCUN niveau sur cette capacité est `admin_plateforme`
(et les deux autres rôles éditeur) — rôle de portée PLATEFORME (D37), jamais
lié à une société. C'est lui que les épreuves de
`tests/isolation/suite-a-donner-notifications.test.ts` utilisent comme témoin
négatif, avec le motif écrit dans le fichier. Pas un point d'arrêt (§8) : un
détail de rédaction d'épreuve, pas une règle du chapitre 10.

## Gardiens touchés en chemin

- `lib/db/migrations-attendues.ts` — la migration neuve ajoutée à la liste.
- `tests/unit/auth/porte.test.ts` — la route neuve dans `ROUTE_CAPACITE`/
  `PORTE_COMPLETE` (compte de routes 98 → 99).
- `scripts/lib/chemins-de-depot.ts` — `devisEnRetard`/`accordAttenduEnRetard`
  entrent dans `FONCTIONS_SANS_CHEMIN` (neuves, sans appelant) ; motif de
  `marquerPieceRecue` mis à jour (pose désormais sa notification, toujours
  sans déclencheur de production).
- `tests/isolation/suite-a-donner.test.ts` et
  `tests/isolation/suite-a-donner-reprise.test.ts` — leur nettoyage de
  `suite_a_donner` après `marquerPieceRecue` effaçait la ligne SANS effacer
  la notification neuve d'abord (clé étrangère RESTRICT) : la suppression
  échouait et laissait une intervention orpheline, qui polluait ensuite
  `intervention.test.ts` et `planning-du-technicien.test.ts` (comptes exacts
  d'interventions de la société) — mesuré en jouant `pnpm test:isolation` en
  entier, corrigé, rejoué vert.
- `tests/isolation/fixtures/base-agee/` — nouvelle amorce pour l'index unique
  de `suite_a_donner` (`migrations-sur-base-agee.test.ts`) ; `notification`
  n'en avait pas besoin, déjà couverte par l'amorce de 9J10A qui vieillit
  encore à ce point de l'histoire.

## Non touché, par choix de territoire

`app/(back-office)/notifications/presentation.ts` (`LIBELLES_EVENEMENT`) ne
gagne PAS les trois libellés des événements neufs — même séquence que 9J09
(schéma) → 9J10 (écran) : le mécanisme précède l'écran qui l'habille, jamais
l'inverse. Tant qu'aucune entrée n'existe, `/notifications` affiche le nom
technique brut pour ces trois événements (filet déjà prévu par ce fichier). À
faire au ticket qui ouvre l'écran des relances.

## Vérification jouée

`CI=1 pnpm verify` vert (format:check, typecheck, lint, test — 5533 —,
test:isolation — 1928 —, build). `pnpm test:isolation` et `pnpm test` rejoués
plusieurs fois en entier pendant le ticket. E2E ciblés joués au premier plan
puisque `/parametres/societe` gagne une carte : `9ez-logo-societe.spec.ts` et
`captures-9i8-affichage-des-montants.spec.ts` (19/19), et
`tous-les-ecrans-rendent.spec.ts` (59 passed, 3 skipped, sans rapport). Les
captures PNG de `docs/propositions/9I8-AFFICHAGE-DES-MONTANTS/captures/`
régénérées par ce dernier passage ont été rejetées (`git checkout --`) : pixel
diffs d'un ticket qui n'est pas celui-ci. `verify:full` laissé à la file,
comme demandé.

## Ce qui reste à faire (prochain ticket, déjà nommé par le territoire)

1. L'écran qui visite `devisEnRetard`/`accordAttenduEnRetard` à l'ouverture
   (l'onglet « Suites à donner », ou un futur tableau de bord des relances) —
   sans lui, le mécanisme existe mais personne ne l'appelle en production.
2. Les libellés `notifications.evenement.*` des trois événements neufs,
   quand cet écran existera (même séquence que 9J09 → 9J10).
3. La transition `qualifiee` → `accord_attendu` elle-même (FLX-3, toujours
   hors territoire depuis 9J17) — et, avec elle, la question de savoir si
   `accord_attendu_en_retard` doit alors migrer vers une colonne dédiée
   plutôt que `modifie_le`.
