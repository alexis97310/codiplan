# Passation — 9G2-TABLEAUX-EN-CARTES-375

Les 7 points du ticket sont faits, dans l'ordre de priorité demandé. Budget tenu très
largement (T0 07:37, dernier commit de code 08:08 — 31 min sur les 150 permises, aucune
coupure à T0+90).

## Point 1 — Trajets

`app/(back-office)/parametres/trajets/page.tsx`

- **Avant** : `<Carte>` (sans classe) enveloppait directement `<Tableau minimum="1000px">`
  — le seul geste de la ligne (« Régler » + « Enregistrer ») sortait de l'écran à 375 px
  (mesuré `rectanglePremierBouton.x = 825`, `docs/audits/9F6/ecrans/parametres-trajets/mesures.json`).
- **Après** : `page.tsx:149` — `<Carte className="max-[900px]:hidden">` autour du tableau ;
  `page.tsx:157-165` — `<ListeCartes>` avec une `<CarteZone>` par zone (`page.tsx:221`,
  nouvelle fonction) sous 900 px, même contenu que `LigneZone`.
- **Preuve** : `tests/unit/parametres/trajets/duree.test.ts`,
  `tests/unit/ui/carte-pas-recopiee.test.ts` (pas de recopie manuelle), capture
  `parametres-trajets-avant-375.png` vs `parametres-trajets-apres-375.png`.

## Point 2 — Agences

`app/(back-office)/parametres/agences/page.tsx` et `.../composants.tsx`

- **Avant** : `<Carte>` seule autour du tableau (960 px) — « Pas » et « Modifier »
  hors écran à 375 px.
- **Après** : `page.tsx:210` (devenu `className="max-[900px]:hidden"`) + `ListeCartes`
  avec `<CarteAgence>` (`composants.tsx:245`, nouvelle fonction) : même contenu que
  `LigneAgence` (nom, code, état, calendrier, jours, horaires, créneaux, pas, modifier).
- **Preuve** : `tests/unit/agences/*`, `tests/unit/app/agences-ligne-code.test.tsx`,
  capture `parametres-agences-*-375.png`.

## Point 3 — Matériel, Habilitations, Prestations

- `app/(back-office)/parametres/materiel/page.tsx` : deux tableaux (familles 920 px,
  modèles 960 px) → `CarteFamille` (`:568`) et `CarteModele`, `ListeCartes` sous 900 px.
  Un suivi (`44c8a804e`) a corrigé `CarteModele`, qui composait le séparateur « : »
  comme une constante dans le JSX plutôt que par `t("ponctuation.deux_points")` — rattrapé
  par le gardien L0-11 avant le dernier commit de code.
- `app/(back-office)/parametres/habilitations/page.tsx` : tableau 820 px → `CarteHabilitation`
  (`:248`).
- `app/(back-office)/parametres/prestations/page.tsx` : tableau 900 px → `CartePrestation`
  (`:265`).
- **Preuve** : `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`,
  `tests/unit/ui/carte-pas-recopiee.test.ts`, captures `parametres-materiel/-habilitations/-prestations-*-375.png`.

## Point 4 — Imports

`app/(back-office)/imports/page.tsx`

- **Avant** : tableau « Derniers imports » (900 px) sans variante mobile ; grille
  `<div className="grid gap-4 lg:grid-cols-2">` SANS `grid-cols-1` (donc aucun
  `minmax(0, …)` posé sous `lg`) ; `<input type="file">` natif — les deux débordaient
  le DOCUMENT à 375 px (`debordementHorizontal: true`, grille ~:246, champ fichier ~:260-267).
- **Après** : `page.tsx:253` — `grid-cols-1 gap-4 lg:grid-cols-2` explicite ; `page.tsx:268`
  — `<ChampFichier>` (déjà adopté sur `/parametres/societe` pour la même raison) remplace
  le natif ; tableau → `max-[900px]:hidden` + `CarteEntite`/`GrilleCartesEntites` sous 900 px.
