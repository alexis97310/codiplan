-- CODIPLAN — LA TROISIÈME CATÉGORIE DE I1 REÇOIT SON PLANCHER (ticket L1-02d ;
-- invariant I1 ; arbitrages D34, D39, D40 ; décision d'exploitation du
-- 08/09/2026).
--
-- ── CE QUI A DÉCLENCHÉ CETTE MIGRATION ─────────────────────────────────────
--
-- Une mesure, le 07/09/2026, sous le rôle applicatif et un contexte de
-- `technicien` : `second_facteur` ne portait AUCUNE sécurité au niveau des
-- lignes, aucune politique, et le rôle applicatif y détenait les quatre verbes.
-- La suppression de sa propre ligne réussissait ; un `DELETE` sans `WHERE`
-- effaçait deux lignes, toutes sociétés confondues.
--
-- Les QUATRE tables voisines étaient dans le même état. Témoin de non-vacuité à
-- l'appui — population posée d'abord —, une **empreinte de mot de passe** et un
-- **jeton de session** ont été lus sous ce même contexte.
--
-- L'exploitation a tranché pour la CATÉGORIE ENTIÈRE, et non pour la table
-- mesurée : « traiter une table et laisser ses quatre voisines dans le même
-- état, c'est réparer une liste au lieu de la fermer ». Et l'exemption était un
-- VESTIGE : ces cinq tables ont été laissées sans plancher pour la même raison
-- que `utilisateur` — l'authentification précède la société, et nous ne savions
-- pas exprimer une garantie avant le contexte. Nous savons depuis L1-02c :
-- c'est la forme « désignation ». *Une borne posée faute de mieux ne se
-- reconduit pas dès que le mieux existe.*
--
-- ── LA RÈGLE, UNIFORME ; LES FORMES, NON ───────────────────────────────────
--
-- **Aucune table de cette catégorie n'est lisible sans une désignation ou un
-- contexte.** Chaque forme est ensuite DÉDUITE du chemin d'accès réel — non pas
-- d'une lecture de la bibliothèque, mais d'une TRACE des requêtes réellement
-- émises à l'inscription, à la connexion et à la lecture de session.
--
--   `session`        → désignation par le JETON. C'est l'exemple pur de la
--                      forme : une valeur opaque que seul son porteur connaît.
--                      Plus « sa propre ligne » pour un contexte établi.
--   `compte`         → désignation par l'identifiant d'utilisateur, que
--                      l'appelant vient de trouver par le courriel.
--   `verification`   → désignation par l'identifiant opaque, présenté par celui
--                      qui le détient. Aucune autre clé d'accès n'existe.
--   `second_facteur` → désignation par l'identifiant d'utilisateur, **et AUCUNE
--                      politique de suppression** (voir plus bas).
--   `journal_acces`  → ce n'est PAS la même espèce. Voir la section qui lui est
--                      consacrée.
--
-- ── UN DÉFAUT QUE CE TICKET A TROUVÉ, ET CE QU'ON EN SAIT EXACTEMENT ──────
--
-- Avant cette migration, `getSession` rendait **NULL** pour tout compte
-- fraîchement connecté — donc toute page authentifiée. Mesuré deux fois, avec
-- témoin : les lignes de session étaient bien présentes en base. Personne ne
-- s'en était aperçu : aucune page ne s'en sert encore.
--
-- Après cette migration, la chaîne fonctionne, et la trace dit COMMENT :
-- `getSession` émet **deux opérations de client distinctes**, chacune désignée
-- pour son compte — `session` par son JETON, `utilisateur` par son IDENTIFIANT.
--
-- **Ce qui n'est PAS établi, et qui se dit plutôt que se raconte : la cause
-- exacte du NULL d'avant.** Une première explication avait été écrite ici — la
-- lecture jointe de Better Auth, qu'une branche de `utilisateur_lecture` aurait
-- réparée. Le JUMEAU l'a démentie : cette branche retirée, la chaîne complète
-- reste verte. Elle a donc été supprimée plutôt que gardée « au cas où » — une
-- branche inutile dans une politique d'identité est un élargissement sans
-- objet. Isoler la cause d'origine demanderait de rejouer l'ANCIEN code contre
-- l'ANCIENNE base : ni l'un ni l'autre n'existe plus ensemble.
--
-- Ce qui garde désormais la chaîne n'est donc pas une explication mais un
-- APPELANT : `tests/isolation/chaine-session.test.ts` ouvre une session, la
-- relit, bascule de société et la relit encore. C'est ce qui manquait.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. SESSION
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Les DEUX drapeaux, partout dans cette migration : `ENABLE` ne concerne pas le
-- propriétaire, et le seed comme les migrations passent par lui. Ce qui ne se
-- prouve pas par la lecture se prouve par l'attribut (§9, 31/08).

ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session" FORCE ROW LEVEL SECURITY;

