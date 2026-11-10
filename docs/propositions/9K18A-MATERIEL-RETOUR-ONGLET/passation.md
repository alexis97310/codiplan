# 9K18A-MATERIEL-RETOUR-ONGLET — passation

## Le signalement et ce qui était en cause

Alexis, 10/11/2026 (en production) : « lorsque je clique pour ajouter un sous-type à un
équipement, au lieu de me remettre sur l'onglet en cours, il me remet systématiquement sur
l'onglet famille. »

`app/(back-office)/parametres/materiel/page.tsx` porte trois onglets (`?onglet=`), des
filtres (`?q=`, `?etat=`, `?famille=`) et un volet (`?volet=`, `?id=`). Les neuf routes de
`app/api/parametres/materiel/**` (familles/modèles/sous-types × créer/modifier/activité)
redirigeaient TOUJOURS vers `/parametres/materiel` nu (`?motif=` en plus au refus) : l'onglet
retombait sur Familles, le défaut, et les filtres étaient perdus.

## Ce qui a changé

1. **`lib/materiel/suite.ts`** (nouveau) — le type `Suite` (onglet, filtres, famille
   filtrée) et deux fonctions :
   - `suiteRecue(formulaire)` : lit quatre champs cachés `suite_onglet`, `suite_q`,
     `suite_etat`, `suite_famille` — une valeur hors de sa liste close (onglet, état),
     un UUID invalide (famille) ou une recherche de plus de 200 caractères retombe sur le
     défaut, **jamais un refus** : ce ne sont que des commodités d'affichage.
   - `paramsDeLaSuite(suite)` : la même composition de `URLSearchParams` que
     `hrefEcran` de la page, partagée pour ne pas diverger en silence (§9, 01/09).
   `OngletMateriel`, `EtatFiltre`, `Filtres`, `TypeVolet` vivent désormais ici — la page les
   importe, elle ne les redéfinit plus.

2. **Chaque formulaire du volet et le bouton d'activité** (`page.tsx`) portent la suite en
   champs cachés (`ChampsSuite`, préfixés `suite_` pour ne jamais heurter un champ de saisie
   du même formulaire — `famille_id` existe déjà sur `FormulaireModele`).