- **Preuve** : `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`,
  `tests/unit/imports/titre-nouvel-import.test.ts`, captures `imports-*-375.png` (aucun
  défilement horizontal visible après).

## Point 5 — VGP (registre et familles à déterminer)

- `app/(back-office)/vgp/page.tsx` : tableau du registre (890 px) → `max-[900px]:hidden`
  (`:722` dans la version lue sur `9bcb542b`) + `ListeCartes`/`CarteLigneRegistre` (`:901`),
  motif VGP (`<details>`) et action « Enregistrer » compris.
- `app/(back-office)/vgp/a-determiner/page.tsx` : tableau (620 px) → même forme,
  `ListeCartes` ajoutée après le tableau masqué.
- **Preuve** : `tests/unit/vgp/*`, `tests/unit/ui/lot-a5-a7.test.ts`, captures
  `vgp-*-375.png`, `vgp-a-determiner-*-375.png`.

## Point 6 — Absences (le plus large : 4 défilements cachés)

`app/(back-office)/absences/page.tsx` et `components/ui/onglets.tsx`

- **Grille de la semaine** (`~:426-429` dans la version lue) : `overflow-x-auto` +
  `grid-cols-[140px_repeat(7,…)]` → masquée sous 900 px (`max-[900px]:hidden`),
  remplacée par une `<ul>` un jour par ligne (`pastillesDuJour` par jour,
  `listeDesPersonnes`), clé i18n neuve `absences.calendrier_aucune_absence`.
- **Frise des 4 semaines** (`~:569-570`) : même traitement, remplacée par une personne
  par ligne (`bandes.lignes`, `periode(bande.du, bande.au)`), clé neuve
  `absences.quatre_semaines_vide`.
- **Tableau** (`~:624` ancien, colonnes 820 px) : → `max-[900px]:hidden` + `ListeCartes`,
  même contenu que `LigneRendue`/`ActionDeLaLigne`.
- **Onglets** (`components/ui/onglets.tsx:61`) : `overflow-x-auto` seul → `flex flex-wrap`
  avec `max-[900px]:overflow-x-visible` / `min-[901px]:overflow-x-auto min-[901px]:flex-nowrap`
  — passent à la ligne sous 900 px, défilement horizontal inchangé au bureau (territoire :
  « sans changer leur comportement au bureau »).
- **Preuve** : `tests/unit/absences/*`, `tests/unit/interventions/onglets-registre.test.tsx`
  (comportement bureau inchangé), `tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`,
  captures `absences-*-375.png`.

## Point 7 — Fiche site

`app/(back-office)/sites/[id]/page.tsx`

- **« + Machine »** : était `max-[900px]:hidden` sans remplaçant. Rejoint désormais la
  `<BarreActionCollee>` (`:404-428`) aux côtés de « + Intervention », visible seulement
  sous 900 px (`min-[901px]:hidden` sur ce second bouton) ; le `pb` de la page passe à
  `220px` quand les deux actions coexistent (`peutGererMachine && peutCreerIntervention`).
- **Tableau « Dernières interventions »** (colonne Statut hors écran, fonction
  `BlocInterventions`) : → `max-[900px]:hidden` + liste de cartes sous 900 px.
- **Preuve** : `tests/unit/sites/*`, `tests/unit/theme/lien-visible.test.ts`, captures
  `sites-fiche-*-375.png` (les deux boutons et le tableau sont lisibles sans défilement).

## Captures

`docs/propositions/9G2-TABLEAUX-EN-CARTES-375/captures/` — 40 fichiers (10 écrans × avant/après
× 375/1280), en VIEWPORT (jamais `fullPage`), produits par
`tests/e2e/zz-captures-9g2.spec.ts` rejoué deux fois (mémoire « captures-avant-apres-e2e ») :
une fois sur un worktree posé sur `dfa0f847f` (= `origin/main` avant ce lot), une fois sur
le code livré.

