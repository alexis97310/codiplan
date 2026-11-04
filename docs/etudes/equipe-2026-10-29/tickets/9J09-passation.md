# 9J09-NOTIFICATIONS-SCHEMA — passation

Budget : T0 00:59 (Pacific/Noumea), limite 150 min. Terminé sans dépasser T0+90 pour le code neuf.

## Migration

`prisma/migrations/20261105010000_notification_interne_9j09/migration.sql`.

## Point par point

1. **Décision D229** ajoutée en fin de `docs/arbitrages.md` (après D228) : la notification prend la forme
   « interne » (D94, D100), pas « parc » — aucun écran de portail n'en lit en V1, et la demande d'Alexis du
   29/10/2026 ne nomme que l'interne. Condition de réouverture écrite : le jour où un événement doit
   atteindre un compte portail, la forme se RETIRE, elle ne s'assouplit pas.
2. **Migration** `notification` : `id`, `societe_id NOT NULL`, cible disjointe `intervention_id`/`demande_id`
   (`CHECK num_nonnulls(...) = 1`, même patron que `document_cible_unique`), `evenement` (énumération
   PostgreSQL fermée, une seule valeur : `signature_absente_ou_refusee`), `capacite_requise` (texte, pas un
   type PostgreSQL — validée par le COMPILATEUR côté application via le type `Capacite`), `destinataire_id`
   (nullable, FK vers `utilisateur` posée en base mais **aucune relation Prisma déclarée**, même choix que
   `import_lot.utilisateur_id`, D39), `cree_le`, `lue_le` (nullable, jamais un booléen), le journal de
   l'envoi — `canal`, `tentee_le` (équivalence CHECK dans les deux sens), `partie` (booléen typé,
   volontairement, FLX-12). Forme « interne » posée dans la même migration : `ENABLE`/`FORCE ROW LEVEL
   SECURITY`, policy `cloisonnement_interne`, `GRANT`, déclencheur `journal_audit` (I8). Migration appliquée
   et vérifiée à la main contre `TEST_DATABASE_URL` avant d'écrire la suite (table, contraintes, policy,
   triggers — tous conformes).
3. **`lib/notifications/depot.ts`** : `poserNotification` (cible typée en union discriminée, capacité typée
   `Capacite`), `listerNotifications` (filtre `niveau(role, capacite) !== "aucun"` en mémoire après lecture
   cloisonnée, jamais un `where` sur le rôle), `marquerLue` (idempotente — `updateMany` conditionné sur
   `lue_le: null`, jamais un `update` inconditionnel). L'horodatage de `marquerLue` passe par
   `maintenant(lireFuseau(societe.fuseau_horaire))` (L0-08), jamais `new Date()` — le gardien
   `tests/unit/calendar/sans-date-courante-implicite.test.ts` l'a réclamé dès le premier `pnpm test`.
4. **Épreuves d'isolation** (`tests/isolation/notification.test.ts`) : témoin RLS (société A lit la sienne,
   pas celle de B), portail n'en lit RIEN à la table brute (`avecPortail` + requête directe), puis au niveau
   du dépôt — `listerNotifications` avec un rôle qui tient la capacité la voit, un rôle qui ne la tient pas
   ne la voit pas (même ligne, deux comptes), un compte portail n'en voit aucune quel que soit son client ;
   `marquerLue` pose la date une fois, la seconde n'y touche pas.
5. **Câblage des gardiens fermés** — non prévu par le ticket, découvert en jouant `pnpm test` dès l'écriture
   du schéma : la table nouvelle a fait rougir SIX gardiens existants, chacun corrigé à sa source plutôt que
   contourné :
   - `TABLES_INTERNES`/`INTERNES_ARBITREES` (`scripts/lib/politiques-rls.ts`) — `notification` est la
     DEUXIÈME table de cette liste qui soit aussi fille d'une table du parc (après `segment_travail`) ; le
     critère de la forme « filiation » (`ecartsTablesFilles`) compare déjà « interne » contre « filiation »
     et juge la première plus fermée, sans qu'aucune règle n'ait été assouplie.
   - `tests/unit/db/formes-du-lot-8.test.ts` — liste close des six tables internes, mise à jour dans les
     deux sens (addition, retrait).
   - `tests/unit/db/perimetre-audit.test.ts` — quarante-deux tables auditées, `notification` ajoutée à sa
     place alphabétique avec son motif.
   - `lib/db/migrations-attendues.ts` — migration ajoutée (sinon `/sante` la croirait absente).
   - `tests/unit/db/inventaire.test.ts` — `notification: 0` ajouté aux trois décomptes fixtures (la
     population est dérivée du schéma ; un décompte manquant masquait l'erreur attendue par deux autres
     scénarios).
   - `scripts/lib/chemins-de-depot.ts` (`MODULES_SANS_CHEMIN`, `FONCTIONS_SANS_CHEMIN`) — le module et ses
     trois fonctions n'ont aucun appelant (écran 9J10, producteurs 9J11/9J19), nommés avec leur motif dans
     les deux listes, pas contournés.
   - `docs/cahier-des-charges.md` chapitre 11.2 — `notification` ajoutée (rang 3, le modèle de données
     omettait la table, `tests/unit/docs/modele-de-donnees.test.ts` l'exigeait).
   - `docs/constitution/organisation-du-code.md` §6 — `lib/notifications/` ajouté au sommaire et à
     l'arborescence détaillée, `pnpm sommaires:regenerer` joué, et les deux mutations figées de
     `tests/unit/docs/constitution-indexee.test.ts` (qui codaient en dur les numéros de ligne 76/122 de CE
     fichier précis) remises à jour (77/123) après le décalage que l'ajout d'une ligne au sommaire a
     introduit. `tests/unit/docs/organisation-du-code.test.ts` utilisait par coïncidence `"notifications"`
     comme nom d'exemple pour « un module créé sans être déclaré » — remplacé par `"mirage"`, qui ne
     désigne rien.

## Ce qui reste à faire (prochains tickets, déjà nommés par le territoire)

1. **9J10** — l'écran qui liste les notifications et appelle `listerNotifications`/`marquerLue`.
2. **9J11 / 9J19** — les producteurs qui appellent `poserNotification` pour `signature_absente_ou_refusee`
   et les événements suivants (`suite_a_donner_id` s'ajoutera à la cible disjointe à 9J19).
3. Les six exemptions de gardiens ci-dessus (point 5) se retirent au fil de ces tickets, chacune avec son
   motif déjà écrit — aucune n'a besoin d'être retrouvée de mémoire.

## Vérification jouée

`CI=1 pnpm verify:full` lancé en un seul appel, sortie dans
`docs/etudes/equipe-2026-10-29/tickets/9J09-verify-final.txt`.
