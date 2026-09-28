# 9BA-AA-G3-EQUIPE-REGISTRE-BANNIERE — passation

Six commits sur `main`, local, non poussés :

- `fbcf7cb` AA-3-EQUIPE — un technicien ne se rattache plus à une agence inactive
- `daa3eb8` AA-3-EQUIPE — captures avant/après de la fiche de modification
- `92953c1` AA-4-REGISTRE-FILTRE — le filtre agence ne propose plus une agence inactive
- `eb3beb3` AA-4-REGISTRE-FILTRE — captures avant/après du filtre agence
- `451000a` AA-5-BANNIERE-PLANNING — la bannière ne nomme plus une agence inactive
- `e8d5406` AA-5-BANNIERE-PLANNING — captures avant/après de la bannière

`CI=1 pnpm verify:full` joué UNE SEULE FOIS après le dernier commit, en entier, au premier plan :
format:check + typecheck + lint + `pnpm test` (294 fichiers, 3071 tests) + `pnpm test:isolation` +
`pnpm build` + `feries:horizon` + `audit:partitions` + `pnpm test:e2e` (513 tests, 510 passés,
3 ignorés — aucun des trois n'appartient à ce lot). Tout vert.

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**AA-3-EQUIPE** — `lib/techniciens/depot.ts` : `creerTechnicien` et `modifierTechnicien` refusent
désormais un rattachement vers une agence inactive (motif `agence_inactive`, même texte que
`site.refus.agence_inactive`), contrôlé DANS la même transaction que l'écriture — même
raisonnement que `creerSite`/`modifierSite`. Le MAINTIEN d'un rattachement déjà posé, même
devenu inactif, reste accepté (relecture de la fiche actuelle avant la comparaison). La fiche de
modification de CHAQUE technicien lit désormais `agencesProposablesPourTechnicien` (nouvelle,
même module) plutôt que la liste plate `agencesDisponibles` partagée par toutes les lignes : sans
elle, un technicien rattaché à une agence désactivée après coup perdait son option dans SON
PROPRE menu — la capture AVANT le montre noir sur blanc, le select retombait sur « Dolbeau »
(premliterale agence active du tri alphabétique) alors que la table affichait bien
« AA3CAP-INACTIVE ». Le prochain « Enregistrer » d'un tout autre champ (la case Actif, par
exemple) aurait donc dératé le rattachement du technicien sans que personne ne l'ait demandé —
c'est exactement ce que le refus serveur couvre désormais si l'agence CHANGE réellement, et ce
que le menu corrigé évite avant même d'atteindre le serveur.

**AA-4-REGISTRE-FILTRE** — `app/(back-office)/interventions/page.tsx` : le menu « Agence » du
registre lit désormais `agencesProposables(tx, { garder: criteres.data.agence_id })` au lieu d'un
`tx.agence.findMany` sans le moindre filtre. Une agence inactive n'est plus proposée dans le
menu, SAUF si l'URL la demande déjà : elle reste sélectionnée, marquée « (inactive) », et sa puce
continue de s'afficher (`puceFiltresActifs`, `interventions/presentation.ts`, **inchangée** — le
`.find()` qui compose la puce fonctionne déjà tel quel dès que l'agence demandée reste dans le
tableau via `garder`). Le filtre APPLIQUÉ ne change jamais : les interventions d'une agence
inactive restent visibles dans « Toutes les agences ».

**AA-5-BANNIERE-PLANNING** — `app/(back-office)/planning/page.tsx` : le `findMany` qui construit
le cadre du planning LIT désormais `actif` (`select`, jamais `where`) ; `pourGrille` et
`pourJournee` restent l'index de consultation COMPLET, agences actives ou non, inchangé — ce sont
eux dont `lib/interventions/grille.ts` a besoin pour ouvrir la journée et hachurer les
interventions encore posées d'une agence désactivée, et la charge par technicien
(`lib/interventions/occupation.ts`) n'a pas été touchée non plus. **Seule la bannière** « Calendriers
d'agence respectés » filtre : `texteCalendriers` (déplacée avec `titreCalendriers` vers un
nouveau fichier frère, `app/(back-office)/planning/presentation.ts` — voir plus bas pourquoi)
filtre désormais elle-même sur `actif` avant de composer la liste des clauses.

## Ce que j'ai mesuré (comptes avant/après)

Chaque partie porte ses propres captures AVANT/APRÈS (1280 et 375 px), prises par un spec dédié
rejoué deux fois — une fois sur le code d'avant (`git stash` des fichiers du lot, capture, puis
restauration), une fois après le commit — jamais en comparant deux fichiers distincts, jamais en
inventant un delta :

