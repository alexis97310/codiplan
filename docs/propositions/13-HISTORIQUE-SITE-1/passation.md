# HISTORIQUE-SITE-1 — passation

Travail commité **sur `main` en local**, sans proposition ni branche distante
(processus du 22/09/2026), en `8175be6` (code et épreuves) puis dans le commit
qui porte ce fichier (captures, `mesure.json`, passation). **Rien n'a été
poussé.**

Point de départ : `2aead99` (`main` au démarrage, VGP-2). Le stash `stash@{0}` du
poste (« WIP on main: 98ba2fc AGENCE-2 ») a été vu et laissé en place — sans
rapport avec ce lot, non ouvert.

---

## 1. Ce que j'ai changé

| fichier | ce qui change |
|---|---|
| `lib/interventions/depot.ts` | Une fonction NEUVE, `dernieresInterventionsDuSite(contexte, siteId, limite, client?)`, posée juste après `dernieresInterventionsDuClient` — que je n'ai pas touchée. Même sélection `CHAMPS_LIGNE`, sans jointure client/site (la fiche les connaît) ; `where: { site_id }` ; `orderBy: [{ date_planifiee: { sort: "desc", nulls: "last" } }, { id: "desc" }]` ; `take: limite` **dans la requête** ; borne refusée avant toute requête si elle n'est pas un entier strictement positif (forme de `teteDeLHistorique`, PARC-1). |
| `app/(back-office)/sites/[id]/page.tsx` | `INTERVENTIONS_MONTREES = 12` ; une lecture de plus ; un bloc `BlocInterventions` (`data-bloc="historique-site"`) SOUS le bloc des habilitations : titre, borne écrite (« Au plus 12 interventions, la plus récente en tête ; celles qui restent à planifier en bas. »), tableau référence / date planifiée / nature / statut, chaque référence menant à `/interventions/{id}`. Zéro intervention → une phrase, aucun tableau. |
| `lib/i18n/fr.ts` | Quatre clés `sites.fiche.interventions`, `…_borne_prefixe`, `…_borne_suffixe`, `…_vide`. Le nombre est composé par l'écran (`borneEcrite`), jamais écrit dans le dictionnaire. |
| `tests/isolation/historique-site-borne.test.ts` (neuf) | Un site posé exprès à quinze interventions (douze datées 2099…2110, trois sans date) : la borne tronque côté base, la tête est la tête, la file d'attente ferme la liste, un site de B rend zéro sous A (témoin d'abord), un site inexistant rend zéro sans lever, une borne non entière ou ≤ 0 est refusée. |
| `tests/unit/theme/lien-visible.test.ts` | **Une ligne dans une liste close**, hors du territoire nommé : le gardien tient par ÉGALITÉ la liste des écrans qui portent `CLASSES_LIEN`, et dit lui-même qu'elle « s'allonge quand un écran nouveau porte l'habillage ». La fiche site y entre, avec sa date et sa raison. Aucune assertion affaiblie. |
| `tests/e2e/historique-site.spec.ts` (neuf) | L'écran : un site POSÉ à treize interventions (dix datées 2013…2022 terminées, trois sans date à planifier) en rend douze — dates décroissantes puis deux « — » —, la borne écrite ; un site posé sans intervention dit son absence. Les deux sites et leurs lignes sont retirés à la fin. Captures avant les assertions ; clés neuves lues par nom. |

**Ce que ça change pour l'exploitation.** Sur la base hébergée, 1751
interventions d'archive sont rattachées à des sites ; jusqu'ici la fiche d'un
site n'en montrait aucune et il fallait passer machine par machine. Depuis ce lot,
ouvrir la fiche d'un site répond à « qu'est-ce qu'on a déjà fait ici ? » avec ses
douze dernières interventions, la plus récente en tête, et un lien vers chacune.
Les interventions qui restent à planifier sont en bas, pas en tête.

**Ce que je n'ai pas mesuré :** le rendu sur la base hébergée elle-même (I9). Les
1751 sont le chiffre du ticket, pas une mesure de ma main.

---

## 2. Ce que j'ai mesuré

### L'écran — `tests/e2e/historique-site.spec.ts`, scène posée, 1280 px

