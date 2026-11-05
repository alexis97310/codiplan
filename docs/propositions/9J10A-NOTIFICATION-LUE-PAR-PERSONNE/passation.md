# 9J10A-NOTIFICATION-LUE-PAR-PERSONNE — passation

## La migration à jouer, nommément

```
20261105020000_notification_lecture_9j10a
```

Appliquée par `prisma migrate deploy` sur `codiplan_test` (port 5441) pour
les épreuves, et rejouée par Playwright pour les captures. Alexis la joue en
production et sur le site de test par le chemin habituel (`pnpm db:deploy`).
Aucune reprise du passé n'était nécessaire : `notification.lue_le` reste en
base (I6), simplement muette côté application à partir de ce ticket.

## La décision (Alexis, 05/11/2026 ~08:40)

« une notification adressée à tout le monde disparaît pour tous dès qu'une
personne l'a lue — voulu ? » → non, **« lu par personne »** : chacun garde la
sienne jusqu'à ce qu'il la lise.

## 1. Mesure (demandée en tête du ticket)

- `app.utilisateur_id` est posée par **tout** chemin de session
  (`avecContexteApplicatif`, `lib/db/client.ts:86-117`, qui délègue à
  `avecContexteRls`/`lib/db/rls.ts`) — jamais vide sous un contexte applicatif
  réel. Aucune variable à ajouter.
