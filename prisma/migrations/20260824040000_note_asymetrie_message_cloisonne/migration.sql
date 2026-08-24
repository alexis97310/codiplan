-- CODIPLAN — L'asymétrie des messages est délibérée : la note, à l'endroit de
-- la tentation (arbitrage D50 ; complète D48 et D49).
--
-- ── CETTE MIGRATION NE CHANGE RIEN AU SCHÉMA ───────────────────────────────
-- Aucune table, aucune colonne, aucune contrainte, aucun déclencheur. Elle
-- n'écrit que des COMMENTAIRES, et c'est son objet : déposer dans la base même,
-- à côté de l'objet concerné, la raison d'une absence. La migration
-- 20260823130000 a touché une base réelle le 24/08 — elle est immuable
-- (CLAUDE.md §7) —, et une note qui doit être lue là où la faute se commet ne
-- pouvait donc plus y être ajoutée. `\df+` et `pg_description` la montrent ;
-- c'est même une meilleure place qu'un commentaire SQL dans un fichier que
-- personne ne rouvre.
--
-- ── L'ASYMÉTRIE, ET POURQUOI ELLE N'EST PAS UN OUBLI ───────────────────────
-- Il existe un déclencheur explicatif côté `agence`
-- (`agence_territoire_verrou_ecarts`) et RIEN de tel côté `jour_ferie`, alors
-- que les deux clés du chaînage portent le même `ON UPDATE RESTRICT` (D49).
-- Vue de loin, cette asymétrie ressemble à un oubli. Elle ne l'est pas, et un
-- oubli appelle quelqu'un pour le corriger — c'est-à-dire pour recopier le
-- déclencheur côté `jour_ferie`. Or cette correction irait exactement dans la
-- direction dangereuse.
--
-- **Mesuré, pas supposé.** Un prototype à l'identique du modèle « agence »
-- (`SECURITY INVOKER`, décompte des écarts), exécuté sous le SEUL rôle qui peut
-- écrire dans `jour_ferie` — un rôle éditeur, qui par construction n'a aucune
-- société active (§22.5, D46) — voit **0 écart** là où la vérité en compte 1.
-- `calendrier_ferie` est cloisonnée avec `FORCE ROW LEVEL SECURITY` ; les
-- contrôles d'intégrité référentielle, eux, s'exécutent hors RLS. C'est
-- pourquoi la clé refuse correctement pendant que le déclencheur est aveugle.
-- Recopié tel quel, le jumeau serait du CODE MORT dans le seul chemin réel.
--
-- **Et le faire voir serait une fuite.** Lui donner les droits qui lui
-- manquent — une fonction `SECURITY DEFINER` détenue par un rôle `BYPASSRLS` —
-- ferait d'un message d'erreur un lecteur inter-sociétés. Un décompte
-- apprendrait à un salarié de l'éditeur combien d'agences clientes chôment ce
-- jour-là. **Un message d'erreur est un canal d'information : il est soumis au
-- cloisonnement comme une requête** (D50, inscrit au CLAUDE.md).
--
-- **Ce qui est donc décidé (D50).** Le verrou reste — `ON UPDATE RESTRICT` des
-- deux côtés. Le message côté `jour_ferie` attend la console éditeur du lot 7,
-- qui interceptera l'erreur de clé et la traduira sans rien lire à travers le
-- cloisonnement. Aucun chemin de code du dépôt ne peut produire ce refus
-- aujourd'hui : le seed fait un `upsert` sur `(territoire, date)` et ne met à
-- jour que `libelle` et `mobile` ; `etendre-feries` n'écrit que des `create`.
-- Ni l'un ni l'autre ne change jamais une date ni un territoire.
--
-- **Et un gardien vaut mieux qu'une note.**
-- `tests/unit/db/security-definer-sous-arbitrage.test.ts` échoue si une
-- fonction `SECURITY DEFINER` apparaît dans une migration. La liste des
-- exceptions arbitrées est CLOSE et VIDE ; le repli de consolidation de D36
-- (lot 5) y entrera par arbitrage, pas par décision de session.

COMMENT ON FUNCTION "agence_territoire_verrou_ecarts"() IS
  'Message actionnable devant le refus de ON UPDATE RESTRICT (D49). Double la clé étrangère, ne la remplace pas : retiré, la clé refuse encore. ABSENCE DÉLIBÉRÉE DE JUMEAU CÔTÉ jour_ferie (D50) : l''écrivain y est un rôle éditeur sans société active, un déclencheur SECURITY INVOKER n''y verrait aucun écart (mesuré : 0 contre 1), et lui donner la vue — SECURITY DEFINER sur un rôle BYPASSRLS — ferait d''un message d''erreur un lecteur inter-sociétés. Un message est un canal d''information, soumis au cloisonnement comme une requête. Ne PAS recopier ce déclencheur sur jour_ferie.';

COMMENT ON TRIGGER "agence_territoire_verrou_ecarts" ON "agence" IS
  'Voix du refus, jamais le verrou (D49). Pas de jumeau sur jour_ferie, et c''est délibéré (D50) : voir le commentaire de la fonction, et docs/decisions/2026-08-24-territoire-agence-sans-propagation.md.';

COMMENT ON CONSTRAINT "calendrier_ferie_jour_ferie_id_date_territoire_fkey"
  ON "calendrier_ferie" IS
  'ON UPDATE/DELETE RESTRICT (D49) : corriger la date ou le territoire d''un fait public ne réécrit pas en silence l''écart d''une société. Son refus n''a PAS de déclencheur explicatif, et c''est délibéré (D50) : le message viendra de la console éditeur au lot 7, faute de pouvoir compter les écarts sans franchir le cloisonnement.';