| fiche | AVANT (`2aead99`, 09:35 UTC) | APRÈS (`8175be6`, 09:42 UTC) |
|---|---|---|
| « Lieu à treize interventions » (`e2e00000-…-513a`, **13** en base dont 3 sans date) | formulaire + habilitations, **aucun bloc** | bloc « Dernières interventions », **12 lignes** : `01/01/2022 → 01/01/2013` (dix, décroissantes) puis deux « — » À planifier ; la treizième (sans date) coupée par la borne ; sous le titre « Au plus 12 interventions, la plus récente en tête ; celles qui restent à planifier en bas. » |
| « Lieu jamais visité » (`e2e00000-…-513e`, 0 en base) | formulaire + habilitations, **aucun bloc** | bloc présent, **0 ligne**, « Aucune intervention n'est enregistrée pour ce lieu. » |

Le spec a rougi sur le code d'avant par son premier `expect` exact, les deux
fois : `locator('[data-bloc="historique-site"]') — Expected: visible —
element(s) not found`. Les images AVANT ont été prises avant cette assertion
(`avant/mesure.json` : deux passages, le mode série n'ouvrant pas le second test
quand le premier rougit ; le second a ciblé `-g "SANS AUCUNE"`). Sur `8175be6` :
**2/2**, et `apres/mesure.json` porte les douze dates rendues.

**Comment l'AVANT a été pris, dit en entier.** La première écriture du spec
visait le site le plus chargé du SEMIS (« Atelier principal », 10 en base) ; son
AVANT a été pris sur `2aead99` nu à 09:21. Cette écriture a ensuite rougi dans
la suite complète (voir « Le rouge de la porte » plus bas), et la scène a été
réécrite sur un site à soi. Pour que l'AVANT montre LA MÊME fiche que l'APRÈS,
je l'ai repris à 09:35 sur le code d'avant reconstitué : les quatre fichiers de
code du lot remis en stash (`git stash push -- …`, puis `pop` — le stash
AGENCE-2 du poste est intact), et `tests/isolation/historique-site-borne.test.ts`
déplacé hors du dépôt le temps du passage, parce que `next build` type-vérifie
`tests/` et que son import aurait cassé le serveur d'épreuve. `avant/mesure.json`
le dit sous `etat_du_code` ; son `commit` est `2aead99`. Les captures de la
première écriture ont été effacées.

### La lecture — `tests/isolation/historique-site-borne.test.ts`

Sur `2aead99` : **6 rouges / 6**, toutes par `TypeError:
dernieresInterventionsDuSite is not a function`. **Elles rougissaient parce que la
fonction manquait, pas parce qu'elles mesuraient** — c'est dit ici pour ne pas
être cru. Un premier passage a rougi avant cela sur la SCÈNE (`column "statut" is
of type "StatutIntervention" but expression is of type text`) : c'est mon insert,
pas le code ; corrigé par un cast, sans toucher à une assertion.

Sur le nouveau code : **6/6**. Ce que chaque vert prouve pour de vrai :

- bornée à 5 sur 15 → exactement 5 lignes, toutes du site ;
- ces 5 sont `2110, 2109, 2108, 2107, 2106` — les rangs 11→7, par identifiant
  attendu écrit depuis la scène ;
- lecture à 25 → 15 lignes, l'ordre attendu entier, première ligne sans date à
  l'index 12 et rien de daté après ;
- `SITE_B1_S1` porte ≥ 1 intervention (témoin) et rend `[]` sous A ;
- un UUID inconnu rend `[]` ;
- `0, -5, 1.5, NaN` lèvent `/entier strictement positif/`.

### Le rouge de la porte — un par épreuve, aucune rejouée en boucle

Deux passages de `verify:full` ont rougi avant le vert, sur deux épreuves
DIFFÉRENTES, chacune une seule fois :

1. **09:26, `tests/unit/theme/lien-visible.test.ts`** — la liste close des
   écrans qui portent `CLASSES_LIEN` ne contenait pas la fiche site (`Expected
   [18] … Received [19]`). Le gardien dit lui-même que la liste s'allonge quand
   un écran nouveau porte l'habillage : une ligne ajoutée, avec sa date.
2. **09:32, `historique-site.spec.ts`, dans la suite complète seulement** —
   `toHaveCount(11)` a reçu **12**. Le spec visait le site le plus chargé du
   semis et avait compté 11 en `beforeAll` ; un autre spec, en parallèle
   (`fullyParallel`), a créé une intervention sur ce même site avant le rendu.
   Le code a rendu 12 ≤ 12, ce qui est juste ; c'est la SCÈNE qui empruntait un
   site que d'autres écrivent. Réécrite sur un site à soi (treize lignes posées,
   retirées à la fin, modèle `parc-apercu-borne.spec.ts`) — ce qui, au passage,
   photographie la troncature que le semis ne permettait pas. L'assertion n'a
   pas été affaiblie : elle est devenue une égalité stricte à 12.

