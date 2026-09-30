# 9CG-RETOUCHES-2A-TYPO — passation

Six commits de code (`6dcd517`…`b0382e5`), les décisions d'Alexis du 30/09/2026 (points 6 à 11, D143), un nouveau gardien (`tests/unit/ui/retouches-2a.test.ts`), et des captures AVANT/APRÈS complètes (`captures/`).

## Ce que j'ai changé, et ce que ça change pour l'exploitation

- **Point 6 — 210 occurrences de `text-[12.5px]` (58 fichiers) → `text-13`** (le jeton de l'échelle). Aucun texte ne rend plus une taille littérale de 12,5 px.
- **Points 7 et 10 — les 12 tailles hors échelle restantes (19, 20, 22, 26, 27 px, 10 fichiers) ramenées à la valeur la plus proche** : 27 px → 28 px (tuiles `Kpi`, tuile du portail) ; 26 px → 28 px (symbole machine, compteur clients — égalité à 2 px avec 24, tranchée vers la plus grande par consigne du pilote) ; 22 px → 24 px (h1 de `Page`, h2 de la fiche machine, h1 du terrain) ; 20 px → 18 px (h1 de `terrain/[id]`, loupe des filtres) ; 19 px → 18 px (raison sociale du portail). **Effet visible pour l'exploitation** : tous les titres de page du back-office (`Page`) passent de 22 à 24 px, toutes les tuiles de chiffres de 27 à 28 px — un changement uniforme sur tout le produit, pas une page isolée.
- **Point 11 — 700 minimum pour tout texte de 12 ou 13 px** : 563 lignes (77 fichiers) portaient une taille de 12-13 px avec une graisse inférieure à 700 (400/500/600) ou aucune graisse propre ; elles portent maintenant `font-bold` au moins. Trois cas d'HÉRITAGE (taille du parent, pas de jeton sur la ligne elle-même) ont échappé au script et au gardien statique, et n'ont été trouvés qu'en RELISANT LA MESURE DES CAPTURES APRÈS coup (voir « ce que j'ai mesuré ») : `arrivee/page.tsx` (`<dd className="font-medium">`), trois `<span className="w-[150px] font-semibold">` dans `imports/[id]/page.tsx`, et le lien « voir les interventions » de `parametres/equipe/page.tsx`. Les sept occurrences de `CLASSES_LIEN_TUILE` (« le lien sous une tuile ») restent EXCLUES — territoire de 9CH-RETOUCHES-2B-COMPOSANTS, gardé par une exemption fermée dans `retouches-2a.test.ts`.
- **Point 8 — le texte du terrain à 16 px** : `app/(mobile)/terrain/page.tsx`, `terrain/[id]/page.tsx`, `components/interventions/signature-terrain.tsx` — texte courant, champs et les six `<Button>` passent à 16 px. `app/(mobile)/layout.tsx` porte `text-16` sur son enveloppe. Surtitres (`uppercase`) et pastilles (`rounded-full`) restent au rang « plus petit texte » (12 px, 700 par le point 11) — lecture retenue, non contredite par Alexis à ce jour. La barre de navigation (`components/navigation/barre.tsx`), rendue sur le terrain comme sur le reste du produit, n'est PAS un écran du terrain au sens du point 8 : elle garde sa propre échelle (12-13 px), inchangée.
- **Point 9 — chiffres tabulaires partout** : une seule règle, `font-variant-numeric: tabular-nums` sur `body` (`app/globals.css`), plutôt qu'une classe par endroit. Les 12 `tabular-nums` déjà posés restent (redondants, jamais fautifs).
- **Plancher étendu (D138, règle existante)** : `components/interventions/trouver-creneau.tsx` (2 classes, 11,5 px) passe au jeton `text-12` avec la graisse 700 du point 11. `plancher-12-pages.test.ts` l'ajoute à sa liste explicite (qui grandit, ne rétrécit jamais).
- **Point 6 de la table « laissé au pilote » — `leading-[8px]` des filtres du parc → `leading-none` : TENTÉ, PUIS REVENU EN ARRIÈRE.** Voir « ce que je n'ai pas fait ».

## Ce que j'ai mesuré

### Comptes AVANT (main, commit `7619cb8d`, re-mesurés sur `6dcd517` — commit 1 de ce ticket, avant toute retouche) — mêmes commandes que le constat du ticket

- `grep -rEo 'text-\[12\.5px\]' app components --include=*.tsx | wc -l` → **210**, dans **58** fichiers.
- `grep -rnE 'text-\[(19|20|22|26|27)px\]' app components --include=*.tsx` → **12** occurrences dans **10** fichiers, identiques au tableau du constat.
- `grep -ro tabular-nums app components --include=*.tsx | wc -l` → **12**.
- `grep -rn 'leading-\[8px\]' app components` → **4** (les filtres du parc).
- `grep -rnE 'text-\[(9|10|11)(\.[0-9])?px\]' app components` → **2** (`trouver-creneau.tsx:94,102`) ; les 3 de `pose.tsx` avaient déjà été passées à 12 px par 9CF-PG-G11-JOUR-FRISE, relu au départ comme demandé.
- Point 11, motif `P='text-(12|13|xs|\[12px\]|\[12\.5px\]|\[13px\])([^0-9a-z.-]|$)'` → **663** lignes candidates, dont **563** sans graisse ≥ 700.

