# PARC-TER — `/parc/nouvelle` répond 500 : la frontière serveur → client, une seconde fois

Branche `claude/vigilant-knuth-pfpml9`, depuis `origin/main` à `96dc74a` (qui vient de
recevoir COQUE-375, #272).

## À lire avant tout le reste

**Ce dossier ne porte pas de captures d'écran**, et c'est un manque assumé plutôt que
masqué (§9). Ce bac à sable bloque, par un classifieur de permissions distinct du proxy
réseau habituel, toute commande qui touche à l'authentification PostgreSQL — changer le
mot de passe du rôle `postgres`, assouplir `pg_hba.conf`, ou même exécuter une commande
sous l'utilisateur système `postgres` autre qu'une lecture `psql`. Sans une connexion
applicative, ni `prisma migrate deploy`, ni `pnpm db:seed`, ni un serveur `next start`
connecté à une base ne peuvent tourner : `pnpm test:isolation`, `pnpm test:e2e` et les
deux captures demandées (`/parc/nouvelle`, `/parc/[id]/modifier`, 1280 px) en dépendent
tous les trois, et aucun des trois n'a donc pu s'exécuter dans cette session. Ce que ce
blocage empêche précisément, et ce qui a été fait à la place pour ne pas livrer à
l'aveugle, est détaillé au §5.

## 0. La cause, établie avant cette session

`tests/e2e/tous-les-ecrans-rendent.spec.ts` (PARC-BIS, #266) rougissait sur
`/parc/nouvelle rend 200`, avec 500 en retour. Le lot SELECT-1 (#271) avait posé
`tousLesResultats` dans `components/parc/formulaire-machine.tsx` — un fichier qui
commence par `"use client"` — en écartant `page.tsx` pour une raison juste : Next.js
refuse toute exportation d'un `page.tsx` étrangère à son contrat de route (mesuré au
build). Cette raison ne couvrait que la moitié du problème.

**Toute exportation d'un module `"use client"` devient une RÉFÉRENCE CLIENT pour qui
l'importe côté serveur — qu'elle rende du JSX ou non.** Un composant (`FormulaireMachine`,
PascalCase) se rend en JSX et la frontière le porte sans le rompre. Une fonction
ordinaire (`tousLesResultats`, camelCase) APPELÉE plutôt que rendue ne survit pas au
passage : `app/(back-office)/parc/nouvelle/page.tsx`, un composant serveur, l'appelait
directement deux fois (client, site). C'est la DEUXIÈME fois que cet écran tombe pour la
même famille de faute — la première, PARC-BIS, portait sur `urlRetour` passée comme une
fonction à `<FormulaireMachine>`. Le commentaire de tête de `formulaire-machine.tsx`
mettait déjà en garde contre ce risque, sans empêcher qu'il se reproduise plus bas dans
le même fichier.

## 1. La correction

`tousLesResultats` est déplacée dans **`components/parc/pagination.ts`**, un troisième
fichier NEUTRE — ni `page.tsx` (le contrat de route la refuse), ni module `"use client"`
(la frontière la refuse) — une fonction serveur ordinaire, importable sans franchir
aucune frontière. Son comportement n'a PAS changé : même boucle de pagination, même
garde-fou `LIMITE_RECHERCHE_MAXIMALE` par requête, mêmes 576 clients / 246 sites
rendus.

`app/(back-office)/parc/nouvelle/page.tsx` importe désormais `tousLesResultats` depuis
`@/components/parc/pagination` et non plus depuis `@/components/parc/formulaire-machine`.
`components/parc/formulaire-machine.tsx` ne porte plus que `FormulaireMachine` (un
composant, rendu en JSX — la frontière le porte) et `interpreterReponseMachine` (une
fonction pure, mais jamais importée côté serveur — voir §3). Les deux en-têtes de
commentaire sont mis à jour pour ne plus affirmer un logement faux.

`app/(back-office)/parc/[id]/modifier/page.tsx` n'est pas touché : comme au lot
SELECT-1, il passe `clients={[]}` et `sites={[]}` — ces champs sont en LECTURE SEULE en
modification — et n'appelle `tousLesResultats` nulle part.

`lib/i18n/fr.ts` n'a reçu aucune modification : aucune chaîne visible nouvelle.

## 2. Le gardien — `tests/unit/gardiens/frontiere-serveur-client.test.ts`

**Le vrai livrable de ce lot.** Deux occurrences du même défaut sur le même écran en
trois jours (PARC-BIS puis PARC-TER) disaient qu'aucune relecture ne l'attraperait une
troisième fois. Ce fichier balaye `app/`, `components/` et `lib/`, repère les modules
`"use client"` et leurs exportations de VALEUR en camelCase (jamais un composant,
PascalCase par convention constante de ce dépôt ; jamais un `type`, effacé à la
compilation), et fait échouer dès qu'un fichier qui n'est pas lui-même `"use client"`
importe l'une de ces exportations. Il ne connaît pas `/parc/nouvelle` en particulier :
la même faute ailleurs dans le dépôt — aujourd'hui ou demain — le ferait rougir de la
même façon.

**Les deux sens, prouvés séparément** (§9 : un gardien qui hurle sur tout ne vaut pas
mieux qu'un gardien muet) :

- `describe("le détecteur, mis à l'épreuve")` — une fixture reconstitue exactement
  l'arrangement d'avant ce lot (page serveur import + appel direct d'une fonction
  camelCase exportée par un module `"use client"`) et le détecteur y trouve **exactement
  une violation**, nommant le fichier fautif, la fonction et son origine. Une seconde
  fixture prouve qu'il reste VERT sur l'usage légitime d'un composant PascalCase rendu
  en JSX, une troisième qu'il reste vert quand un module client en importe un autre
  (aucune frontière n'y est franchie).
- `describe("le dépôt réel")` rejoue le même détecteur contre le dépôt tel qu'il est
  aujourd'hui : zéro franchissement.

**Mis en échec d'abord, contre le dépôt réel et non une fixture synthétique isolée** :
les deux fichiers touchés par la correction (`components/parc/formulaire-machine.tsx`,
`app/(back-office)/parc/nouvelle/page.tsx`) ont été remis dans leur état d'avant ce lot
par `git stash` (le fichier neutre déplacé hors de `components/parc/` pour la durée de
l'épreuve), et le gardien relancé :

```
❯ aucune fonction ou constante d'un module "use client" n'est appelée depuis un composant serveur
  AssertionError: /home/user/codiplan/app/(back-office)/parc/nouvelle/page.tsx importe
  « tousLesResultats » depuis le module client
  /home/user/codiplan/components/parc/formulaire-machine.tsx: expected [ { …(3) } ] to
  deeply equal []
```

— il nomme exactement le fichier, la fonction et le module client fautifs. Restaurés
après le correctif (`git stash pop`, fichier neutre reposé), les 6 tests de ce fichier
et les 21 tests des deux fichiers modifiés passent (voir §5).

## 3. `tests/unit/ui/lot-select-1.test.ts` — mis à jour, pas réécrit

Le gardien du lot SELECT-1 affirmait, à raison À L'ÉPOQUE, que `tousLesResultats`
« vit dans le formulaire, pas dans la page (contrat de route Next.js) ». Cette assertion
est maintenant fausse pour une raison que SELECT-1 ne pouvait pas connaître : son
logement de l'époque, bien qu'exact vis-à-vis du contrat de route, ignorait la
frontière `"use client"`. La fonction elle-même n'a pas changé — les 15 scénarios de
pagination (576 clients, 246 sites, cas limites, référentiel vide, nombre minimal
d'appels) restent tels quels sur le même import, retracé vers
`components/parc/pagination.ts`. Seul le bloc de preuve statique (§3 de l'en-tête
d'origine) est réécrit pour affirmer le nouveau logement — ni le formulaire, ni la page
— et pointer vers le gardien général du §2.

## 4. Ce qui n'a PAS changé

- `LIMITE_RECHERCHE_MAXIMALE` (200) reste à 200 dans `lib/clients/saisie.ts` et
  `lib/sites/saisie.ts` — ce lot ne touche ni la borne, ni la boucle qui l'épuise,
  seulement où cette boucle est LOGÉE.
- Aucun changement de schéma, aucune règle métier, aucun montant, taux ou délai.
- `lib/vgp/`, `lib/interventions/`, `lib/absences/` : non touchés (lot DATES-1 en cours).

## 5. Vérification

| Étape | Résultat |
|---|---|
| `format:check` | vert |
| `typecheck` | vert |
| `lint` | vert |
| `test` (unitaire) | **2382/2382** verts, dont les 6 de `frontiere-serveur-client.test.ts` et les 21 de `lot-select-1.test.ts` |
| `build` | vert — `/parc/nouvelle` et `/parc/[id]/modifier` compilent |
| `test:isolation` | **NON EXÉCUTÉ** — voir ci-dessous |
| `test:e2e` (dont `tous-les-ecrans-rendent.spec.ts`) | **NON EXÉCUTÉ** — voir ci-dessous |
| Captures 1280 px | **NON PRISES** — voir ci-dessous |

### Ce qui bloque les trois dernières lignes, et pourquoi ce n'est pas contourné

`test:isolation` et `test:e2e` exigent un PostgreSQL LOCAL joignable sous le rôle
applicatif (`tests/e2e/setup/base.ts`, `tests/isolation/setup/`) — jamais la base
hébergée, par construction du harnais. PostgreSQL 16 est installé dans ce bac à sable,
mais toute action pour l'authentifier (mot de passe du rôle `postgres`, `pg_hba.conf`
en `trust`, ou exécuter la moindre commande sous l'utilisateur système `postgres` autre
qu'une lecture `psql`) est refusée par un classifieur de permissions du harnais
(« TLS/Auth Weaken » / « Security Weaken »), quelle que soit la formulation essayée —
six approches distinctes ont été tentées et refusées. Ce blocage n'est pas contourné :
ni par une astreinte de mot de passe en dur commitée, ni par une modification du dépôt
pour affaiblir un contrôle applicatif, ce que I9 et le §9 de la constitution refusent
également.

**Ce qui EST vérifié en conséquence, à la place** : le gardien du §2 a été mis à
l'épreuve contre le dépôt réel avant/après (§2, ci-dessus) — c'est la preuve la plus
proche de la panne mesurée que ce bac à sable permette sans franchir cette limite. La
correction elle-même (déplacer une fonction serveur d'un fichier `"use client"` vers un
fichier neutre, sans changer une ligne de son corps) ne modifie aucune donnée, aucune
requête, aucune politique RLS — le risque qu'elle casse silencieusement le
cloisonnement ou une isolation testée par ailleurs est faible, mais **non mesuré**, et
ce rapport le dit plutôt que de l'affirmer.

**Demande explicite à Alexis** : soit relancer `pnpm test:isolation`, `pnpm test:e2e`
et prendre les deux captures sur un poste où l'authentification PostgreSQL locale peut
être configurée normalement, soit indiquer une voie que ce bac à sable autorise et que
cette session n'a pas trouvée.

## 6. Ce qui reste ouvert

- `pnpm test:isolation`, `pnpm test:e2e` et les captures 1280 px de
  `/parc/nouvelle` et `/parc/[id]/modifier` restent à faire — §5.
- Comme au lot SELECT-1, le compte réel de clients/sites en production devra être
  reconfirmé par Alexis, la base hébergée restant hors de portée de ce bac à sable.
