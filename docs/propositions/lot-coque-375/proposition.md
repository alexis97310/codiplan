# COQUE-375 — le back-office et le portail tiennent sur un téléphone

Branche `claude/zealous-sagan-9e3iwj`, depuis `origin/main` à `de17141` (N-07).

## À lire avant tout le reste

1. **Aucun déploiement de prévisualisation n'est joignable depuis cette
   session** (le proxy bloque le site en ligne) : la mesure « avant » de ce
   dossier vient d'un PostgreSQL local monté par le script officiel du dépôt,
   `scripts/postgres-jetable.sh`, migré et semé par le chemin de production
   (`prisma migrate deploy` + `pnpm db:seed`), sur le MÊME commit que
   l'« après ». C'est ce que demandait le ticket.
2. **Le portail se mesure avec le compte interne de l'épreuve**
   (`adv@codima.test`), pas avec un compte de portail réel — **aucun n'existe
   encore** (D96, déjà documenté par
   `tests/unit/navigation/barre-du-portail.test.tsx`). `/portail` avec ce
   compte affiche l'écran RÉSERVÉ plutôt que le parc d'un client, mais la
   COQUE — colonne, bandeau mobile, tiroir — y est rigoureusement identique à
   celle qu'un client verrait : c'est elle que ce ticket corrige, et c'est
   elle qui est photographiée et éprouvée.
3. **Le terrain n'est pas touché.** Sa liste d'entrées est vide (R5-01) ;
   `BarreDeNavigation` y rend `BarreHorizontaleVide`, une branche que ce
   correctif ne modifie pas. `tests/e2e/terrain-largeur.spec.ts` reste vert
   sans changement (voir le tableau des gardiens).
4. **Conflit annoncé et attendu sur `lib/i18n/fr.ts`** : le lot SELECT-1,
   en cours en parallèle, écrit aussi dans ce fichier. Cette proposition n'y
   ajoute qu'une seule clé (`nav.ouvrir_le_menu`), à un seul endroit (section
   « LA BARRE DE NAVIGATION »), sous forme d'ajout pur — la fusion attendue
   est SELECT-1 d'abord, ce lot ensuite, résolue par un ajout de part et
   d'autre.

## 1. La cause, telle que localisée dans le ticket

`components/navigation/barre.tsx`, ligne 143 (avant ce correctif) : `<aside
className="bg-app-chrome-fond sticky top-0 flex h-dvh w-[272px] shrink-0
flex-col …">` — une largeur fixe de 272 px, sans la moindre classe
responsive. `grep -E 'sm:|md:|lg:'` sur ce fichier et sur les deux
`layout.tsx` ne rendait rien. Le back-office et le portail appellent la MÊME
`BarreDeNavigation` : les deux coques portaient le même défaut. Mesuré à
375 px sur cette même branche, avant correctif : 63 px de contenu utile une
fois la gouttière de `LargeurUtile` déduite (`avant-back-office-375.png`),
et **aucun bouton hamburger dans le DOM**.

## 2. Le correctif

### Le seuil réutilisé, jamais un nouveau

`min-[901px]:`, le point de rupture déjà en production dans
`components/ui/maitre-detail.tsx` et déjà éprouvé jusqu'à 390 px par
`tests/e2e/parc.spec.ts`. Aucun nouveau système de points de rupture.

### Sous 901 px, la colonne sort de l'écran

`components/navigation/barre.tsx` — la classe de l'`<aside>` devient
mobile-first : `hidden` par défaut sous le seuil, `fixed top-0 left-0 z-40
flex` quand un état `ouvert` le rappelle, et `min-[901px]:sticky
min-[901px]:top-0 min-[901px]:flex` qui restaure exactement le comportement
d'avant ce ticket au-dessus du seuil (rien ne change au bureau). Un voile
(`bg-app-chrome-fond/60` — un jeton existant, jamais une couleur neuve,
`tests/unit/theme/sans-couleur-en-dur.test.ts` y veille) referme le tiroir
au clic, sous 901 px seulement.

### Le bandeau mobile — composant neuf

`components/navigation/bandeau-mobile.tsx` : le déclencheur (icône +
libellé `nav.ouvrir_le_menu`) et un fournisseur de contexte,
`FournisseurNavigationMobile`, qui porte l'état d'ouverture partagé entre la
colonne et le déclencheur — les deux sont des FRÈRES posés par `layout.tsx`,
un composant SERVEUR qui ne peut ni porter d'état ni transmettre une
fonction de l'un à l'autre. `layout.tsx` continue d'écrire
`<BarreDeNavigation entrees={ENTREES} …/>` en toutes lettres : c'est ce texte
que lit le gardien statique de R2-16
(`tests/unit/app/barre-par-segment.test.ts`), et il n'a pas bougé.

Le titre affiché est lu dans le DOM (`document.querySelector("main h1")`,
via un `MutationObserver`) plutôt que recopié dans une seconde liste
chemin → titre : `components/mise-en-page/page.tsx` écrit déjà UN SEUL
`<h1>` par écran, et une carte tenue à la main aurait divergé en silence dès
le premier écran qui change son titre sans passer par ce fichier (§9 du
CLAUDE.md). `components/mise-en-page/page.tsx` n'est pas touché — hors du
territoire de ce lot (SELECT-1).

### Les deux `layout.tsx`