- `docs/propositions/AA-3-EQUIPE/captures/` (`fiche-technicien-{avant,apres}-{1280,375}.png`) —
  AVANT : le select de la fiche de modification affiche « Dolbeau » alors que la table dit
  « AA3CAP-INACTIVE ». APRÈS : le select affiche et sélectionne
  « AA3CAP-INACTIVE — AA3CAP-INACTIVE (inactive) ».
- `docs/propositions/AA-4-REGISTRE-FILTRE/captures/` (`registre-filtre-{avant,apres}-{1280,375}.png`)
  — AVANT : le menu propose « AA4CAP-INACTIVE — AA4CAP-INACTIVE » sans aucune marque. APRÈS : le
  même menu la marque « (inactive) », toujours sélectionnée, la puce « Agence : … » toujours
  affichée.
- `docs/propositions/AA-5-BANNIERE-PLANNING/captures/` (`banniere-planning-{avant,apres}-{1280,375}.png`)
  — AVANT : la bannière nomme les deux agences forgées, « AA5CAP-ACTIVE » ET « AA5CAP-INACTIVE ».
  APRÈS : seule « AA5CAP-ACTIVE » reste nommée, aux côtés des trois agences actives du semis
  (Dolbeau, Ducos, Koné).

Trois épreuves d'isolation neuves (`tests/isolation/equipe-agence-inactive.test.ts`, 4 cas :
création refusée/acceptée, modification refusée/maintien accepté), un spec e2e fonctionnel par
partie qui compte (AA-3 : maintien à travers un vrai navigateur ; AA-4 : absence du menu + maintien
par l'URL + présence de la puce), plus 8 tests unitaires neufs (`tests/unit/techniciens/depot.test.ts`
étendu de 4 cas ; `tests/unit/planning/banniere-calendriers.test.ts`, 4 cas).

## Ce que j'ai tranché et pourquoi

1. **Le contrôle serveur vit DANS la transaction d'écriture, jamais avant** (AA-3) — même
   argument que `creerSite`/`modifierSite` : une lecture séparée laisserait une fenêtre où l'agence
   change entre les deux. Conséquence acceptée, déjà documentée en tête de
   `lib/techniciens/depot.ts` pour toute autre cause de refus sur cette seconde transaction : un
   refus `agence_inactive` à la création peut laisser une identité neuve seule, sans société ni
   rattachement — rejouable, jamais une ouverture.
2. **`agencesProposablesPourTechnicien` interroge une fois PAR technicien affiché** (AA-3), plutôt
   qu'une seule fois pour toute la liste : le ticket demandait explicitement
   `agencesProposables(tx, { garder: technicien.agenceId })`, et chaque ligne a potentiellement un
   rattachement différent — impossible de partager un seul appel. Coût mesuré négligeable sur
   l'équipe d'une agence (quelques techniciens), et le motif figure dans le commentaire du code.
3. **La clé du refus est `equipe.refus.agence_inactive`, pas `technicien.refus.agence_inactive`**
   comme le libellait le ticket : la route (`app/api/techniciens/[id]/modifier/route.ts`,
   `app/api/techniciens/creer/route.ts`) compose déjà TOUJOURS `equipe.refus.${motif}` — c'est le
   même préfixe que `deja_membre`, `agence_hors_societe`, `introuvable`. Un « technicien.refus.* »
   n'aurait jamais été résolu à l'écran. Signalé ici plutôt que suivi à la lettre en silence.
4. **`texteCalendriers`/`titreCalendriers` sont sorties de `page.tsx` vers un nouveau fichier
   frère `presentation.ts`** (AA-5), hors du territoire tel qu'énoncé littéralement
   (« page.tsx (select + appel de la bannière) ») — **contrainte technique, pas un choix de
   confort** : Next.js (`typedRoutes`) refuse tout export nommé qui n'est pas dans sa liste close
   depuis un fichier `page.tsx`, et `pnpm typecheck` le fait échouer avec
   `Property 'texteCalendriers' is incompatible with index signature`. Le ticket demandait
   explicitement un test UNITAIRE de `texteCalendriers`, ce qui exige de pouvoir l'importer hors
   navigateur. Le fichier neuf ne porte QUE ces deux fonctions et leurs deux fonctions privées
   (`resumeCalendrierAgence`, `nomJourIso`), verbatim, sans changement de comportement autre que
   le filtre `actif` demandé par le ticket.
