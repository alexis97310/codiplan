# 9BCA-REPRISE-9BC — passation

## Ce que j'ai change

Deux commits sur `main`, en local, non pousses :

1. `3ce1d80` — **reprise de PG-A3a, PG-A6, PG-A7 depuis la branche `9BC-PG-G2-POSE-LIBELLES-garde`**,
   par `git diff $BASE $BRANCH -- <fichiers du lot> | git apply --3way` (jamais `git checkout <branche> -- fichier`).
   Aucune logique changee par rapport a ce que 9BC avait ecrit : le refus du depot en pose nomme ce qui
   manque au lieu d'un message generique (« tirez la poignee »), les libelles sans duree portent leur
   population, et un deplacement en vue Semaine garde l'heure et la duree de l'intervention. Fichiers
   d'exploitation touches : `app/(back-office)/interventions/[id]/page.tsx`,
   `app/(back-office)/planning/page.tsx`, `app/api/interventions/[id]/deplacer/route.ts`,
   `components/planning/pose.tsx`, `lib/i18n/fr.ts`. Cote tests : trois specs e2e de captures neuves,
   une spec e2e de comportement neuve (`planning-semaine-garde-heure.spec.ts`), deux specs unitaires
   neuves, une spec unitaire modifiee (`tests/unit/planning/pose.test.tsx`). Pour l'exploitation : les
   trois ecrans concernes (fiche intervention, planning, bandeau de deplacement) portent desormais les
   memes libelles et le meme comportement que ceux geles sur la branche garde — rien de nouveau n'a ete
   invente ici.
2. `98e4382` — **tas du build de production porte a 3072 Mo** (`package.json`, script `build` :
   `NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=3072" next build`). Pour l'exploitation :
   `pnpm build` (et donc `pnpm verify`, `pnpm verify:full`, tout deploiement) ne depend plus d'un pic
   memoire qui frolait la limite par defaut de Node ; c'est une decision technique reversible, pas un
   changement de logique produit.

Le fichier `docs/propositions/9BC-PG-G2-POSE-LIBELLES/passation.md` et les trois dossiers de captures
`PG-A3a-MESSAGES-POSE`, `PG-A6-LIBELLE-SANS-DUREE`, `PG-A7-SEMAINE-GARDE-HEURE` (READMEs + PNG
avant/apres) sont revenus tels quels avec le commit 1 : je ne les ai pas refaits.

## Ce que j'ai mesure

**AVANT la reprise (sur `main`, commit `e6eb98c`)** : `free -m` montrait 9448 Mo libres / 11957 Mo au
total. `/usr/bin/time -v pnpm build` : VERT, exit 0, Maximum resident set size = **2 250 888 Ko**
(~2,15 Go), temps ecoule 0:38.63.

**APRES la reprise, avant la correction du tas** (deux essais, au premier plan, l'un derriere
l'autre) :
- essai 1 : ROUGE — « Ineffective mark-compacts near heap limit … JavaScript heap out of memory »,
  « Next.js build worker exited with code: null and signal: SIGABRT ». Parent RSS mesure par
  `/usr/bin/time -v` : 2 254 180 Ko, exit 1.
- essai 2 : ROUGE, meme signature, parent RSS 2 255 892 Ko, exit 1.

Le constat de la file (heap out of memory pendant « Linting and checking validity of types ») est
**reproduit a l'identique**, deux fois de suite : ce n'est pas un defaut de logique de 9BC, c'est bien
le tas du worker de build qui est a la limite.

**APRES la correction du tas (`NODE_OPTIONS` a 3072 Mo)** (deux essais) :
- essai 1 : VERT, exit 0, parent RSS 2 539 896 Ko, temps ecoule 0:33.69.
- essai 2 : VERT, exit 0, parent RSS 2 543 520 Ko, temps ecoule 0:32.10.

## Ce que j'ai tranche et pourquoi

- **Reprise par patch cible, pas par `checkout` de branche entiere** : `git diff $BASE $BRANCH --
  <fichiers>` puis `git apply --3way`, pour ne rapporter que ce que 9BC avait ecrit sans ecraser ce qui
  est arrive sur `main` depuis (D124/D125, verdicts de pose, etc.). Le patch s'est applique proprement,
  aucun marqueur de conflit dans le resultat (verifie par recherche de `<<<<<<<`/`=======`/`>>>>>>>`).
- **Tas du build a 3072 Mo, par `NODE_OPTIONS` ajoute et non ecrase**, plutot que de toucher
  `next.config.*` : la consigne du ticket interdit d'enlever le lint ou la verification des types du
  build, et une limite memoire plus genereuse est une correction reversible qui ne change aucune
  logique. La machine dispose de 11957 Mo au total, largement au-dessus de 3072 Mo — la condition
  « si `free -m` montre moins de 5000 Mo, le dire » ne s'applique pas ici.
- Pas de troisieme piste cherchee (import circulaire, type recursif) : le tas seul a suffi a rendre le
  build vert deux fois de suite, donc l'etape 6 du ticket (chercher ce qui gonflerait la verification
  des types) ne s'est pas declenchee.

