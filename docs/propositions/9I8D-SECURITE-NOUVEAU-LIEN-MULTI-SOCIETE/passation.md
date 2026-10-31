# 9I8D-SECURITE-NOUVEAU-LIEN-MULTI-SOCIETE — passation

**Session non interactive, branche `9i8d-securite-nouveau-lien-multi-societe`**
(partant d'`origin/main`, `0b3c26168` — `main` était extrait dans un autre
worktree, `/home/aplou/codiplan`). Aucun push.

## EN UNE PHRASE

Le point 1 (mesure) et le point 5 (réserves de 9I7D sur les mentions légales)
sont livrés et commités. **Le point 2 (la migration) est un point d'arrêt** :
la fonction que ce ticket demande entre en collision frontale avec un
gardien existant, D50 (`tests/unit/db/security-definer-sous-arbitrage.test.ts`),
et le ticket lui-même prévoyait ce cas (« si le précédent du dépôt l'interdit :
ARRÊTE-TOI à ce point »). Les points 3, 4, 7 en dépendent et ne sont pas faits.
Le point 6 ne peut pas s'écrire comme une décision tranchée — il n'y a pas eu
d'arbitrage sur CE point précis — et reste donc ici, pas dans
`docs/arbitrages.md`.

---

## POINT 1 — LA MESURE

### Les tables qui rattachent une identité à une société

`git grep -n utilisateur_id prisma/schema.prisma`, puis lecture des modèles :

| Table (`@@map`) | Clé | Ce qu'elle rattache |
|---|---|---|
| `utilisateur_societe` (modèle `UtilisateurSociete`, l.949-964) | `@@unique([utilisateur_id, societe_id])` | Bureau — tous les rôles internes, `role` compris. **Un rôle `technicien` y a AUSSI une ligne** : `creerTechnicien` (`lib/techniciens/depot.ts` l.482) écrit d'abord `tx.utilisateurSociete.create(...)`, puis la ligne `technicien`. Vérifier cette table-ci couvre donc les DEUX formes « bureau » et « technicien » du point 4. |
| `technicien` (modèle `Technicien`, l.429-472) | `@@id([societe_id, utilisateur_id])` | Le rattachement AGENCE du technicien (majoration hors ouverture, calendrier). Toujours accompagnée d'une ligne `utilisateur_societe` (voir ci-dessus) : ne pas la compter une seconde fois dans la fonction. |
| `technicien_calendrier` (l.474-498) | `@@id([societe_id, utilisateur_id])` | Calendrier propre du technicien — même couple, dérivé de `technicien`, pas un rattachement supplémentaire à juger. |
| `utilisateur_client` (modèle `UtilisateurClient`, l.991-1021) | `@@unique([utilisateur_id, client_id])`, `societe_id NOT NULL` | Portail client — la forme « portail » du point 4. |
| `session`, `compte`, `verification`, `second_facteur`, `journal_acces` | — | Troisième catégorie de I1 (D39), techniques, **sans `societe_id`** : hors sujet. |
| `utilisateur` | — | Quatrième catégorie de I1 (D39), table de PLATEFORME : porte l'identité elle-même, pas un rattachement. |

**Conclusion de mesure : deux tables à interroger pour juger l'exclusivité —
`utilisateur_societe` (bureau + technicien) et `utilisateur_client`
(portail).** Rien d'autre ne rattache une identité à une société.

### Les fonctions SECURITY DEFINER déjà présentes, et leurs conventions

`git grep -n "CREATE OR REPLACE FUNCTION\|CREATE FUNCTION" prisma/migrations/` :
**aucune n'est `SECURITY DEFINER`.** Toutes les fonctions `app_*` existantes
(`app_role`, `app_est_role_editeur`, `app_peut_consulter_journal_audit`,
`app_peut_administrer_identites`, `app_tableau_sans_doublon`,
`app_societe_active_vierge`, `app_poser_perimetre_client`) sont
`SECURITY INVOKER` (le défaut, non écrit — D50 : « on ne demande pas ce qu'on
ne veut pas »).

