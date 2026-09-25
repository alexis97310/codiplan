# 91-VGP-4-REPRISE — passation

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

`87-VGP-4` s'était arrêté sur une question, sans commit : la maquette écrit
« à faire sous 30 jours » sur le premier KPI du registre `/vgp`, et rien — ni
le chapitre 10, ni `docs/arbitrages.md` — n'avait jamais réglé ce délai (§8 du
CLAUDE.md interdit d'en inventer un). L'arbitrage du 25/09/2026 tranche :
**aucune fenêtre de jours, un ORDRE à la place.**

1. **Le registre `/vgp` trie désormais ses lignes par urgence**
   (`trierParUrgence`, `lib/vgp/registre.ts`) : les échéances DÉPASSÉES en
   tête, la plus ANCIENNE d'abord ; puis les échéances À VENIR, la plus
   PROCHE d'abord ; puis tout le reste (hors registre, sans information,
   information reçue sans rythme déclaré), dans son ordre d'arrivée. Le
   classement s'applique après le filtre `etat` et la recherche, avant de
   borner l'affichage à `LIGNES_AFFICHEES` (200) — un chef d'atelier qui ouvre
   `/vgp` voit donc en premier ce qui presse le plus, sans avoir à trier lui
   même une table de plusieurs centaines de lignes.
2. **Le KPI « Échéances à venir » devient un lien**, `/vgp?etat=a_venir` —
   symétrique du KPI « Échéances dépassées », qui menait déjà à
   `/vgp?etat=depassees` depuis `TABLEAU-1`. Le critère est le MÊME que celui
   que le KPI compte déjà (`echeanceEstAVenir`, extrait de la logique déjà
   écrite dans `resumerLeRegistre`) : non borné, sans fenêtre de jours. Les
   deux autres KPI (« Informations reçues », « À déterminer ») restent
   inertes, comme demandé.
3. **Une recherche `q`** — numéro de série, désignation (le modèle) ou
   client, insensible à la casse (`rechercheCorrespond`,
   `lib/vgp/registre.ts`) — un formulaire `GET`, même contrat que `/sites` et
   `/parc`. Elle porte sur les lignes DÉJÀ LUES par `listerLeRegistre`
   (comme le filtre `etat` existant), jamais une seconde requête SQL : le
   registre n'est pas paginé, et une lecture bornée séparément divergerait du
   compte affiché (la même faute que `TABLEAU-1` avait corrigée pour les
   KPI). Un filtre `etat` actif est préservé par un champ caché quand on lance
   une recherche.

## Ce que j'ai mesuré

- **La branche `87-VGP-4-inacheve` ne portait aucun code utile** :
  `git diff --stat main 87-VGP-4-inacheve` rend 44 fichiers changés, **zéro
  insertion et zéro suppression de texte** — uniquement des octets d'images
  PNG (captures rejouées par une session tuée avant son commit). Aucune ligne
  de `lib/`, `app/` ou `tests/` n'en a été reprise ; ce ticket repart de
  `main`.
- **Avant ce lot**, `/vgp` triait ses lignes par `numero desc, numero_serie
  asc` (ordre neutre, non trié par urgence) et ne connaissait qu'un seul
  filtre (`?etat=depassees`) ; aucune recherche n'existait — le paragraphe de
  bas de page le disait explicitement (« La recherche et le filtre par
  échéance ne sont pas encore disponibles », texte à présent corrigé).
- **Après ce lot** :
  - `pnpm test` : 265 fichiers, 2851 tests, tous verts — dont les 10 tests
    neufs de `tests/unit/vgp/tri-et-recherche.test.ts` (tri par urgence sur
    quatre cas datés + un palier « reste », stabilité du tri, cinq cas de
    recherche).
  - `npx playwright test tests/e2e/vgp-4.spec.ts` : 2/2 verts (le KPI «
    dépassées » ne laisse que des dépassées, la plus ancienne en tête ; la
    recherche filtre par numéro de série, client et désignation).
  - `npx playwright test tests/e2e/vgp-retard-visible.spec.ts
    tests/e2e/imports-vgp.spec.ts` (les deux specs VGP préexistantes) : 6/6
    verts — aucune régression.
  - `CI=1 pnpm verify:full` en un seul appel, au premier plan : **format,
    typecheck, lint, test, test:isolation, build, fériés, partitions, et
    toute la suite `test:e2e` (272 passés, 3 ignorés) — tout vert.**

## Ce que j'ai tranché et pourquoi

- **Le tri s'applique APRÈS le filtre `etat` et la recherche `q`, jamais
  avant** : les 200 lignes affichées doivent être les plus urgentes DE CE QUI
  EST FILTRÉ, pas les 200 premières lignes lues puis triées séparément.