`app/(back-office)/layout.tsx` et `app/(portail)/layout.tsx` enrobent leur
composition existante dans `FournisseurNavigationMobile` et ajoutent
`<BandeauMobile />` avant `<LargeurUtile>` — deux lignes chacun, la call à
`BarreDeNavigation` reste inchangée.

## 3. Le gardien — le compte avant/après

Mis en échec **avant** d'être satisfait, comme demandé : le correctif a été
mis de côté (`git stash`), le gardien rejoué contre le PostgreSQL local, puis
le correctif restauré.

| Gardien | Population | Avant | Après |
|---|---|---|---|
| `tests/e2e/coque-375.spec.ts` (neuf) | 6 scénarios (2 coques × 3) | **1/6** — la largeur mesurée à 375 px valait 63, jamais 335 ; le bouton `nav.ouvrir_le_menu` introuvable (timeout) ; l'assertion « bureau inchangé » rougissait par ambiguïté (deux `<aside>` sur `/planning`, corrigée en ciblant `#colonne-navigation`) | **6/6** |
| `tests/e2e/terrain-largeur.spec.ts` | 2 scénarios | 2/2 (déjà vert, branche non touchée) | 2/2 |
| `tests/e2e/barre-sans-session.spec.ts` | 5 scénarios | 5/5 | 5/5 |
| `tests/e2e/ecrans-largeur-utile.spec.ts` | 8 scénarios | 7/8 (1 échec **préexistant**, indépendant : voir §5) | 7/8 (même échec préexistant, reproduit sur `main` non modifié) |
| `tests/e2e/parc.spec.ts` | 5 scénarios | 5/5 | 5/5 |
| `tests/e2e/deconnexion.spec.ts` | 2 scénarios | 2/2 | 2/2 |
| `pnpm test` (unitaire) | 219 fichiers, 2361 tests | — | 219/219, 2361/2361 |
| `pnpm test:isolation` | 96 fichiers, 1050 tests | — | 96/96, 1050/1050 |

## 4. Un défaut de couleur en dur découvert en cours de route, et corrigé

Le voile posé au premier essai (`bg-black/40`) faisait rougir
`tests/unit/theme/sans-couleur-en-dur.test.ts` (L0-09 : la charte est une
donnée de société, jamais une couleur en dur). Corrigé en reprenant
`bg-app-chrome-fond` — le jeton du fond de la colonne elle-même — avec un
modificateur d'opacité Tailwind, plutôt qu'en ajoutant un neuvième jeton pour
un seul état.

## 5. `pnpm verify` — vert, et l'écart nommé

Harnais monté localement (PostgreSQL 16, cluster jetable du script officiel
du dépôt, migrations par `prisma migrate deploy`, semis de démonstration),
faute de base hébergée accessible ici :

- `pnpm format:check` — vert.
- `pnpm typecheck` — vert, zéro erreur.
- `pnpm lint` — vert, zéro avertissement.
- `pnpm test` — vert, 219 fichiers / 2361 tests.
- `pnpm test:isolation` — vert, 96 fichiers / 1050 tests.
- `pnpm build` — vert.

**Un échec de `tests/e2e/ecrans-largeur-utile.spec.ts` reste rouge, et il est
préexistant, mesuré et non touché par ce lot** : « le catalogue de forfaits
occupe la même largeur, et la même forme » attend 2 lignes de forfait et en
lit 3, sur `main` non modifié comme sur cette branche, avec ou sans
parallélisme (`--workers=1` ne change rien). Aucun fichier de ce lot ne
touche `/parametres/forfaits`, à la tarification ni au semis — l'écart est
signalé plutôt que masqué, et une tâche séparée est suggérée pour la session
qui le prendra.

## 6. Captures — `docs/propositions/lot-coque-375/`

Toutes prises sur le même commit, session authentifiée
(`adv@codima.test`), PostgreSQL local.

| Écran | Largeur | Avant | Après |
|---|---|---|---|
| Back-office (`/planning`) | 375 px | `avant-back-office-375.png` | `apres-back-office-375.png` |
| Back-office (`/planning`) | 375 px, tiroir ouvert | — | `apres-back-office-375-tiroir-ouvert.png` |
| Back-office (`/planning`) | 1280 px | `avant-back-office-1280.png` | `apres-back-office-1280.png` |
| Portail (`/portail`) | 375 px | `avant-portail-375.png` | `apres-portail-375.png` |
| Portail (`/portail`) | 375 px, tiroir ouvert | — | `apres-portail-375-tiroir-ouvert.png` |
| Portail (`/portail`) | 1280 px | `avant-portail-1280.png` | `apres-portail-1280.png` |

Les deux paires à 1280 px sont **identiques à l'octet près** (`cmp` sur les
quatre fichiers, silencieux) — c'est ce qui prouve que le bureau n'a pas
bougé.

## 7. Territoire tenu

Fichiers touchés : `components/navigation/barre.tsx`,
`components/navigation/bandeau-mobile.tsx` (neuf),
`app/(back-office)/layout.tsx`, `app/(portail)/layout.tsx`,
`lib/i18n/fr.ts` (une clé), `tests/e2e/coque-375.spec.ts` (neuf). Aucun
fichier de `app/(back-office)/parc/`, `lib/clients/saisie.ts` ni
`lib/sites/saisie.ts` (lot SELECT-1) n'a été touché.