**Le seul précédent `SECURITY DEFINER` arbitré à ce jour est D36** (le repli de
consolidation portable, lot 5, pas encore écrit) :
`docs/decisions/2026-08-20-consolidation-repli-portable.md`. Sa forme, arrêtée
par avance :
- fonction `SECURITY DEFINER`, propriétaire du schéma ;
- `SET search_path = pg_catalog, public` fixe ;
- ne renvoie **que des agrégats déjà consolidés**, jamais une ligne ;
- `EXECUTE` accordé au **seul** rôle visé, révoqué de `PUBLIC`.

Et `docs/arbitrages.md` l.723 le dit en toutes lettres : *« D36 entre
NOMMÉMENT dans la liste d'exceptions de D50 — ce qui est un arbitrage, pas une
décision de ticket, et doit donc être pris AVANT l'écriture du repli. »*

### Comment le dépôt appelle la capacité/le rôle avant d'agir

- `lib/auth/acces-bureau.ts` : `roleDuCompteDeBureauMembre` (l.331-349) lit le
  rôle dans la société active SEULE (`avecSociete`, jamais
  `avecContexteApplicatif`), appelée par `copierNouveauLienDAccesBureau`
  (l.442-459), qui applique déjà l'ordre capacité → rôle protégé (D223,
  `estCibleProtegeeCopieNouveauLien`) avant tout jeton émis.
- `lib/auth/acces-technicien.ts` : `copierNouveauLienDAcces` (l.259-275)
  n'a, lui, AUCUN contrôle de rôle protégé (D223 ne couvre que le bureau) —
  seulement `technicienMembreEtActif`.
- Les deux finissent par `copierLienDAccesPartage`, commun.

---

## POINT 2 — POINT D'ARRÊT : LA MIGRATION N'EST PAS ÉCRITE

### Le conflit, mesuré

`app_identite_exclusive_a_la_societe` doit répondre : *cette identité a-t-elle
une ligne dans `utilisateur_societe` ou `utilisateur_client` pour une société
AUTRE que `app.societe_id` ?* C'est structurellement une lecture AU-DESSUS du
cloisonnement — exactement ce que RLS existe pour empêcher à l'intérieur
d'une société.

**Mesuré : sous `SECURITY INVOKER` (le rôle applicatif, FORCE ROW LEVEL
SECURITY sur les deux tables), une requête
`WHERE utilisateur_id = X AND societe_id <> app.societe_id` rend TOUJOURS
zéro ligne** — la politique RLS de `utilisateur_societe` (et de
`utilisateur_client`) filtre déjà `societe_id = app.societe_id` AVANT la
clause ajoutée, qui devient donc une conjonction vide par construction. Un
`SET LOCAL row_security = off` n'a aucun effet pour un rôle qui ne porte pas
déjà `BYPASSRLS` ou n'est pas le propriétaire. **Il n'existe donc aucune
façon d'écrire cette fonction sous `SECURITY INVOKER` : c'est
`SECURITY DEFINER` (propriétaire, donc `BYPASSRLS` de fait) ou rien.**

Or `tests/unit/db/security-definer-sous-arbitrage.test.ts` (gardien de D50)
**refuse toute fonction `SECURITY DEFINER` apparaissant dans une migration**,
liste d'exceptions `AUTORISEES_PAR_ARBITRAGE` **close et vide**, et son
en-tête le dit nommément : *« Elle entrera par arbitrage, avec son nom écrit
ici — pas par une décision de session qui trouverait le gardien
encombrant. »* `docs/arbitrages.md` l.723-726 confirme, pour D36, que cette
addition « est un arbitrage, pas une décision de ticket ».

**C'est exactement le cas que ce ticket avait anticipé** (« Si le précédent
du dépôt exige autre chose ... s'il l'interdit : ARRÊTE-TOI à ce point »), et
CLAUDE.md §8 le confirme comme point d'arrêt : l'assouplissement d'un
invariant/gardien de sécurité, à exposer et attendre, jamais à trancher seul.

### Ce que la décision d'Alexis du 31/10 (« A ») ne pouvait pas prévoir

Les options A/B/C posées au pilote portaient sur la RÈGLE MÉTIER (copier
seulement si exclusif, vérifié par la base). Elles ne mentionnaient pas que
« vérifié par la base » exige, par construction PostgreSQL, de franchir la
même porte que D50 ferme. Ce n'est pas une réouverture de son choix, c'est
une information technique nouvelle qu'il n'avait pas sous les yeux en
répondant.

