# 9J08-PORTAIL-BON-TELECHARGEABLE — passation (reprise 9J08B)

Chaîne : 9J08 (arrêté sans code, 06/11 10:11) → 9J08A-REPRISE-9J08 (code écrit, isolation et captures non
jouées — consigne du pilote du 05/11) → **9J08B-REPRISE-9J08A** (cette session, T0 15:25, Pacific/Noumea).

## Ce que 9J08A a livré, et la mesure qui a rouvert ce ticket

Le détail point par point (composition partagée, condition de clôture propre au portail, lecture dédiée,
route et écran) est dans `9J08A-passation.md`, inchangé par cette reprise. Le pilote a mesuré, après coup, que
la seule épreuve d'isolation du bon portail (`tests/isolation/9j08a-portail-bon.test.ts`) échouait sur ses 4
scénarios : `PrismaClientInitializationError … Environment variable not found: DATABASE_URL`.

## Ce que 9J08B a trouvé et corrigé

**Le chemin de production n'était pas en cause.** `composerBon`, `lireBonDuParc` et `bonInterventionDuParc`
acceptaient et transmettaient déjà un `connexion?: PrismaClient` facultatif jusqu'à `avecContexteApplicatif`
(lib/db/client.ts) — exactement la convention des autres dépôts portail. La panne venait de **l'épreuve
elle-même** : ses 4 appels à `bonInterventionDuParc` ne passaient que deux arguments (`contexte`, `id`),
jamais le troisième. Sans client explicite, `avecContexteApplicatif` retombe sur le client par défaut
(`prisma`, piloté par `DATABASE_URL`), absent sous le harnais d'isolation — exactement la pile que le pilote a
mesurée. Les épreuves sœurs du même fichier de décor
(`tests/isolation/9j07-portail-intervention-etat.test.ts`) passent, elles, `clientApp()` à chaque appel de
dépôt portail : c'est ce troisième argument qui manquait ici.

Correction : les 4 appels de `tests/isolation/9j08a-portail-bon.test.ts` passent désormais `clientApp()`
(import ajouté depuis `./setup/db`). Aucun fichier de production touché.

`pnpm test:isolation` joué EN ENTIER : **221 fichiers, 1904 épreuves, toutes vertes** — les 4 épreuves de
9J08A comprises, rien d'autre de rouge.

## Captures (point 4, faites par cette session)

`tests/e2e/captures-9j08a-portail-bon.spec.ts` — même recette que
`captures-9j07-portail-intervention-etat.spec.ts` pour la scène portail (compte invité, intervention jetable
CLÔTURÉE, afterAll qui l'efface) et `captures-9i7-bon-en-tuiles.spec.ts` pour le rendu impression
(`emulateMedia({ media: "print" })`). AVANT non capturé : l'écran n'existait pas avant 9J08A. 4 épreuves
vertes :

- lien « Télécharger le bon » visible sur la fiche portail d'une intervention clôturée, à 1280 px ;
- le bon lui-même à 375 px, à 1280 px et en rendu impression.

PNG versés dans `docs/etudes/equipe-2026-10-29/tickets/9J08-captures/`. Vérifiés à l'œil : aucun montant, aucun
taux, aucune valorisation à l'écran — cohérent avec le gardien statique
`tests/unit/portail/bon-sans-montant.test.ts`.

## Ce qui reste tel que 9J08A l'a laissé, volontairement non touché

**Les deux champs du bon vides côté portail — les segments de travail (toujours `[]`) et le nom du technicien
affecté (toujours `null`/« — ») — restent dus à deux politiques RLS déjà en vigueur, non touchées par ce
ticket** (voir §3 de `9J08A-passation.md`) : `segment_travail` ferme sa lecture à `app.client_id IS NULL`
(D94, forme « interne »), et `utilisateur` ferme sa branche de rattachement au même discriminant. Aucun des
deux n'est un défaut de ce ticket à corriger — les corriger toucherait une politique RLS, point d'arrêt
explicite de 9J08A. **C'est une question pour Alexis**, pas une réparation à faire en file.

## Portes de sortie jouées dans cette session (9J08B)

`pnpm format` : vert (rien à reformater). `pnpm typecheck` : vert. `pnpm lint --max-warnings 0` : vert.
`pnpm test` (unitaire, `--project unit`) : 503 fichiers, 5522 tests, vert. `pnpm test:isolation` : 221
fichiers, 1904 tests, vert. Captures e2e ciblées (4 épreuves) : vertes.

`CI=1 pnpm verify` : voir le journal commité séparément si besoin — joué en fin de session avant rebase.

## Arbre

Branche dédiée `9J08B-REPRISE-9J08A`, créée depuis `origin/main` (`de83e1845`, HEAD au départ de cette
session) — la garde `9J08A-REPRISE-9J08-garde` n'était pas sur `main`. Les 3 commits de la garde ont été
reportés par cherry-pick, puis complétés par les commits de cette reprise. `git fetch origin` + `git rebase
origin/main` joués en fin de session. Aucun push.