- Les treize formes de politique RLS en vigueur sont dans
  `scripts/lib/politiques-rls.ts`. La plus proche d'un besoin « visible si le
  parent l'est, plus une restriction d'écriture » est la forme **« filiation »**
  (D103) — déjà portée par `intervention_statut_historique` /
  `demande_statut_historique` (9J08A). **Aucune 14e forme créée** : la
  politique de lecture reste la filiation pure (recopiée à l'identique de ces
  deux tables), et la politique d'écriture y AJOUTE `utilisateur_id =
  app.utilisateur_id` — `ecartsFiliation` (le gardien qui mesure cette forme
  en base) ne juge que la présence de l'adossement au parent, une clause plus
  étroite le satisfait toujours.
- Le défaut mesuré sur `origin/main` f34b423fa, `lib/notifications/depot.ts`
  (avant ce ticket) : `marquerLue` faisait un `updateMany({ where: { id,
  lue_le: null } })` sur `notification` elle-même — **une seule colonne
  `lue_le` pour toute la table**. M1 : une notification collective
  (`destinataire_id` NULL) lue par UNE personne devenait lue pour TOUTES. M2 :
  aucun filtre `destinataire_id` dans `marquerLue` — un compte pouvait marquer
  lue la notification personnelle d'un collègue en connaissant son
  identifiant.

## 2. La migration

`notification_lecture` : `id`, `societe_id`, `notification_id`,
`utilisateur_id`, `lue_le` (`timestamptz(3)`, posée explicitement par le
dépôt — jamais de `DEFAULT now()`, même discipline que l'ancienne colonne
`notification.lue_le`, datée dans le fuseau de la société). Clé composite
`(societe_id, notification_id)` vers `notification(societe_id, id)` — qui a
donc gagné `@@unique([societe_id, id])`, sa toute première fille — `ON DELETE
CASCADE`. Clé unique sur **le couple** `(notification_id, utilisateur_id)` :
c'est elle qui tient la date de la première lecture sans aucun `UPDATE`.

- RLS, deux politiques : `SELECT` filiation pure (`EXISTS (SELECT 1 FROM
  notification WHERE id = notification_lecture.notification_id)`, aucune
  clause de société — la visibilité de `notification`, forme « interne »,
  D229, se propage) ; `INSERT` filiation **plus** `utilisateur_id =
  app.utilisateur_id` — c'est cette seconde branche qui ferme M2 au niveau de
  la base, en plus du contrôle applicatif du point 3.
- `GRANT SELECT, INSERT` à `codiplan_app`, `REVOKE UPDATE, DELETE, TRUNCATE` —
  aucune politique pour ces deux verbes, fermés par construction sous `FORCE
  ROW LEVEL SECURITY`, même régime qu'`intervention_statut_historique`.
- Déclencheur `journal_audit` (I8, périmètre inversé) : table de première
  catégorie, auditée dès sa naissance.
- Registre des formes mis à jour (`scripts/lib/politiques-rls.ts` :
  `TABLES_FILIATION`, `FILIATION_ARBITREE`) et chapitre 11.2 du cahier des
  charges complété (gardien `tests/unit/docs/modele-de-donnees.test.ts`).
  Gardiens dérivés du schéma mis à jour (`tests/unit/db/perimetre-audit.test.ts`,
  `tests/unit/db/inventaire.test.ts`).
- Amorce de rejeu `tests/isolation/fixtures/base-agee/20261105020000_
  notification_lecture_9j10a.sql` : la migration pose `UNIQUE (societe_id,
  id)` sur `notification`, née une migration plus tôt — sans une ligne réelle
  à ce point de l'histoire, ce resserrement ne serait éprouvé contre rien
  (`tests/isolation/migrations-sur-base-agee.test.ts`).

## 3. Le dépôt — `lib/notifications/depot.ts`

- `marquerLue(contexte, id)` : relit la notification sous le contexte
  cloisonné, vérifie qu'elle est visible pour **cet acteur** (`destinataire_id
  === null || === utilisateurId`, et `niveau(role, capacite_requise) !==
  "aucun"`), et seulement alors pose SA ligne dans `notification_lecture`
  (`createMany` + `skipDuplicates`, jamais d'`UPDATE`). Sinon : rien, sans
  erreur bavarde — introuvable (id forgé, autre société, RLS de `notification`
  déjà fermée), destinée nommément à quelqu'un d'autre, ou hors de la
  capacité tenue aujourd'hui.
- `listerNotifications` : lit toujours les notifications visibles comme
  avant (9J09, inchangé), mais `lueLe` vient désormais d'une seconde requête
  sur `notification_lecture`, filtrée à `utilisateur_id = soi`, dans la MÊME
  transaction cloisonnée.
- `notification.lue_le` n'est plus ni lue ni écrite nulle part dans ce
  module — la colonne reste en base (I6).
- `app/api/notifications/marquer-lue/route.ts` : commentaire mis à jour (il
  décrivait l'ancien `updateMany`).

## 4. Épreuves d'isolation — `tests/isolation/notification.test.ts`

Deux comptes `adv` RÉELS sur la **même** société (`UTILISATEUR_INTERNE_A` et
`UTILISATEUR_PAR_ROLE[Role.adv]`, qui sont deux identités distinctes
habilitées toutes les deux sur SOCIETE_A — voir `setup/fixtures.ts`) :

- une notification collective lue par A reste non lue pour B (`listerNotifications`
  des deux comptes, sur la même ligne) ;
- A ne peut pas marquer lue la notification **personnelle** de B — rien n'est
  écrit dans `notification_lecture` pour A, et B peut toujours marquer la
  sienne (M2) ;
- une autre société ne lit ni n'écrit aucune ligne de `notification_lecture`
  pour une notification de la société A (ni par `marquerLue`, ni par lecture
  directe sous `sousSociete`).

Le test existant « la date de la première lecture, jamais réécrite » est
réécrit pour interroger `notification_lecture` (clé composite Prisma
`notification_id_utilisateur_id`) au lieu de `notification.lue_le`.

## 5. Captures — deux comptes, 375 et 1280 px

`docs/propositions/9J10A-NOTIFICATION-LUE-PAR-PERSONNE/captures/`, produites
par `tests/e2e/captures-9j10a-notification-lue-par-personne.spec.ts` :
`COMPTE_EPREUVE` et `COMPTE_MULTI_SOCIETE_EPREUVE` sont les deux seuls
comptes `adv` de la scène e2e habilités sur la **même** société
(`ecrireLeCompteMultiSocieteDeLEpreuve` — aucune fixture neuve nécessaire) ;
une notification collective leur est posée à tous les deux, A la marque lue,
B rouvre sa page et la voit toujours non lue :

- `a-cloche-avant-{375,1280}.png` / `b-cloche-avant-{375,1280}.png` — l'entrée
  « Notifications » de la barre (le tiroir est ouvert d'abord à 375 px), AVANT
  toute lecture.
- `a-a-lu-sa-notification-{375,1280}.png` — la page de A, « Toutes lues ».
- `b-navait-pas-lu-{375,1280}.png` — la page de B, **au même instant**, « 1
  notification non lue ».

`COMPTE_MULTI_SOCIETE_EPREUVE` passe par `/arrivee` (deux sociétés, aucune
redirection automatique) ; le premier bouton « activer » est CODIMA-NC, la
société où la notification de l'épreuve est posée — `ecrireLeCompteMultiSocieteDeLEpreuve`
l'habilite sur NC avant EU, dans cet ordre.

## Feuille de route — non touchée, et c'est délibéré

`lib/feuille-de-route/contenu.ts` ne porte qu'une ligne groupée « Notifications
internes (9J09 à 9J11) », déjà au statut `pret` (pas encore `livre` — 9J11
n'est pas fait). Ce ticket corrige un défaut mesuré dans ce qui est déjà écrit
(9J09/9J10), il ne termine pas le lot : rien à faire passer à `livre`.

## Hors territoire, non fait (par construction du ticket)

La migration de 9J09 (`notification`, jamais réécrite), les autres tables,
`lib/auth/**`, `app/(back-office)/template.tsx`. Aucune dépendance nouvelle,
aucune politique existante affaiblie, aucune suppression de colonne ni de
ligne — `notification.lue_le` reste en base, vestigiale.

## Vérification

`pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (499 fichiers, 5495
épreuves) verts après chaque commit. `pnpm test:isolation` rejoué en entier
après la migration : **212 fichiers, 1843 épreuves, tout vert** — y compris
le rejeu sur base âgée avec l'amorce du point 2. `CI=1 pnpm verify` est le
dernier geste de cette session, joué à sec juste avant de rendre la main (voir
le message de ce commit pour son issue).

## Reprise 9J10B — la capture à 1280px

Les deux vérifications de 9J10A (`traces/…-verify-1.txt`, `-verify-2.txt`) montraient un seul échec,
deux fois : la capture 1280px ne trouvait pas le lien « Notifications » dans la barre (`toBeVisible`
→ timeout), alors que la même capture à 375px passait.

**Mesure** : `CI=1 pnpm exec playwright test tests/e2e/captures-9j10a-notification-lue-par-personne.spec.ts
--workers=1` reproduit l'échec à l'identique. Le message précis est « element(s) not found », pas
« hidden » : le lien n'existe pas du tout dans le DOM, aux deux largeurs — ce n'est donc pas un défaut
propre à 1280px. `sansNotificationsVides` (`components/navigation/barre.tsx`) retire l'entrée
« Notifications » de la barre quand `decomptes.notifications.total` vaut zéro pour le compte connecté,
aux deux largeurs pareillement. Le `beforeAll` du spec ne posait la notification collective de
l'épreuve que si `CAPTURES_9J10A` était défini (même garde que l'écriture des PNG) — exactement le
défaut déjà mesuré et corrigé sur 9J02A par 9J02B (« l'épreuve ne posait pas son client sans
CAPTURES_9J02A ») : `pnpm test:e2e` / `verify:full` ne positionnent jamais cette variable, donc aucune
notification n'existait pour les deux comptes, et la barre n'avait rien à faux — l'écran est correct.

**Correction**, en trois temps (le premier reprend le patron 9J02B, les deux autres sont propres à ce
spec parce que, contrairement au client de 9J02A, la notification est MUTÉE par le test — marquée lue
par A) :

1. `poserLaNotificationCollectiveDeLEpreuve()` s'exécute désormais sans condition.
2. Le `beforeAll` est posé DANS chaque bloc `describe` par largeur (et non une fois pour tout le
   fichier) : sans ça, la notification posée une seule fois aurait été déjà lue par A quand le test à
   375px s'exécute, qui aurait alors échoué à son tour sur « A voit son propre « non lue » ».
3. Un `afterAll` neuf (`nettoyerLaNotificationDeLEpreuve`) retire la ligne posée. Mesuré nécessaire en
   rejouant `captures-9j10-notifications.spec.ts` et ce fichier ensemble avec `--repeat-each=2` : la
   capacité choisie, `annuler_intervention`, est aussi tenue par `admin_societe`
   (`lib/auth/habilitations.ts`, forme `complet`) — sans nettoyage, la ligne restait en base entre les
   fichiers (base de test partagée, I9) et cassait la capture « vide (admin_societe, sans la capacité
   posée) » du fichier voisin dès la deuxième répétition. Aucun autre fichier de capture du dépôt ne
   nettoie après lui (patron 9J02A/9J02B/9J10 observés) parce qu'aucun n'utilise une capacité partagée
   avec un autre — propre à ce ticket, pas une règle générale à poser ailleurs.

Rejoué `tests/e2e/captures-9j10-notifications.spec.ts tests/e2e/captures-9j10a-notification-lue-par-personne.spec.ts
--workers=1 --repeat-each=2` : 12/12 vert (c'est cette combinaison qui avait révélé la pollution
ci-dessus — chaque fichier seul, même répété, restait vert). `pnpm format`, `pnpm typecheck`,
`pnpm lint`, `pnpm test` (499 fichiers, 5497 épreuves) verts.