-- Deux branches qui ne se recouvrent pas : le JETON avant qu'un contexte
-- existe, SA PROPRE LIGNE une fois qu'il existe. La seconde est ce qui permet à
-- un compte de voir et de révoquer ses sessions sans avoir à présenter chaque
-- jeton.
CREATE POLICY "session_lecture" ON "session"
  FOR SELECT
  USING (
    "token" = NULLIF(current_setting('app.authentification_jeton_session', true), '')
    OR "utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
  );

-- OUVERTURE. `WITH CHECK` écrit, et il n'est pas tautologique : une session ne
-- s'ouvre que pour l'identité que le chemin d'authentification vient de
-- DÉSIGNER. Un chemin qui a désigné A ne peut pas ouvrir une session pour B.
CREATE POLICY "session_ouverture" ON "session"
  FOR INSERT
  WITH CHECK (
    "utilisateur_id" = NULLIF(current_setting('app.authentification_utilisateur_id', true), '')::uuid
  );

-- MODIFICATION — la bascule de société, et le rafraîchissement d'expiration.
-- `WITH CHECK` ÉCRIT même s'il répète le `USING` : une politique qui n'énonce
-- qu'un `USING` légifère en silence sur les écritures (L1-02c).
CREATE POLICY "session_modification" ON "session"
  FOR UPDATE
  USING (
    "token" = NULLIF(current_setting('app.authentification_jeton_session', true), '')
    OR "utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
  )
  WITH CHECK (
    "token" = NULLIF(current_setting('app.authentification_jeton_session', true), '')
    OR "utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
  );

-- SUPPRESSION — la déconnexion, et le retrait d'une session ouverte pour un
-- compte désactivé. Elle EXISTE ici, contrairement à `second_facteur` : fermer
-- une session est un geste ordinaire, retirer un second facteur ne l'est pas.
CREATE POLICY "session_fermeture" ON "session"
  FOR DELETE
  USING (
    "token" = NULLIF(current_setting('app.authentification_jeton_session', true), '')
    OR "utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
  );

COMMENT ON TABLE "session" IS
  'Session serveur. Troisième catégorie de I1 — aucune donnée métier, aucun societe_id. Cloisonnée depuis L1-02d par la forme « désignation » : le JETON, ou sa propre ligne sous un contexte établi. Le jeton désigne aussi son identité (voir utilisateur_lecture) : c''est ce chemin que Better Auth emprunte pour lire une session.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. COMPTE — l'empreinte du mot de passe
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "compte" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "compte" FORCE ROW LEVEL SECURITY;

CREATE POLICY "compte_lecture" ON "compte"
  FOR SELECT
  USING (
    "utilisateur_id" = NULLIF(current_setting('app.authentification_utilisateur_id', true), '')::uuid
    OR "utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
  );

CREATE POLICY "compte_ouverture" ON "compte"
  FOR INSERT
  WITH CHECK (
    "utilisateur_id" = NULLIF(current_setting('app.authentification_utilisateur_id', true), '')::uuid
  );

CREATE POLICY "compte_modification" ON "compte"
  FOR UPDATE
  USING (
    "utilisateur_id" = NULLIF(current_setting('app.authentification_utilisateur_id', true), '')::uuid
    OR "utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
  )
  WITH CHECK (
    "utilisateur_id" = NULLIF(current_setting('app.authentification_utilisateur_id', true), '')::uuid
    OR "utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
  );

-- AUCUNE POLITIQUE DE SUPPRESSION, ET C'EST UNE DÉCISION. Supprimer le moyen de
-- connexion d'un compte n'est pas un geste du produit : désactiver une identité
-- se fait par `utilisateur.actif`, et la purge de rétention du chapitre 22 est
-- une opération du lot 7, avec sa propre décision.
COMMENT ON TABLE "compte" IS
  'Moyen de connexion — porte l''empreinte du mot de passe. Troisième catégorie de I1. Cloisonnée depuis L1-02d par la forme « désignation » : l''identifiant de l''utilisateur, que l''appelant vient de trouver par le courriel. Aucune politique de suppression : c''est délibéré.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. VERIFICATION — les jetons à usage unique
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Une vérification se CONSOMME : elle est lue par son identifiant, puis
-- supprimée. Les quatre verbes portent donc la même clause, et il n'y a pas
-- d'autre clé d'accès — cette table n'est jamais parcourue ni listée.

ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification" FORCE ROW LEVEL SECURITY;

