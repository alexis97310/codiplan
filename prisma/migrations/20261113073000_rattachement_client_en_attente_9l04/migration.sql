-- ═══════════════════════════════════════════════════════════════════════════
-- 9L04-PORTAIL-INVITATION-EN-ATTENTE — LE RATTACHEMENT EN ATTENTE D'ACCEPTATION
-- Décision d'Alexis du 10/11/2026 (D249, revient sur D233).
--
-- ## Ce qui a été mesuré (revue de sécurité privée d'Alexis, non reproduite ici)
--
-- `inviterClientAuPortail` (`lib/auth/lien-d-acces.ts`), branche « déjà actif »
-- (D233, 08/11/2026) : trouver une identité DÉJÀ pourvue d'un mot de passe —
-- quelle que soit la société où elle est connue — posait aussitôt un
-- rattachement ACTIF au client visé, sans que son titulaire n'ait rien
-- demandé ni accepté. Une personne déjà connectée au portail d'une société
-- pouvait ainsi se voir ouvrir, EN SILENCE, le parc d'un second client d'une
-- AUTRE société, sur la seule initiative d'un administrateur qui connaît son
-- courriel.
--
-- ## La décision
--
-- Un rattachement `utilisateur_client` reste EN ATTENTE tant que son
-- titulaire ne l'a pas accepté explicitement, SAUF pour une identité NOUVELLE
-- (ouverte par cette invitation même) : D96 veut que son premier accès —
-- choisir un mot de passe par le lien reçu — vaille lui-même acceptation, et
-- il n'existe alors aucune session ailleurs à protéger. Un seul message de
-- refus, neutre, couvre désormais tous les cas « adresse connue ailleurs »
-- (D226/D233 toujours en vigueur) : il ne distingue plus « pas encore activé »
-- de « employé d'ailleurs », pour ne plus révéler qu'une adresse existe dans
-- une autre société.
--
-- ## Deux colonnes, additives, nullables, sans donnée existante réécrite dans
-- le sens qui romprait un accès
--
-- `accepte_le` porte l'acceptation. Les lignes déjà en base décrivent un accès
-- déjà accordé avant que cette notion existe — la reprise les pose à `now()`,
-- jamais à `NULL`, pour ne révoquer aucun accès existant au passage d'une
-- migration.
--
-- `nom_client_invitation` est un CLICHÉ, et c'est une décision nommée : lire
-- le nom réel du client exigerait de désigner `app.client_id` (forme « parc »,
-- D10/D22), ce qui ouvrirait tout son parc avant l'acceptation — précisément
-- ce que cette migration ferme. Un libellé recopié peut devenir faux si le
-- client est renommé avant l'acceptation ; accepté à dessein, la ligne ne s'en
-- servant plus une fois acceptée. Il n'est posé QUE pour une identité déjà
-- ouverte (rattachement créé en attente) — jamais pour une identité nouvelle,
-- qui n'en a pas besoin.
--
-- ## Pourquoi aucun bloc de garde (§9 du 07/09)
--
-- Les deux colonnes sont NULLABLES, sans défaut déclaré : aucune ligne
-- existante n'est en défaut au moment de l'ajout, et la mise à jour qui suit
-- cible explicitement les lignes qu'elle reprend.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE "utilisateur_client"
  ADD COLUMN "accepte_le" timestamptz,
  ADD COLUMN "nom_client_invitation" text;

-- ── REPRISE : tout rattachement déjà en base décrivait un accès déjà accordé
UPDATE "utilisateur_client" SET "accepte_le" = now() WHERE "accepte_le" IS NULL;

COMMENT ON COLUMN "utilisateur_client"."accepte_le" IS
  '9L04 / D249 — NULL tant que le titulaire n''a pas accepté ce rattachement. Une ligne non acceptée n''ouvre aucun accès (ni le parc, ni le choix de cette société comme active). Posée à now() à la création pour une identité NOUVELLE (le premier accès vaut acceptation, D96) ; NULL à la création pour une identité déjà ouverte. Les lignes antérieures à cette migration sont reprises comme acceptées.';

COMMENT ON COLUMN "utilisateur_client"."nom_client_invitation" IS
  '9L04 / D249 — cliché du nom du client, posé SEULEMENT pour un rattachement créé en attente (identité déjà ouverte) : désigner app.client_id pour lire le nom réel ouvrirait tout le parc avant l''acceptation. Peut devenir faux si le client est renommé avant l''acceptation — accepté à dessein, fenêtre courte, enjeu un seul libellé d''écran.';
