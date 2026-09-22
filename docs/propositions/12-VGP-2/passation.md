# VGP-2 — passation

Travail commité **sur `main` en local**, sans proposition ni branche distante
(processus du 22/09/2026), en `88e9629` (code et épreuves) puis dans le commit qui
porte ce fichier (captures, `mesure.json`, passation). **Rien n'a été poussé.**

Point de départ : `d9c9446` (`main` au démarrage, plus récent que le `0d2f567`
que le ticket nomme). Le stash `stash@{0}` du poste porte le lot
REPRISE-HISTORIQUE déjà commité en `4726c66` — vérifié, sans rapport avec ce lot,
laissé en place.

---

## 1. Ce que j'ai changé

| fichier | ce qui change |
|---|---|
| `lib/vgp/registre.ts` | Deux prédicats écrits **une fois**, `echeanceDepassee` et `echeanceAVenirSous` (le signe de `joursAvantEcheance`, l'horizon reçu). `compterAPrevoir` rend désormais `CompteAPrevoir = { depassees, aVenir, sansInformation }` au lieu d'un entier. Le `where` du lot PERF est factorisé en `WHERE_SOUMISE` et sert deux lectures : les informées (`id IN recues`, puis `ligneDuRegistre` ligne par ligne, puis `compterLesEcheances`) et un `count` des soumises **hors** `recues` pour la voie sans information. `resumerLeRegistre` (les KPI de `/vgp`) lit `echeanceDepassee` au lieu de son propre `< 0`. |
| `app/(back-office)/tableau-de-bord/presentation.ts` | `EtatVgpAPrevoir` porte les trois voies quand c'est calculé ; `{calcule:false}` (AV-14) inchangé. Deux fonctions neuves : `valeurVgpAPrevoir` (dépassées + à venir) et `detailVgpAPrevoir` (les trois voies nommées, horizon reçu). |
| `app/(back-office)/tableau-de-bord/page.tsx` | La tuile « VGP à prévoir » rend `valeurVgpAPrevoir` et `detailVgpAPrevoir(…, HORIZON_VGP_JOURS)`. Ni l'ordre ni le nombre des tuiles (D125). |
| `app/(back-office)/vgp/page.tsx` | `tonEtat(information)` : rouge quand `echeanceDepassee`, sinon le ton de l'état ; `libelleEtatCourt(information)` : « Échéance dépassée » dans ce cas, « Information reçue » sinon. |
| `lib/i18n/fr.ts` | Cinq clés `tableau_de_bord.vgp_voie_*` et `vgp.information.recue_echeance_depassee`. `tableau_de_bord.vgp_a_prevoir_detail` (« Dans les 30 prochains jours ») **retirée** : l'horizon n'est plus écrit dans un texte, il est composé depuis la constante de la page. |
| `tests/e2e/vgp-retard-visible.spec.ts` (neuf) | L'écran, les deux cas, captures prises **avant** les assertions. |
| `tests/unit/vgp/voies-a-prevoir.test.ts` (neuf) | Le compte, avec l'ancien filtre gardé comme témoin ; le jour J à 23 h 59 Nouméa ; la garde PERF étendue aux trois voies. |
| `tests/unit/tableau-de-bord/vgp-trois-voies.test.ts` (neuf) | La tuile : forme, valeur, détail, aucun verdict. |
| `tests/unit/tableau-de-bord/presentation.test.ts` | Le bloc AV-14 **adapté** à la nouvelle forme du compte (un objet à trois voies au lieu d'un entier). Son intention — zéro mesuré contre registre vierge — est gardée mot pour mot ; ce n'est pas un test affaibli, c'est un contrat que le ticket demande de changer. |
| `tests/unit/perf/vgp-compter-a-prevoir.test.ts` | Six lignes de **commentaire** en tête, rien d'autre : sa valeur figée (2) est désormais la voie À VENIR, et l'extension vit dans le fichier neuf. |

**Ce que ça change pour l'exploitation.** Sur la base hébergée — 298 vérifications
reprises de l'archive —, l'accueil comptait « VGP à prévoir » en écartant toute
échéance passée, et le registre peignait ces machines en vert. Depuis `88e9629`,
la tuile dit « N — N échéances dépassées · M à venir sous 30 jours · K sans
information », et chaque ligne dépassée du registre porte un badge rouge
« Échéance dépassée ». Aucun mot ne dit « conforme », « à jour » ni « en retard »
(D88) : on dit qu'une date est passée, jamais ce que la machine vaut.

**Ce que je n'ai pas mesuré :** le rendu sur la base hébergée elle-même (I9 :
aucune donnée de production n'est lue par une session). Les 298 sont le chiffre
du ticket, pas une mesure de ma main.

---

## 2. Ce que j'ai mesuré

### L'écran — `tests/e2e/vgp-retard-visible.spec.ts`, scène du semis, 1280 px

Le semis (`prisma/seed-data.ts`, `VERIFICATIONS_VGP_DEMONSTRATION`) porte déjà
le cas : `NUS-SPL-2022-0007` (rythme de six mois au modèle) vérifiée il y a
quatorze mois, échéance passée depuis 243 jours ; `RAV-KPX-2019-0148` (douze
mois à la famille) vérifiée il y a deux mois ; `SN-INCONNU-PONT-2` soumise, jamais
informée. Rien n'a été fabriqué.

| écran | AVANT (`d9c9446`, 08:54–08:56 UTC) | APRÈS (`88e9629`, 09:08 UTC) |
|---|---|---|
| tuile « VGP à prévoir » | `0` — « Dans les 30 prochains jours » | `1` — « 1 échéance dépassée · 0 à venir sous 30 jours · 1 sans information » |
| `/vgp`, badge de `NUS-SPL-2022-0007` (dépassée) | **vert**, « Information reçue » | **rouge**, « Échéance dépassée » |
| `/vgp`, badge de `RAV-KPX-2019-0148` (lointaine) | vert, « Information reçue » | vert, « Information reçue » — inchangé, pour sa propre raison |

Le spec a rougi sur `d9c9446` par ses deux bouts exacts : `Expected substring:
"1 " / Received: "VGP À PRÉVOIR 0 Dans les 30 prochains jours"` puis `expect(tonDepassee).not.toBe(tonLointaine) — Expected: not "vert"`.
Les deux images « avant » ont été prises avant ces assertions — voir
`avant/mesure.json` (deux passages, en mode série le premier échec n'ouvre pas le
registre ; le second passage a ciblé `-g REGISTRE`). Les images « après » sont
sur le commit `88e9629`, rejouées après `verify:full`.

### Le compte — `tests/unit/vgp/voies-a-prevoir.test.ts`

Sur `d9c9446` : **8 rouges / 6 verts** sur 14. Les six verts sont les témoins,
et ils doivent l'être : le modèle rend `-30` (l'information existait), l'ancien
filtre rejoué rend **0** pour cette machine (le constat du ticket, gardé comme
texte exécutable), `resumerLeRegistre` la comptait déjà « dépassée » (le KPI de
`/vgp` disait vrai — seul l'accueil mentait), le jour à Nouméa est bien le 22,
le `where` seul retrouve `sans_information`, et les 20 combinaisons. Les huit
rouges sont les fonctions neuves : elles rougissaient parce qu'elles manquaient,
pas parce qu'elles mesuraient — sauf la première (« APRÈS — voie DÉPASSÉE »),
dont le témoin « AVANT » juste au-dessus dit ce que rendait l'ancien code. Sur
`88e9629` : 14/14.

### La tuile — `tests/unit/tableau-de-bord/vgp-trois-voies.test.ts`

Sur `d9c9446` : **7 rouges / 1 vert** sur 8 (le vert : `{calcule:false}`, AV-14,
qui ne bouge pas). Les sept rouges tiennent à des fonctions absentes et à une
forme de retour changée — **ils ne prouvent pas le défaut**, le fichier le dit
en tête. Sur `88e9629` : 8/8.

### La garde PERF

`tests/unit/perf/vgp-compter-a-prevoir.test.ts` : vert avant, vert après, non
modifié hors commentaire. L'extension (`voies-a-prevoir.test.ts`, dernier bloc) :
sur un parc de neuf machines, lecture entière et lecture resserrée rendent toutes
deux `{depassees: 2, aVenir: 2}` ; le `where` seul (`id ∉ recues` ∧ soumise)
rend exactement `["jamais-informee"]`, comme `etatDeLInformation` ; et pour les
20 combinaisons exception × famille d'une machine jamais informée,
`etat === "sans_information"` ⇔ le `where` la dit soumise.

### La porte

`pnpm verify:full`, **en entier**, sur `88e9629` : 09:03:30 → 09:08:04 UTC
(4 min 34 s), exit 0 sans reprise. `format:check`, `typecheck`, `lint`,
**2557** unitaires (233 fichiers), **1090** d'isolation (103 fichiers), `build`,
`feries:horizon`, `audit:partitions` (13 partitions, défaut vide), **131** e2e
passés — les 2 restants sont les deux `skip` préexistants de
`tous-les-ecrans-rendent.spec.ts` (`/imports/[id]`, `/parametres/forfaits/[id]`).

Un premier passage de la suite unitaire, avant le commit, a rougi une fois sur
`sans-chaine-visible-en-dur` : le spec e2e portait `toHaveText("0")` et
`toHaveText(libelle("tableau_de_bord.non_calcule"))`, que le gardien lit comme
des requêtes d'écran à texte en dur. Remplacé par une lecture de `innerText` et
`Number(valeur) > 0` — ce qui couvre aussi « Non calculé » (`NaN`).

---

## 3. Ce que j'ai tranché, et pourquoi

Aucun de ces points ne touche l'argent facturé, une obligation légale au sens
d'une règle nouvelle, ni ce qu'un client voit (le portail n'est pas dans le lot).
`docs/arbitrages.md` n'est pas dans le territoire : les décisions sont ici, avec
leur condition de réouverture, et la session suivante peut les y reporter.

1. **Où vit le prédicat « dépassée » : `lib/vgp/registre.ts`, pas
   `information.ts`.** Le ticket n'autorise `information.ts` que « si une voie
   manque au type » ; le type porte déjà `joursAvantEcheance` avec son signe
   documenté — rien ne manque au type, il manquait une lecture partagée. Trois
   lecteurs (accueil, KPI de `/vgp`, badge de ligne) lisent désormais le même
   `echeanceDepassee`. *Réouverture :* si un quatrième écran hors du back-office
   (portail, terrain) a besoin du prédicat sans vouloir dépendre de `registre.ts`
   (qui importe `lib/db`), le déplacer dans `information.ts` — c'est un
   déplacement, pas une réécriture.

2. **La voie SANS INFORMATION est un `count`, sans `ligneDuRegistre`.** Le
   ticket dit « tu resserres la population lue, jamais le calcul par ligne ».
   Il n'y a ici aucun calcul par ligne à préserver : une machine soumise absente
   de `recues` est `sans_information` par la seule cascade d'assujettissement,
   sans qu'aucune date n'entre en jeu — et cette cascade est déjà celle que
   `WHERE_SOUMISE` retrouve (lot PERF). Prouvé par énumération (20 cas). Lire
   toutes les lignes soumises non informées d'un parc pour les compter aurait
   réintroduit la lecture entière que PERF avait retirée. *Réouverture :* le jour
   où `etatDeLInformation` fait dépendre `sans_information` d'autre chose que
   `derniereInformation === null` et `soumis` — le test des 20 combinaisons
   rougira.

3. **Le grand chiffre de la tuile = dépassées + à venir ; les sans
   information ne s'y ajoutent pas.** Une échéance passée est à prévoir, et
   avant les autres. Une machine sans information n'a pas d'échéance ; la
   compter comme due serait lui inventer une durée (L9-05). Elle est nommée
   dans le détail, jamais tue. *Réouverture :* si l'exploitation veut que le
   grand chiffre soit le seul compte des dépassées (« ce qui crie ») — c'est un
   changement de ce que la tuile dit, à trancher avec Alexis parce que c'est
   l'alerte du matin.

4. **Les trois voies sont toujours nommées, même à zéro.** Le dépôt écarte
   ailleurs un détail qui affiche « 0 non affectée » (§9, 06/09). Ici « 0
   échéance dépassée » dit que la voie existe et a été mesurée ; un lecteur qui
   ne voit ce mot que le jour où il compte ne saurait pas lire la tuile ce
   jour-là. *Réouverture :* si, mesuré en ligne, le détail sur deux lignes étire
   la rangée de tuiles (le motif d'AV-14 pour le taux d'occupation) — la capture
   à 1280 px montre deux lignes, à la même hauteur que la tuile « Non calculé ».

5. **Le libellé du badge est « Échéance dépassée », pas « Information reçue —
   échéance dépassée ».** Le badge est `whitespace-nowrap` dans une colonne de
   220 px ; la date de réception est déjà dans « Dernier contrôle ». Le mot est
   celui de `vgp.echeance.depassee`, sous une clé propre parce que la
   destination (un badge) n'est pas la même que la colonne. Le gardien
   `aucun-verdict-de-conformite` couvre la nouvelle clé (préfixe
   `vgp.information.`). *Réouverture :* si le badge doit un jour porter une
   phrase — c'est D128 qu'il faudrait rouvrir, pas cette clé.

6. **`etatVgpAPrevoir` change de forme plutôt que d'être doublée.** Une
   seconde fonction à côté aurait fait deux lectures du même critère (§9,
   01/09). Le test AV-14 a été adapté à la forme, son intention gardée.
   *Réouverture :* aucune — c'est un contrat interne à l'écran.

7. **`tests/unit/perf/vgp-compter-a-prevoir.test.ts` reçoit un commentaire de
   six lignes** malgré « fichiers de test NEUFS » : son en-tête disait
   « compterAPrevoir rend la MÊME valeur » au singulier, ce qui serait devenu
   faux en silence — *un texte qui vieillit ne rougit pas*. Aucune assertion
   touchée. *Réouverture :* si la règle « neufs seulement » vise aussi les
   commentaires, retirer ces six lignes ne casse rien.

---

## 4. Ce que je n'ai PAS fait

- **Pas touché `lib/vgp/libelles.ts`** — hors territoire. `libelleEcheance` y
  garde son propre `joursAvantEcheance < 0` pour composer « Échéance dépassée —
  date (N jours) ». C'est une **quatrième écriture du même signe** (après les
  trois que ce lot a réunies) ; elle est vraie aujourd'hui, et rien ne garde
  qu'elle le reste. Voir §6.
- **Pas touché la fiche machine `/parc/[id]`** — hors territoire. Elle rend
  `libelleEcheance` en texte (« Échéance dépassée — … ») sans ton : le retard s'y
  lit, il ne s'y voit pas. Voir §6.
- **Pas écrit dans `docs/arbitrages.md` ni `docs/backlog.md`** — hors
  territoire ; VGP-2 n'y figure pas (`grep` : rien).
- **Pas ajouté de seuil** : aucune tolérance, aucun « bientôt ». Le seul nombre
  est `HORIZON_VGP_JOURS = 30`, qui existait, dans la page, et que la tuile ne
  fait plus qu'afficher.
- **Pas touché `prisma/`, `lib/imports/**`, `lib/planning/**`, `lib/calendar/**`**,
  aucune politique RLS — interdits, et rien ne l'exigeait. `compterAPrevoir`
  passe toujours par `avecContexteApplicatif`.
- **Pas éprouvé `compterAPrevoir` contre une base dans un test d'isolation** :
  la voie DÉPASSÉE et la voie SANS INFORMATION sont mesurées de bout en bout par
  le spec e2e (le semis porte les deux cas) ; la voie À VENIR n'a **aucun cas
  dans le semis** (RAV-KPX est à dix mois) — elle n'est éprouvée qu'en unitaire,
  sur `compterLesEcheances`. Un cas de semis « à venir sous 30 jours » n'a pas
  été ajouté : `prisma/seed-data.ts` est sous `prisma/`, interdit.
- **Pas photographié à 390 px** — le ticket demande 1280 px, et deux paires.
- **Rien poussé.**

---

## 5. Les pièges pour la session suivante

- **`tsconfig.json` inclut `tests/**` et `next build` type-vérifie tout.** Un
  spec e2e qui indexe `fr["clé-qui-n'existe-pas-encore"]` fait échouer le build
  du serveur d'épreuve — donc la capture AVANT, qui doit se faire sur le code
  d'avant. J'ai lu les clés par leur nom (`libelle(cle)` sur `fr as
  Record<string,string>`) pour que le même spec compile des deux côtés.
- **Le mode série de Playwright n'ouvre pas le second test quand le premier
  rougit.** Pour les captures AVANT, il a fallu deux passages (`-g REGISTRE`
  pour le second) et fusionner les deux `mesure.json` à la main — c'est dit
  dans `avant/mesure.json`.
- **Un serveur `next start` survit à un `playwright test` interrompu**
  (`reuseExistingServer`), et le passage suivant échoue sur `DROP DATABASE …
  is being accessed by other users`. `pgrep -fa next-server`, tuer, relancer.
- **`test:isolation` et `test:e2e` visent la même base `codiplan_test`** sur ce
  poste (mémoire du 22/09) : ne pas lancer l'un pendant l'autre. `verify:full`
  les enchaîne dans le bon ordre, mais un `pnpm test:isolation` lancé « en
  attendant » pendant un spec e2e casse le spec.
- **Le gardien des chaînes en dur lit aussi les specs e2e** : `toHaveText("0")`
  est refusé, même pour un chiffre. Lire `innerText` et comparer en JS.
- **La capture APRÈS doit être reprise après le commit**, sinon `mesure.json`
  porte l'empreinte du commit *précédent* avec des modifications non commitées
  — c'est ce que le premier passage a produit, et pourquoi il a été rejoué sur
  `88e9629`.
- **Ce qui trompe à la lecture du code** : `resumerLeRegistre` comptait déjà
  « dépassée » — les KPI de `/vgp` étaient justes. Le défaut n'était pas « le
  registre ignore le retard », c'était « l'accueil l'ignore, et la ligne du
  registre le peint en vert ». Trois lecteurs du même signe, dont un seul juste.

---

## 6. Ce qui reste à faire

1. **Réunir la quatrième écriture du signe** — `libelleEcheance`
   (`lib/vgp/libelles.ts`) doit lire `echeanceDepassee` au lieu de son propre
   `< 0`. Prérequis : trancher où le prédicat vit (décision 1 ci-dessus —
   `libelles.ts` ne devrait pas importer `registre.ts` qui tire `lib/db`, donc
   c'est probablement le moment de le déplacer dans `information.ts`). Un
   ticket d'un fichier, une épreuve : le texte et le ton d'une même
   information ne peuvent pas diverger.
2. **La fiche machine `/parc/[id]` ne montre le retard qu'en texte.** Un ton
   (rouge) sur la ligne « Prochaine VGP » quand `echeanceDepassee` — même
   prédicat, même mot. Territoire : `app/(back-office)/parc/[id]/page.tsx`.
3. **Un cas « à venir sous 30 jours » dans le semis** (`prisma/seed-data.ts`,
   `VERIFICATIONS_VGP_DEMONSTRATION`) : aujourd'hui aucune machine de
   démonstration n'entre dans cette voie, et l'écran n'en montre jamais une.
   Une troisième vérification, `moisAvant` tel que l'échéance tombe sous trente
   jours (attention : le rythme est de 12 mois à la famille des ponts, 6 au
   modèle SPL-4000). Territoire `prisma/` — hors de ce lot.
4. **Reporter les décisions 1 à 5 dans `docs/arbitrages.md`** avec leurs
   conditions de réouverture, si Alexis les ratifie — et poser un numéro à la
   suite du dernier attribué.
5. **La tuile mène nulle part.** « VGP à prévoir » n'a pas de lien vers `/vgp`,
   alors que « Demandes en attente » mène à `/interventions/nouvelle` (D128).
   Un `Link` sous la tuile, comme la seconde grille le fait déjà. Ce n'est pas
   dans D125 (la maquette n'en dessine pas) : un ajout volontaire à nommer.
6. **`/vgp` n'a ni tri ni filtre par voie, et n'affiche que 200 lignes**
   (`LIGNES_AFFICHEES`) — le ticket L9-08 (campagne datée) porte déjà le tri et
   le filtre ; ce lot n'y touche pas. En production, les dépassées se trouvent
   en lisant la couleur, pas en filtrant, et au-delà de la 200e fiche elles ne
   se voient pas du tout — seuls les KPI du bandeau et la tuile d'accueil
   comptent tout le parc.
