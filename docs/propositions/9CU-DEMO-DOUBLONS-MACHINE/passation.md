# 9CU-DEMO-DOUBLONS-MACHINE — passation

## Ce que j'ai changé, et ce que ça change pour l'exploitation

La base de démonstration est bloquée (P3009) depuis le 23/09/2026 sur la migration
`20260923130000_parcours_1_creer_puis_planifier`, qui pose « une intervention ne porte
qu'une machine au plus » et refuse de s'appliquer tant que des lignes existantes
l'enfreignent — sans jamais en supprimer aucune elle-même. Jusqu'ici, aucun flux ne
permettait de faire ce retrait sans lever le cloisonnement à la main sur la base hébergée.

Ce lot ajoute ce retrait, en trois pièces :

- `scripts/lib/doublons-machine.ts` — logique pure : à partir des lignes observées,
  construit le plan (garder le plus petit identifiant d'un doublon, retirer les autres),
  ou refuse si une ligne en double ne porte pas un identifiant du jeu de démonstration.
- `scripts/nettoyer-doublons-machine-demo.mts` — lit sous une identité exemptée des
  politiques (sinon la lecture rend zéro ligne sur une table `FORCE ROW LEVEL SECURITY`),
  refuse si la base porte une société hors du seed, imprime toujours le plan, et —
  seulement si `APPLIQUER=oui` — supprime les lignes en trop sous le rôle **connecté**,
  avec le contexte RLS de chaque société posé comme le fait `lib/db/rls.ts`. Le
  cloisonnement n'est jamais levé, pas même le temps d'une transaction.
- `.github/workflows/db-doublons-machine-demo.yml` — `workflow_dispatch` seul, une
  case `appliquer` (défaut décoché), réservé à `MIGRATION_DATABASE_URL` : aucune entrée
  de cible, le mot « production » n'apparaît nulle part dans le fichier.

Pour l'exploitation : le chemin pour débloquer la base de démonstration est désormais
« DB doublons machine (lecture) → DB doublons machine (appliquer) → DB resolve → DB
migrate & seed », documenté en clics au §7 ter de `docs/mise-en-ligne.md`.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

Sur une base jetable (cluster `codiplan-pg16`, port 5433), sous un rôle propriétaire
NON superutilisateur avec `FORCE ROW LEVEL SECURITY` actif — jamais sous le
superutilisateur local, qui ne voit aucun défaut lié à `FORCE` (voir mémoire
« Rejouer les rôles hébergés en local ») :

- une intervention fabriquée avec 2 lignes `intervention_machine` → lecture seule :
  rapport correct, **0** ligne retirée (vérifié par relecture) ;
- même état → `APPLIQUER=oui` : **1** ligne retirée, exactement celle au plus grand
  identifiant ; relecture : **1** ligne restante, celle de plus petit identifiant ;
- relance après nettoyage : « Aucun doublon », code de sortie `0` ;
- `FORCE ROW LEVEL SECURITY` mesuré actif (`relforcerowsecurity = t`) **après**
  l'application — jamais levé ;
- la contrainte `UNIQUE (intervention_id)` de la migration bloquante se repose sans
  échouer une fois le nettoyage fait ;
- une ligne en doublon fabriquée hors du préfixe du semis → refus, code de sortie `1`,
  rien retiré (vérifié par relecture).

**Non mesuré : le refus sur une société hors du seed.** L'insertion manuelle d'une
société fabriquée a buté sur une colonne `NOT NULL` du schéma réel (`territoire`), sans
rapport avec ce lot, et je ne l'ai pas creusé davantage — le chemin est celui, inchangé,
de `scripts/refus-si-donnees-reelles.mts`, déjà éprouvé par ses propres tests. C'est une
hypothèse de continuité, pas une mesure sur ce script précis.

Détail complet, commandes et sorties : `docs/propositions/9CU-DEMO-DOUBLONS-MACHINE/README.md`.

## Ce que j'ai tranché, et pourquoi

- **L'écriture se fait sous le rôle connecté, avec le contexte RLS posé par société**
  (via `instructionContexte`, exporté par `lib/db/rls.ts`), plutôt que sous l'identité
  exemptée. L'identité exemptée (BYPASSRLS) n'a, par construction, que `SELECT` et
  `USAGE` — c'est la recette mesurée pour la lire sans la laisser écrire n'importe quoi.
  Le rôle connecté (propriétaire des tables), lui, est soumis à `FORCE ROW LEVEL
  SECURITY` comme n'importe quel appelant non privilégié : poser le contexte et le
  laisser passer par la politique `cloisonnement_filiation` est la même garantie que
  celle du rôle applicatif, sans jamais toucher à `FORCE`.
- **Une seule transaction pour toute la suppression**, avec un comptage des lignes
  réellement supprimées confronté au plan : un écart lève une exception, qui annule tout
  (`$transaction` de Prisma). Pas de suppression partielle silencieuse.
- **Le témoin relit après coup**, sous la même identité exemptée : si une anomalie
  demeure, le script sort en 75 (exploitation), jamais en 0.
- **Le préfixe d'identifiant du semis est la seule clé de confiance.** Une ligne en
  double qui ne le porte pas n'est plus la démo que le semis connaît ; choisir laquelle
  garder serait inventer une règle. Refus plutôt que choix à l'aveugle.
- **Codes de sortie 0/1/75**, réutilisés à l'identique de `refus-si-donnees-reelles.mts` :
  0 = conclu et rien à signaler (lecture ou nettoyage réussi), 1 = refus fondé sur l'état
  observé (société hors seed, ligne hors semis), 75 = n'a pas pu conclure (identité hors
  de portée, anomalie après écriture).

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix touché.
- Aucun écran créé ou modifié — pas de capture AVANT/APRÈS (voir le README du dossier).
- Je n'ai pas joué le flux GitHub réel (`db-doublons-machine-demo.yml`) sur la base de
  démonstration hébergée : cette session n'a pas accès au secret `MIGRATION_DATABASE_URL`
  ni à `gh workflow run`. La preuve est sur la base jetable, sous les mêmes rôles.
