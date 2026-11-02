# 9IC-CORRECTIFS-COURTS — passation

Quatre réserves des revues de 9I1 à 9I4, en un seul ticket de correctifs courts, en fin de file
(décision d'Alexis du 29/10/2026, « oui »). Sources : `pilote/w/solde-9DW-a-integrer.txt`, entrées
592 à 596.

## Point 1 — D127 en entier

| | |
|---|---|
| **Mesuré avant** | `docs/arbitrages.md`, section D127 (entre D126 et D128), ne portait que le texte RÉSUMÉ par le pilote (`pilote/w/D127-texte-projet.md`) — manquaient « Ce qui est écrit » (interventions, `montant_ht`, lignes de facturation), « Les garde-fous qui viennent du fichier » (VGP non rattachée, dossiers en double, 272 documents orphelins), « Ce que ça ouvre ». |
| **Fait** | Corps de la section D127 remplacé par le texte intégral (`pilote/w/D127-texte-integral.md`), mot pour mot, titres au format du registre (`###` en majuscules). Seul le titre `## D127 — …` et l'italique d'attribution restaient déjà corrects et n'ont pas changé. |
| **Preuve** | `git diff` du commit du point 1 ; `tests/unit/docs/citations-decisions-code.test.ts` (gardien qui résout `D127` vers son titre) reste vert ; `pnpm test` (docs guardians inclus) vert. |

## Point 2 — Écran Équipe par paquets de 5

| | |
|---|---|
| **Mesuré avant** | `etatsAccesDesComptes`/`etatsAccesDesTechniciens` lisaient les comptes via un `Promise.all` SANS plafond (9I4) : chaque lecture ouvre sa propre transaction (désignation self-authored, `lib/auth/lecture-identite.ts`), pool Prisma par défaut, `$transaction` `maxWait` 2 s — une grande équipe pouvait faire échouer l'écran entier (« Unable to start a transaction ») plutôt que d'être seulement lente. |
| **Fait** | Politique RLS inchangée (aucune migration). Concurrence plafonnée à 5 lectures simultanées, par tranches successives (ordre conservé), via `parTranchesDeCinq` (`lib/auth/acces-bureau.ts`, exportée, importée par `acces-technicien.ts`). `orderBy: [{ cree_le: "asc" }, { id: "asc" }]` ajouté aux `findFirst` en défense (aucune seconde ligne `compte` par utilisateur mesurée aujourd'hui, mais plus de choix silencieux par Postgres si ce jour arrivait). |
| **Preuve** | `tests/unit/auth/acces-bureau.test.ts` (describe `parTranchesDeCinq`) — N=12, jamais plus de 5 appels en vol (compteur + espion), ordre conservé. Une première tentative de preuve PAR LA BASE (`tests/isolation/9ic-equipe-par-tranches.test.ts`) a mesuré le plafond instable sous `pnpm test:isolation` complet — polluée par le `Promise.all` SANS plafond, déjà existant et hors territoire, qui lit le journal d'autant d'administrateurs que la société en accumule (jusqu'à 35 mesurés dans SOCIETE_A) ; ce fichier garde la mesure robuste : des états MÉLANGÉS (aucun/actif/lien_envoye/lien_expire) ne se confondent jamais entre tranches, côté technicien ET côté bureau. `pnpm test` et `pnpm test:isolation` verts. |

## Point 3 — Preuve du scanner hors réseau

| | |
|---|---|
| **Mesuré avant** | `tests/e2e/9i1-scanner-hors-reseau.spec.ts` n'affirmait que « url sans chrome-error » — vert même quand le serveur répond, puisque le `fetch` interne au service worker échappe à `context.setOffline`/`context.route` de Playwright (même limite que 9F4H1 pour `/terrain`). La branche `.catch()` de `public/sw.js` (repli `/scanner-hors-reseau`) n'était prouvée que par lecture du code. |
| **Fait** | `tests/unit/pwa/sw-repli-scanner.test.ts` : charge `public/sw.js` (le fichier réel) dans un bac à sable `node:vm`, `caches`/`fetch` simulés, un `fetch` qui REJETTE — c'est la branche `.catch()` qui s'exécute, pas une lecture. Vérifié RED sur le `sw.js` d'avant ce commit (mesuré directement : un GET non-navigation vers `/scanner` y recevait bien le HTML de la coquille). `public/sw.js` : `requete.mode === "navigate"` ajouté comme condition des replis `/scanner` ET `/terrain` — un GET RSC en échec ne reçoit plus la coquille. |
| **Preuve** | `tests/unit/pwa/sw-repli-scanner.test.ts` (6 scénarios : navigation vers `/scanner` et `/parc/scanner` reçoit la coquille et ne met rien en cache ; GET non-navigation vers les deux ne la reçoit pas ; non-régression `/terrain`). `tests/e2e/9i1-scanner-hors-reseau.spec.ts`, `tests/e2e/offline/socle-pwa.spec.ts`, `tests/e2e/offline/9f4h1-consultation.spec.ts` rejoués (8 tests) : verts. |

## Point 4 — Trait de signature sur les pixels du PNG ; bandeau au-dessus de la colonne figée

| | |
|---|---|
| **Mesuré avant (4a)** | `tests/e2e/rapport-signature-epaisseur-trait.spec.ts` ne relisait que `ctx.lineWidth` — une propriété posée, pas ce que le canevas a réellement dessiné. |
| **Fait (4a)** | À DPR 1 et 3, mesure ajoutée sur les PIXELS du PNG enregistré (`canvas.toDataURL()`, décodé dans la page par une seconde `Image`) : épaisseur verticale d'un trait HORIZONTAL dédié (sans ambiguïté, contrairement au trait diagonal mesuré par `lineWidth`). Seuil `epaisseur ≥ dpr + 1` : le défaut d'avant 9I2 aurait rendu ~1 pixel quel que soit le DPR, le correctif scale avec lui. |
| **Mesuré avant (4b)** | `components/navigation/bandeau-bureau.tsx` : `sticky top-0 z-20`, monté AVANT le contenu de la page. Les cellules figées du planning (vues Jour/Mois/Semaine, `z-20`) et `BandeauDeplacementDiffere` (`pose.tsx`, `z-20`) viennent APRÈS dans le DOM. À `z-index` égal, l'ordre du DOM tranche : l'élément plus tardif peint par-dessus — une cellule figée défilée jusqu'à hauteur du bandeau passait donc dessus, jamais mesuré (seul le défilement HORIZONTAL était éprouvé). |
| **Fait (4b)** | `bandeau-bureau.tsx` passé à `z-30`, strictement supérieur aux trois `z-20` en cause ; la colonne figée reste, elle, au-dessus des cases ordinaires de sa propre grille (`z-10`), relation inchangée. |
| **Preuve** | `tests/e2e/rapport-signature-epaisseur-trait.spec.ts` (3 DPR, dont 2 avec la mesure PNG) vert. `tests/e2e/planning-bandeau-au-dessus-colonne-figee.spec.ts` (4 épreuves — Jour/Mois/Semaine par `elementFromPoint` au centre, après un vrai défilement vertical ; `BandeauDeplacementDiffere` par comparaison de z-index résolus, le glisser-déposer complet n'apportant rien de plus sur ce point). **Vérifié RED/GREEN** : repassé temporairement `bandeau-bureau.tsx` à `z-20` → les 4 épreuves échouent ; restauré à `z-30` → les 4 repassent au vert. `tests/e2e/planning-jour-colonne-figee-empilement.spec.ts` et `tests/e2e/planning-mois-colonne-figee-empilement.spec.ts` rejoués : verts (non-régression du travail de 9H4/9I2). |

## Point 5 — Textes de 9I5 reformulés, épreuves non tautologiques

| | |
|---|---|
| **Mesuré avant** | `lib/i18n/fr.ts` portait les quatre phrases dans leur forme 9I5 (jargon de projet, formulations trompeuses — voir le ticket). `tests/unit/*/9i5-ce-qui-manque.test.tsx` (cinq fichiers) rendaient chacun leur PROPRE `<p>`/`<Page>` avec la MÊME clé qu'ils prétendaient éprouver — tautologiques : verts même si la vraie page perdait la phrase. |
| **Fait** | Les quatre clés reformulées mot pour mot (voir le corps du ticket), commentaires de source (D161, D189, D166, D192) inchangés. Les cinq fichiers unitaires ne rendent plus rien : ils ne gardent que la FORME de la phrase (ce qui se mesure sans rendu — présence de certains segments, absence de « bientôt »/« lot N »). `tests/e2e/9i5-ce-qui-manque.spec.ts` (neuf) ouvre les CINQ écrans réels et lit la phrase par sa clé dans le DOM qu'ils rendent eux-mêmes. Placement : vérifié sur le code existant que les trois écrans autres que la fiche machine ne PEUVENT PAS utiliser le slot `sousTitre` de `Page` — déjà pris par leur propre sous-titre (`sousTitreTableauDeBord`, `vgp.sous_titre`, `donnees_a_completer.sous_titre`), ou absent (`/terrain` n'utilise pas `Page`) ; aucun changement de placement nécessaire. |
| **Preuve** | Les cinq fichiers `tests/unit/*/9i5-ce-qui-manque.test.tsx` verts. `tests/e2e/9i5-ce-qui-manque.spec.ts` (5 tests, un par écran) vert. Un piège rencontré et évité : un `const phrase = \`…\`` intermédiaire avant `getByText` fait échouer le gardien `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts` — `constantesLitterales` (`tests/unit/outils/rendu-visible.ts`) résout un `const` avec un contexte d'accesseurs VIDE (pour éviter une dépendance circulaire), et un `motDansUnePhrase("site", true)` niché dedans n'y est alors plus reconnu comme une lecture du dictionnaire ; ses arguments littéraux sont signalés comme écrits en dur. Corrigé en passant la chaîne EN DIRECT à `getByText`, jamais via un `const` — documenté dans le fichier. |

## Point 6 — Captures

`docs/propositions/9IC-CORRECTIFS-COURTS/captures/{avant,apres}/`, 16 fichiers par état (8 écrans ×
375/1280 px), listés avec leur taille dans `captures/README.md`. AVANT produit dans un worktree
jetable sur `origin/main` d'avant ce lot (`23700e26f`), APRÈS sur ce dépôt. Spec commune :
`tests/e2e/zz-captures-9ic-correctifs-courts.spec.ts` (`CAPTURES_9IC=<dossier>`, rien n'est écrit
sans cette variable).

Piège rencontré : le premier essai de capture du planning défilé appelait le helper `capturer`
générique (qui pose `page.setViewportSize`) APRÈS avoir défilé la page — `setViewportSize`
réinitialise le défilement, et la capture montrait le haut de la page, pas le point de
chevauchement. Corrigé en prenant la capture directement après le défilement, sans repasser par
`capturer`. Second piège : le premier sélecteur (`tbody th[scope="row"]`, premier du DOCUMENT)
visait par erreur la ligne « Interventions non affectées » d'un AUTRE tableau que la frise du Jour
— corrigé en ciblant `table[aria-label="${t("planning.titre")}"] tbody th[scope="row"]`.

## Points ouverts

Aucun — les six points sont faits et commités avant le budget de temps. `verify:full` reste à
jouer (voir plus bas).

## Territoire respecté

`docs/arbitrages.md` (corps de D127 seulement), `lib/auth/acces-bureau.ts`,
`lib/auth/acces-technicien.ts` (lecture des comptes seulement), `public/sw.js` (condition des
replis seulement), `app/(back-office)/planning/page.tsx` (AUCUNE classe d'empilement touchée — le
correctif a suffi côté bandeau), `components/navigation/bandeau-bureau.tsx`,
`components/planning/pose.tsx` (AUCUNE touche — mesuré par comparaison de z-index, pas par
glisser-déposer), `lib/i18n/fr.ts` (les quatre clés), les cinq pages de 9I5 (AUCUN placement
changé — vérifié non nécessaire), leurs épreuves, `docs/propositions/9IC-CORRECTIFS-COURTS/`.
Aucune migration, aucune donnée de production, aucune dépendance nouvelle.
