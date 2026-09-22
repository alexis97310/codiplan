# FICHE-1 — la fiche d'intervention affiche l'identifiant technique du technicien

Travail commité **sur `main` en local**, sans proposition ni branche distante
(processus du 22/09/2026), en `91e3222`. Rien n'a été poussé.

Captures prises le **2026-09-22 à 08:08 UTC** (19:08 à Nouméa), par
`tests/e2e/fiche-technicien-nomme.spec.ts` contre le serveur de production
compilé (`next start`) sur la base d'épreuve locale de `pnpm test:e2e` :
migrations, semis de `prisma/seed.ts`, scène e2e. Aucune donnée de la base
hébergée (I9). Largeur 1280 px. `mesure.json` est écrit par le spec :
empreinte du commit sous lequel il a tourné — `d6f702a`, l'état de `main` au
moment de la photo, **et le code de la fiche n'a pas changé depuis** —,
horodatage, et ce que chaque fiche a rendu dans la ligne « Technicien ».

## Le constat, re-mesuré avant de coder — et il est PÉRIMÉ

Le ticket cite `app/(back-office)/interventions/[id]/page.tsx:177` :

    valeur={ligne.technicien_id ?? t("intervention.aucun_technicien")}

**Cette ligne n'est plus sur `main`.** Mesuré :

    git log -S technicienAfficheSurLaFiche -- 'app/(back-office)/interventions/'
    → edb089a  D-04 (1/4) — la fiche d'intervention affichait l'UUID du
                technicien, pas son nom (I10) (#239)        19/09/2026
    → 31f89a2  Lot INT-FORM (#267)                           20/09/2026

Depuis `edb089a`, la fiche appelle `technicienAfficheSurLaFiche(ligne.technicien_id,
annuaire)` (`presentation.ts:187`), qui reprend `quiTravaille` de
`lib/interventions/personnes.ts` sur un annuaire construit par
`annuaireDesPersonnes` sous le contexte cloisonné — **le même annuaire que la
liste**, jamais un second. Le cas « technicien inconnu ou refusé par la
politique » rend déjà `planning.nom_non_communique` (« Technicien (nom non
communiqué) ») ; le cas « aucune affectation » rend `intervention.aucun_technicien`.
Aucune clé n'a manqué au dictionnaire.

La « re-mesure du 22/09 (C-06) » a donc lu un état antérieur au 19/09, ou une
copie de travail qui n'était pas `main`. Le refus d'écrire une seconde
résolution est motivé par cette mesure (protocole §3) : *la coder à nouveau
aurait produit exactement la divergence silencieuse que le ticket interdit.*

## Ce que j'ai tranché : où la résolution vit

Le ticket demandait de mesurer : dans `lireFicheIntervention`, ou dans la
page ? **Dans la page, comme la liste** — et c'est le choix déjà pris par
`edb089a`, que je garde :

- la liste (`interventions/page.tsx:167-169`) lit ses lignes par le dépôt,
  puis appelle `annuaireDesPersonnes(tx, personnesANommer(lignes, []))` dans
  la page, sous la même transaction cloisonnée ;
- `lib/interventions/depot.ts` ne connaît pas l'annuaire, ni pour la liste ni
  pour la fiche — et il n'a pas à le connaître : le nom d'une personne n'est
  pas une donnée de l'intervention, c'est une lecture d'`utilisateur` que la
  politique RLS peut refuser (compte portail, autre société) ;
- la fiche lit **aussi** les techniciens actifs pour ses deux `<select>`, et
  seulement si le rôle y a droit — l'annuaire doit couvrir les deux
  populations en une requête. Le dépôt ne sait pas ce que le rôle a le droit
  de voir ; la page le sait.

Déplacer la résolution dans le dépôt aurait donc fait deux choses que rien
n'exige : donner au dépôt une connaissance des habilitations, et rompre la
symétrie avec la liste.

## Ce qui a changé

Un seul fichier de code, **neuf** : `tests/e2e/fiche-technicien-nomme.spec.ts`.
Rien dans `page.tsx`, `depot.ts` ni `fr.ts` — le territoire les autorisait,
la mesure n'en a rien demandé.

Ce que les épreuves existantes ne tenaient pas, et que le ticket exige :

| épreuve | ce qu'elle prouve | ce qu'elle ne prouvait pas |
|---|---|---|
| `tests/unit/interventions/technicien-fiche.test.ts` (edb089a) | la FONCTION, 4 cas, sur un annuaire factice | l'écran |
| `tests/e2e/intervention-technicien-select.spec.ts` (#267) | le nom dans un `<dd>` une fois affecté | la fiche **sans** technicien ; l'absence de tout UUID |

Le nouveau spec, 2 scénarios en série, session ADV, fenêtre 1280 × 900 :

1. **SANS technicien** — crée une intervention sur le premier site, ouvre sa
   fiche : le `<dd>` qui suit le `<dt>` « Technicien » vaut
   « Aucun technicien affecté », et l'`innerText` de `<main>` ne contient
   aucun motif `8-4-4-4-12`. C'est le cas réel d'Alexis (équipe vide, 1751
   archives sans clé).
2. **AFFECTÉE** — même création avec la deuxième option du sélecteur (la
   première est l'absence) ; la fiche rend **le nom lu dans l'option**, qui
   n'est ni un UUID, ni « Aucun technicien affecté », ni l'un des deux replis
   de `quiTravaille` — la personne est nommée, pas seulement « pas
   identifiée ». Aucun UUID dans le texte visible.

« Aucun UUID dans le rendu » est défini dans le spec : le **texte visible**.
Les `<option value>` des sélecteurs portent des UUID dans un attribut — c'est
leur rôle. `Local-21F111` prend six caractères de l'`id`, il n'est pas l'`id`.

## L'épreuve a été mise en échec avant d'être crue

Vert du premier coup — donc suspect (§9, 11/09). J'ai réinstallé le défaut
exact du ticket dans `page.tsx` (`ligne.technicien_id ?? t(…)` à la place de
l'appel), rejoué le spec (rebuild compris) :

    AFFECTÉE  ✗  Expected: "D. Guérin"
                 Received: "01a0c829-405c-7c70-a156-5826efe7b093"
    SANS      ✓  (le défaut n'a jamais touché ce cas — vert pour sa propre raison)

Puis `git checkout` de la page. L'épreuve tombe sur le défaut d'origine, par
son bout exact.

## Les captures

| fichier | ligne « Technicien » rendue |
|---|---|
| `fiche-sans-technicien--1280.png` | Aucun technicien affecté |
| `fiche-technicien-nomme--1280.png` | D. Guérin |

Les deux URL photographiées sont dans `mesure.json` (`/interventions/01a0c828-…`) :
l'UUID est dans l'**adresse**, où il a sa place (I10 : la clé technique porte
les relations), et nulle part dans le texte rendu.

## `verify:full`, en entier

Deux passages. Le premier (08:09 UTC) a rougi en 7 s sur **`format:check`,
mon seul fichier** — Prettier voulait une ligne différente pour la constante
`UUID`. Corrigé par `prettier --write`.

Le second (08:10:15 → 08:14:49 UTC, 4 min 34 s), sur l'état commité en `91e3222` : `format:check`, `typecheck`, `lint`, **2534**
unitaires (231 fichiers), **1082** d'isolation (102 fichiers), `build`,
`feries:horizon`, `audit:partitions`, **129** e2e passés sur 131 (les 2 restants sont deux `skip` préexistants de `tous-les-ecrans-rendent.spec.ts`) — exit 0, sans reprise.

## Ce que je n'ai pas fait

- **Pas réécrit la résolution** : elle existe sur `main` depuis `edb089a`, et
  la réécrire aurait été le défaut que le ticket nomme (§9, 01/09).
- **Pas ajouté de clé à `lib/i18n/fr.ts`** : `planning.nom_non_communique`
  couvre déjà la personne qu'on ne sait plus nommer, et `intervention.aucun_technicien`
  l'absence. Le ticket n'en demandait une que « si aucune clé n'existe ».
- **Pas touché à `prisma/`, `lib/planning/**`, `lib/imports/**`** — interdits,
  et rien ne l'exigeait.
- **Pas éprouvé un technicien réellement SUPPRIMÉ en base** : `intervention.technicien`
  porte `onDelete: Restrict` (`schema.prisma:2447`) — une personne affectée
  ne se supprime pas. Le cas « inconnu de l'annuaire » est éprouvé sur la
  fonction (`technicien-fiche.test.ts`, cas « refusée »), pas sur l'écran :
  le produire à l'écran exigerait d'écrire une ligne qui viole une clé
  étrangère, ce que la base refuse.
- **Pas inscrit FICHE-1 au backlog** — le ticket n'y figure pas
  (`grep FICHE-1 docs/backlog.md` : rien), et `docs/backlog.md` n'est pas
  dans le territoire.
- **Pas ouvert de branche** : le ticket dit « branche NEUVE depuis main » en
  tête et « tu commites sur main en local » en fin ; j'ai suivi la fin, qui
  est le processus du 22/09 (PARC-1, VGP-IMPORT, REPRISE-HISTORIQUE l'ont
  suivi).
- **Rien poussé.** Deux commits sur `main` en local : `91e3222` (le
  spec), puis celui-ci (les captures, `mesure.json`, ce compte rendu).
