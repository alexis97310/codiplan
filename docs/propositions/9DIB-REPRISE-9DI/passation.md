# 9DIB-REPRISE-9DI — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

Rien de fonctionnel côté produit : ce lot rejoue le travail déjà fini de 9DI-TP-TER1-JOURNEE-FICHE, qui dormait sur la branche locale `9DIA-REPRISE-9DI-garde`. La garde avait été vérifiée verte par 9DIA SAUF `captures-pg-a6-libelle-sans-duree.spec.ts`, rouge sur `main` depuis dimanche 11:00 Nouméa pour une raison de date — corrigée entre-temps par `9D0-E2E-PGA6-DIMANCHE` (`d7013805`), déjà présente sur `origin/main` au début de cette session.

Les dix commits de la garde ont été rejoués par `git cherry-pick`, dans l'ordre, sur `origin/main` tel qu'il était au début de la session (`696ec5dd`, après 9DKA) :

1. `9DI — retouches R1/R2 de la relecture de 9DG`
2. `9DI — journée, fiche, compteur et barre basse du technicien`
3. `9DIA — D161, décision QE-11 : journée et fiche du technicien`
4. `9DI — épreuve de bout en bout de la journée et de la fiche`
5. `9DI — adapte trois épreuves existantes aux libellés et à l'URL que ce lot change`
6. `9DI — captures AVANT/APRÈS de la journée, de la fiche, du profil et de la barre basse`
7. `9DI — passation`
8. `9DIA — passation`
9. `9DI — adapte l'épreuve 9DE au libellé et à l'URL que ce lot change`
10. `9DIA — passation mise à jour : second rebase, conflit réel avec 9DEB/D173`

**Trois conflits à la reprise, tous positionnels ou additifs — aucun n'opposait deux lectures contraires d'une même règle :**

- **`app/(mobile)/terrain/[id]/page.tsx`** : depuis la garde, `origin/main` avait reçu `9DF-TP-CY2-MATRICE-D8` (D160), qui introduit SA PROPRE lecture de `verdictDemarrer` (même fonction, `peutDemarrerLeCompteur`, appelée sur la variable `statut` déjà castée plus haut, avec son propre commentaire D160/QT-4). Le cherry-pick de 9DI réintroduisait une SECONDE déclaration du même nom, plus un import dupliqué de `peutDemarrerLeCompteur` et un import désormais inutile de `StatutIntervention`. Résolu en gardant la version D160 (déjà publiée, donc canonique) pour le calcul de `verdictDemarrer`, et en conservant intégralement les apports propres à 9DI (lecture des machines, du contact, `enPause`/« Reprendre le compteur ») à la suite — les deux fonctionnalités sont indépendantes et aucune n'efface l'autre. Import dupliqué et import mort supprimés.
- **`docs/arbitrages.md`** : conflit purement positionnel entre **D162** (9DJ-TP-ACC1-DONNER-ACCES, déjà publiée par un autre lot pendant que la garde de 9DI dormait) et **D161** (9DI elle-même) — les deux décisions s'inséraient au même endroit, à la suite de D160. Résolu en gardant D162 (déjà sur `main`) puis en ajoutant D161 à sa suite ; aucun des deux textes n'a été modifié.
- **`lib/i18n/fr.ts`** : même conflit positionnel, entre les clés `equipe.acces.*`/`mot_de_passe_oublie.*` (9DJ, D162) et les clés `terrain9di.e2e.*` (9DI) — deux blocs ajoutés en fin de fichier par deux lots distincts. Résolu en concaténant les deux blocs, aucune clé modifiée ni retirée.

Pour l'exploitation : la fiche terrain gagne sa barre basse (« Journée » / « Profil »), la priorité, le créneau, la panne signalée, les machines, le contact joignable, le bandeau « compteur en cours », et le bouton du compteur dit désormais « Reprendre le compteur » sur une intervention déjà démarrée mais en pause — **sans rien retirer** de ce que D160 (matrice D8) avait posé entre-temps sur le même écran, ni de ce que D162 avait déjà publié dans le dictionnaire et le journal des décisions.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