### AVANT → APRÈS (mêmes commandes, sur `b0382e5`, dernier commit de code)

- `text-[12.5px]` : 210 → **0**.
- Tailles hors échelle (19/20/22/26/27 px) : 12 → **0**.
- Point 11 (563 lignes fautives) : **0** ligne statique restante — confirmé par le gardien `retouches-2a.test.ts`.
- `leading-[8px]` : 4 → **4** (inchangé, voir plus bas).
- Sous 12 px hors `pose.tsx` : 2 → **0**.

### Point 10 — le tableau taille → cible, tel qu'appliqué

| Taille mesurée | Cible retenue | Écart aux deux bornes | Fichiers |
|---|---|---|---|
| 27 px | 28 px | 1 px (24 à 3) | `kpi.tsx`, `portail/page.tsx` |
| 26 px | 28 px | **égalité** 24/28 à 2 px — tranchée vers la plus grande (consigne du pilote) | `parc/[id]/page.tsx`, `maitre-detail.tsx`, `clients/page.tsx` |
| 22 px | 24 px | 2 px (18 à 4) | `mise-en-page/page.tsx` (h1 de `Page`), `parc/[id]/page.tsx` (h2), `terrain/page.tsx` (h1) |
| 20 px | 18 px | 2 px (24 à 4) | `terrain/[id]/page.tsx` (h1), `barre-de-filtres.tsx` (loupe) |
| 19 px | 18 px | 1 px (24 à 5) | `portail/page.tsx` |

### La mesure DYNAMIQUE des captures — AVANT/APRÈS, résumée

Voir `captures/README.md` pour le tableau complet et son commentaire. En bref, sur 48 écrans × 3 largeurs (1280/1024/375 px), deux bases jetables fraîchement semées :

| | Hors échelle | Petits textes légers | Terrain < 16 px |
|---|---|---|---|
| AVANT | 294/294/262 (par largeur) | 1507/1507/1135 | 48/48/48 |
| APRÈS | **0/0/0** | **11/11/11** | 20/20/20 |

Les 11 « petits textes légers » restants sont EXACTEMENT les sept usages de `CLASSES_LIEN_TUILE` (territoire 9CH). Les 20 « terrain < 16 px » restants sont le bandeau de navigation (SAV, nom de société, « Se déconnecter », initiales — hors point 8) et les surtitres/pastilles légitimement laissés à 12 px. C'est cette mesure, relue APRÈS la première prise, qui a fait remonter les trois cas d'héritage du point 11 corrigés dans le sixième commit.

### `CI=1 pnpm verify:full` — résultat complet

`format:check`, `typecheck`, `lint`, `test` (**4836/4836** tests unitaires), `test:isolation`, `build`, `feries:horizon`, `audit:partitions` : **tous verts**. `test:e2e` : **692 passés, 7 ignorés (préexistant, sans rapport), 1 ÉCHEC** — `tests/e2e/parc-tri.spec.ts:249` (« la liste occupe au moins 480 px visibles »). Voir « le conflit non résolu ».

*(Note d'exécution : `pnpm typecheck` a heurté un plafond mémoire par défaut de Node dans cet environnement — `NODE_OPTIONS=--max-old-space-size=6144` l'a contourné ; sans rapport avec ce ticket.)*

## Ce que j'ai tranché, et pourquoi

- **Point 10, égalité 26 px → 28 px** (et non 24) : consigne du pilote — en cas d'égalité de distance, la plus grande valeur.
- **Lecture du point 8** : « texte » = texte courant, champs, boutons ; surtitres et pastilles restent au rang 12 px/700 de la même table ; la barre de navigation n'est pas un écran du terrain. Non contredit par Alexis à ce jour — voir « à confirmer ».
- **Les trois cas d'héritage du point 11** ont été corrigés à la main (pas de règle générale ajoutée) : le grep statique ne voit que ce qui porte SON PROPRE jeton de taille ; c'est délibéré (`retouches-2a.test.ts` documente pourquoi), et la mesure dynamique est le filet qui rattrape le reste.
- **D143** numéroté après D142 (dernier numéro pris, vérifié en tête de ticket) — libre, pas de collision.
- **Huit tickets du backlog re-estampillés** (L1-01, L1-05b, L1-11, L3-04b, L3-06, L3-16, L7-01, L7-02) : leur empreinte dépendait de D138, dont le texte a changé (ajout de « Amendé par D143 »), sans que leur contenu ait besoin d'être corrigé — vérifié un par un, aucun ne parle de typographie.

## Ce que je n'ai PAS fait

