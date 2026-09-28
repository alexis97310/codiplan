# 9BJA-REPRISE-9BJ — passation

Reprise de `9BJ-PG-G10-CARTES-CHARGE` (branche locale `9BJ-PG-G10-CARTES-CHARGE-garde`, 3 commits,
jamais publiée). Six commits sur `main`, en local, non poussés :

1. `9BJA-REPRISE-9BJ — reprise de PG-C3 et PG-C4 depuis la branche`
2. `9BJA-REPRISE-9BJ — corrige le rouge de glisser-deposer.spec.ts`
3. `9BJA-REPRISE-9BJ — point 4b : la commune du site sur la carte du planning`
4. `9BJA-REPRISE-9BJ — point 4a : « Plein écran » replie aussi la barre latérale`
5. `9BJA-REPRISE-9BJ — point 4c : la barre de charge par jour dans les cases`
6. `9BJA-REPRISE-9BJ — captures AVANT/APRES de PG-C3 et PG-C4`

## Ce que j'ai changé (et ce que ça change pour l'exploitation)

**La reprise elle-même** (commit 1) : `git diff` du point de divergence (`940cc53`) vers la branche
gardée, appliqué par `git apply --3way` sur `main` à jour (qui avait avancé de quatre commits
depuis, dont PG-B3-TROUVER-CRENEAU et sa reprise). Trois conflits dans `page.tsx`, tous résolus en
GARDANT LES DEUX APPORTS plutôt qu'en choisissant : « Plein écran » (PG-C3) fusionné avec
l'ouverture de `FenetrePose` par glisser depuis la file (PG-B2/PG-B4, `BoutonPoser`,
`depuisFile`/`libelle`/`fuseau`) et avec le survol du jour férié posé sur la case
(`survol.ferie`, PG-B4) — que `etatsFeries` (PG-C3) ne portait pas encore, calculé une seule fois et
lu par les trois consommateurs (largeur de colonne, en-tête, survol).

**Le rouge mesuré à la reprise de la file** (commit 2) : `glisser-deposer.spec.ts` refusait de
trouver le bandeau de refus pour un dépôt sur un jour fermé (Koné, samedi). Mesuré, pas supposé :
à 1280 px, les colonnes de jour à 150 px (QG-1) font défiler la grille Semaine horizontalement dès
que la source et la cible sont à plus de trois colonnes l'une de l'autre — et la colonne
« Technicien » (`sticky left-0`) recouvre alors ce qui a défilé derrière elle.
`cible.scrollIntoViewIfNeeded()` amenait la case visée à l'écran mais poussait la SOURCE derrière
la colonne sticky, où aucun `dragstart` ne part — et `pointVisible` (le garde-fou du glissé), qui
ne juge que les bords de la FENÊTRE, jugeait « visible » une source qu'aucun clic n'aurait pu
atteindre. `glisser()` (`tests/e2e/setup/glisser.ts`) vérifie désormais avec `elementFromPoint`
que le point visé atteint RÉELLEMENT la source ET la cible, et élargit la fenêtre de test pour
supprimer le débordement horizontal plutôt que de le contourner pendant le glissé (le défilement
PENDANT un glissé HTML5 natif est mesuré inopérant, note déjà présente dans le fichier) : à
2200 px, un cadre dont le contenu naturel mesure 1070 px ne déborde plus, source et cible tiennent
ensemble même à quatre colonnes d'écart. **Ceci est une correction de l'ÉPREUVE, jamais du produit**
— la case fermée reste une cible de dépôt valide, le refus se lit toujours, seule la façon dont le
scénario amène la souris à bon port a changé.

**Point 4b — la commune du site sur la carte** : `listerPlanning` (`lib/interventions/depot.ts`)
lit désormais `site.commune`, et `siteDeLaCarte` (`carte.ts`) la compose entre parenthèses après le
site quand elle est connue (« Site Boulari (Nouméa) »). Seule cette fonction change de type — la
sélection PARTAGÉE `SELECTION_LIGNE_PLANNING` (fiches client et site) n'est pas touchée : un
premier essai avait élargi le type `LignePlanning` lui-même, ce que `pnpm typecheck` a aussitôt
signalé comme touchant trois AUTRES requêtes hors territoire ; corrigé en n'élargissant QUE le
type de retour de `listerPlanning`.