**`pnpm verify`** (format, typecheck, lint, build + tests) : rouge à la première exécution après les dix cherry-picks — **2 tests d'isolation en échec** dans `tests/isolation/absence.test.ts` (sur 4000 tests unitaires et 1401 tests d'isolation), tous deux ÉTRANGERS au lot (ils viennent de `9DK-PG-G15A-ABSENCE-ECOURTER`, déjà sur `main` avant la garde de 9DI). Diagnostiqué, corrigé (voir « ce que j'ai tranché »), puis **`pnpm verify` rejoué en entier : vert** — format:check, typecheck, lint, 4000 tests unitaires passed, 1401 tests d'isolation passed (25/25 sur `absence.test.ts`), build réussi.

**`pnpm feries:horizon`** : vert, 2 territoires (XA, ZZ), dernier férié 2028-12-04, ≥ 12 mois d'avance partout.

**`pnpm audit:partitions`** : vert, 13 partitions couvertes jusqu'à 2027-10, partition par défaut présente et vide (préventif et détectif verts).

**`pnpm test:e2e`, première passe complète (881 tests, non shardée — tournée en une fois, ~36 minutes sous `CI=1`)** : **2 échecs**, tous deux étrangers au lot, tous deux retombés DEUX FOIS (Playwright retente une fois automatiquement) :
1. `tests/e2e/absences-ecourter-etat.spec.ts` (9DK) : « ÉCOURTER une absence EN COURS, fin = aujourd'hui — accepté » — attendu `2026-10-04`, reçu `2026-10-09`.
2. `tests/e2e/acces-technicien.spec.ts` (9DJ, D162) : `getByText('Le compteur tourne.')` introuvable après « Démarrer l'intervention ».

Diagnostiqués, corrigés (voir ci-dessous), **`pnpm test:e2e` rejoué en entier une seconde fois** : **874 passed, 7 skipped, 0 failed (~35 minutes)**. Les 7 « skipped » portent chacun un message explicite déjà documenté ailleurs (captures non prises hors fenêtre), sans rapport avec ce lot.

**La spec de captures de 9DI** (`tests/e2e/captures-9di-tp-ter1-journee-fiche.spec.ts`) a été rejouée séparément avec `CAPTURES_9DI=/tmp/captures-9di` : **8/8 passed**. Comparaison octet à octet avec les PNG déjà commités par 9DI : **6 fichiers différents** (`fiche-apres-*`, `journee-apres-*`, `journee-bandeau-apres-375`, `reprendre-apres-375`), **2 identiques** (`profil-apres-*`, écran non touché par ce qui a changé entre-temps). Inspection visuelle des deux versions de `fiche-apres-1280.png` : la version commitée par 9DI montre encore l'ANCIEN formulaire de signature (nom + qualité, texte libre) ; la version régénérée montre les TROIS boutons de signature (« Signature du client », « Client absent », « Refus de signer ») et le bloc « Terminer » — c'est `D173` (9DE-TP-CY1-TERMINER-SIGNATURE), déjà intégré par 9DIA sur ce même fichier, qui a changé l'écran après que 9DI avait pris ses propres captures. Les 6 captures différentes ont été remplacées ; les 2 identiques laissées intactes. Captures AVANT non touchées (code d'un lot antérieur à ce qu'intègre cette reprise).

**Effet de bord mesuré à CHAQUE exécution de `pnpm test:e2e`** : la suite complète réécrit, en l'écrasant, jusqu'à 112 PNG suivis et crée jusqu'à 12 fichiers neufs appartenant à des dizaines d'AUTRES lots (`47-AVERTISSEMENTS-1`, `9DF-TP-CY2-MATRICE-D8`, `9DK-PG-G15A-ABSENCE-ECOURTER`, etc.) — observé IDENTIQUEMENT après chacune des deux passes complètes. Avant chaque commit, `git status --porcelain` a été vérifié et tout fichier étranger restauré (`git restore --source=HEAD --pathspec-from-file=...`) ou supprimé (nouveaux fichiers non suivis) — seuls les fichiers du lot ont été ajoutés (`git add` nommé, jamais `-A` ni `.`).

## Ce que j'ai tranché et pourquoi

**Les deux tests d'isolation/e2e cassés par `tests/isolation/absence.test.ts`, `tests/e2e/absences-ecourter-etat.spec.ts` sont la MÊME famille de défaut que `9D0-E2E-PGA6-DIMANCHE` a déjà nommée et corrigée ailleurs** : une date ou une heure « d'aujourd'hui » lue en UTC naïf (`new Date()` + `getUTCDate()`), alors que la règle métier qu'elle alimente (`debutDuJourSociete`, dans `lib/absences/depot.ts`) juge « aujourd'hui » dans le fuseau de la société (Pacific/Noumea, UTC+11). Au moment de cette session, l'heure UTC était encore le 4 octobre tandis que Nouméa était déjà le 5 — un jour d'écart qui a fait passer une absence « en cours » pour « pas encore commencée » (ou l'inverse) selon le test. J'ai traité ces deux fichiers comme le piège connu le prescrit pour une épreuve ÉTRANGÈRE au lot : lu avant de conclure, diagnostiqué que la cause est la MISE EN SCÈNE (une date mal calculée), jamais l'assertion elle-même ni la règle métier — corrigé en recalculant les dates via `lib/calendar` (`maintenant`, `jourDe`, `jourSuivant`, `cleJour`, `lundiDeLaSemaine`), dans le fuseau de la société plutôt qu'en UTC. `LUNDI_A_VENIR` (`tests/isolation/absence.test.ts`), hardcodé au 05/10/2026 par 9DK le 04/10 comme « dans l'avenir », est devenu « aujourd'hui » le jour même de cette session (même mécanisme que `LUNDI` avant lui, décrit par le commentaire original) : recalculé dynamiquement plutôt que remplacé par une nouvelle date fixe, pour ne plus jamais rattraper la date du jour. Aucune assertion n'a été affaiblie, aucune règle métier touchée.