- **`leading-[8px]` → `leading-none` des filtres du parc : REVENU EN ARRIÈRE.** Appliqué, mesuré avec `pnpm exec playwright test tests/e2e/parc-tri.spec.ts -g "480 px"` sur la vraie base : la liste tombe à **455,2 px** visibles, sous le plancher de 480 px que `parc-tri.spec.ts:249` exige (constat 30, 99C). Conformément à la consigne du ticket (« si ça rougit, t'arrêter et le dire, sans toucher d'autre espacement »), j'ai annulé le changement — `app/(back-office)/parc/page.tsx` est revenu strictement à l'état de `main` (`git checkout --`), comparé par `git diff` avant de continuer. Les 4 classes restent `leading-[8px]`.
- **Les liens sous les tuiles (`CLASSES_LIEN_TUILE`) et la tuile « En retard »** : hors territoire (9CH-RETOUCHES-2B-COMPOSANTS), même s'ils portent une taille de 12-13 px sans graisse 700. Exemption fermée, tenue dans les deux sens par `retouches-2a.test.ts`.
- **Aucune règle de gestion, aucune couleur nouvelle, aucun libellé changé, aucune dépendance ajoutée.**
- **Les 50 lignes restantes qui portent une graisse faible (`font-normal`/`medium`/`semibold`) SANS jeton de taille sur la même ligne** n'ont pas toutes été auditées une par une : seules celles que la mesure dynamique des captures a réellement vues à 12-13 px ont été corrigées (les trois cas ci-dessus). D'autres pourraient hériter une taille de 14 px ou plus (hors point 11) — non vérifiées faute d'écran les exerçant dans la liste des 48 captures.

## Les pièges pour la session suivante

- **`sansCommentaires` (`tests/unit/outils/fichiers-source.ts`) confond `accept="image/*"` avec un commentaire de bloc ouvert** — elle cherche le PROCHAIN `*/` et avale tout ce qui se trouve entre les deux (mesuré sur `terrain/[id]/page.tsx` : 72 lignes disparues, dont un `<Button>` entier). `retouches-2a.test.ts` contourne le problème en lisant le contenu BRUT pour les trois fichiers du terrain (point 8). Tout futur gardien qui lit ces trois fichiers via `sansCommentaires` doit le savoir.
- **Le conflit non résolu : `parc-tri.spec.ts:249` (480 px de liste visible) est maintenant rouge sur `main`, indépendamment de `leading-[8px]`.** Deux mesures, deux rouges de la même famille : 455,2 px avec `leading-none` appliqué (abandonné), 459,2 px avec `leading-[8px]` restauré (état actuel de `main`). La cause n'est pas le `leading` — c'est la croissance mandatée par ce ticket : le h1 de `Page` (22 → 24 px, point 10) et les tuiles `Kpi` (27 → 28 px, point 7) rendues sur `/parc`, qui poussent la liste de quelques pixels vers le bas dans un viewport fixe (800 px). Options, non tranchées ici : (a) relever le plancher de `parc-tri.spec.ts` de 480 à ~460 px pour refléter la nouvelle échelle — un test, pas un espacement, donc hors de ce que ce ticket touche ; (b) resserrer un espacement du bandeau de KPI ou des filtres du parc pour regagner les ~21 px manquants — un geste d'espacement, explicitement hors territoire de ce ticket (« aucune autre ligne ») ; (c) laisser 9CH-RETOUCHES-2B-COMPOSANTS ou un ticket dédié trancher. **Je n'ai pas touché au test ni ajouté d'espacement compensatoire** — les deux seraient sortis du territoire strictement typographique de ce ticket.
- **Deux serveurs de captures qui partagent la même base ne doivent PAS être relancés sans reseed** si un second facteur a été activé pendant une prise précédente : le compte `direction@codima.test` porte alors un secret TOTP non rejouable, et TOUTE capture authentifiée suivante échoue en cascade (mesuré : 18 refus deviennent 21+, puis un échec de connexion generalisé). Repartir d'une base droppée-recréée à chaque nouvelle tentative, comme documenté par 9CB.
- **`pnpm typecheck` peut heurter un plafond mémoire V8 par défaut** dans cet environnement, de façon intermittente (reproductible puis non reproductible sans changement de code) — `NODE_OPTIONS=--max-old-space-size=6144` le contourne.

## Ce qui reste à faire

- **Trancher `parc-tri.spec.ts:249`** — voir « le conflit non résolu » ci-dessus.
- **Confirmer ou infirmer la lecture du point 8** (pastilles/surtitres du terrain hors du plancher 16 px) et le h1 des pages du bureau à 24 px plutôt que 28 px (spec §3.2 :221, écart nommé dans D143).
- **`leading-none` des filtres du parc** reste à faire, avec un espacement compensateur ailleurs sur `/parc` pour ne pas repasser sous 480 px — non tenté ici, hors territoire.
- **Audit complet des 50 lignes à graisse faible sans jeton de taille propre**, au-delà des trois corrigées : nécessiterait soit plus d'écrans dans `scripts/captures.mts`, soit une revue manuelle fichier par fichier.