**Point 4a — « Plein écran » replie aussi la barre latérale** : `components/navigation/barre.tsx`
lit `useSearchParams().get("pleinEcran")` et ne rend rien quand il vaut `"1"`. Lu PAR CE SEUL
COMPOSANT, jamais passé par `app/(back-office)/layout.tsx` : un layout Next.js ne reçoit pas les
paramètres de recherche de la page qu'il enrobe (les lui donner rendrait tout le segment
dynamique), et le gardien `tests/unit/app/barre-par-segment.test.ts` exige que ce fichier appelle
`<BarreDeNavigation entrees={ENTREES} …/>` sans rien y ajouter — il reste intact. Effet de bord
mesuré : `useSearchParams` exige un contexte de routeur que cinq scénarios unitaires qui rendent
`BarreDeNavigation` ne fournissaient pas (`vi.mock("next/navigation", ...)` ne portait que
`usePathname`) — les cinq mocks sont étendus d'un `useSearchParams: () => new URLSearchParams()`.

**Point 4c — la barre de charge par jour dans les cases** : ce que 9BJ avait explicitement laissé
de côté (« demande un dénominateur PAR JOUR et par technicien … suppose de charger le calendrier
de CHAQUE technicien affiché … et de le croiser avec les interventions déjà posées dans
`cellule.lignes` », passation de 9BJ, « Ce qui reste à faire »). `page.tsx` charge désormais le
calendrier de CHAQUE technicien de la grille (pas seulement ceux « sans charge » du bloc 0 % déjà
livré), en réutilisant EXACTEMENT les mêmes fonctions que ce bloc
(`chargerCalendrierDuTechnicien`/`chargerCalendrierAgence`) ; `carte.ts` (`barreChargeDuJour`)
compose ensuite, PUREMENT et sans requête supplémentaire, `minutesOuvrees` sur la fenêtre d'UN SEUL
jour et `occupationTechnicien(technicienId, cellule.lignes, ouvrables, SANS_TRAJET)` — formules
INCHANGÉES (`lib/interventions/occupation.ts` et `statistiques.ts` non touchés, D107/D111). La
barre passe par `tauxCompact`, jamais par `tauxOccupation` nu : c'est ce choix qui exempte cet
affichage du gardien D56 (même raisonnement, déjà écrit, que `TauxDUneAgence`) sans avoir à porter
les deux termes et la formule en permanence dans une case de 78 px — ils vivent dans l'infobulle
(`title`). Largeur bornée à 100 %, rouge au-delà de `TAUX_PLEIN` (seul seuil existant, aucun palier
inventé), aucune barre sans calendrier connu (rien à comparer).

**Ce que ça change pour l'exploitation** : un planificateur peut désormais glisser une intervention
vers n'importe quel jour de la semaine, même hors du cadre visible d'un coup d'œil, sans que
l'écran perde la trace du geste ; les cartes du planning nomment la commune du site, utile en
Nouvelle-Calédonie où deux sites d'un même client peuvent être à une heure de route ; « Plein
écran » regagne toute la largeur de l'écran (barre latérale ET colonne « À planifier ») pour voir
plus de jours sans défiler ; et chaque case de la grille porte désormais un repère visuel immédiat
de la charge DE CE JOUR pour CE technicien, sans devoir dérouler le panneau complet.

## Ce que j'ai mesuré (comptes AVANT/APRÈS)

- **Unitaires** (`CI=1 pnpm exec vitest run tests/unit`, dans `pnpm verify:full`) : 302 fichiers,
  3150 tests, tous verts — y compris `occupation-affichee.test.ts` (D56) et
  `sans-couleur-en-dur.test.ts`, qui n'ont pas rougi malgré l'ajout de la barre par jour.