CREATE POLICY "verification_lecture" ON "verification"
  FOR SELECT
  USING (
    "identifiant" = NULLIF(current_setting('app.authentification_identifiant', true), '')
  );

CREATE POLICY "verification_ouverture" ON "verification"
  FOR INSERT
  WITH CHECK (
    "identifiant" = NULLIF(current_setting('app.authentification_identifiant', true), '')
  );

CREATE POLICY "verification_modification" ON "verification"
  FOR UPDATE
  USING (
    "identifiant" = NULLIF(current_setting('app.authentification_identifiant', true), '')
  )
  WITH CHECK (
    "identifiant" = NULLIF(current_setting('app.authentification_identifiant', true), '')
  );

CREATE POLICY "verification_consommation" ON "verification"
  FOR DELETE
  USING (
    "identifiant" = NULLIF(current_setting('app.authentification_identifiant', true), '')
  );

COMMENT ON TABLE "verification" IS
  'Jetons à usage unique — vérification de courriel, défi de second facteur, confiance d''appareil. Troisième catégorie de I1. Cloisonnée depuis L1-02d par la forme « désignation » : l''identifiant opaque, présenté par celui qui le détient.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. SECOND_FACTEUR — ET LE VERBE QUI EST LE CŒUR DU PROBLÈME
-- ═══════════════════════════════════════════════════════════════════════════
--
-- **`mfa_actif` n'est qu'un drapeau.** Un cliquet qui n'aurait fermé que lui
-- aurait été DÉCORATIF : le sujet supprimait sa ligne de second facteur sans
-- jamais y toucher, et la base disait que tout allait bien. C'est la mesure du
-- 07/09 qui l'a établi, et c'est pourquoi le cliquet n'a pas été posé ce
-- jour-là.
--
-- PostgreSQL sait porter des politiques PAR VERBE. La lecture, la création et la
-- modification sont désignées ; **la suppression n'a AUCUNE politique**, et sous
-- `FORCE ROW LEVEL SECURITY` un verbe sans politique est refusé pour tout le
-- monde. Retirer un second facteur n'est donc plus un geste possible depuis
-- l'application — ni par le sujet, ni par personne.
--
-- **Le chemin de sortie existe, et il est administratif** : L7-01, déblocage par
-- `admin_plateforme` SEUL, journalisé dans `journal_acces`, avec réactivation
-- obligatoire d'un second facteur avant retour des droits. Ce ticket écrira sa
-- propre politique de suppression, avec sa propre décision. **L'absence est
-- écrite ici plutôt que subie.**

ALTER TABLE "second_facteur" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "second_facteur" FORCE ROW LEVEL SECURITY;

CREATE POLICY "second_facteur_lecture" ON "second_facteur"
  FOR SELECT
  USING (
    "utilisateur_id" = NULLIF(current_setting('app.authentification_utilisateur_id', true), '')::uuid
    OR "utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
  );

-- ENRÔLEMENT — dans un seul sens, et c'est la transition que D58 ouvre.
CREATE POLICY "second_facteur_enrolement" ON "second_facteur"
  FOR INSERT
  WITH CHECK (
    "utilisateur_id" = NULLIF(current_setting('app.authentification_utilisateur_id', true), '')::uuid
  );

-- MODIFICATION — les compteurs d'échec et le verrouillage temporaire, écrits par
-- le chemin de vérification. Elle ne peut pas détacher la ligne de son compte :
-- le `WITH CHECK` la rattache à la même désignation.
CREATE POLICY "second_facteur_modification" ON "second_facteur"
  FOR UPDATE
  USING (
    "utilisateur_id" = NULLIF(current_setting('app.authentification_utilisateur_id', true), '')::uuid
    OR "utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
  )
  WITH CHECK (
    "utilisateur_id" = NULLIF(current_setting('app.authentification_utilisateur_id', true), '')::uuid
    OR "utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
  );

COMMENT ON TABLE "second_facteur" IS
  'Second facteur d''authentification. Troisième catégorie de I1. Cloisonnée depuis L1-02d par la forme « désignation ». AUCUNE POLITIQUE DE SUPPRESSION, et c''est le point du ticket : un cliquet sur utilisateur.mfa_actif seul aurait été décoratif, la ligne se supprimant sans jamais toucher au drapeau. Le retrait d''un second facteur est un acte administratif — L7-01, admin_plateforme seul — et ce ticket écrira sa propre politique.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. JOURNAL_ACCES — ET CE N'EST PAS LA MÊME ESPÈCE
