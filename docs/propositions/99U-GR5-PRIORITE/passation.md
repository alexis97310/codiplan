# 99U-GR5-PRIORITE — passation

## Ce que j'ai changé

- `lib/theme/priorites.ts` (nouveau) : `tonDePriorite(priorite)` — la SEULE
  correspondance priorité → ton du dépôt. P1 rouge, P2 orange, P3 et P4 gris —
  tranché par Alexis le 26/09/2026 (la maquette donne P3 en bleu, écarté par
  cette décision). Le paramètre est typé `string`, pas `Priorite`, pour rester
  appelable depuis `tableau-de-bord/presentation.ts`, dont les types restent
  MINIMAUX par convention (aucun import de domaine).
- Cinq écrans lisent désormais cette fonction, au lieu de cinq lectures
  divergentes (constat G6 de l'audit du 26/09) :
  - `app/(back-office)/interventions/page.tsx` (registre) — la constante
    locale `TONS_PRIORITE` a été retirée, remplacée par
    `tonDePriorite(ligne.priorite)`. Le rendu ne change pas (déjà correct).
  - `app/(back-office)/planning/page.tsx` (file « À planifier ») — la
    pastille de priorité peignait la couleur du STATUT
    (`CLASSES_STATUT[ligne.statut]`) sur le texte de la PRIORITÉ : une carte
    P1 non affectée (statut `a_planifier`, gris) affichait « P1 — critique »
    en gris. Remplacée par `<Badge ton={tonDePriorite(ligne.priorite)}>`,
    la même géométrie que le registre.
  - `app/(back-office)/tableau-de-bord/page.tsx` (`ElementDePriorite`) — la
    pastille numérotée (39×39, `.rang`) était rouge EN DUR pour toutes les
    lignes, y compris celles dont le rang n'est PAS une priorité (l'ancienneté
    en jours d'une fiche « en attente de pièce », ex. `"12j"`). `ElementPriorite`
    (`presentation.ts`) gagne un champ optionnel `priorite`, posé par
    `prioritesUrgentes` et `prioritesAPlanifier` (toujours des P1-P4), jamais
    par `prioritesPieces`. La pastille garde le rouge en dur UNIQUEMENT quand
    `priorite` est absent — la seule branche où le rang n'est pas une priorité.
  - `app/(back-office)/demandes/page.tsx` et `.../demandes/[id]/page.tsx` — la
    colonne / ligne « urgence » était un texte nu (`{t(\`priorite.${...}\`)}`),
    devient `<Badge ton={tonDePriorite(demande.urgence)}>`. Le composant local
    `Ligne` de la fiche demande voit son prop `valeur` élargi de `string` à
    `React.ReactNode` pour accueillir le badge.
  - `app/(back-office)/interventions/[id]/page.tsx` (fiche) — même chose :
    la ligne « Priorité » était un texte nu, devient un badge ; même
    élargissement de `Ligne.valeur`.
- **Ce que ça change pour l'exploitation** : une intervention P1 se reconnaît
  maintenant par LA MÊME couleur (rouge) partout où sa priorité s'affiche —
  registre, planning, tableau de bord, demandes, fiche —, au lieu de trois
  lectures différentes selon l'écran (constat G6). Une P1 dans la file
  d'attente du planning n'est plus indiscernable d'une P4 par sa couleur.

## Ce que j'ai mesuré

- **AVANT** (`docs/propositions/99U-GR5-PRIORITE/captures/*-avant-*.png`,
  prises en rejouant temporairement le code du commit précédent, `7c8736a`,
  sur les 7 fichiers touchés) : la fiche d'intervention affiche « P1 —
  critique » en texte noir sans ton ; la carte de la file « À planifier » du
  planning affiche le même texte dans un fond GRIS (couleur du statut
  `a_planifier`, pas de la priorité) ; le tableau de bord affiche un rang
  rouge — **déjà rouge par accident** (le rouge était codé en dur pour TOUT
  rang, donc une P1 n'y montre AUCUN changement visible avant/après ; c'est
  noté ci-dessous, pas supposé).
- **APRÈS** (`captures/*-apres-*.png`, même scène, code corrigé) : la fiche
  et la carte du planning portent toutes deux un badge ROUGE identique à
  celui du registre ; le tableau de bord est visuellement inchangé pour
  cette P1 précisément parce qu'il était déjà rouge — la correction de ce
  fichier porte sur les priorités P2/P3/P4, non observées ici (voir « Ce qui
  reste à faire »).
- `pnpm format:check`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (2913 tests,
  dont les 4 cas neufs de `tests/unit/theme/priorites.test.ts` et les deux
  gardiens adaptés) : tous verts.
- `CI=1 pnpm verify:full`, joué EN ENTIER, TROIS FOIS après le commit : les
  deux premières fois intégralement vert (312 tests e2e passés, 3 skip
  inchangés, aucun échec). La troisième fois, 1 échec + 1 flaky, tous deux
  dans `tests/e2e/glisser-deposer.spec.ts` (planning, glisser-déposer),
  fichier hors territoire de ce ticket et non touché par lui. Signature
  identique à celle déjà documentée dans `docs/propositions/99Q-GR2-DEMANDE/
  passation.md` : un refus `chevauchement` réel remplace le refus SIMULÉ
  attendu (route interceptée), et un bloc posé par une autre scène masque
  le bloc attendu — deux symptômes d'une VRAIE collision de créneau créée
  par une épreuve concurrente (`fullyParallel`). **Mesuré, pas supposé** :
  `pnpm exec playwright test tests/e2e/glisser-deposer.spec.ts` seul, sans
  le reste de la suite en parallèle, est vert (8/8). Aucune ligne de ce
  fichier n'a été touchée.
- `tests/e2e/priorite-ton-partage.spec.ts` (nouveau, scène propre à
  identifiant fixe, supprimée dans son `afterAll`) rejoué seul sur le code
  AVANT : rouge attendu (le badge de la fiche n'existe pas encore) — les
  captures AVANT sont prises AVANT les assertions, pour survivre à cet échec
  attendu, avant que je restaure le code corrigé (`git diff --stat HEAD`
  vide sur les 7 fichiers du lot, vérifié après restauration).

## Ce que j'ai tranché, et pourquoi

- **Le paramètre de `tonDePriorite` est `string`, pas `Priorite`** :
  `tableau-de-bord/presentation.ts` déclare explicitement ne jamais importer
  de type de domaine (« types MINIMAUX »), et son champ `ElementPriorite.priorite`
  suit cette convention. Élargir le paramètre plutôt que de rompre cette
  convention pour un seul appelant.
- **`ElementPriorite.priorite` est optionnel, jamais une troisième valeur
  inventée pour les fiches « en attente de pièce »** : leur rang (`"12j"`)
  n'est pas une priorité, et lui en inventer une aurait été la même faute
  que les valeurs par défaut interdites au §8.
- **Le registre (`interventions/page.tsx`) est corrigé sans changement de
  rendu** : il utilisait déjà la bonne correspondance (`TONS_PRIORITE`,
  identique à `tonDePriorite`), donc seule la SOURCE change (fonction
  partagée au lieu d'une constante locale) — les deux gardiens qui citaient
  `TONS_PRIORITE` en dur (`colonnes-et-kpi.test.ts`, `lot-a3.test.ts`) sont
  adaptés pour citer `tonDePriorite(ligne.priorite)` à la place, sans perdre
  ce qu'ils prouvaient.
- **`Ligne.valeur` élargi à `React.ReactNode`** (fiche demande, fiche
  intervention) plutôt qu'un second composant `LigneAvecBadge` : la seule
  différence entre les deux formes est CE QUI est rendu dans `<dd>`, jamais
  la structure — dupliquer le composant pour un seul champ aurait été
  l'abstraction que rien ne demandait.

## Ce que je n'ai PAS fait

- Aucune migration, aucune ligne de semis, aucun prix, aucune règle de
  gestion touchée : `priorite`/`urgence` restent lus tels quels, seule leur
  PRÉSENTATION change.
- Aucune clé i18n renommée ni ajoutée : les cinq écrans affichent le même
  libellé qu'avant (`t(\`priorite.${...}\`)`), seul le TON autour change.
- Je n'ai pas touché aux tons P2/P3/P4 sur le tableau de bord dans les
  captures : la scène de ce lot ne pose qu'une P1 (voir ci-dessous, « ce qui
  reste »), et le rouge-en-dur qu'elle remplaçait ne s'y voit donc pas.

## Les pièges pour la session suivante

- **Le tableau de bord ne montre AUCUNE différence visible avant/après pour
  une P1** : son rang était déjà rouge en dur pour TOUT rang, donc la
  correction n'y est observable que sur une P2 (orange attendu, rouge avant)
  ou une P3/P4 (gris attendu, rouge avant). Si une session future doit
  prouver ce cas précis, poser une seconde ligne à `date_planifiee = NULL`,
  `statut = 'a_planifier'`, `priorite = 'p2'` dans la même scène jetable.
- **AVANT/APRÈS obtenus par `git checkout <commit précédent> -- <7 fichiers>`**,
  jamais par un stash : le spec de capture (`priorite-ton-partage.spec.ts`)
  reste le code ACTUEL pendant l'opération — ses assertions rougissent sur
  l'AVANT (attendu), mais les captures, placées AVANT les assertions dans le
  test, sont prises quand même. Restauré par `git checkout HEAD -- <mêmes
  fichiers>` ; `git status --porcelain` sur ces 7 chemins est vide après coup.
- `tests/e2e/priorite-ton-partage.spec.ts` déclare
  `test.describe.configure({ mode: "serial" })` : son `beforeAll` écrit une
  ligne fixe (`INSERT … ON CONFLICT DO NOTHING`), et le gardien
  `tests/unit/e2e-mise-en-scene.test.ts` l'exige pour tout `beforeAll`
  écrivant en base, sans exception implicite.
- Sa ligne (`01a0f005-0000-7000-8000-000000000001`, priorité P1, statut
  `a_planifier`, sans date) compterait dans la liste « à planifier » du
  tableau de bord si elle n'était pas supprimée : son `afterAll` la retire
  systématiquement — ne pas la rendre permanente (piège connu de ce lot,
  compteurs partagés de la société de démonstration).
- `tests/e2e/glisser-deposer.spec.ts` peut rougir sous `pnpm verify:full`
  (charge parallèle complète) mais passe seul (8/8) : une VRAIE collision de
  créneau créée par une autre épreuve du dépôt masque le refus SIMULÉ que ce
  fichier attend — déjà rencontré et documenté par 99Q-GR2-DEMANDE. Aucun
  rapport avec ce lot ; ne pas le corriger ici.

## Ce qui reste à faire

- Aucun. Le territoire du ticket (fonction partagée, cinq rendus, gardien
  adapté, tests neufs, captures, passation) est couvert. Une preuve visuelle
  du cas P2/P3/P4 au tableau de bord resterait à faire si une session future
  en a besoin (voir « pièges » ci-dessus) — non demandée par ce ticket.

## Reprise 99UA (27/09/2026)

Ce lot était FAIT sur la branche locale `99U-GR5-PRIORITE-garde` (commits
`d06c18b`, `8ce75ce`, `ec66e55`) mais jamais publié sur `main`. Cette section
documente sa reprise par `99UA-REPRISE-99U`, sans reprendre GR5 depuis zéro.

### Ce qui a été corrigé

- Le diff de la branche (`git diff <merge-base> 99U-GR5-PRIORITE-garde`,
  7 fichiers applicatifs + 4 fichiers de test) a été appliqué sur `main` par
  `git apply --3way`. Deux fichiers avaient divergé sous 99W-GR7-PRIORITES
  (audit G8, 26–27/09) et ont produit un conflit :
  - `app/(back-office)/tableau-de-bord/presentation.ts` — GR7 avait changé
    `titre`/`detail` de `prioritesUrgentes` et `prioritesAPlanifier` pour
    nommer la panne et le site (`panneOuNature`, séparateurs i18n) ; GR5
    ajoutait le champ `priorite` à `ElementPriorite`. Résolu en gardant le
    texte de GR7 et en y ajoutant la ligne `priorite: ligne.priorite,` de
    GR5 — les deux apports sont désormais présents.
  - `app/(back-office)/planning/page.tsx` — GR7 avait changé la carte de la
    file « À planifier » pour afficher `ligne.client.raison_sociale` (au
    lieu de `referenceAffichee(ligne)`) ; GR5 remplaçait la pastille
    `CLASSES_STATUT[ligne.statut]` par `<Badge ton={tonDePriorite(...)}>`.
    Résolu en gardant le nom du client de GR7 et le badge de ton de GR5 —
    `CLASSES_STATUT` n'était plus importé nulle part ailleurs dans ce
    fichier, la résolution ne pouvait donc pas le laisser en place.
  - Les 5 autres fichiers (registre, fiche demande, liste demandes, fiche
    intervention, tableau de bord — la page) et les 4 fichiers de test se
    sont appliqués sans conflit.

### La cause d'equipe-1 (MESURÉE, pas supposée)

- `equipe-1.spec.ts` était rouge dans les deux passages précédents de la
  file pour une cause SANS LIEN avec GR5 : un « strict mode violation » sur
  deux liens « 2 interventions à venir ». Vérifié ici que
  `99W-GR7-PRIORITES — étape 0 : equipe-1 vise le lien de son propre
  technicien` (commit `37b4c8d`) est déjà sur `main` — la cause est donc
  déjà corrigée en amont de cette reprise, sans action de ce lot.
- Rejoué `pnpm exec playwright test tests/e2e/equipe-1.spec.ts` seul après
  l'application du diff de GR5 : 2/2 passés. Aucune modification apportée à
  ce fichier.
- Même vérification pour `planning-6.spec.ts` (cause « `[data-aujourdhui]`
  absent » un dimanche/lundi) : `99W-GR7-PRIORITES — étape 0 : planning-6
  lit le jour civil de la société` (commit `7cc7020`) est déjà sur `main`.
  Rejoué avec `priorite-ton-partage.spec.ts` : 4/4 passés (1280 et 1440).

### Empreintes

- `pnpm format:check`, `pnpm test` (2925 tests) : verts, avant le commit de
  la reprise.
- `pnpm exec playwright test tests/e2e/equipe-1.spec.ts` : 2/2.
- `pnpm exec playwright test tests/e2e/priorite-ton-partage.spec.ts
  tests/e2e/planning-6.spec.ts` : 4/4.
- `CI=1 pnpm verify:full`, joué EN ENTIER, EN UN SEUL APPEL, au premier
  plan : vert — 314 tests e2e passés, 3 skip (inchangé), aucun échec.
  Confirme aussi `typecheck`, `lint`, `test:isolation`, `build`,
  `feries:horizon`, `audit:partitions` (le script `verify:full` est une
  chaîne `&&` : atteindre `test:e2e` prouve que tout ce qui précède est
  passé).

### Une capture refaite

- La file « À planifier » du planning a changé de rendu depuis les
  captures AVANT/APRÈS d'origine de ce lot (GR7 a remplacé la référence
  affichée par le nom du client, indépendamment du badge de ton de GR5).
  Une paire AVANT/APRÈS supplémentaire a donc été prise à 1280px sur LE
  CODE ACTUEL (`planning-file-priorite-p1-reprise-avant-1280.png` = `main`
  juste avant cette reprise, commit `e2b8421`, badge inexistant ;
  `planning-file-priorite-p1-reprise-apres-1280.png` = après application de
  GR5, badge rouge). Les captures d'origine de 99U
  (`planning-file-priorite-p1-avant-1280.png` /
  `-apres-1280.png`) restent dans le dossier pour la trace historique de
  la décision de ton, mais ne reflètent plus le texte affiché par la carte
  depuis GR7.

### Ce qui reste à faire

- Aucun. Le lot est publié sur `main`, vert sous `verify:full` complet.
