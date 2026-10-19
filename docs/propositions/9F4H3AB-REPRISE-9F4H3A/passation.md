# 9F4H3AB-REPRISE-9F4H3A — passation

T0 = 09:40 (Pacific/Noumea). Point de départ : la garde `9F4H3AA-REPRISE-9F4H3A-garde` (11 commits : les
10 de 9F4H3A + le correctif de 9F4H3AA), rejouée par cherry-pick sur `origin/main` à jour (`e5d7a1d6`, 4
commits d'avance sur la base de la garde, aucun dans notre territoire). Aucun conflit.

## Conclusion : AUCUN défaut du lot trouvé

Deux passages de la file ont mesuré rouge : **3 min** (une étape rapide, 02:24) puis **59 min** (la suite
e2e, 03:23). Après mesure complète, aucun des deux n'est imputable au code de 9F4H3A/9F4H3AA.

### 1. L'étape rapide — non reproduite

`pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (4887 tests), `pnpm test:isolation` (1631
tests) et `pnpm build` : **chacun lancé DEUX FOIS au premier plan, tous verts, aucune instabilité
observée.** Je n'ai pas pu reproduire de rouge rapide. Hypothèse la plus probable : un aléa d'environnement
au moment du passage de la file (ce poste exécute de nombreux arbres de travail concurrents contre la même
base `codiplan_test` — voir la mémoire du poste), pas un défaut de ce lot.

### 2. La suite e2e — contamination de scène `fullyParallel`, étrangère au lot

`pnpm exec playwright test` (parallèle, workers par défaut = 12) sur ma branche : **15 échecs**, dont les
deux seuls touchant notre territoire — `tests/e2e/captures-9f4h2a-fin-avant-debut.spec.ts` (la régression
nommément corrigée par 9F4H3AA) et `tests/e2e/offline/9f4h1-consultation.spec.ts`.

Rejoués SEULS (`CI=1 --workers=1`) : **les deux passent** (1 passed chacun). Donc pas un défaut de code —
un effet de bord du parallélisme.

**Mesure sur `origin/main` NU** (zéro commit de 9F4H3A/9F4H3AA), même commande parallèle : **17 échecs**,
dont EXACTEMENT les deux mêmes fichiers (`captures-9f4h2a-fin-avant-debut`, `offline/9f4h1-consultation`),
plus 11 des 13 autres échecs de ma branche à l'identique (`absences-levee-confirmation`,
`captures-9ay-aa1-choix-sites`, `demandes-2`, `demandes-marquer-transformee`, `demandes-traitees`,
`deplanifiee-1`, `fiche-technicien-nomme`, `historique-site`, `pg-g14a-transmettre`, `registre-ux3-2`,
`9ewb1-feuille-basse-375-menu-plus`). Les échecs non communs des deux côtés (ex. `captures-9f3-...` vs
`captures-9f3b-...`, `9efb-y13-...`, `pg-g14b-...`) changent de fichier selon l'ordonnancement des workers
d'un passage à l'autre — signature d'une contamination de scène partagée sous `fullyParallel` (cf. mémoire
« e2e-semis-partage-parallele »), pas d'un défaut stable.

**Rouge seulement avec 9F4H3A = défaut du lot** (critère du mandat) : FAUX ici — rouge aussi sur
`origin/main` nu, à l'identique pour les deux fichiers de notre territoire. Aucune correction de code n'a
donc été apportée (rien à corriger).

### Vérification finale — EN UN SEUL APPEL, intégralement

`CI=1 pnpm verify:full` lancé UNE FOIS, au premier plan, sans interruption (le point qui manquait aux deux
reprises précédentes) : **VERT EN ENTIER**, `docs/propositions/9F4H3AB-REPRISE-9F4H3A/verify-final.txt` —
format:check + typecheck + lint + test (4887) + test:isolation (1631) + build + feries:horizon +
audit:partitions + test:e2e en série (`CI=1`, 1 worker) : **1465 tests, 1417 passed, 48 skipped, 0 failed**
(55.5 min pour la suite e2e seule). Sous `CI=1` (1 worker, sans parallélisme), aucune contamination de scène
n'est possible : la suite e2e complète est donc elle-même la preuve qu'aucun défaut stable ne s'y cache.

Rejoué une seconde fois en entier pour confirmer l'exit code (`echo $?` après la commande, pas après `tee`) :
**exit 0** également.

Fichiers régénérés par effet de bord de ces deux exécutions complètes de la suite e2e (captures PNG/PDF
d'autres lots, modifiées en place par leurs propres épreuves) : restaurés (`git checkout --`) ou supprimés
(nouveaux fichiers non suivis) avant chaque changement de branche et avant ce commit — aucun n'est inclus.

## Points ouverts de 9F4H3A — inchangés, non traités ici

- `saisi_hors_reseau` toujours vrai pour le compteur (point 0 de 9F4H4, HORS territoire de cette reprise).
- Ouverture déjà hors réseau → coquille `REPLI_TERRAIN` (`public/sw.js`, hors territoire).
- Une saisie refusée par `ajouterSaisie` (C2) bloque la suite sans geste de sortie dédié — jugé acceptable.
- Le tri UUID v7 à la même milliseconde n'est qu'approximatif — sans conséquence pratique mesurée.

Commit final de cette reprise : voir `git log --oneline -1` au moment du commit ci-dessous.