## Ce que je n'ai PAS fait

- Je n'ai pas relance `pnpm verify:full` en entier (regle en tete du ticket, decision d'Alexis du
  28/09) : j'ai fait le controle de fin de session reduit — `CI=1 pnpm verify`, puis
  `feries:horizon`/`audit:partitions`, puis un sous-ensemble cible de Playwright. C'est la file qui
  rejouera `verify:full` en entier et qui decide de la publication.
- Je n'ai pas rejoue la suite e2e complete de `tests/e2e/` (des dizaines de fichiers) : seuls les
  specs neufs/modifies du lot repris, les specs existants des ecrans touches (fiche intervention,
  planning, bandeau de deplacement), et les specs obligatoires (coque, largeur, planning) ont tourne.
- Je n'ai pas touche a une ligne de semis (`prisma/seed*.ts`), a une migration, ni a un prix.
- Je n'ai pas refait les captures des trois parties de 9BC : elles sont revenues telles quelles avec le
  patch.

## Les pieges pour la session suivante

- **Le tas du build est desormais a 3072 Mo dans `package.json`** — si un futur lot fait a nouveau
  planter le build par manque de memoire, ne pas remonter la valeur en reflexe : mesurer d'abord
  (`/usr/bin/time -v`) pour verifier si c'est encore le tas ou si quelque chose gonfle la verification
  des types (import circulaire, type recursif genere).
- Le crash observe est **non deterministe selon la charge de la machine au moment du build** (la
  session de 9BC avait eu un build vert avec le meme code) : un `pnpm build` vert une fois ne garantit
  pas qu'il le restera sous charge — d'ou les deux essais de suite exiges par le ticket, a reproduire
  pour toute investigation future sur ce sujet.
- Le controle de fin de session est desormais reduit (voir tete de ce fichier) : ne pas relancer
  `verify:full` par reflexe dans une prochaine session sur ce depot, sauf si la consigne du ticket le
  redemande explicitement.

## Ce qui reste a faire

- La file (`11-FILE.sh`) doit rejouer `CI=1 pnpm verify:full` avec le tas de build a 3072 Mo et decider
  de la publication ; ce lot ne pousse rien.
- Aucun defaut connu ni laisse ouvert dans le perimetre de ce lot.

---

## Reprise 9BCA — recapitulatif

- Commits repris depuis la branche `9BC-PG-G2-POSE-LIBELLES-garde` (base `a246446e`, 7 commits :
  `54aeab7`, `33f495b`, `fc0efb2`, `91c8a47`, `6c42cf9`, `7dacc73`, `63f8feb`) : rapportes en un seul
  commit `3ce1d80` sur `main`.
- Commit de correction du tas : `98e4382`.
- Mesures etape 2 (AVANT, sur `main`) : VERT, RSS 2 250 888 Ko.
- Mesures etape 4 (APRES reprise, avant correction) : ROUGE x2, RSS 2 254 180 Ko puis 2 255 892 Ko,
  heap OOM reproduit a l'identique du constat de la file.
- Mesures etape 5 (APRES correction du tas a 3072 Mo) : VERT x2, RSS 2 539 896 Ko puis 2 543 520 Ko.
- Valeur retenue : `--max-old-space-size=3072`, ajoutee a `NODE_OPTIONS` existant, dans le script
  `build` de `package.json` uniquement.
- Controle de fin de session (reduit, decision du 28/09) : `CI=1 pnpm verify` VERT (format, typecheck,
  lint, 299 fichiers/3101 tests unitaires, 132 fichiers/1268 tests d'isolation, build) ; `pnpm
  feries:horizon` VERT (2 territoires, horizon ≥ 12 mois) ; `pnpm audit:partitions` VERT (preventif et
  detectif) ; `CI=1 pnpm exec playwright test` sur les 17 specs cibles du lot : 99 passed, 3 skipped, 0
  failed.
- **La file rejouera `verify:full` avec le build a 3072 Mo.**