5. **Le filtre de la bannière vit DANS `texteCalendriers`, pas au point d'appel** — le ticket
   demandait un test unitaire « une active + une inactive → seule l'active est nommée » sur
   `texteCalendriers` elle-même ; filtrer au point d'appel (dans `page.tsx`) aurait rendu ce test
   impossible à écrire sans dupliquer la logique de filtre dans le test. `pourGrille` reste
   l'index complet fourni tel quel à la grille ; une nouvelle liste `pourBanniere` (mêmes champs
   que `pourGrille`, plus `actif`) est calculée séparément et n'alimente QUE la bannière.

## Ce que je n'ai pas fait

- **Pas d'épreuve e2e pour AA-5** — le ticket l'hédait déjà (« e2e si la scène s'y prête ») : la
  bannière nomme TOUTES les agences actives de la société, semis compris (Dolbeau, Ducos, Koné
  pour CODIMA-NC), et `fullyParallel: true` fait tourner en même temps d'autres fichiers qui
  peuvent eux aussi créer des agences. Une assertion de PRÉSENCE/ABSENCE de texte dans la bannière
  romprait sous ce piège (compté large), et le gardien `sans-chaine-visible-en-dur` refuse de
  toute façon qu'une chaîne composée localement (`` `${PREFIXE}INACTIVE` ``) atteigne
  `toContainText`/`toHaveText`/`getByRole` (forme 2 du §9, rencontrée une première fois sur AA-4,
  voir plus bas). Le test UNITAIRE couvre exactement le scénario demandé, sans aucun de ces deux
  risques ; la capture AVANT/APRÈS apporte la preuve visuelle contre le vrai semis.
- **`interventions/presentation.ts` n'a reçu aucune modification** (AA-4) — le territoire
  l'autorisait « puce seulement », mais `puceFiltresActifs` n'avait besoin de rien : son
  `agences.find(...)` retrouve déjà l'agence inactive sélectionnée, du moment qu'`agencesProposables`
  la garde dans le tableau via `garder`. Aucune ligne n'y a donc été touchée.
- **Le constat de AA-4 sur la puce qui « disparaît »** décrivait un risque théorique (celui d'un
  correctif naïf qui filtrerait `actif` SANS `garder`), pas un défaut mesuré sur `main` : avant ce
  lot, `agences` ne portait AUCUN filtre, donc la puce fonctionnait déjà pour une agence inactive —
  seul le MENU proposait à tort une agence désactivée. Signalé plutôt que réécrit en silence.

## Les pièges pour la session suivante

- **La gardien `sans-chaine-visible-en-dur` (L0-11) refuse une constante composée localement
  transmise à `toContainText`/`toHaveText`/`getByRole`, MÊME hors littéral inline** — il remonte
  jusqu'à la déclaration de la variable. `` `${PREFIXE}INACTIVE` `` stocké dans une constante puis
  passé à `.toContainText(...)` a fait échouer `pnpm test` une première fois sur
  `tests/e2e/registre-filtre-agence-inactive.spec.ts` (forme 2, « la chaîne concaténée ») ; corrigé
  en ne vérifiant que la VISIBILITÉ de la puce (`.toBeVisible()`), jamais son texte. À anticiper
  pour toute épreuve future qui voudrait affirmer qu'un libellé forgé par la scène apparaît à
  l'écran.
- **Un fichier `page.tsx` ne peut exporter QUE ce que Next.js connaît** (`default`, `metadata`,
  `generateStaticParams`, …) — tenté d'exporter `texteCalendriers` directement depuis
  `planning/page.tsx`, `pnpm typecheck` a échoué sur les types générés
  (`.next/types/app/.../page.ts`). Toute fonction qu'un futur ticket voudrait éprouver sans
  navigateur, et qui vit aujourd'hui dans un `page.tsx`, devra migrer vers un fichier frère
  (`presentation.ts`, `carte.ts`, `statistiques.tsx` sont déjà le patron établi sous `planning/`).
- **Le harnais AVANT/APRÈS par `git stash` fonctionne, mais RALENTIT chaque partie d'environ
  100 s** (build + seed + un run Playwright, deux fois) — chaque capture a coûté ~7 minutes de
  session. À budgéter pour tout ticket qui en redemande.

## Ce qui reste à faire

- **Aucun** ticket connu n'ouvre encore un menu de rattachement d'agence sans passer par
  `agencesProposables` — mesuré par `grep -rn "tx.agence.findMany" app/` avant de clore ce lot :
  les trois lieux visés par ce ticket (équipe, registre, bannière) sont les trois qui restaient
  après AA-1/AA-2 (sites) et AA-6 (création côté serveur).
- Le champ `actif` sur `Agence`, désormais lu par le planning en plus des trois écrans déjà
  couverts, n'a jamais été vérifié pour d'AUTRES écrans qui composeraient un référentiel d'agences
  similaire (tableau de bord, exports) — non mesuré, hors périmètre de ce lot.