- **La « désignation »** de l'arbitrage est le champ `modele` de
  `LigneDeRegistre` (la référence du modèle) — la seule colonne du registre
  qui identifie un matériel au-delà du numéro de série et du client. Je n'ai
  pas étendu la recherche à la famille ni au site : l'arbitrage nomme
  explicitement trois colonnes, et le registre — contrairement à `/parc` —
  n'affiche ni site ni commune en tête de ligne.
- **`echeanceEstAVenir` est EXTRAITE de `resumerLeRegistre`, pas réécrite** :
  le filtre `?etat=a_venir` devait lire EXACTEMENT le critère que le KPI
  compte déjà, jamais une seconde écriture qui pourrait diverger en silence
  (la discipline du dépôt, §9 du 01/09).
- **La recherche reste une lecture en mémoire**, comme le filtre `etat`
  préexistant, et non une clause SQL supplémentaire : `/vgp` n'est pas
  paginé (contrairement à `/parc`), et `listerLeRegistre` lit déjà jusqu'à
  `LIGNES_RESUME_MAXIMALES` (2000) lignes pour le résumé — la recherche
  filtre ce qui est déjà en mémoire, sans requête distincte à faire diverger.
- **La scène de l'épreuve de bout en bout pose sa PROPRE famille et son
  propre modèle** (assujettis, périodicité de douze mois), plutôt que de
  réutiliser ceux du semis : cela isole totalement les dates de vérification
  comme seule variable du scénario. La machine « la plus ancienne dépassée »
  porte une date de vérification ABSOLUE et délibérément extrême (2010),
  bien plus ancienne que n'importe quelle donnée de démonstration ou d'une
  autre épreuve VGP du dépôt (vérifié : les deux vérifications du semis et
  les deux dates de `classeur-vgp.ts` sont toutes postérieures à 2019) — ce
  qui garantit sa place en tête quelle que soit la date d'exécution.

## Ce que je n'ai PAS fait

- **Aucune fenêtre de 30 jours n'a été reprise**, ni comme borne de calcul ni
  comme libellé affiché — c'est l'écart nommé par l'arbitrage lui-même, et il
  est documenté dans le docblock de `app/(back-office)/vgp/page.tsx` (section
  « VGP-4 — UN ORDRE, PAS UNE FENÊTRE DE JOURS »).
- Je n'ai pas touché au bouton « + Planifier un contrôle » : il reste absent,
  écart déjà nommé avant ce ticket (aucune route ne planifie une échéance
  future), hors territoire de cette reprise.
- Je n'ai pas ajouté de pagination au registre : l'affichage reste borné à
  200 lignes (`LIGNES_AFFICHEES`), comme avant ce lot.
- Je n'ai touché ni migration, ni `prisma/seed.ts`, ni ligne de semis — la
  scène de l'épreuve est entièrement fabriquée et détruite par le fichier de
  test lui-même.
- Je n'ai pas modifié le comportement des trois autres KPI (« Informations
  reçues », « À déterminer ») ni de la liste des « familles à déterminer » —
  seulement ajouté les deux liens demandés.

## Les pièges pour la session suivante

- **Le lien d'un KPI EFFACE la recherche en cours** : `href="/vgp?etat=a_venir"`
  ne porte pas `q`. C'est délibéré (le hidden input ne joue que dans l'autre
  sens — une recherche lancée depuis un filtre actif le conserve), mais ce
  n'est PAS éprouvé côté bout en bout : un futur ticket qui voudrait combiner
  les deux devra d'abord décider si c'est le comportement voulu.
- **`LIGNES_RESUME_MAXIMALES` (2000) reste la seule lecture bornée** du
  registre — tri, filtre et recherche ne portent que sur ce qui a été lu. Une
  société dont le parc VGP dépasserait cette borne verrait un registre
  incomplet plutôt que faux de façon imprévisible : écart déjà documenté par
  `TABLEAU-1`, pas introduit par ce lot.
- **`tests/unit/vgp/aucune-duree-en-dur.test.ts` ne scanne que les fichiers
  DIRECTS de `lib/vgp/`, non récursivement** : `trierParUrgence` et
  `rechercheCorrespond` y vivent bien, sans aucun littéral hors `0`/`1` — à
  vérifier de nouveau si l'une des deux fonctions déménage.
- La recherche compare des chaînes avec `toLocaleLowerCase("fr")`, sans
  normalisation des accents : chercher « decale » ne trouvera pas
  « décalé ». Non demandé par l'arbitrage, mais à savoir si un exploitant s'en
  étonne.

## Ce qui reste à faire

Rien d'identifié comme bloquant pour ce ticket. Les deux écarts nommés
(fenêtre de 30 jours non reprise, bouton « Planifier un contrôle » absent)
restent des décisions assumées, pas des oublis — voir « Ce que j'ai tranché »
et le docblock de `app/(back-office)/vgp/page.tsx`.