- **Isolation** (`pnpm test:isolation`) : 134 fichiers, 1281 tests, tous verts.
- **`pnpm build`** : compilé sans erreur (4,6 s).
- **`pnpm feries:horizon` / `pnpm audit:partitions`** : verts, 13 partitions couvertes jusqu'à
  2027-09, horizon fériés ≥ 12 mois.
- **`pnpm test:e2e` (la suite ENTIÈRE, incluse dans `verify:full`)** : 587 épreuves, 584 passées,
  3 ignorées (`skip` préexistants, sans rapport avec ce lot), **0 échec**, 21,6 minutes.
  `glisser-deposer.spec.ts` (8 épreuves) rejoué isolément trois fois avant le `verify:full` complet
  pour écarter la fragilité — trois fois vert.
- **`CI=1 pnpm verify:full` EN ENTIER, un seul appel, premier plan** (consigne de ce ticket) :
  VERT de bout en bout (format, typecheck, lint, test, test:isolation, build, fériés, partitions,
  e2e).
- **Captures AVANT/APRÈS** (`docs/propositions/PG-C3-CARTES-COLONNES/captures/`,
  `docs/propositions/PG-C4-CHARGE/captures/`) : AVANT sur `git worktree` au commit `940cc53`
  (dernier avant la branche gardée), APRÈS sur `cc806ac` (avant le commit des captures
  elles-mêmes) — mesuré : `vue-semaine-1280.png` et `vue-semaine-plein-ecran-1280.png` ont la MÊME
  taille en octets sur l'état AVANT (le paramètre `pleinEcran` n'existait pas encore), preuve que
  la capture « plein écran avant » montre bien l'état réel d'avant, pas un artefact.

## Ce que j'ai tranché et pourquoi

- **Élargir `agrandirPourContenirLesDeux` (largeur) plutôt qu'ajouter un défilement natif piloté
  par la souris** pour corriger le rouge de `glisser-deposer.spec.ts` : un essai avec un défilement
  au bord du cadre (mesuré : Chromium défile bien nativement un `overflow-x-auto` quand le pointeur
  d'un glissé actif s'attarde près de son bord, `scrollLeft` 0 → 410 sur 2 s) fonctionnait mais
  ajoutait un mécanisme de scrutation à 100 ms pendant jusqu'à 6 s, une source de lenteur et de
  flakiness en CI. Élargir la fenêtre pour supprimer le débordement à la racine est plus simple,
  déterministe, et réutilise un mécanisme (`agrandirPourContenirLesDeux`) déjà éprouvé pour l'axe
  vertical depuis 63-STABILITE-4 — l'étendre à la largeur est la même idée, pas une seconde
  écriture.
- **`pointVisible` reste inchangé dans sa définition, un second contrôle (`pointAtteint`,
  `elementFromPoint`) s'ajoute à côté** plutôt que de réécrire `pointVisible` pour connaître la
  colonne sticky : `pointVisible` ignore délibérément tout ce qui n'est pas la fenêtre (sa propre
  doc le dit), et lui apprendre une exception pour CETTE colonne particulière aurait couplé une
  fonction générique à un détail d'un seul écran. `pointAtteint` est, lui, générique : il demande
  au DOM ce qu'un vrai clic verrait, quelle que soit la cause du recouvrement.
- **Le calcul du taux par jour réutilise `occupationTechnicien` + `tauxCompact`, jamais une
  troisième fonction dans `lib/interventions/`** : territoire du ticket, formules gelées (D107/D111).
