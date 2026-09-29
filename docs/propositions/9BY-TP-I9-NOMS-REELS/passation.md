# 9BY-TP-I9-NOMS-REELS — passation

## Ce que j'ai changé, et ce que ça change pour l'exploitation

**Premier commit (`dd0093a`) — les raisons sociales.** Cinq raisons sociales
et un toponyme mesurés en production (constat CS28, audit du 28/09) sont
sortis des commentaires et d'un test, remplacés par des exemples fictifs qui
gardent exactement ce que chaque test éprouve :

- **R1** (18 caractères, en capitales) et **T1** (toponyme, à côté de R1) —
  `lib/sites/depot.ts`, `lib/tri/collation.ts` et son test, passation
  `36-LISTES-1`. Le test `tests/unit/tri/collation.test.ts` éprouve toujours
  la même propriété (une chaîne « AVIS … » classée après « avis autre »
  insensible à la casse, une chaîne « An… » qui la précède insensible à la
  casse mais la suit en ordre d'octets) — démontré en inversant l'attente
  puis en la remettant, le test mord bien.
- **R2** (15 caractères, écrit « R2 — R2 ») — `app/api/recherche/sites/route.ts`,
  `lib/i18n/fr.ts`, `tests/e2e/creation-2.spec.ts`, passation `92-CREATION-2`
  — tous des commentaires, remplacés par « CLIENT FICTIF — CLIENT FICTIF ».
- **R3** (6) et **R4** (7) — `lib/interventions/depot.ts`,
  `tests/e2e/historique-client.spec.ts`, passation `20-HISTORIQUE-CLIENT-1`
  (commentaires, remplacés par « un gros client ») et
  `tests/unit/tableau-de-bord/presentation.test.ts:138` (donnée de test sans
  attente sur le nom, remplacée par une raison sociale fictive).
- **R5** (6, hors liste de l'audit, même nature) — `lib/machines/depot.ts`,
  `app/(back-office)/planning/{carte.ts,page.tsx}` et leurs tests unitaire et
  e2e — tous des commentaires citant « SIDAPS / Curatif », remplacés par
  « CLIENT / Curatif ».

Aucune logique changée : uniquement des commentaires et des littéraux de
test/fixture.

**Second commit (`e0f545a`) — les quatre techniciens de la scène de
démonstration.** Décision d'Alexis du 29/09/2026 (~12h20 NC) : noms fictifs,
initiale gardée.

| Agence | Nom après | Courriel après |
|---|---|---|
| Ducos (compresseurs, ponts) | **D. Garnier** | `garnier@codima.test` |
| Ducos (électroportatif, SAV) | **J. Lemaître** | `lemaitre@codima.test` |
| Koné (généraliste Nord) | **M. Perrin** | `perrin@codima.test` |
| Dolbeau (pneumatique, clim) | **T. Weber** | `weber@codima.test` |

*(Cette table désigne les quatre techniciens par leur agence et leur NOUVEAU
nom — la consigne du ticket est de ne jamais écrire les anciens patronymes
réels dans cette passation. Ils restent lisibles dans `git log` et dans les
fichiers `docs/` non touchés, listés plus bas.)*

`prisma/seed-data.ts` porte les nouveaux noms/courriels ; `TECHNICIENS_PAR_AGENCE`
suit. `prisma/seed.ts` renomme désormais, dans la MÊME transaction que
l'upsert et AVANT lui, une identité déjà semée sous son ancien courriel
(champ optionnel `ancien_email` sur `UtilisateurInterneSeed`) — sans ce
geste, l'upsert par le NOUVEAU courriel aurait créé une seconde identité à
côté de l'ancienne, jamais supprimée.

Tout ce qui citait ces patronymes suit le même remplacement : `tests/e2e/setup/{scene,reperes}.ts`
(courriels et commentaire), une douzaine de specs e2e (commentaires, une
variable de scène locale, une requête `where: { email }` réelle dans
`tests/e2e/blocage-agenda-visible.spec.ts` — la plus sensible, puisqu'elle
interroge la base par ce courriel), les fixtures unitaires qui employaient
le patronyme avec un autre prénom (`techniciens/saisie`, `techniciens/depot`,
`personnes-du-planning`, `technicien-fiche`, `navigation/initiales` — y
compris l'attente `initialesDuNom("Weber") → "WE"`, changée avec le nom), et
les commentaires de `lib/interventions/{personnes,grille}.ts` et
`app/(back-office)/absences/{page.tsx,presentation.ts}` (ces deux derniers
citent la maquette, mais le nom cité n'existe plus nulle part dans le code
courant — j'ai jugé qu'un commentaire de code citant encore un vrai nom de
technicien allait contre l'esprit d'I9, voir « ce que j'ai tranché »).

Pour l'exploitation : la scène de démonstration ne porte plus aucun nom réel
de technicien CODIMA. Rien ne change pour un utilisateur réel de la
plateforme — ce sont des identités de démonstration.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Preuve textuelle des raisons sociales** : `git grep -F` sur les cinq
  raisons sociales et le toponyme relevés par l'audit, hors `.git` → **zéro
  occurrence**. Commande jouée via un fichier de motifs temporaire
  (`/tmp/motifs-tpi9.txt`, jamais commité, supprimé aussitôt après).
- **Preuve textuelle des patronymes** : `git grep -in` (formes accentuées et
  non accentuées, majuscule ou non) sur les quatre patronymes, hors
  `prisma/seed-data.ts` (où seul le champ `ancien_email` les porte encore,
  intentionnellement), hors `tests/unit/ui/lot-a2.test.ts` et
  `tests/unit/techniciens/tri.test.ts` (voir plus bas), hors `docs/**` →
  **zéro occurrence**. Même méthode de fichier de motifs temporaire.
- **Le renommage du semis, mesuré à la main sur `codiplan_test`** (le seul
  chemin possible : `prisma/seed.ts` s'auto-exécute à l'import et suppose une
  base neuve, comme `docs/propositions/28-SEMIS-3/passation.md` le documente
  déjà pour la même raison — aucun test automatisé ne le rejoue).
  1. Base AVANT mon second commit : les quatre techniciens portaient encore
     leurs anciens courriels et noms (vérifié par `psql`).
  2. `pnpm exec tsx prisma/seed.ts` (avec le code de ce lot) : **aucune
     erreur**, `utilisateurs internes — 9 identités`.
  3. Relecture : les quatre lignes portent désormais le NOUVEAU nom et le
     NOUVEAU courriel, avec le MÊME `id` qu'avant (donc un renommage, pas une
     création) — 4 lignes, pas 8.
  4. Semis rejoué une seconde fois (idempotence) : toujours 4 lignes, aucune
     erreur.
- **Captures** dans `docs/propositions/9BY-TP-I9-NOMS-REELS/captures/` —
  planning (vues Semaine et Jour), `/parametres/equipe`, `/absences`, à 1280
  et 375 px, AVANT (`git worktree` sur `dd0093a`, base ressemée avec
  l'ancien code) et APRÈS (`e0f545a`). `equipe-*` montre clairement les
  quatre nouveaux noms et courriels. `absences-*` est capturé mais les paires
  AVANT/APRÈS sont identiques à l'octet près — voir le README des captures
  pour la raison (sélecteur natif fermé, aucun blocage à afficher dans la
  scène).
- `pnpm typecheck`, `pnpm format:check`, `pnpm test` (3346 tests) et
  `pnpm test:isolation` (1291 tests) : verts après chaque commit.

## Ce que j'ai tranché et pourquoi

- **`ancien_email` plutôt que garder les anciens courriels.** Le ticket
  laissait la porte ouverte à garder les anciens courriels si le renommage
  n'était « pas faisable simplement ». Il l'était : `Utilisateur` n'a pas de
  `societe_id` (I1, 2ᵉ catégorie) et la transaction qui pose déjà l'identité
  (`avecSocieteEtRole`) pouvait porter un `updateMany` supplémentaire avant
  l'upsert, sans changer sa forme. J'ai donc renommé aussi les courriels —
  c'est ce que « scène sans nom réel » veut dire au sens plein : un courriel
  du type `guerin@codima.test` reste lisible comme un nom réel.
- **Les commentaires citant la maquette dans `absences/{page.tsx,presentation.ts}`
  ont été changés**, alors que le ticket ne les listait explicitement que
  dans une remarque « REMESURE » sans trancher. J'ai choisi de les aligner :
  laisser un vrai patronyme dans un commentaire de code alors que la scène
  entière en est purgée aurait recréé exactement le défaut qu'I9 vise, pour
  la seule raison que la citation vient de la maquette et non du semis. Si
  Alexis préfère que les commentaires reflètent fidèlement la maquette telle
  qu'elle est écrite, c'est réversible en un `git revert` ciblé sur ces deux
  lignes.
- **`tests/unit/agences/tri-reglages.test.ts` et `tests/unit/techniciens/tri.test.ts`
  non touchés**, bien qu'ils réutilisent un des noms concernés (préfixés
  `TPA6-`) : ce sont des fixtures du lot `9BX-TP-A6-TRIS-MISE-EN-PAGE`, hors
  de mon Territoire, qui réutilisent un nom existant comme simple chaîne de
  test (toponyme réel dans un cas, patronyme dans l'autre) sans lien avec la
  scène de démonstration ou I9. Les renommer aurait dépassé mon Territoire
  pour un gain nul.
- **`tests/unit/ui/lot-a2.test.ts` non touché** : sa `preuve` est une citation
  LITTÉRALE de `docs/maquette/codiplan-maquette-complete.html` (source de
  rang 1, `CLAUDE.md` §0/§1), confrontée par `toContain` — la changer aurait
  cassé le gardien sans toucher à la maquette elle-même, que je n'ai pas le
  droit de modifier.

## Ce que je n'ai PAS fait

- Je n'ai touché à aucun fichier `docs/maquette/*.html`, ni aux passations
  historiques, ni à `docs/arbitrages.md`, ni à `docs/backlog.md` — occurrences
  restantes, par fichier (comptées par un script `grep`, patronymes et
  raisons sociales confondus) :

  | Fichier | Occurrences |
  |---|---|
  | `docs/maquette/codiplan-maquette-complete.html` | 22 |
  | `docs/maquette/CODIPLAN_Maquette.html` | 22 |
  | `docs/propositions/PG-A2-ORDRE-TECHNICIENS/captures/README.md` | 8 |
  | `docs/propositions/9BB-PG-G1-DOCS-FERIES-ORDRE/passation.md` | 8 |
  | `docs/audit-2026-09-26-captures/mobile.md` | 7 |
  | `docs/propositions/planning-gmao/maquette-planning-gmao.html` | 4 |
  | `docs/propositions/planning-1/mesure.json` | 4 |
  | `docs/propositions/99G-PLANNING-JOUR/passation.md` | 4 |
  | `docs/propositions/planning-1/README.md` | 3 |
  | `docs/propositions/fiche-1/README.md` | 2 |
  | `docs/propositions/PG-B2-FENETRE-POSE/captures/README.md` | 2 |
  | `docs/propositions/9BO-TP-UX0-DOCS/passation.md` | 2 |
  | `docs/propositions/9AF-GR14-CHARGE-PLANNING/passation.md` | 2 |
  | `docs/propositions/99M-REPRISE-99G/passation.md` | 2 |
  | `docs/propositions/99J-PLANNING-GLISSER/passation.md` | 2 |
  | `docs/propositions/99A-ARRIVEE/passation.md` | 2 |
  | `docs/propositions/57-REGISTRE-2/passation.md` | 2 |
  | `docs/backlog.md` | 2 |
  | `docs/audit-ergonomie-2026-09-26.md` | 2 |
  | `docs/registres/2026-09-11-file-de-nuit.md` | 1 |
  | `docs/propositions/fiche-1/mesure.json` | 1 |
  | `docs/propositions/PG-C4-CHARGE/captures/README.md` | 1 |
  | `docs/propositions/PG-B5-ANNULER-DEPLACEMENT/captures/README.md` | 1 |
  | `docs/propositions/PG-B4-SURVOL-CASES/captures/README.md` | 1 |
  | `docs/propositions/PG-A8-ANNULEES-MASQUEES/captures/README.md` | 1 |
  | `docs/propositions/ERGO-PRISE-DE-VUE/passation.md` | 1 |
  | `docs/propositions/9BC-PG-G2-POSE-LIBELLES/passation.md` | 1 |
  | `docs/propositions/9AE-GR14-DUREE-UNIQUE/passation.md` | 1 |
  | `docs/propositions/76-BON-4/passation.md` | 1 |
  | `docs/propositions/37-AFFICHAGE-MATERIEL-1/passation.md` | 1 |
  | `docs/propositions/29-DROITS-1/passation.md` | 1 |
  | `docs/arbitrages.md` | 1 |

  Alexis décidera s'il faut les traiter, et comment (la maquette est une
  source de rang 1 qui ne se corrige pas par ce genre de ticket ; les
  passations historiques sont des comptes-rendus déjà publiés).
- Je n'ai pas touché `tests/unit/agences/tri-reglages.test.ts` ni
  `tests/unit/techniciens/tri.test.ts` (motif ci-dessus).
- Je n'ai pas touché `tests/unit/ui/lot-a2.test.ts` (motif ci-dessus).
- Aucune migration, aucune ligne de semis de données (au sens interventions/
  clients/sites), aucun prix, aucune logique métier changée.

## Les pièges pour la session suivante

- **`prisma/seed.ts` s'auto-exécute à l'import** : aucun test automatisé ne
  peut le rejouer comme une fonction. Toute vérification d'un comportement du
  semis (comme mon renommage) doit se mesurer à la main sur une base
  jetable, comme `28-SEMIS-3` l'a déjà fait — et se documenter ici, pas dans
  un test qui n'existe pas.
- **L'historique git garde les anciens noms : il n'est PAS réécrit.**
  `git log`, `git blame` et les commits antérieurs à `dd0093a` continuent de
  porter les raisons sociales et les patronymes réels en clair. Si I9 doit un
  jour s'étendre à l'historique, c'est un ticket à part (réécriture
  d'historique — hors de portée d'un ticket ordinaire, et risqué sur un dépôt
  partagé).
- **`TECHNICIENS_PAR_AGENCE` et `UTILISATEURS_INTERNES` doivent rester en
  phase** : si un futur ticket renomme encore un technicien, il doit changer
  les DEUX (le second n'est pas dérivé du premier).
- Le champ `ancien_email` de `UtilisateurInterneSeed` n'a d'utilité que le
  temps de CE renommage. Un futur ticket peut le retirer une fois que toutes
  les bases connues (dont l'hébergée, si le semis y tourne un jour) ont
  tourné au moins une fois avec ce code — le retirer plus tôt romprait le
  renommage pour toute base qui ne l'aurait pas encore vu.

## Ce qui reste à faire

- Décider du sort des occurrences dans `docs/` listées ci-dessus (aucune
  n'est dans mon Territoire).
- Si le semis tourne un jour sur la base hébergée avec d'anciens courriels
  encore présents, vérifier que le renommage s'y comporte comme mesuré ici
  en local (même mécanique, pas mesuré à distance).