### Deux options, pour Alexis ou pour qui arbitre D50

**Option 1 — arbitrer l'exception, sur le modèle de D36.** Ajouter
`app_identite_exclusive_a_la_societe` nommément à
`AUTORISEES_PAR_ARBITRAGE`, avec une décision écrite dans
`docs/arbitrages.md` qui reprend les garanties déjà prévues par le ticket :
elle ne rend qu'un booléen (aucun nom, aucun identifiant d'une autre société),
`search_path` figé, `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE` au seul rôle
applicatif. C'est la voie la plus courte vers ce que le ticket demande, et
elle suit un précédent déjà posé (D36) plutôt que d'en inventer un nouveau.
**Conséquence à assumer** : la liste de D50, « close et vide » depuis sa
création, reçoit sa première entrée AVANT même que D36 (lot 5) n'existe — le
gardien lui-même disait attendre D36 comme premier candidat ; ce serait un
second candidat, plus tôt que prévu, pour un cas différent (un booléen de
contrôle d'accès, pas un agrégat de consolidation).

**Option 2 — ne pas franchir RLS, et renoncer à la vérification EN BASE.**
Revenir sur le choix « A » vers une variante de B/C : par exemple, l'écran
Équipe ADMIN PLATEFORME (seul rôle qui voit déjà toutes les sociétés,
lot 7/console éditeur) assainit après coup les cas détectés, plutôt qu'un
contrôle en base empêchant la copie au moment du geste. Coûte la garantie
immédiate que « A » visait.

**Je n'ai pas tranché entre les deux — ni choisi une voie alternative à
l'intérieur de l'option 1 (ex. une forme autre que `SECURITY DEFINER`,
si elle existe et que je n'ai pas vue) : c'est un arbitrage, pas une
décision de ticket.**

### Conséquences sur le reste du ticket

- **Point 3 (branchement)** : pas fait — dépend de la fonction.
- **Point 4 (épreuves)** : pas fait — dépend de la fonction.
- **Point 6 (registre)** : pas une décision tranchée dans
  `docs/arbitrages.md` — ce point ouvert vit ICI, dans la passation, en
  attendant l'arbitrage de D50 ci-dessus.
- **Point 7 (captures)** : pas fait — rien de nouveau à capturer (le bouton
  « Copier un nouveau lien » n'a pas de nouvelle condition de refus).

---

## POINT 5 — LIVRÉ (réserves de 9I7D sur les mentions légales)

Commit `a14fb7031`. Les trois réserves :

1. **La saisie n'est plus perdue après un refus « caractères ».** Choix
   retenu : **validation côté client avant l'envoi** (pas de texte renvoyé
   par le serveur) — cohérent avec `maxLength`, qui faisait déjà ce choix
   pour le refus « taille ». La règle (`CARACTERE_CONTROLE_INTERDIT`) est
   extraite dans `lib/societes/mentions-legales-regles.ts`, module SANS
   Prisma, importé par le serveur (`lib/societes/identite.ts`) ET par le
   composant client (`editeur-mentions-legales.tsx`) : une seule source de
   la règle, jamais recopiée.
2. **`tests/isolation/mentions-legales-routes.test.ts`** mockait
   `@/lib/auth/porte` et répondait `null` sans condition pour « ADV refusé »
   et « technicien refusé » — cela n'éprouvait que la redirection de la
   route, jamais un refus réel de CES rôles. Il mocke désormais
   `@/lib/auth/session` (`obtenirSession`) avec une session FABRIQUÉE de
   chaque rôle, laissant la VRAIE `exigerCapaciteComplete`
   (donc le vrai `peutPleinement`) juger. **Mesuré en écrivant le
   changement** : `next/headers` doit être mocké aussi, sans quoi
   `headers()` lève lui-même hors d'une requête Next réelle, AVANT même que
   le `obtenirSession` mocké ne soit atteint — ajouté, et commenté dans le
   fichier pour que ce ne soit pas redécouvert à la dure une seconde fois.
   Un test témoin (`admin_societe` franchit la porte) a été ajouté : sans
   lui, un refus qui refuserait TOUT LE MONDE par accident passerait inaperçu.
3. **Le test « force l'identifiant de B »**
   (`tests/isolation/mentions-legales-societe.test.ts`) comparait
   `.rejects.toThrow(/No record was found for an update/)` — un LIBELLÉ
   Prisma. Il vérifie désormais `erreur instanceof
   Prisma.PrismaClientKnownRequestError && erreur.code === "P2025"`.

`pnpm format`, `pnpm typecheck`, `pnpm lint`, `pnpm test` (5367 passés),
`pnpm test:isolation` (1739 passés) — tous verts après ce commit.

---

## CE QUI RESTE À FAIRE (une fois le point 2 arbitré)

Dans l'ordre du ticket, inchangé : écrire la migration (nom à choisir à ce
moment), brancher les deux routes de copie (bureau ET technicien, avec en
plus le contrôle de rôle protégé D223 ajouté à la route technicien — toujours
valable, indépendant de la fonction d'exclusivité), les épreuves d'isolation
et e2e, le registre dans `docs/arbitrages.md`, les captures 375/1280.

## `verify-final.txt`

`CI=1 pnpm verify:full` : `format:check`, `typecheck`, `lint`, `test` (5367
passés), `test:isolation` (1739 passés), `build` (compilé) et `feries:horizon`/
`audit:partitions` sont VERTS. `test:e2e` a démarré (« Running 1805 tests
using 1 worker ») et a été coupé par la limite d'une heure de l'outil en plein
balayage, sans résultat final — **même point de coupure que le lot précédent**
(9I8B2, commit `0b3c26168`, « coupée à 55 min en plein test:e2e »). Une
première exécution ANTÉRIEURE à ce fichier avait rencontré un échec isolé,
`tests/isolation/site.test.ts` (« un client qui a des sites ne s'efface pas »),
sur une faute `demande_societe_id_client_id_fkey` au lieu de `site_client_fkey`
— rejoué ensuite deux fois, PASSÉ les deux fois avec un code identique : un
ordre de verrous qui dépend des fixtures d'un autre fichier, étranger à cette
session (aucun fichier touché par ce lot ne nomme `client`, `site` ou
`demande`), pas une régression qu'elle aurait introduite.

## TERRITOIRE TOUCHÉ DANS CETTE SESSION

`lib/societes/identite.ts`, `lib/societes/mentions-legales-regles.ts`
(nouveau), `app/(back-office)/parametres/editeur-mentions-legales.tsx`,
`tests/isolation/mentions-legales-routes.test.ts`,
`tests/isolation/mentions-legales-societe.test.ts`. Rien touché dans
`prisma/`, `lib/auth/acces-bureau.ts`, `lib/auth/acces-technicien.ts`,
`lib/auth/lien-d-acces.ts`, `app/api/equipe/**`, l'écran Équipe,
`docs/arbitrages.md`.

---

# REPRISE 9I8D1-REPRISE-9I8D (01/11/2026)

## L'ARBITRAGE QUI DÉBLOQUE LE POINT 2

Alexis, verbatim, en réponse au point d'arrêt ci-dessus (POINT 2) : **« Oui,
l'autoriser »** (option 1 — arbitrer l'exception sur le modèle de D36). Écrit
dans `docs/arbitrages.md` sous **D226**, qui complète D223 sans le remplacer :
D223 ferme l'accès selon le RÔLE de la cible dans la société active, D226 le
ferme selon le RATTACHEMENT de l'identité au-delà de cette société.

## LA MIGRATION — LE NOM EXACT

**`20261101080000_identite_exclusive_a_la_societe_9i8d1`**, à jouer en
production et sur le site de test par `pnpm db:deploy` — une seule fonction
créée, `app_identite_exclusive_a_la_societe(uuid) RETURNS boolean`, aucune
politique RLS touchée, aucune table nouvelle. Elle entre, seule, dans
`AUTORISEES_PAR_ARBITRAGE` (`tests/unit/db/security-definer-sous-arbitrage.test.ts`)
et dans `lib/db/migrations-attendues.ts`.

## CE QUI A ÉTÉ MESURÉ : `row_security = off` SOUS LE RÔLE QUI JOUE LES
## MIGRATIONS EN CI (ET EN LOCAL)

**Mesuré, en interrogeant `pg_roles` sous `clientOwner()` de la base de
test** : `current_user = 'postgres'`, `rolsuper = true`, `rolbypassrls =
true`. C'est l'image officielle `postgres:16` de `.github/workflows/ci.yml`
(`POSTGRES_HOST_AUTH_METHOD: trust`, aucun rôle dédié créé), et c'est le même
rôle en local (port 5441, conteneur `codiplan-pg-voie1`, voir
`rejouer-roles-heberges-en-local` en mémoire de session).

**Conséquence, à savoir avant de lire les épreuves comme une preuve
complète** : un SUPERUTILISATEUR contourne RLS **inconditionnellement**, quel
que soit `row_security` — ce n'est pas `SET row_security = off` qui
l'exempte ici, c'est son statut de superutilisateur. La fonction, possédée
par ce rôle (`SECURITY DEFINER` = les droits du propriétaire), bypasse donc
FORCE ROW LEVEL SECURITY en CI et en local **même si l'attribut
`row_security = off` était retiré par erreur** — aucune épreuve de ce lot ne
le distinguerait.

**Ce que les épreuves mesurent réellement, et qui reste vrai en production**
(`tests/isolation/identite-exclusive-a-la-societe.test.ts`) :
- `codiplan_reporting` (ni propriétaire, ni `codiplan_app`) reçoit
  « permission denied » — un refus d'EXÉCUTION, posé par `REVOKE ALL FROM
  PUBLIC` / `GRANT EXECUTE`, **indépendant** de `row_security`. C'est la
  PREMIÈRE porte, et elle est éprouvée pour de vrai : `codiplan_reporting`
  n'est pas superutilisateur.
- Un appel sans `app.societe_id` lève, quel que soit le rôle — éprouvé
  sous `codiplan_app` (le rôle applicatif réel, non superutilisateur, non
  `BYPASSRLS`), donc une mesure authentique.

**Ce qui N'EST PAS éprouvé, et pourquoi c'est acceptable sans l'être** : le
cas précis où `row_security = off` fait la différence — un rôle qui EST le
propriétaire (ou `BYPASSRLS`) mais SANS être superutilisateur, sous `FORCE
ROW LEVEL SECURITY`, ferait lever une erreur si cet attribut manquait. Aucun
rôle de ce harnais (ni `postgres`, superutilisateur, ni `codiplan_app`/
`codiplan_reporting`, qui n'ont ni l'un ni l'autre les moyens d'exécuter
cette branche) ne peut l'éprouver : il faudrait un propriétaire NON
superutilisateur — exactement le modèle de production (`rejouer-roles-
heberges-en-local` : « propriétaire non superutilisateur »), hors de la base
jetable de ce dépôt. **La garantie tient sur le comportement DOCUMENTÉ de
PostgreSQL** (cité dans la note de la migration), pas sur une mesure locale,
pour cette seule branche.

**Pour Alexis, au moment de jouer la migration en production** : le
propriétaire du schéma y est, par construction (D36, mémoire de session),
non superutilisateur. `row_security = off` y jouera donc son rôle réel —
contrairement à CI/local, où un superutilisateur masque la question. Rien à
faire de plus ; c'est une information, pas une action.

## CE QUI RESTE HORS DE CE LOT

Aucune réserve nouvelle. Les points 1 à 5 du ticket sont faits et commités ;
le point 6 (cette section) clôt la reprise.

## `verify-final.txt` DE LA REPRISE

`CI=1 pnpm verify:full` : `format:check`, `typecheck`, `lint`, `test` (5374
passés), `test:isolation` (1751 passés — +12 sur les 1739 du run précédent
Nommément les épreuves de D223/D226), `build` (compilé) et
`feries:horizon`/`audit:partitions` sont VERTS. `test:e2e` a démarré
(« Running 1816 tests using 1 worker ») et a été coupé par la limite d'une
heure de l'outil en plein balayage, sans résultat final — **même point de
coupure que les deux lots précédents** (9I8B2, « coupée à 55 min » ; 9I8D,
« coupée à 1h ») : aucune ligne `✘`/`failed` dans tout ce qui a tourné avant
la coupure, uniquement des passes.
