# `pnpm veille` — ce qu'il faut pour atteindre la base hébergée

*Écrit et MESURÉ le 9 septembre 2026, sous protocole de nuit. Chaque ligne dit
d'où elle vient : une observation, ou une attente.*

---

## LA PRÉMISSE DE LA QUESTION EST FAUSSE, ET C'EST LA PREMIÈRE CHOSE À ÉCRIRE

La demande était : « écris ce qu'il manque exactement pour que `pnpm veille`
atteigne la base hébergée ». **Il ne manque rien : elle l'atteint déjà, chaque
nuit.**

*Mesuré par l'API de GitHub, sur le dernier passage planifié du flux `ci.yml` :*

| Ce qui a été lu | Valeur |
|---|---|
| Exécution planifiée | `34243371255`, `event: schedule`, branche `main` |
| Créée le | `2026-09-08T15:13:34Z` |
| Travail « veille — base hébergée » | `102118978376`, conclusion **`success`** |
| Étape « pnpm veille » | `15:14:03Z` → `15:14:09Z`, **6 secondes**, `success` |
| Travail « alarme — nuit rouge » | `skipped` — la veille n'a pas rougi |

Six secondes de bout en bout : la base a été jointe et interrogée. Un rouge
d'exploitation aurait rendu 75 et le travail d'alarme se serait ouvert ; il a été
**passé**, ce qui n'arrive que sur `nature=verte`.

*Ce que cette mesure ne dit pas, et qui n'est pas demandé ici : elle ne dit pas
que la base hébergée porte le schéma de cette branche. La veille observe l'état
de `main`.*

---

## CE QUI MANQUE, ALORS — ET C'EST DEPUIS CETTE SESSION, PAS EN CI

Deux choses, **nommées** :

| Ce qui manque | Où cela vit | À qui |
|---|---|---|
| La **valeur** du secret `DATABASE_URL` — l'URL du rôle **applicatif** `codiplan_app` sur la base Neon | secret d'Actions du dépôt, lu par le travail `veille-hebergee` de `.github/workflows/ci.yml` | **à l'exploitation** — c'est un secret |
| Un **chemin réseau TCP** vers `neon.tech:5432` depuis cette session cloud | le mandataire sortant de l'environnement, qui ne relaie pas le TCP (`P1001`) | **à l'exploitation** — c'est de l'hébergement |

**Et rien d'autre.** Pas de variable de plus : `scripts/veille-hebergee.mts`
(`urlVeille`) ne lit que `DATABASE_URL`. En particulier **`REPORTING_DATABASE_URL`
n'a rien à faire ici** et ne doit pas y être posée : ce rôle voit toutes les
sociétés, et D38 en fait un secret distinct, lu par le seul `lib/reporting`.

Pas de rôle à créer non plus : la veille se connecte avec le rôle **applicatif**,
le moins doté qui voie le catalogue, et en transaction `READ ONLY`.

**Les deux manques sont des gestes qui appartiennent à l'exploitation** — un
secret, un chemin réseau. Aucun des deux ne se répare dans le dépôt.

---

## CE QUE LA VEILLE VOIT AUJOURD'HUI, MESURÉ SUR UNE BASE LOCALE À JOUR

`pnpm veille` a été joué contre un PostgreSQL local portant **toutes** les
migrations de cette branche, sous le rôle `codiplan_app` :

> Veille de la base hébergée : **9 contrôles, aucun écart**, sur 32 table(s),
> 53 politique(s), 32 état(s) RLS, 22 déclencheur(s), 14 partition(s),
> 2 privilège(s) de journal et 8 de consolidation.

Les trois tables du ticket L2-10 y figurent avec la forme attendue —
`intervention/cloisonnement_parc`, `intervention_temps/cloisonnement_filiation`,
`technicien/cloisonnement_societe`.

*Le CLAUDE.md §4 dit « sept aujourd'hui » ; il en compte neuf, et il annonce
lui-même que sept n'est qu'un instantané. Le gardien qui ferme la liste
(`tests/unit/veille-hebergee.test.ts`) est vert.*

---

## LA LIMITE DU PARTITIONNEMENT NON DURCI : ELLE RESTE **COUVERTE**

*Et c'est une contradiction avec ce que la nuit demandait d'écrire, donc elle
s'écrit.*

La consigne était : « la limite du partitionnement non durci repasse de
*couverte* à **DÉCOUVERTE**, avec la date depuis laquelle elle l'est. Une limite
couverte par un contrôle qui ne tourne pas est une limite nue. »

**Le raisonnement est juste ; sa prémisse est fausse.** Le contrôle TOURNE — la
mesure ci-dessus le montre, hier à 15 h 14 UTC, et chaque nuit avant cela sur
dix-neuf exécutions planifiées consécutives. La limite reste donc **couverte**,
et l'écrire découverte mettrait un fait faux dans la documentation pour respecter
une consigne dont la condition n'est pas remplie.

**Ce que la limite est, et ce qu'elle reste** *(CLAUDE.md, I8)* : tant que le
rôle de migration n'est pas superutilisateur, `ddl_command_end` est hors de
portée, et une partition nue reste **productible à la main** dans une console.
Le préventif ne couvre pas ce geste ; c'est le **détectif** qui le rattrape — la
partition par défaut doit être vide —, et c'est lui qui tourne chaque nuit.

**La date à retenir n'est donc pas celle d'une découverture, c'est celle de la
dernière observation :** `2026-09-08T15:14:09Z`.

**Ce qui la rendrait découverte, et comment on le saurait** — écrit ici pour que
la question ait une réponse mécanique le jour où elle se pose :

1. la planification `schedule` de `ci.yml` est désactivée — GitHub le fait après
   60 jours d'inactivité sur un dépôt **public**, et le dépôt est privé
   aujourd'hui ; c'est un attribut du dépôt, pas de ce fichier ;
2. le secret `DATABASE_URL` est retiré ou périmé — la veille rendrait alors 1 et
   le travail d'alarme s'ouvrirait ;
3. la base devient durablement injoignable — code 75, `nature=liaison`.

Les trois se voient : `pnpm battement` échoue sur le premier, l'alarme s'ouvre
sur les deux autres. *Une limite couverte par un contrôle qui ne tourne pas est
une limite nue — et c'est exactement pour cela que le battement existe.*
