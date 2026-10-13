# 9EV-DIRECTION-TOUS-DROITS — passation

**MIGRATION À APPLIQUER EN PRODUCTION PAR ALEXIS (flux DB migrate & seed) — nom du dossier de migration : `20261013150000_direction_administre_identites`.**

## Ce qui est livré (sept commits, tous verts individuellement)

1. Matrice (`lib/auth/habilitations.ts`) : la direction reçoit le ● sur `saisir_rapport`, `parametrer_societe`, `administrer_utilisateurs`, `administrer_agences`, `regler_trajets` — exactement les cinq capacités où elle n'avait pas encore tous les droits de l'administrateur de société. Gardien unitaire ajouté : pour toute capacité, si `admin_societe` a ●, `direction` l'a aussi (parcourt `CAPACITES`, jamais une liste écrite à la main).
2. Migration `20261013150000_direction_administre_identites` : `app_peut_administrer_identites()` reconnaît désormais `admin_societe` ET `direction` — une seule fonction `CREATE OR REPLACE`, aucune politique recréée. Elle gouverne trois politiques existantes sans les toucher : `utilisateur_ouverture`, `utilisateur_modification` (L1-02c), `second_facteur_deverrouillage` (D66).
3. Épreuves inversées (droits-ecrans-tp-s3, deverrouillage-escalade, acces-technicien, acces-bureau) : les refus nommés de la direction deviennent des acceptations. Correctif trouvé en inversant : `etatsAccesDesComptes` (`lib/auth/acces-bureau.ts`) n'agrégeait l'historique d'envoi de lien que des `admin_societe` — un lien envoyé par la direction restait invisible à l'écran Équipe (même panne que le solde 175 de 9ET-COMPTES-BUREAU-2, pour un second rôle). Dérivé désormais de la matrice.
4. Messages (`lib/auth/deverrouillage.ts`, `lib/auth/acces-technicien.ts`, `lib/auth/acces-bureau.ts`) : « l'administrateur de la société » devient « l'administrateur de la société ou la direction ».
5. Décision **D199** dans `docs/arbitrages.md`, amendant D37, D66, D153, D162 (câblage bidirectionnel tenu par `tests/unit/docs/amendements-arbitrages.test.ts`). D40 et D65 ne sont PAS amendées — dit en prose, volontairement. Cinq tickets du backlog relus contre le texte courant (gardien `coherence-backlog`) ; deux corrigés sur le fond (L7-01, L7-04 — leurs critères d'acceptation affirmaient encore que la direction était exclue d'un geste qu'elle partage désormais).
6. Épreuve de bout en bout (`tests/e2e/9ev-direction-tous-droits.spec.ts`) : connectée en direction (identité propre, préfixée, jamais `SCENE.*`), elle ouvre Équipe (volet technicien présent), agences (« Nouvel établissement » présent) et taux horaire (formulaire d'écriture présent). Captures 375/1280 des trois écrans dans `docs/propositions/9EV-DIRECTION-TOUS-DROITS/captures/`.

## DÉCOUVERTE MAJEURE, HORS TERRITOIRE DE CE LOT — à arbitrer séparément

En fiabilisant l'épreuve de déverrouillage (point « correctif majeur »), la suite isolation complète a révélé que **`second_facteur_modification`** (politique RLS posée par L1-02d, 08/09/2026) est une **seconde politique permissive d'`UPDATE`** sur `second_facteur`, combinée **par OR** à `second_facteur_deverrouillage` (D66) — PostgreSQL combine toutes les politiques permissives d'une même commande. Sa branche `utilisateur_id = app.utilisateur_id` matche la **propre ligne de l'AUTEUR** du déverrouillage, **indépendamment de son état de verrouillage**.

**Conséquence mesurée : en production, le geste L7-04 (déverrouiller un compte à l'escalade) échoue systématiquement dès que l'auteur a lui-même un second facteur enrôlé.** Or `admin_societe` et `direction` ont TOUS LES DEUX un second facteur obligatoire (D40) — c'est-à-dire que **tout administrateur réel** qui tente de déverrouiller quelqu'un d'autre voit sa PROPRE ligne de `second_facteur` matchée en plus de celle du sujet visé, l'`UPDATE` sans `WHERE` touche 2 lignes, et `deverrouillerSecondFacteur` (`lib/auth/deverrouillage.ts:116-124`) refuse par sûreté (« la politique de déverrouillage ne borne plus ce qu'elle devrait »).

Le test existant (`tests/isolation/deverrouillage-escalade.test.ts`, « l'administrateur de SA société écrit ») ne l'a jamais vu parce que sa fixture `ADMIN_A` n'a jamais sa propre ligne de `second_facteur` dans la suite — un angle mort du harnais de test, pas une preuve que le geste marche en production.

**Ce n'est ni le territoire ni la décision de ce lot** (D199 ne touche à aucune politique RLS, et toucher `second_facteur_modification` ou `second_facteur_deverrouillage` est un changement de cloisonnement — CLAUDE.md §8 : point d'arrêt explicite). **Recommandation : ouvrir un ticket dédié** qui borne `second_facteur_deverrouillage` pour qu'elle ne matche QUE la ligne du sujet désigné, indépendamment de ce que `second_facteur_modification` autoriserait par ailleurs sur la ligne de l'auteur — par exemple en excluant explicitement `utilisateur_id = app.utilisateur_id` du côté « modification » sous un contexte de déverrouillage, ou en donnant à `second_facteur_deverrouillage` une forme RESTRICTIVE plutôt que PERMISSIVE (`AS RESTRICTIVE`) pour qu'elle borne au lieu de s'ajouter. **À vérifier avant de corriger : si le geste est aujourd'hui réellement cassé en production, c'est potentiellement urgent.**

Correctif local appliqué (ne règle que l'épreuve, pas la politique) : `tests/isolation/deverrouillage-escalade.test.ts` utilise désormais une identité dédiée pour le sujet (jamais `SUJET_A`, partagée avec d'autres scénarios) et `ADMIN_A` comme auteur (jamais `ADV_A`, qui porte une ligne `second_facteur` laissée par `categorie-authentification.test.ts`, fixture `AUTRUI`, sans nettoyage).

## État de la vérification

- `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (unit, 4647 épreuves), `pnpm test:isolation` (1542 épreuves) : **verts**, rejoués individuellement à plusieurs reprises après chaque correctif.
- `tests/isolation` en entier (`pnpm test:isolation`) rejoué **3 fois d'affilée, propre** après le correctif de déverrouillage (voir « correctif majeur » ci-dessus) — avant ce correctif, il échouait ~2 fois sur 3.
- Épreuves voisines e2e (`equipe.spec.ts`, `equipe-1.spec.ts`, `equipe-agence-inactive.spec.ts`, `acces-technicien.spec.ts`, `droits-rm-rs.spec.ts`, `habilitations.spec.ts`, `volet-equipe.spec.ts`) : **30/30 vertes**.
- `tests/e2e/9ev-direction-tous-droits.spec.ts` (ce lot) : **9/9 vertes**, captures produites.
- **`CI=1 pnpm verify:full` N'A PAS ÉTÉ MENÉ À SON TERME** — la commande englobe `pnpm test:e2e` (1308 épreuves, un seul worker), et deux tentatives ont dépassé le budget de session restant (la seconde a été interrompue après 50 minutes, en progression, sans aucun échec visible dans sa sortie jusque-là — voir `/tmp/verify-full-final2.log` sur ce poste, non committé). **À REJOUER ENTIÈREMENT avant de considérer ce lot clos** : `CI=1 pnpm verify:full` en un seul appel, en tâche de fond si besoin.

## Commit de tête

`git rev-parse --short HEAD` → `633aaa7e` au moment de la rédaction (neuf commits locaux sur `9EV-DIRECTION-TOUS-DROITS`, aucun push).

## Ce qui n'a pas pu être fait dans ce lot

- Rebase sur `origin/main` et `CI=1 pnpm verify` final après rebase : pas effectués, faute de temps (budget épuisé par l'investigation du correctif majeur ci-dessus, qui le justifiait).
- `CI=1 pnpm verify:full` complet (voir ci-dessus).