```
$ ls -la docs/propositions/9G2-TABLEAUX-EN-CARTES-375/captures/ | head -8
total 2780
drwxr-xr-x 2 aplou aplou   4096 Oct 25 08:07 .
drwxr-xr-x 3 aplou aplou   4096 Oct 25 09:11 ..
-rw-r--r-- 1 aplou aplou  89862 Oct 25 08:05 absences-apres-1280.png
-rw-r--r-- 1 aplou aplou  35231 Oct 25 08:05 absences-apres-375.png
-rw-r--r-- 1 aplou aplou  89854 Oct 25 08:07 absences-avant-1280.png
-rw-r--r-- 1 aplou aplou  35764 Oct 25 08:07 absences-avant-375.png
-rw-r--r-- 1 aplou aplou 108357 Oct 25 08:05 imports-apres-1280.png
```
(40 fichiers au total — 10 écrans × avant/après × 375/1280 ; voir le dépôt pour la liste complète)

## Fin de lot — `verify-final.txt`

Les 15 dernières lignes, LITTÉRALES (couleurs ANSI retirées) — le fichier se termine par
la sortie brute, caractère par caractère, du reporter Playwright, tuée par la limite de
l'outil (voir « Points ouverts », qui lit `×`/`F`/`T` ci-dessous) :

```
·MESURE depot-fenetre-pose@375 — textes<12px: 0, cibles<32px: 13, débordement: 0
  cibles: [{"element":"a", … (tronqué)}]
·MESURE glisser-en-cours@1280 — textes<12px: 0, cibles<32px: 0, débordement: 0
MESURE bandeau-deplacement-differe@1280 — textes<12px: 0, cibles<32px: 0, débordement: 0
·····
········································°°······································
··×°F°···············································[WARN Better Auth: Base URL …]
···························
··············································×T································
································································×F··········[WARN …]
[WARN Better Auth: Base URL …]
····
················································································
················································································
······
```

