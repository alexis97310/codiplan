# SELECT-1 — les sélecteurs de client et de site ne montrent pas tout le référentiel

Branche `claude/awesome-curie-uw72oz`, depuis `origin/main` à `06780c7` (qui
vient de recevoir le lot SEMIS-2, #265/#266/#269).

## À lire avant tout le reste

**Aucun déploiement de prévisualisation n'était joignable** : le proxy de ce
bac à sable bloque le site déployé. La mesure — avant ET après — a donc été
faite contre un **PostgreSQL local**, sur ce même commit, comme demandé. Les
captures de ce dossier en sont la preuve, il n'y a rien d'autre à ouvrir avant
fusion.

## 0. La mesure, avant toute correction

Le semis de démonstration (`prisma/seed-data.ts`, ce que le dépôt nomme « le
jeu d'essai ») ne porte que **3 clients / 4 sites** pour CODIMA-NC et
**2 clients / 3 sites** pour CODIMA-EU — bien en-dessous de tout plafond, et
il ne reproduit donc PAS la panne : ce n'est pas le jeu de données qui
l'a révélée en production.

Pour mesurer la panne sur ce commit sans accès à la base hébergée, la base
locale (migrée par `prisma migrate deploy`, semée par `pnpm db:seed`, comme
`tests/e2e/setup/base.ts` le fait déjà pour les scénarios de bout en bout) a
reçu, pour CODIMA-NC, des fiches synthétiques supplémentaires — jamais
commitées (I9) — pour porter le total à l'échelle réellement observée :

| | Avant les fiches synthétiques (jeu d'essai) | Après (base locale, mesure) | `LIMITE_RECHERCHE_MAXIMALE` |
|---|---:|---:|---:|
| Clients (CODIMA-NC) | 3 | **576** | 200 |
| Sites (CODIMA-NC) | 4 | **246** | 200 |

576 clients : le nombre exact que la constitution elle-même cite déjà, en
commentaire, comme mesuré par le directeur d'exploitation le 16/09
(`lib/clients/depot.ts`, `app/(back-office)/clients/page.tsx` : « 619 » à
cette date-là — le total a bougé depuis, 576 est ce qui est mesuré sur ce
commit).

**Le fait, confirmé en écran** (capture `avant-parc-nouvelle.png`) : le
sélecteur « Client » de `/parc/nouvelle` rend 201 `<option>` — le placeholder
plus 200 fiches, jamais plus. Un client choisi au hasard au-delà du 200ᵉ rang
alphabétique — *Client synthétique lot SELECT-1 n°488* — **n'apparaît tout
simplement pas dans le sélecteur** : créer une machine pour lui est
impossible, sans le moindre message d'erreur. Son unique site (*Site
synthétique lot SELECT-1 n°58*) est logé au même sort côté sélecteur de site.

## 1. La cause

`app/(back-office)/parc/nouvelle/page.tsx` appelait `rechercherClients` et
`rechercherSites` **une seule fois chacune**, avec `limite:
LIMITE_RECHERCHE_MAXIMALE` (200) et `page: 1`. Le commentaire de tête
justifiait ce plafond par « la volumétrie du chapitre 11.3 (200 à 500 clients
actifs à trois ans) » — **cette justification est fausse contre les données
réelles** : une société en porte déjà 576, largement au-delà des 500 supposés
dans trois ans. Ce n'était pas une règle de gestion, c'était un défaut.

## 2. La correction

`LIMITE_RECHERCHE_MAXIMALE` (200) **reste inchangée** dans
`lib/clients/saisie.ts` et `lib/sites/saisie.ts` : ce n'est pas un plafond
sur ce qu'on peut voir qu'il faut relever — un plafond plus haut resterait un
plafond, exactement la faute qu'on répare. C'est un garde-fou **par requête**,
contre une seule requête qui ramènerait tout le référentiel d'un coup depuis
Nouméa (latence élevée vers l'hébergeur) ; `/clients` et `/sites` s'en
servent déjà comme taille de PAGE, avec `compterClients`/`compterSites` pour
paginer le total réel (AT-07, 17/09). Les commentaires des deux fichiers, qui
prétendaient à tort que cette borne n'avait « rien à paginer », sont
corrigés en même temps que le code — même faute que celle nommée en §1, à
deux endroits.

Un sélecteur n'est pas une liste de recherche paginée à l'écran : il n'a pas
de page suivante à proposer, il doit montrer ce qui existe, quel qu'en soit
le nombre. `tousLesResultats` (nouvelle fonction, dans
`components/parc/formulaire-machine.tsx`) enchaîne les pages d'une recherche
bornée jusqu'à ce qu'un lot revienne plus court que la taille de page —
exactement le critère que `skip`/`take` de Prisma produisent déjà côté
dépôt, jamais une seconde lecture du total. `app/(back-office)/parc/nouvelle/page.tsx`
l'appelle pour les deux listes.

**Pourquoi la fonction vit dans le composant du formulaire et non dans la
page qui l'appelle** : mesuré au build, Next.js refuse toute exportation d'un
fichier `page.tsx` étrangère à son contrat de route —

```
Type error: Page "app/(back-office)/parc/nouvelle/page.tsx" does not match
the required types of a Next.js Page.
  "tousLesResultats" is not a valid Page export field.
```

— et une fonction non exportée n'aurait été éprouvable que par lecture du
source, jamais par un appel réel. Elle vit donc dans
`components/parc/formulaire-machine.tsx`, le fichier du formulaire qu'elle
alimente — territoire du ticket, et le même couple que
`rechercherClients`/`compterClients` du dépôt.

`app/(back-office)/parc/[id]/modifier/page.tsx` n'est pas touché : il passe
déjà `clients={[]}` et `sites={[]}` à `FormulaireMachine`, ces quatre champs
étant en LECTURE SEULE en modification (voir la note de tête du composant) —
aucun sélecteur, donc rien à réparer là. Il reste dans le territoire du
ticket et ses captures (§4) le montrent inchangé, avant et après.

`lib/i18n/fr.ts` n'a reçu aucune modification : aucune chaîne visible
nouvelle n'a été introduite.

## 3. Le gardien — `tests/unit/ui/lot-select-1.test.ts`

Trois volets :

1. **`tousLesResultats`**, importée telle quelle (jamais réimplémentée)
   depuis `components/parc/formulaire-machine.tsx` : rend les 576 clients et
   les 246 sites mesurés (§0), au-delà de `LIMITE_RECHERCHE_MAXIMALE`, sur
   des cas limites autour de la borne (un lot de moins, exactement une page,
   une page plus une fiche, plusieurs pages…), sur un référentiel vide sans
   boucler, et avec le nombre minimal d'appels (un lot plus court que la
   page EST la preuve d'épuisement, jamais un appel de confirmation en plus).
2. **La faute rejouée** : un appel unique borné à 200 sur les 576 clients
   mesurés — exactement ce que `/parc/nouvelle` appelait avant ce lot — puis
   la même source relue par `tousLesResultats`, qui répare exactement la
   perte.
3. **Preuve statique** sur le source réel de la page et du formulaire (même
   limite déjà mesurée par `tests/unit/ui/lot-parc.test.ts` : faire tourner
   `/parc/nouvelle` elle-même exige une session, une base, un rendu React
   Server Component, hors de portée de ce projet Vitest) : les deux listes
   passent par `tousLesResultats`, le commentaire ne justifie plus le
   plafond par la volumétrie fausse, et `LIMITE_RECHERCHE_MAXIMALE` reste à
   200 dans les deux fichiers de saisie — la réparation est la boucle,
   jamais un nombre relevé.

**Mis en échec d'abord** : les mêmes assertions statiques et algorithmiques,
jouées contre le source d'avant ce lot (`git stash` du correctif, gardien
relancé), rougissent sur **13 des 15 cas** — dont les deux qui rejouent la
panne mesurée (576 clients réels, 200 rendus). Restaurées après le correctif,
les 15 passent. Compte-rendu complet dans l'entête du fichier de test.

## 4. Captures d'écran (1280 px, `docs/propositions/lot-select-1/`)

Prises contre la base locale décrite en §0, compte de la démonstration
`adv@codima.test` (rôle `adv`, sans second facteur — le même compte que le
harnais de bout en bout).

| Fichier | Ce qu'il montre |
|---|---|
| `avant-parc-nouvelle.png` | `/parc/nouvelle` avant correction — sélecteur Client à 201 `<option>` (200 fiches + placeholder) |
| `apres-parc-nouvelle.png` | `/parc/nouvelle` après correction — 576 `<option>`, une par client réel |
| `apres-parc-nouvelle-site-cible.png` | Le client *n°488*, invisible avant correction, sélectionné après correction ; son site *n°58* apparaît dans le sélecteur de site (2 options : placeholder + son site) |
| `avant-parc-modifier.png` | `/parc/[id]/modifier` — champs client/site en lecture seule, non affectés par ce lot |
| `apres-parc-modifier.png` | Identique à `avant-parc-modifier.png` — écran non touché par la correction, capturé les deux fois pour mémoire |

(Il n'existe pas d'`avant-parc-nouvelle-site-cible.png` : avant correction, le
client *n°488* n'apparaît pas du tout dans le sélecteur — rien à sélectionner
pour prendre cette capture, ce qui est en soi la preuve la plus directe de la
panne.)

## 5. Vérification

| Étape | Résultat |
|---|---|
| `format:check` | vert |
| `typecheck` | vert |
| `lint` | vert |
| `test` (unitaire) | **2376/2376** verts, dont les 15 de `lot-select-1.test.ts` |
| `test:isolation` | **1050/1050** verts |
| `build` | vert |

`pnpm verify` complet, une seule fois, sur l'état final (correctif + gardien).

## 6. Ce qui reste ouvert

- Les fiches synthétiques créées pour la mesure locale (576 clients, 246
  sites pour CODIMA-NC) ne vivent que dans la base locale jetable de cette
  session — jamais commitées, jamais dans `prisma/seed-data.ts` (I9). Elles
  n'ont laissé aucune trace dans le dépôt hors des captures d'écran.
- Le compte réel en production (576 au moment de cette mesure) devra être
  reconfirmé par Alexis après fusion, la base hébergée restant hors de portée
  de ce bac à sable — comme la mesure de N-11 l'avait déjà signalé pour
  `date_vente`.
- `/parc/[id]/modifier` n'est pas modifié : ses champs client/site restent en
  lecture seule, hors du périmètre de ce ticket.