3. **`versLeReferentiel`** (`app/api/parametres/materiel/saisie-recue.ts`) prend désormais
   `{ suite, motif?, ligne?, volet? }` et compose l'adresse de retour :
   - **au succès** : le même onglet, les mêmes filtres, et `?ligne=<id>` pour repérer la
     ligne créée ou modifiée ;
   - **au refus** : le même onglet, les mêmes filtres, `?motif=`, et **le volet ROUVERT**
     (`volet.type`, `volet.id` s'il y a un `id` à éditer) plutôt que fermé.
   Les neuf routes lisent désormais le formulaire (`requete.formData()`) **avant** d'exiger la
   capacité, pour que `suite` soit connue même au refus de droit — sans ce réordonnancement,
   le seul cas « pas la capacité » aurait quand même perdu l'onglet.

4. **`components/materiel/ligne-reperee.tsx` + `app/globals.css`** — la ligne visée défile
   dans la vue et se met brièvement en évidence (`@keyframes surbrillance-ligne`, sans
   `animation-fill-mode`, donc sans qu'il faille revenir retirer une classe). Chaque ligne
   (tableau ≥ 901 px, carte < 900 px) porte `data-ligne={id}` — jamais `id` : les deux
   représentations existent TOUJOURS dans le DOM, et un `id` HTML ne peut pas se dupliquer.
   Au montage, le composant choisit, parmi les éléments qui portent ce `data-ligne`, celui
   dont `offsetParent !== null` — visible à CETTE largeur, jamais le premier du document.

5. L'en-tête de `page.tsx` a perdu son paragraphe « LIMITE CONNUE, HORS TERRITOIRE » (la
   redirection ne reportait rien) : une section 9K18A dit ce qui est désormais fait, et ce
   qui NE l'est volontairement pas (point 6 ci-dessous).

## Ce qui n'a PAS été fait, et pourquoi c'est honnête de le dire

**La saisie refusée n'est pas reproposée.** Rouvrir le volet au refus montre les valeurs DE
LA BASE (celles d'avant la tentative), jamais celles tapées dans le formulaire refusé : aucun
champ caché ne les reporte. Le ticket l'autorisait explicitement (« s'il perd la saisie,
dis-le et garde-la si c'est simple ») : la reporter aurait exigé un champ caché par champ de
saisie, pour les trois formulaires séparément (famille : 3 champs ; modèle : 7 ; sous-type :
4), hors du budget de ce lot. Le motif de refus, lui, reste visible — c'est inchangé.

## Point 6 — les autres écrans de Paramètres dans le même cas (NON corrigés)

Recherche `grep -rl "Location:" app/api/parametres app/api/habilitations` : toutes ces routes
construisent leur propre `Location`, à vérifier une par une avant de les corriger (certaines
pages visées n'ont peut-être ni onglet ni filtre, auquel cas la question ne se pose pas) :

- `app/api/habilitations/exigences/[id]/retirer/route.ts`
- `app/api/habilitations/exigences/creer/route.ts`
- `app/api/habilitations/saisie-recue.ts`
- `app/api/parametres/agences/[id]/modifier/route.ts`
- `app/api/parametres/agences/creer/formulaire.ts`
- `app/api/parametres/agences/creer/route.ts`
- `app/api/parametres/forfaits/[id]/activite/route.ts`
- `app/api/parametres/forfaits/[id]/modifier/route.ts`
- `app/api/parametres/forfaits/creer/formulaire.ts`
- `app/api/parametres/forfaits/creer/route.ts`
- `app/api/parametres/pas-creneau/route.ts`
- `app/api/parametres/plages/actions.ts`
- `app/api/parametres/prestations/saisie-recue.ts`
- `app/api/parametres/societe/afficher-montants/route.ts`
- `app/api/parametres/societe/delai-relance-suite/route.ts`
- `app/api/parametres/societe/logo/retirer/route.ts`
- `app/api/parametres/societe/logo/route.ts`
- `app/api/parametres/societe/mentions-legales/route.ts`
- `app/api/parametres/tarifs/regle-facturation/route.ts`
- `app/api/parametres/taux-horaire/creer/route.ts`
- `app/api/parametres/trajet-zone/route.ts`

`app/api/parametres/materiel/saisie-recue.ts` apparaît encore dans cette recherche (elle
construit toujours `Location` elle-même) — c'est attendu, et désormais corrigée.

## Épreuves

- **Unitaires** : `tests/unit/materiel/suite.test.ts` — `suiteRecue` (défaut sur formulaire
  vide, lecture des quatre champs, valeur forgée hors liste close retombe sur le défaut,
  jamais un refus) et `versLeReferentiel` (succès reporte onglet+filtres+ligne, refus
  rouvre le volet avec le MÊME onglet, le défaut Familles ne pose aucun paramètre).
- **e2e existants corrigés** : `9i95-refonte-parametres-materiel.spec.ts` et
  `9k17a-materiel-sous-type.spec.ts` attendaient l'ancien bug comme un comportement normal
  (un test nommé « limite connue de la redirection ») — réécrits pour attendre le MÊME onglet
  et `?ligne=`.
- **e2e dédié** : `tests/e2e/9k18a-materiel-retour-onglet.spec.ts` — le cas d'Alexis (onglet
  Modèles filtré sur une famille, ajouter un sous-type existant à un modèle) et les deux
  autres onglets, à 1280 et 375 px, scène propre (préfixe `9K18A-`, effacée en `afterAll`).
- **Captures AVANT/APRÈS** dans `docs/propositions/9K18A-MATERIEL-RETOUR-ONGLET/captures/` —
  AVANT rejoué contre `dfc1373df` (tip d'`origin/main` avant ce lot) via un worktree jetable
  (`git worktree add`, next_modules symlinké, `.env` copié, `CI=1` pour ne jamais réutiliser
  le serveur 3100 du code corrigé) : rouge observé, exactement le signalement d'Alexis.
  APRÈS rejoué sur ce lot : vert.
- `pnpm test`, `pnpm test:isolation`, `pnpm typecheck`, `pnpm lint` : verts.
- `tests/e2e/tous-les-ecrans-rendent.spec.ts` : vert (`/parametres/materiel` compris).

## Ce qu'un ticket suivant devrait faire

Reprendre la liste du point 6 une route à la fois : vérifier d'abord si l'écran visé a un
onglet ou un filtre à perdre, puis appliquer le même patron (`Suite`/`ChampsSuite`,
adapté au nom des paramètres de l'écran).