- Je n'ai pas mesuré le refus « société hors du seed » sur ce script précis (voir plus
  haut).

## Les pièges pour la session suivante

- **Ne pas confondre `doublons_bypass`/`doublons_owner` avec les rôles réels.** Ce sont
  des rôles de mesure, créés et détruits pendant cette session sur `codiplan-pg16` ; ils
  n'existent plus.
- **Le seed échoue aujourd'hui sur `utilisateur` quand on le joue sous un propriétaire
  fraîchement créé** (RLS sur `utilisateur`, grants manquants hors du périmètre de ce
  lot) — sans rapport avec ce ticket, mais à savoir si une session future reprend cette
  recette de mesure : les lignes `intervention`/`machine`/`intervention_machine` sont
  déjà écrites avant ce point, ce qui a suffi ici.
- **`intervention_machine_intervention_id_key` n'existe que depuis la migration
  bloquante.** Sur une base qui ne l'a pas encore (c'est précisément le cas réel de la
  démonstration hébergée), rien n'empêche d'insérer un doublon — c'est la situation que
  ce script répare. Sur une base jetée fraîchement migrée (comme dans mes mesures), il
  faut retirer la contrainte à la main avant de fabriquer un doublon, et la reposer
  ensuite pour prouver que le blocage est levé.

## Ce qui reste à faire

- Jouer réellement « DB doublons machine — démonstration » (lecture, puis application)
  sur la base de démonstration hébergée, puis « DB resolve » et « DB migrate & seed »,
  pour débloquer effectivement P3009. Ce lot fournit l'outil ; l'exécution sur
  l'hébergé demande le secret et reste un geste humain, nommé en clics au §7 ter de
  `docs/mise-en-ligne.md`.