### La porte

`pnpm verify:full`, **en entier**, sur `8175be6` (troisième passage) :
09:36:47 → 09:41:32 UTC (4 min 45 s), exit 0 sans reprise. `format:check`,
`typecheck`, `lint`, **2557** unitaires (233 fichiers), **1096** d'isolation
(104 fichiers, +6), `build`, `feries:horizon`, `audit:partitions` (13
partitions, défaut vide), **133** e2e passés (+2) — les 2 restants sont les deux
`skip` préexistants de `tous-les-ecrans-rendent.spec.ts`.

---

## 3. Ce que j'ai tranché, et pourquoi

Aucun de ces points ne touche l'argent facturé, une obligation légale, ni ce
qu'un client voit (le portail n'est pas dans le lot).

1. **La borne vaut 12, comme la fiche client.** Ce n'est pas un montant ni un
   délai (§8) : c'est le nombre de lignes qu'un écran montre, et la fiche client
   l'a déjà fixé. Deux fiches voisines qui n'en montreraient pas le même nombre
   se liraient comme deux règles. *Réouverture :* si l'exploitation veut voir
   plus loin, ce n'est pas la borne qu'il faut monter, c'est une pagination ou un
   lien vers `/interventions` filtré par site (§6).

2. **Le bloc est SOUS les habilitations, pas au-dessus du formulaire.** Le ticket
   dit « la même règle que `habilitations.site.aucune` juste au-dessus dans le
   même écran » — je l'ai lu comme une position. *Réouverture :* si, à l'usage,
   c'est l'historique qu'on vient chercher en premier (c'est le point du lot),
   remonter le bloc est un déplacement de dix lignes JSX, sans effet sur les
   épreuves (qui visent `data-bloc`).

3. **Quatre colonnes, pas cinq : le lieu est retiré.** La fiche client montre
   référence / date / nature / lieu / statut ; ici le lieu est le titre de la
   page, et une colonne qui répète le titre sur douze lignes ne dit rien. Le
   client n'est pas ajouté pour la même raison (sous-titre). *Réouverture :* si
   la ligne doit un jour nommer le technicien — c'est `technicien_id` qu'il
   faudrait résoudre par l'annuaire cloisonné (FICHE-1), jamais rendre tel quel.

4. **La lecture rend `LigneIntervention`, pas `LignePlanning`.** Sans jointure
   `client`/`site` : la fiche les connaît. *Réouverture :* le jour où un autre
   écran veut ces lignes AVEC leurs libellés, ajouter la jointure ici plutôt
   qu'écrire une seconde requête sur le même critère (§9, 01/09).

5. **La borne écrite dit « au plus 12 », même quand il y en a moins.** L'écran
   ne compte pas ce qu'il montre (il n'a pas le total, et le demander serait une
   seconde requête). « Au plus » est vrai dans les deux cas. *Réouverture :*
   si un compte total est voulu (« 10 interventions, les 12 dernières »), c'est
   un `count` de plus, et il faut décider s'il vaut sa requête.