-- ═══════════════════════════════════════════════════════════════════════════
--
-- L'exploitation l'avait vu venir : *« journal_acces n'est probablement pas de
-- la même espèce que les quatre autres. C'est une trace, pas un matériau
-- d'authentification. »* La déduction confirme, et elle le rapproche de
-- `journal_audit` : **ajout seul, et rien d'autre**.
--
-- Ce qu'elle ne peut PAS avoir, et c'est ce qui la distingue de `journal_audit` :
-- une clause de société. `journal_acces` n'en porte pas — `societe_id_source` et
-- `societe_id_cible` sont INFORMATIVES et nullables, et D34 leur interdit de
-- filtrer quoi que ce soit. Un refus de bascule de A vers B ne se range ni sous
-- A ni sous B ; c'est la raison d'être de la table.
--
-- ── L'AJOUT SEUL A ÉTÉ VOULU, PUIS MESURÉ IMPOSSIBLE ──────────────────────
--
-- L'intention était : INSERT seul, AUCUNE politique de lecture. Sous `FORCE`,
-- la table serait devenue illisible depuis l'application — plus fort que
-- « lisible sous désignation ».
--
-- **Mesuré : Prisma ne peut alors plus l'écrire du tout.** `INSERT … RETURNING`
-- est soumis à la politique de LECTURE — c'est la leçon de L1-02c —, et sans
-- politique de SELECT l'insertion elle-même est refusée : *« new row violates
-- row-level security policy for table "journal_acces" »*, alors même que le
-- `WITH CHECK` de l'ajout valait `true`. `journal_audit` y échappe parce qu'un
-- DÉCLENCHEUR l'écrit ; `journal_acces` est écrite par du code applicatif.
--
-- La lecture est donc BORNÉE À LA DÉSIGNATION plutôt qu'absente : on ne lit que
-- les lignes du compte qu'on nomme. Strictement plus fort que l'état d'avant —
-- où le rôle applicatif lisait toutes les lignes de tous les comptes — et
-- strictement plus faible que l'ajout seul. **L'écart est écrit plutôt que tu**,
-- et il porte son alternative : un journal réellement en ajout seul demanderait
-- un déclencheur, ou du SQL brut que le §2 interdit hors migration. C'est une
-- question du lot 7, avec la lecture « qui a tenté d'accéder à mes données ».
--
-- **Et le `WITH CHECK` de l'ajout est `true`, dit plutôt que caché.** La base ne
-- peut pas vérifier l'auteur d'une ligne de journal d'accès : l'appelant fournit
-- l'auteur ET la ligne, et aucun contexte n'est établi au moment où l'on
-- journalise un refus — c'est précisément le cas où il n'y en a pas. Une clause
-- qui comparerait l'auteur à une variable que le même appelant vient de poser
-- serait une garantie décorative, et le dépôt en a assez rencontré. La garantie
-- réelle est ailleurs : ni modification, ni suppression, et une lecture bornée.

ALTER TABLE "journal_acces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "journal_acces" FORCE ROW LEVEL SECURITY;

CREATE POLICY "journal_acces_ajout" ON "journal_acces"
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "journal_acces_lecture" ON "journal_acces"
  FOR SELECT
  USING (
    "utilisateur_id" = NULLIF(current_setting('app.authentification_utilisateur_id', true), '')::uuid
    OR "utilisateur_id" = NULLIF(current_setting('app.utilisateur_id', true), '')::uuid
  );

COMMENT ON TABLE "journal_acces" IS
  'Journal des accès — connexions, bascules, refus. Depuis L1-02d : ajout libre, lecture BORNÉE À LA DÉSIGNATION, ni modification ni suppression (aucune politique, donc refusées sous FORCE ROW LEVEL SECURITY). Ce n''est pas une table de matériau d''authentification mais une TRACE, de la même espèce que journal_audit ; elle ne peut pas porter la clause de société de celui-ci, ses colonnes de société étant informatives et jamais filtrantes (D34). L''ajout seul a été voulu puis mesuré impossible : INSERT … RETURNING est soumis à la politique de lecture, et Prisma ne pouvait plus écrire du tout. La lecture « qui a tenté d''accéder à mes données » est une fonction de la console du lot 7.';
