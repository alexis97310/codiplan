# 9G4D-EPREUVE-TRANSMETTRE-ET-MINUIT — passation

T0 `08:25` (Pacific/Noumea). Parti d'`origin/main` (`a7182b066`) — branche
`9G4D-EPREUVE-TRANSMETTRE-ET-MINUIT`, créée depuis ce commit (`origin/main`
n'a pas avancé pendant le lot, vérifié par `git fetch` en fin de lot). Cherry-pick
des quatre commits de la garde `9G4A1-REPRISE-9G4C-garde` absents d'`origin/main`,
sans conflit : `dfa094e4b` (cause + correctif « Lever »), `21aca0cdc` (captures
AVANT), `7551e9d96` (passation 9G4C), `eaf65f8ef` (passation 9G4A1).

## Point 2 — `pg-g14a-transmettre.spec.ts:224` — DÉFAUT DE L'ÉPREUVE, pas de l'application

Reproduit immédiatement (`pnpm exec playwright test tests/e2e/pg-g14a-transmettre.spec.ts`,
09.0s, même échec que mesuré par 9G4A1 : `[data-avertissement="…courriel_technicien_parti"]`
introuvable après le second « Déplacer »).

**Mesure** : un spec de débogage jetable (écrit, joué, puis supprimé — jamais commité)
intercalé entre le clic « Déplacer » et l'assertion a capturé l'URL après la redirection
303 de `POST /api/interventions/[id]/deplacer` :

```
REDIRECTED url deplacer= http://127.0.0.1:3210/interventions/<id>?motif=intervention.refus.jour_ferme
```

Le DÉPLACEMENT lui-même est **refusé** (`intervention.refus.jour_ferme`,
`lib/interventions/pose.ts:160`, `verdictOuverture`) avant même d'atteindre
`avertirApresPlanification` — ce n'est donc jamais une question de courriel. L'assertion
sur le titre (`statut.affectee`, ligne 217-219) passait quand même, silencieusement : un
refus laisse l'ancien état en place, qui était DÉJÀ « Affectée » depuis Transmettre.

`jourDeplace = jourSuivant(reperes.lundi, 147)` est tombé sur le **Lundi de Pâques**
(`2027-03-29`), confirmé en base :

```sql
select date, libelle, territoire from jour_ferie where date = '2027-03-29';
--  2027-03-29 | Lundi de Pâques | NC
--  2027-03-29 | Lundi de Pâques | FR
```

`jourInitial`/`jourDeplace` ne visent qu'un jour de la SEMAINE (+140 et +147 jours,
jamais une date précise) : selon la date du jour où la suite tourne, l'un des deux rangs
peut tomber sur un jour férié. Le dépôt refuse alors tant que
`confirmer_hors_ouverture` ne le confirme pas explicitement — **comportement voulu**
(D93, RG-PLA-07) : un jour fermé ne se pose jamais sans confirmation. L'application se
comporte CORRECTEMENT ; c'est l'épreuve qui ne coche jamais cette case avant de poser
une date, et qui devient donc indéterministe (verte ou rouge selon le jour civil
d'exécution).

**Correctif** (`tests/e2e/pg-g14a-transmettre.spec.ts`, deux lignes ajoutées) : coche
`confirmer_hors_ouverture` sur les deux soumissions qui posent une date — initiale et
déplacement. Sans effet quand le jour ouvre déjà (comportement documenté des deux
dialogues, `DialoguePlanifier`/`DialogueDeplacer` : « toujours présente, sans effet si
la pose reste dans l'ouverture ») : l'épreuve ne mesure pas `jour_ferme`, elle devient
seulement indifférente à la date du jour où elle tourne. Rejoué `--repeat-each=3` :
3/3 verts.

## Point 3 — la course de minuit sur `lundiSansJourPasse`

Cause déjà établie par lecture (9G4A1, non reproduite par horloge simulée — l'outil ne
le permet pas ici, pas d'accès à faux le temps système d'un process serveur
séparé sans redémarrer tout le harnais) : `ecrireLaScene` (préparation globale, une
seule fois) et `reperesDeLaScene` (rappelée dans le `beforeAll` de CHAQUE fichier)
recalculaient chacun « aujourd'hui » à l'instant où ILS tournaient — deux instants
distincts d'une suite qui dépasse largement l'heure sous `CI=1 --workers=1`. Si minuit
s'intercale entre les deux et fait franchir MARDI pour l'un des deux processus mais pas
pour l'autre, `lundiSansJourPasse` avance d'une semaine entière pour un seul des deux :
la scène écrite en base et la semaine visée par le scénario divergent.

**Correctif** (`tests/e2e/setup/scene.ts`, `tests/e2e/setup/reperes.ts`) : `ecrireLaScene`
pose désormais le `lundi` calculé dans `process.env[E2E_LUNDI_SCENE]` (constante
`VARIABLE_LUNDI_SCENE`, exportée) — même mécanisme déjà en service pour
`VARIABLE_CLES_ACTIVEES` (`session.ts`) : la préparation globale tourne dans le
processus PARENT, avant que Playwright ne distribue le moindre fichier à un worker, et
un `process.env` qu'elle pose y est hérité par CHAQUE worker, y compris un worker né en
cours de run. `reperesDeLaScene` relit cette valeur telle quelle au lieu de la
recalculer (secours : recalcul local UNIQUEMENT si la variable est absente — un appel
hors du harnais `global.ts`, par exemple `tests/audit-fonctionnel/comptes.ts` qui
partage le même `globalSetup`, ou un test unitaire). Ce n'est plus un second calcul,
c'est la même valeur : les deux processus ne peuvent plus diverger.

**Mesure** (gardien ajouté, `tests/unit/e2e-lundi-scene-memorise.test.ts`, 3 tests) : le
roundtrip `process.env` rend EXACTEMENT la valeur posée, y compris un lundi posé
« avant minuit » et relu après — la course venait d'un RECALCUL entre deux instants,
jamais d'une simple relecture, et ce gardien prouve que la relecture ne recalcule plus
rien.

Rejoué `planning-largeur-et-carte.spec.ts` + `planning-survol-cases.spec.ts` : 14/14
verts (pas de franchissement de minuit pendant cette mesure, comme pour 9G4A1 — la
preuve que la course a disparu est dans la lecture du nouveau mécanisme, pas dans une
reproduction en direct).

## Étape 4 — épreuves citées + les deux du dialogue, `--repeat-each=3`

```
pnpm exec playwright test tests/e2e/planning-largeur-et-carte.spec.ts \
  tests/e2e/planning-survol-cases.spec.ts tests/e2e/pg-g14a-transmettre.spec.ts \
  tests/e2e/absences-levee-confirmation.spec.ts \
  tests/e2e/9ewb1-feuille-basse-375-menu-plus.spec.ts --workers=1 --repeat-each=3
```

→ **105 passed** (4.8 min).

## `pnpm verify` — vert

`format:check`, `typecheck`, `lint`, `test` (475/475), `test:isolation` (192/192),
`build` : tous verts, exit 0, rejoué en fin de lot après le rebase (voir plus bas).

## `CI=1 pnpm verify:full` — N'A PAS FINI DANS LE BUDGET (troisième reprise
consécutive, déjà signalé par 9G4C et 9G4A1)

Lancé en un seul appel, au premier plan, à 08:46 — tué après 55 min (limite de l'outil,
pas un verdict du code) en plein milieu de la suite e2e. `format:check`, `typecheck`,
`lint`, `test`, `test:isolation`, `build`, `feries:horizon`, `audit:partitions` ont tous
tourné et réussi AVANT que la suite e2e (1668 tests) ne démarre. À l'arrêt : **1265
passés, 17 ignorés, 1 retry puis flaky (passé au second essai), ZÉRO échec rouge final**
(aucune annotation `::error::` du reporter `github`, qui n'en émet qu'à un échec
définitif) — environ 77 % de la suite jouée sans un seul échec. Capturé dans
`verify-final.txt` (665 lignes, tronqué par l'arrêt). Des captures régénérées par
effet de bord d'AUTRES épreuves (47-AVERTISSEMENTS-1, 9DF-TP-CY2-MATRICE-D8, et ~310
fichiers modifiés par la suite complète jouée une fois en plus par `pnpm build`/tests)
ont été restaurées ou supprimées avant de committer, conformément à la consigne.

`pnpm verify` SEUL (sans `:full`) a été rejoué séparément après coup : exit 0.

**Troisième reprise de suite où `verify:full` dépasse le budget du ticket** (9G4C puis
9G4A1 l'avaient déjà signalé) : la suite e2e complète dépasse largement l'heure sous
`CI=1 --workers=1`. Hors territoire de ce ticket pour en faire quoi que ce soit (aucun
fichier de `tests/e2e/` ou de configuration Playwright ne le permettrait sans toucher à
la portée du lot) — à nommer comme ticket dédié si la contrainte doit changer
(parallélisation, ou budget de lot élargi pour `verify:full`).

## Captures

Aucune — ce lot ne touche aucun écran (deux épreuves e2e et leur scène partagée). Pas de
capture AVANT/APRÈS.

## Points ouverts

- `verify:full` continue de dépasser le budget d'un lot sous `CI=1 --workers=1` (voir
  ci-dessus) — troisième mesure consécutive du même fait, jamais corrigé ici (hors
  territoire).
- La course de minuit est corrigée par construction (un seul calcul, partagé) ; elle
  n'a pas été reproduite par horloge simulée faute d'un moyen, dans ce harnais, de
  truquer l'heure du processus `next start` séparé sans redémarrer toute la
  préparation globale. Si une mesure plus directe est un jour voulue, il faudrait un
  point d'entrée dédié (horloge injectable dans `global.ts` et dans le serveur de
  test), hors du périmètre de ce ticket.

## Fin de lot

`git fetch origin` : `origin/main` toujours à `a7182b066`, rien à rebaser.
`CI=1 pnpm verify` rejoué : vert, exit 0. `git status --porcelain` vide (après retrait
des captures régénérées par effet de bord d'autres tickets). Aucun push.