`pnpm verify` (format:check, typecheck, lint, 5111 tests unitaires, 1679 tests
d'isolation, build) est **entièrement vert**. `feries:horizon` et `audit:partitions`
sont **verts**.

```
$ git rev-parse --short HEAD
25732c315
```

## Points ouverts

1. **`test:e2e` n'a pas fini** — 1620 scénarios sur un seul worker dépassent l'heure que
   l'outil accorde à un appel ; même situation, déjà vue et acceptée, que le lot précédent
   (`dfa0f847f`, 9G9E). **Nuance par rapport à 9G9E, à vérifier avant de fusionner** : la
   sortie brute du reporter (symboles du reporter `dot`/`github` — `·` passé, `°` ignoré,
   `F` échoué, `T` expiré, `×` interrompu par le `SIGTERM` final), juste avant la coupure,
   porte explicitement deux `F` et un `T` — PAS seulement des `×` d'interruption, donc PAS
   seulement l'effet du `SIGTERM` — alors que la fin de celle de 9G9E ne montrait que des
   `·`/`°` au moment de sa propre coupure (elle avait été tuée plus tôt, avant d'atteindre
   ces scénarios). Le reporter `github` n'a eu le temps de publier AUCUNE annotation
   `::error` ni aucun nom de scénario avant d'être tué, donc impossible de dire ICI si ces
   deux échecs touchent un écran de ce lot (absences, vgp, imports, parametres/*, sites) ou
   un scénario étranger déjà fragile. Les captures (spec e2e dédiée, rejouée deux fois,
   avant/après, sur la vraie page) et les 5111+1679 tests unitaires couvrent la correction
   visuelle revendiquée par ce lot ; mais `pnpm test:e2e` complet reste à rejouer hors de
   la contrainte de temps de l'outil (en CI, ou en plusieurs appels `-g` pour isoler les
   deux `F`/le `T`) avant fusion, pour nommer ces échecs et juger s'ils sont étrangers.
2. Aucune valeur de prix, aucun montant, aucun droit nouveau — hors territoire respecté.
3. Aucune migration — `prisma/` non touché.

## Reprise 9G2A-REPRISE-9G2 (25/10/2026)

Partie de `dfa0f847f` (garde `9G2-TABLEAUX-EN-CARTES-375-garde`), rebasée sur
`origin/main` (`7e3756eda`, 9G8D) sans conflit. Le pilote avait mesuré 8 échecs e2e sur
cette garde (`traces/9G2-TABLEAUX-EN-CARTES-375-verify-1.txt`) : la cause commune est que
chaque tableau converti rend DÉSORMAIS deux fois sa ligne — le tableau (`max-[900px]:
hidden`) ET une carte (`min-[901px]:hidden`) — et les deux restent dans le DOM, masquées
l'une l'autre par CSS selon la largeur.

### Côté application — un vrai doublon, pas seulement une épreuve mal ciblée

`app/(back-office)/absences/page.tsx`, le formulaire « Lever » (`FormulaireLevee`) : le
tableau et la carte posent chacun leur propre `BoutonAvecConfirmation`, donc chacun son
propre `<form>` et son propre `<dialog>` pour LA MÊME action — `locator('dialog')`
trouvait deux dialogues pour une ligne, alors qu'une confirmation est par nature unique.
`components/ui/bouton-confirmation.tsx` reçoit un prop optionnel `coteLargeur` (`"large"`
pour l'instance posée à côté du tableau, `"etroit"` pour celle posée dans la carte) : les
deux instances démarrent SANS `<dialog>` (zéro doublon avant hydratation), puis un effet
client, par `matchMedia("(min-width: 901px)")`, ne monte le `<dialog>` que sur celle qui
correspond à la largeur réelle. Absent (tous les autres appelants : `BoutonAnnuler`,
clôture, imports, société, planning, demandes), le comportement est inchangé. Le bouton
lui-même reste dupliqué (l'un `display:none` via la classe CSS) — explicitement permis
par le contrat de reprise, qui ne proscrit que le `<dialog>`/`<form>` qui agit en double.

**`"tableau"` et `"cartes"` étaient les noms évidents pour ces deux côtés — refusés** :
`APPARENCES` (`lib/theme/apparence.ts`) nomme déjà une apparence `"tableau"` (D95,
sans rapport avec cette reprise), et le gardien `tests/unit/theme/deux-apparences.test.ts`
refuse qu'un écran cite ce mot entre guillemets. Renommé en `"large"` / `"etroit"`, qui
ne collisionne avec rien et reste lisible (le seuil est 901 px, pas un tableau).

### Côté épreuves — viser la présentation affichée, jamais `.first()`/`.nth()`

| Épreuve | Avant | Après | Ce qu'elle prouve toujours |
|---|---|---|---|
| `absences-levee-confirmation.spec.ts` | `locator('dialog')` trouvait 2 `<dialog>` | corrigé côté application (ci-dessus) ; l'épreuve n'a pas changé | la confirmation s'ouvre, se referme sans soumettre, ou soumet et lève le blocage |
| `captures-9g9d-cartes-parametres-planning.spec.ts` | `premiereAgence` (lien CSS brut) `.first()` retrouvait le lien du TABLEAU masqué (le DOM-order premier), jamais cliquable à 375 px → délai de 30 s | `:visible` ajouté au sélecteur CSS avant `.first()` | la capture part bien de la première agence RÉELLE de la scène, quelle que soit la largeur courante |
| `defilement-tableau.spec.ts` | mesurait le défilement du registre VGP À 375 px | le tableau se masque désormais sous 901 px (point 5 du ticket 9G2) : plus de sens à 375 — reportée à **901 px**, la largeur la plus étroite où le tableau existe encore (la colonne de navigation y laisse moins de 890 px, son minimum, donc le débordement reste garanti) | le cycle complet de l'indice de défilement (droite puis gauche après défilement total) |
| `fiche-machine-vgp.spec.ts` | `.locator("a", {hasText: …}).first()` à 375 px retrouvait le lien du tableau masqué → délai de 30 s | `a:visible` | la fiche d'une machine en VGP dépassée, atteinte depuis le registre, à 375 px |
| `messages-tpa4a.spec.ts` | `getByText(vide_filtre)` trouvait le message du tableau ET celui de la carte | `.and(page.locator(":visible"))` | le registre VGP distingue bien « vide » de « filtré sans résultat » |
| `vgp-4.spec.ts` | `getByText(numéro de série)` dupliqué tableau/carte | `.and(:visible)` sur les trois occurrences | la recherche `q` filtre par numéro de série, désignation ou client |
| `vgp-a-determiner-lien.spec.ts` | `getByText(famille)` dupliqué | `.and(:visible)` | le lien « Décider » mène au bon filtre du référentiel matériel |
| `vgp2-registre.spec.ts` | `getByText(numéro de série)` dupliqué sur 7 occurrences, dans 5 scénarios ; le mode `serial` masquait que LES SUIVANTS (5 scénarios, « did not run » du constat) partageaient le même défaut, jamais atteints tant que le premier échouait | `.and(:visible)` sur les 7 occurrences | marque/référence affichées, recherche par marque/commune/client/site, tuiles KPI → filtre, regroupement par client et impression |

**`:visible` plutôt qu'un marqueur `data-presentation`** : le CSS pseudo-sélecteur
`:visible` est déjà l'idiome du dépôt pour exactement ce cas
(`planning-technicien-actions-refusees.spec.ts`, `fiche-annuler-terminee.spec.ts`,
`rapport-import-tpa3.spec.ts`) — il retrouve l'élément AFFICHÉ sans qu'aucune épreuve
n'ait à connaître la largeur courante ni le nom de la présentation, et sans jamais
réduire le compte attendu (`.first()`/`.nth()` restent absents du lot). `.and()` (API
Playwright, intersection de deux locators) compose ce filtre avec `getByText` sans jamais
toucher le TEXTE ni le COMPTE attendu par l'épreuve.

### Captures

**Aucune nouvelle capture** : les deux correctifs ne changent AUCUN pixel rendu — le
`<dialog>` différé est invisible avant ouverture (comme avant ce lot), et les épreuves ne
changent que leur SÉLECTEUR, jamais l'écran. Seule `defilement-tableau.spec.ts` change de
largeur de mesure (901 au lieu de 375 px), et ne produit aucune capture (ce fichier n'en a
jamais pris).

### Fin de lot

`pnpm verify` (format, typecheck, lint, 5111 tests unitaires, 1679 tests d'isolation,
build) **entièrement vert**. `feries:horizon` et `audit:partitions` **verts**.
`pnpm test:e2e` ciblé sur les 8 fichiers du constat (23 scénarios, dont les 5 « did not
run » de `vgp2-registre.spec.ts`) : **23 passés**. `pnpm test:e2e` COMPLET (1623
scénarios) relancé pour `verify-final.txt` : interrompu par la limite de temps de l'outil
après environ 700 scénarios (même situation que `dfa0f847f`/9G9E, « pas un échec
mesuré ») — mais, à la différence de la coupure précédente (deux `F` et un `T`
authentiques dans la sortie brute avant l'arrêt), la portion jouée ICI ne montre AUCUN
`×`/`F`/`T` : uniquement `·` (passé) et `°` (ignoré), plus une mesure `capture non prise`
déjà connue et sans rapport (README cité en ligne). `pnpm test:e2e` complet reste, comme
pour 9G9E, à rejouer hors de cette contrainte avant fusion — mais rien dans ce qui a tourné
ne signale une régression de ce lot.