**`tests/e2e/acces-technicien.spec.ts` (9DJ, D162) attendait un libellé que 9DI a lui-même renommé** : « Le compteur tourne. » devient « Le compteur tourne depuis HH:MM » (D161, TR-16) — 9DJ a été écrit et publié sur `main` alors que la garde de 9DI dormait encore sur sa branche locale, donc sans connaître ce renommage. C'est exactement le cas déjà traité par le commit 5 de 9DI lui-même (« adapte trois épreuves existantes ») et par 9DIA pour `9de-terminer-signature.spec.ts` : une épreuve étrangère cassée par la fusion que CE lot introduit, pas par une pollution de scène. Adapté avec le même procédé — confronter le préfixe stable par une expression régulière (`new RegExp(fr["terrain.compteur.tourne_depuis"])`), rien d'autre, aucune assertion de fond affaiblie.

**Les captures de 9DI ont été régénérées plutôt que laissées telles quelles** : la consigne du lot l'exige explicitement si le code a bougé, et il a bougé — `D173` (déjà intégrée par 9DIA au même fichier) a changé l'écran de signature après que les captures originales ont été prises. Les 2 captures de profil, où rien n'a changé, ont été laissées intactes plutôt que régénérées sans raison.

## Ce que je n'ai PAS fait

Aucune fonctionnalité nouvelle. Aucune migration, aucune ligne de semis, aucun prix, aucune logique métier changée — les trois corrections apportées à des épreuves étrangères touchent uniquement le calcul d'une date de scène ou le texte attendu à l'écran, jamais une règle de `lib/`. Je n'ai pas touché `depot/` ni `11-FILE.sh`. Je n'ai pas réécrit la branche `9DIA-REPRISE-9DI-garde` (elle reste intacte, pour mémoire). Je n'ai pas renuméroté `docs/arbitrages.md`. Je n'ai pas touché `cleDuProchainLundi()` (`tests/e2e/absences-ecourter-etat.spec.ts`) — même défaut latent en apparence (UTC naïf), mais AUCUN test ne l'a fait rougir pendant cette session (voir « pièges » ci-dessous) ; je n'ai corrigé que ce qui a réellement rougi. Je n'ai pas poussé : tout reste commité en local, sur la branche détachée au-dessus d'`origin/main`.

## Les pièges pour la session suivante