- **Aucune barre sans calendrier connu** (`barreChargeDuJour` rend `null`) plutôt qu'une barre à
  0 % : même raison que partout ailleurs dans ce module (« pas de calendrier » ≠ « n'a rien fait »).
- **La barre par jour NE soustrait PAS les absences du dénominateur** (contrairement au bloc « 0 %
  hebdomadaire » qui, lui, les soustrait via `periodesBloquees`) : un jour bloqué porte déjà la
  pastille « Agenda bloqué » et n'a normalement aucune intervention dessus, donc une barre à 0 % y
  est déjà correcte sans ce terme supplémentaire — l'ajouter aurait demandé de faire voyager
  `absences` jusque dans `VueSemaine` comme prop neuve pour un cas déjà couvert visuellement. Une
  scène future qui poserait une intervention SUR un jour bloqué (cas anormal, déjà refusé au dépôt)
  verrait un taux légèrement optimiste ce jour-là — écrit ici plutôt que découvert en silence.
- **Cinq mocks `next/navigation` étendus plutôt qu'un mock global** : chaque scénario garde son
  `usePathname` propre (le pathname change le test), seul `useSearchParams` est identique partout
  (aucun de ces cinq scénarios n'a besoin d'un paramètre de recherche réel).

## Ce que je n'ai PAS fait

- **Je n'ai pas retenté le mécanisme de défilement natif par le bord** comme correction du rouge de
  `glisser-deposer.spec.ts` — mesuré fonctionnel mais écarté au profit de l'élargissement de
  fenêtre, plus simple (voir « Ce que j'ai tranché »). Le code de cette tentative n'est dans aucun
  commit.
- **Je n'ai pas ajouté de capture « plein écran » à 375 px** pour PG-C3 : le bouton
  « Plein écran » est `hidden lg:block` comme la grille elle-même (aucun équivalent tactile), donc
  aucun état « plein écran » n'existe à 375 px à photographier — même limite déjà posée pour
  PG-B4-SURVOL-CASES.
- **Je n'ai pas retouché `lib/interventions/occupation.ts` ni `lib/interventions/statistiques.ts`** —
  territoire fermé du ticket (formules D107/D111 inchangées), et la barre par jour n'avait besoin
  que de LIRE ce qui y existe déjà.
- **Je n'ai pas relancé `pnpm chemins` ni `pnpm veille`** — hors du périmètre de ce ticket (aucune
  nouvelle fonction de `lib/` sans appelant, aucune politique RLS touchée).

## Les pièges pour la session suivante

- **`app/(back-office)/planning/page.tsx` a maintenant DEUX blocs qui chargent un calendrier par
  technicien** (le bloc « 0 % hebdomadaire » de PG-C4-CHARGE et le bloc neuf de ce ticket pour la
  barre par jour), chacun avec son propre `cacheAgence` local — une agence sans calendrier PROPRE
  au technicien peut donc être lue deux fois pour la même page. Mesuré : correct, pas mesuré
  coûteux à l'échelle de démonstration (3 agences). Une session qui ajouterait un TROISIÈME besoin
  de calendrier par technicien devrait fusionner les trois blocs en un seul, pas en ajouter un
  quatrième.
- **`glisser()` (`tests/e2e/setup/glisser.ts`) élargit désormais la fenêtre de test dès que la
  source OU la cible n'est pas RÉELLEMENT atteignable** (pas seulement quand `pointVisible`
  échoue) — un scénario qui mesurerait la taille de la fenêtre pendant un glissé, ou qui
  capturerait un écran PENDANT l'appel (avant le `finally` qui restaure `fenetreOrigine`), verrait
  potentiellement une fenêtre élargie. Aucun scénario actuel ne le fait ; à vérifier si un futur
  ticket en ajoute un.
- **La barre par jour vit dans `CasePosable`, positionnée `absolute bottom-1 left-1 right-1`** — un
  futur changement de la hauteur fixe de la case (78 px, `style={{ height: "78px" }}`) ou de son
  padding (`p-1.5`) devrait vérifier que la barre ne chevauche pas la dernière carte posée dans une
  case chargée.
- **`BarreDeNavigation` est maintenant un composant qui dépend de `useSearchParams`** — tout NOUVEAU
  scénario unitaire qui la rend directement (hors Playwright, qui a un vrai routeur) doit mocker
  `next/navigation` avec les DEUX fonctions, `usePathname` ET `useSearchParams`, sous peine d'un
  plantage de rendu plutôt que d'un simple test qui rate son assertion.

## Ce qui reste à faire

Rien n'a été laissé en `BLOQUÉ`, rien n'a rougi deux fois de suite. Les quatre points que 9BJ
n'avait pas faits (captures, « Plein écran » sur la barre latérale, commune sur la carte, barre par
jour) sont tous les quatre livrés et mesurés dans ce lot.
