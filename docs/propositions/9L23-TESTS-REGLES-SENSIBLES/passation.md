# 9L23-TESTS-REGLES-SENSIBLES — passation

Quatre points, tous des tests seulement : aucun écran, aucune migration, aucun test existant assoupli.

## Point 1 — l'annulation

Nouveau fichier `tests/isolation/annulation.test.ts`. Quatre propriétés, éprouvées par la route
(`app/api/interventions/[id]/annuler/route.ts`) plutôt que par le seul dépôt, pour que la porte et le
cycle de vie en base soient tous deux réellement traversés :

- un motif vide est refusé, la ligne reste inchangée ;
- une intervention clôturée (figée) ne s'annule pas ;
- une intervention d'une **autre société** n'est ni lue ni modifiée (même refus qu'un identifiant
  inconnu) ;
- une annulation acceptée écrit une ligne dans `journal_audit`, avec l'auteur et le statut avant/après.

La porte (`exigerCapacite`) est fabriquée pour le rôle qui porte la capacité, même patron que
`tests/isolation/droits-import-par-type.test.ts`. `annulerIntervention` (`lib/interventions/depot.ts`)
ne reçoit aucun client Prisma de substitution, à la différence de ses voisines du cycle de vie
(`suspendreIntervention`, `cloturerIntervention`…) : le test pointe `DATABASE_URL` vers la base jetable,
sous le rôle applicatif, avant que le module ne soit importé — même technique que
`tests/isolation/9eg2-tableau-de-bord.test.ts` pour un module voisin qui a la même particularité.

## Point 2 — le tableau de bord

Déjà couvert, aucune action. Le bloc « l'isolation se mesure par les chiffres, pas par une borne
toujours vraie » de `tests/isolation/9eg2-tableau-de-bord.test.ts`, ajouté par un lot antérieur
(9F1B), mesure déjà un écart NUL pour la société B et un écart de exactement +1 pour la société A sur
chaque compteur, après avoir posé une ligne chez A. Les deux tests qui n'affirmaient qu'un `compte >=
0` restent dans le fichier, mais ne sont plus les seuls témoins de l'isolation sur ces lectures.

## Point 3 — la matrice des statuts

`tests/isolation/intervention.test.ts` porte un nouveau bloc qui joue les 56 couples de statuts hors
diagonale, chacun confronté à la base, contre une matrice écrite en TypeScript dans le test lui-même —
jamais contre une seconde implémentation de production, qui pourrait diverger en silence de la base
réelle. Les colonnes couplées par une contrainte distincte de la matrice (le statut de facturation pour
une clôture, le motif et la date pour une suspension) sont posées systématiquement, pour qu'un couple
permis par la matrice ne soit jamais refusé pour une autre raison — ce qui aurait fait porter à la
matrice la faute d'une contrainte voisine.

## Point 4 — lien d'accès expiré, et `retirerExigence`

Lien expiré : déjà couvert, aucune action. `tests/isolation/premier-acces.test.ts` porte déjà un
scénario (« un lien EXPIRÉ est refusé — même motif qu'un jeton inconnu », ajouté au lot 9L09) : une
ligne de vérification insérée directement, déjà expirée à la naissance, refusée par le même motif
qu'un jeton jamais émis.

`retirerExigence` (`lib/habilitations/depot.ts`) ne juge elle-même aucune capacité — c'est la porte de
sa route qui le fait. Nouveau fichier `tests/isolation/retirer-exigence.test.ts`, même patron que le
point 1 : accepté ; refusé **sans** la capacité `gerer_client_site` (la ligne reste) ; une exigence
d'une **autre société** ni lue ni retirée.

## Vérification

`pnpm typecheck`, `pnpm lint`, `pnpm test` (6002 tests), `pnpm test:isolation` (2382 tests, 254
fichiers) et `CI=1 pnpm verify` (format, typecheck, lint, test, test:isolation, build) passent tous
sans erreur ni avertissement.

## État du dépôt

`main` était extrait ailleurs au démarrage (HEAD détachée sur `origin/main`) : le travail est posé sur
la branche dédiée `9l23-tests-regles-sensibles`, créée depuis ce même commit. Aucun push.