6. **Le statut de la scène d'isolation suit la date** (`a_planifier` sans
   date, `planifiee` datée) au lieu de `terminee` partout comme PARC-1 : une
   ligne sans date « terminée » serait un état que l'application n'écrit pas, et
   une scène qui ment sur ce point se lirait comme une règle. Sans effet sur ce
   qui est mesuré (l'ordre ne lit pas le statut).

7. **Le gardien `lien-visible` reçoit une ligne, malgré « fichiers de test
   NEUFS ».** Son assertion est une égalité de liste close, et son commentaire
   nomme l'allongement comme le bon geste ; l'alternative — ne pas employer
   `CLASSES_LIEN` sur la référence — aurait rendu un lien invisible au repos,
   la faute exacte que ce gardien existe pour arrêter. *Réouverture :* aucune.

---

## 4. Ce que je n'ai PAS fait

- **Pas touché `dernieresInterventionsDuClient`** — interdit par le ticket. Elle
  porte encore `orderBy: [{ date_planifiee: "desc" }, { id: "desc" }]` **sans
  `nulls: "last"`** : sur la fiche client, la file d'attente monte en TÊTE des
  « dernières interventions », et sa doc-comment (« l'ordre est celui de la
  récence ») est vraie sur les datées seulement. La faute que le ticket m'a fait
  éviter au niveau site existe au niveau client. Voir §6.
- **Pas touché au niveau CLIENT (les 12 restent), pas d'écran contacts, ni
  pagination ni filtre** — exclus par le ticket.
- **Pas photographié la fiche d'un site du SEMIS après le lot** : la paire
  AVANT/APRÈS est sur un site posé par le spec (treize interventions), parce
  qu'un site partagé n'a pas de compte stable sous une suite parallèle (§2). La
  première capture APRÈS sur « Atelier principal » (10 lignes, semis réel) a
  été regardée à l'écran mais n'est pas conservée — elle portait l'empreinte
  d'un commit qui n'existait pas encore.
- **Pas touché `prisma/`, `lib/imports/**`, `lib/vgp/**`, `lib/calendar/**`,
  `app/(back-office)/clients/**`**, aucune politique RLS. `dateCivile` est
  importée de `lib/calendar/fuseau`, pas modifiée.
- **Pas écrit dans `docs/backlog.md`** (R4-02 y dit « site (à faire) ») ni
  `docs/arbitrages.md` — hors territoire. La session suivante peut y reporter le
  point 1 du §3.
- **Rien poussé.**

---

## 5. Les pièges pour la session suivante

- **`next build` type-vérifie `tests/**`.** Un fichier de test qui importe une
  fonction absente ou indexe une clé `fr` inexistante casse le build du serveur
  Playwright — donc la capture AVANT. J'ai pris l'AVANT e2e **avant** d'écrire le
  test d'isolation (qui importe `dernieresInterventionsDuSite`), et lu les clés
  neuves par nom dans le spec. L'ordre des gestes compte.
- **Le mode série n'ouvre pas le second test quand le premier rougit** : deux
  passages AVANT, `-g "SANS AUCUNE"` pour le second, et deux `mesure.json` à
  fusionner (fait par un script Python jetable ; le fichier final porte
  `passages[]`).
- **Un insert brut dans `intervention` exige `$n::"StatutIntervention"`** pour
  le statut paramétré — PARC-1 l'écrivait en littéral et n'avait pas ce cas.
- **Le semis n'est pas à soi sous `fullyParallel`.** `fiche-technicien-nomme`,
  `parc-apercu-borne` et d'autres créent et suppriment des interventions sur les
  premiers sites du semis pendant que votre spec tourne : un compte pris en
  `beforeAll` sur un site du semis est faux au rendu. Un spec qui compte pose
  SES lignes sur SON site. Le site le plus chargé du semis avait 10
  interventions (mesuré) — pas de troncature possible sur lui de toute façon.
- **Reprendre un AVANT après avoir réécrit une scène** se fait en stashant les
  seuls fichiers de code (`git stash push -- <fichiers>`) et en sortant du
  dépôt tout test qui importe une fonction neuve ; `pop` tout de suite après,
  et vérifier `git stash list` — le poste porte déjà un stash AGENCE-2.
- **`react/jsx-no-literals` refuse un gabarit composé dans le JSX**, même s'il
  ne contient que des `t(...)` : passer par une fonction (`borneEcrite`).
- **Les captures APRÈS se prennent après le commit du code**, sinon
  `mesure.json` porte l'empreinte du commit précédent (recette VGP-2).

---

## 6. Ce qui reste à faire

1. **`dernieresInterventionsDuClient` sans `nulls: "last"`** — sur la fiche
   client, la file d'attente monte en tête des « dernières interventions ». Un
   ticket d'une ligne de code et d'une épreuve d'isolation (scène : un client
   avec des datées et des sans date, comme `historique-site-borne.test.ts`) ; la
   doc-comment de `listerInterventions` décrit déjà la faute.
2. **R4-02, niveau CLIENT : rien pour aller voir au-delà des 12.** Un lien
   « toutes les interventions de ce client » vers `/interventions` filtré, ou la
   pagination d'AT-07 réutilisée — à trancher.
3. **Un lien « toutes les interventions de ce lieu » sous le bloc site**, même
   chose au niveau site, une fois qu'un filtre par site existe sur
   `/interventions` (`filtreDesInterventions` n'en a pas aujourd'hui).
4. **Reporter dans `docs/backlog.md`** que le niveau site de R4-02 est fait, et
   dans `docs/arbitrages.md` la borne de 12 partagée par les deux fiches.
5. **Le technicien sur la ligne** — si l'exploitation le demande, résoudre
   `technicien_id` par l'annuaire cloisonné (FICHE-1), jamais rendre la clé.