**Une date de scène « dans l'avenir » au moment de l'écrire n'est jamais une garantie durable** : `LUNDI_A_VENIR`, posé par 9DK le 04/10/2026 avec trois semaines d'avance sur `LUNDI` (14/09), est devenu « aujourd'hui » dès le 05/10/2026 — le jour même où cette session de reprise a tourné. Le correctif n'est pas de choisir une nouvelle date fixe plus lointaine (elle rattrapera « aujourd'hui » à son tour), mais de calculer la date au moment de l'exécution, comme le fait déjà `dansNJours` dans `tests/isolation/absence.test.ts` (describe QT-15) — SAUF que cette fonction-là lisait l'UTC naïf plutôt que le fuseau qu'elle prétendait lire en commentaire : vérifier le CALCUL, pas seulement l'INTENTION écrite en commentaire.

**Entre minuit UTC et 11h locales, la date UTC et la date Nouméa (UTC+11) diffèrent d'un jour calendaire entier** — pas seulement aux limites de semaine (le piège déjà nommé par `9D0-E2E-PGA6-DIMANCHE` pour un dimanche) mais à CHAQUE changement de jour. Tout calcul de date de scène en UTC naïf (`new Date()`, `getUTCDate()`, `setUTCDate()`) qui alimente une règle jugée dans le fuseau de la société est un défaut latent, qui ne se manifeste que dans cette fenêtre de 11 heures. `tests/e2e/absences-ecourter-etat.spec.ts` en portait DEUX instances : `dansNJours` (corrigée, a fait rougir un test réel pendant cette session) et `cleDuProchainLundi` (NON corrigée, n'a fait rougir aucun test pendant cette session — seulement un risque théorique, comme `reperes.lundi` déjà nommé par la passation de `9D0-E2E-PGA6-DIMANCHE`). À surveiller si la file publie un rouge dans cette fenêtre horaire précise.

**Lancer `pnpm test:e2e` en entier réécrit, par effet de bord, les PNG de captures AVANT/APRÈS de dizaines de lots antérieurs** — jusqu'à 112 fichiers suivis et 12 fichiers neufs à chaque passe, observé deux fois à l'identique pendant cette session. Toujours vérifier `git status --porcelain` et restaurer (`git restore --source=HEAD --pathspec-from-file=...`) ou supprimer tout `captures/*.png` étranger AVANT tout commit — y compris après avoir régénéré intentionnellement les captures d'UN lot précis (le second passage a recréé exactement les mêmes 124 fichiers étrangers que le premier).

**Un conflit de cherry-pick sur un fichier qui a reçu une fonctionnalité INDÉPENDANTE entre-temps (ici D160 sur `page.tsx`) peut laisser un import dupliqué ou un import mort après une résolution naïve** : toujours relire les imports du fichier après résolution (`grep -n "^import"`), pas seulement le corps — `tsc`/`eslint` les auraient signalés, mais autant les retirer au moment de la résolution plutôt que de laisser une étape de vérification les détecter en aval.

**`main` est détenu par un autre worktree** (`/home/aplou/codiplan` ici) : travailler en HEAD détachée à partir d'`origin/main` à jour fonctionne pour accumuler les commits de reprise ; c'est la file (`11-FILE.sh`) qui les publie.

## Ce qui reste à faire

Rien côté 9DI à proprement parler : le lot est intégré, vert sur `pnpm verify`, `pnpm feries:horizon`, `pnpm audit:partitions` et `pnpm test:e2e` en entier (874 passed, 7 skipped, 0 failed), et commité. Restent, hors mandat de cette reprise :
- `cleDuProchainLundi()` (`tests/e2e/absences-ecourter-etat.spec.ts`) porte le même défaut latent (UTC naïf) que `dansNJours` portait — non corrigé faute d'avoir été observé en défaut pendant cette session ; à surveiller si la file publie un rouge entre minuit UTC et 11h Nouméa ;
- les points déjà laissés ouverts par D161 (reprise d'une SUSPENDUE depuis le terrain, question posée à Alexis) et les entrées « Machines »/« Scanner » de la barre basse, qui arriveront avec TP-PARC ;
- un recensement par `grep` des autres épreuves e2e qui calculent une date de scène en UTC naïf plutôt que dans le fuseau de la société reste à faire — suggéré une première fois par la passation de `9D0-E2E-PGA6-DIMANCHE`, et cette session en a trouvé deux instances supplémentaires sans chercher les autres.
