# Journal de la file de nuit — 13/09/2026

*Une entrée par ticket. Ce journal est relu commit par commit par l'arbitre du projet,
qui lit le dépôt directement : il est écrit **pour être vérifié**, jamais pour être cru.*

**Lieu de ce travail** : la branche `claude/focused-bardeen-fvkipp`, partie de `main` à
l'empreinte `cca4295`. *Rien de ce journal n'affirme un état de `main` au-delà des
empreintes qu'il nomme* (§8 du protocole de session).

**L'horloge.** Toutes les heures de ce journal sont **lues** (`date -u`), jamais
estimées. La session s'est ouverte le 12/09/2026 à `19:32:51 UTC` — c'est-à-dire le
**13/09 à 06:32 à Nouméa**, qui est le jour de la consigne.

## Le socle de mesure, avant tout ticket

| Ce qui a été fait | Ce qui a été mesuré |
|---|---|
| PostgreSQL 16 local démarré, bases `codiplan_test`, `codiplan_e2e`, `codiplan_mesure` | `pg_isready` → `accepting connections` |
| `pnpm install --frozen-lockfile` | EXIT=0 |
| `pnpm verify` sur `cca4295` intact | **non mesuré, et je le dis** : la première exécution de cette session porte déjà mes modifications. *« C'était vert avant » ne s'écrit pas* (§11 du protocole). |

---

## J1 — #169 : LA BASE N'A PAS DÉRIVÉ, ET LA PISTE PROPOSÉE ÉTAIT FAUSSE

**La consigne demandait de nommer l'écart, d'en trouver la cause, de le réparer par une
migration idempotente, et d'écrire le gardien qui manquait. Trois de ces quatre gestes
n'avaient pas d'objet, et c'est la mesure qui le dit** (§3 du protocole — *une consigne
mesurée fausse se refuse, et le refus se motive*).

### a. L'écart : il n'y en avait aucun

Journal du job « veille — base hébergée », exécution `34708986360`, commit `cca4295`.
**Aucun objet n'y est nommé**, et c'est le premier renseignement :

```
Transaction API error: Transaction already closed: A query cannot be executed on an
expired transaction. The timeout for this transaction was 5000 ms, however 5199 ms
passed since the start of the transaction.
```

*Relancée à `19:36:13 UTC` sur le même commit* — deux heures après la première, par
`rerun_failed_jobs` — : **`5152 ms`**. Le dépassement est de trois pour cent : il est
franchi **chaque nuit**, ce n'est pas une gigue.

### b. La cause, par la mesure — et « DB resolve » n'y est pour rien

La piste proposée était que le flux « DB resolve » marque une migration **appliquée sans
l'appliquer**. Une commande la dément :

```
$ grep -rn "rolled-back\|--applied" scripts/ .github/workflows/ package.json
scripts/lib/resolution-migration.ts:18: * `prisma migrate resolve` en a deux. `--applied` marque…
scripts/lib/resolution-migration.ts:24: * `--rolled-back` dit l'inverse…
scripts/resoudre-migration.mts:32:  * `prisma migrate resolve --rolled-back`, dans `_prisma_migrations`.
scripts/resoudre-migration.mts:72:    ["exec","prisma","migrate","resolve","--rolled-back", MIGRATION.trim()],
```

**Une seule ligne exécutable, et c'est `--rolled-back`** — qui déclare la migration
*annulée*, donc **rejouable**. Les trois autres occurrences sont des commentaires qui
expliquent pourquoi `--applied` est refusé. *Ce flux ne peut pas faire mentir le registre
dans le sens que la consigne redoutait.*

**La vraie cause est ailleurs, et elle est arithmétique.** Toute l'observation de la
veille tient dans **une** transaction interactive — par décision : c'est ce qui lui donne
un instantané cohérent et rend le verrou `READ ONLY` effectif sur chaque requête. Elle
héritait des **5 000 ms de Prisma**, qui sont une valeur de réseau local, et elle a
franchi ce plafond **en grossissant** : son périmètre est inversé, tout contrôle écrit
dans `scripts/lib/` y entre de lui-même, et chacun apporte son aller-retour vers Neon.
*Aucun ticket n'est fautif. C'est le seed du 23/08 à l'identique, et la parade est copiée
plutôt qu'inventée.*

### c. La réparation — et pourquoi ce n'est PAS une migration

**Il n'y avait aucune structure à réparer.** Le job « déploiement » de la même exécution
rend `0` : *« L'application déployée répond, sa base est jointe, et les migrations que le
code attend sont appliquées. »* Écrire une migration aurait réparé une dérive que personne
n'a observée — *et une migration idempotente qui ne répare rien passe tous les contrôles,
ce qui est le pire résultat possible.*

Trois défauts réels, un incident :

| | |
|---|---|
| **le budget** | la transaction déclare ses délais, calculés comme ceux du seed — allers-retours **comptés dans le source** × latence majorée < délai déclaré |
| **le verdict** | périmètre **inversé** : seul un `EcartConstate` vaut un écart |
| **la provenance** | R1-01 : la veille compare `_prisma_migrations` au dépôt et **nomme le décompte en retard** |

### d. Le gardien qui manquait — et ce qu'il n'est pas

La consigne le voulait ainsi : *« refuser qu'une migration soit marquée appliquée sans que
son contenu soit dans la base »*. **Cette comparaison-là n'est pas productible** : la
veille observe des **formes** — politiques, drapeaux, privilèges —, jamais le contenu d'un
fichier de migration confronté à ce que la base porte. *Une migration marquée appliquée
dont le contenu manquerait se verrait par ses EFFETS — une politique absente, une
contrainte manquante —, jamais par son nom.* C'est écrit au README plutôt que tu.

Ce qui a été écrit à la place est la moitié productible, et c'est exactement R1-01 : **le
décompte des migrations en retard, mesuré et nommé**. Trois gardiens :

1. **le budget** (`tests/unit/veille-delais.test.ts`) — l'arithmétique, plus un gardien
   statique qui refuse une transaction sans délai déclaré ;
2. **le verdict** — quatre scénarios, dont le cas `#169` rejoué sur son message littéral,
   et le cas qui doit rester vert *pour sa propre raison* : une erreur imprévue tombe du
   côté « rien constaté » **sans avoir été reconnue** ;
3. **la provenance** — les deux verdicts de R1-01, dont celui qui **ne conclut pas** au
   geste manuel.

#### Les messages d'échec initiaux

```
AssertionError: la transaction de la veille n'énonce pas ses délais : elle hérite
des 5 000 ms de Prisma, qui sont une valeur de réseau local.
```

```
TypeError: codeDeSortie is not a function
```

```
AssertionError: expected '1 migration(s) en retard, à partir de…' not to match
/geste passé à la main/
```

*Le troisième n'était pas celui que j'attendais : **ma propre phrase** de provenance
contenait la formule interdite, dans une négation. Un motif ne lit pas une négation, et
l'assertion avait raison — la phrase est réécrite.*

#### Le jumeau, sur la faute telle qu'elle se commettrait

Phrase fixe réécrite dans `ci.yml` : **deux** assertions rouges, dont le décompte de
branches.

```
AssertionError: `ci.yml` affirme encore d'où vient un écart. […]
AssertionError: expected 1 to be greater than or equal to 2
```

### e. La preuve que la veille repasse au vert — la PREMIÈRE observation complète

Exécution `34717349502`, commit `f86b8b8`, `20:32:58 UTC`. **Sept secondes**, là où
l'ancienne expirait à cinq :

```
Veille de la base hébergée : 12 contrôles, aucun écart, sur 44 table(s), 66 politique(s),
44 état(s) RLS, 34 déclencheur(s), 14 partition(s), 2 privilège(s) de journal et 8 de
consolidation. Lecture sans contexte : aucune ligne sur 34 table(s) cloisonnée(s), le
témoin ayant rapporté devise, jour_ferie, parite — sans quoi ces zéros ne prouveraient
rien. Rôle applicatif, transaction en lecture seule.
Migrations : aucune en retard sur 55 tentative(s) lue(s).
```

**#169 est close** avec cette mesure. La dernière ligne est celle de R1-01 : le décompte
est nul, donc un écart — s'il y en avait eu un — aurait bien été un geste passé à la main.

### f. #163 — close, et sa CAUSE est traitée

Le même contrôle qui l'avait ouverte rend `0` : *« les migrations que le code attend sont
appliquées »*. Et la veille le confirme par une seconde lecture indépendante,
`_prisma_migrations` confronté au répertoire du dépôt. **D116 a refermé l'asymétrie** qui
l'avait produite — mesuré le 12/09 sur `b8e2f5b` : le flux se déclenche seul à 13:50:57,
migre à 13:53:12, et le contrôle de déploiement rend `success` à 13:58:20, **sans geste
humain**.

### Ce que la branche voisine disait déjà

Dans le **même `if`** de `ci.yml`, un `elif` plus haut, la branche « déploiement » porte
en commentaire : *« LE CORPS NE DÉCIDE PAS SI QUELQUE CHOSE A ÉTÉ CONSTATÉ — il le LIT »*,
avec la citation du §9 du 10/09. **La branche « veille » ne l'avait pas.** Une décision
appliquée à une moitié — et ici ni distance, ni délai, ni auteur différent : *quatorze
lignes.*

### Commit

`6583b42`, `db06ff0` — `pnpm verify` → **EXIT=0**, 1697 unitaires · 826 d'isolation, le
12/09/2026 à `19:52 UTC`.

---

## J2 — Q7 : les quatre origines de VGP sont RATIFIÉES (D114)

Alexis retient l'issue 1. La liste était **construite en base et soumise dans un compte
rendu** ; rien, dans le dépôt, ne disait qu'elle avait été approuvée. *Une liste proposée
puis approuvée n'est plus une proposition.*

D114 porte désormais la ratification, sa date, les quatre valeurs avec ce que chacune dit
et ne dit pas, et les trois écartées avec leur motif. **Un gardien la tient dans les deux
sens** — le schéma contre l'arbitrage, et l'arbitrage contre le schéma, qui est le sens
qu'on oublie.

**Ce n'est pas le gardien refusé le 11/09** pour son taux de fausses alertes : celui-là
cherchait une valeur d'énumération dans la prose de **toutes** les décisions, onze faux
positifs pour une prise. Celui-ci confronte **une** liste nommée à **un** arbitrage nommé.

#### Le message d'échec du jumeau

```
AssertionError: les valeurs d'origine d'une VGP appartiennent à Alexis (§1 du protocole)…
expected [ 'rapport_organisme', …(4) ] to deeply equal [ 'rapport_organisme', …(3) ]
```

### Commit

`ab36c64`.

---

## J3 — TROIS ÉCRANS SANS PORTE, ET LA MESURE EN NOMME DEUX (R3-05)

**Alexis a demandé que les temps de trajet soient paramétrables. Ils le sont depuis
R3-03** — les valeurs sont des défauts, la table les porte, l'écran existe. *Et personne
ne pouvait y arriver.*

### Ce que le gardien a mesuré, et où il diffère de la consigne

La consigne nommait **trois** écrans orphelins. Le gardien en nomme **deux** :

```
+ [
+   "/parametres/forfaits",
+   "/parametres/trajets",
+ ]
```

**`/sites` est atteignable** — depuis le lieu d'une intervention (`lien={…}` sur la fiche
d'intervention), puis depuis la fiche du site. *C'est exactement le chemin que le journal
du 12/09 décrivait pour L3-16.* Il reste porté dans la page de paramétrage malgré tout :
**un chemin qui existe dans le code n'est pas un chemin qu'un humain trouve**, et c'est la
limite que le gardien annonce lui-même.

### La barre n'a pas bougé, et c'était le point délicat

Elle est **close à onze entrées**, confrontée à la maquette, et un gardien ferait rougir
la douzième — **à raison**. Mais l'entrée « Sociétés & tarifs » portait déjà
`section: "/parametres"` : *la section existait, il lui manquait sa page.* Ce n'est donc
pas un écran de plus, c'est l'écran que la section désignait déjà.

### Le gardien a rendu DEUX faux orphelins avant d'être juste

Et les deux corrections sont des règles, pas des rustines.

1. **Il ne lisait que `href`.** La fiche d'un site se rejoint par `lien={…}`, un composant
   maison. *Chasser les noms d'attributs, c'est tenir une liste close à la main que le
   prochain composant fera mentir* — c'est la **valeur** qui désigne.
2. **Il ne lisait pas les clés d'objet.** Une page d'aiguillage tient ses routes dans un
   tableau et les rend par une boucle : il aurait poussé à écrire quatre liens à la main
   **pour le satisfaire**. *Un gardien qui force à écrire du code moins bon a cessé de
   servir ce qu'il garde.*

**Et il a mordu sur une distinction que j'avais effacée : la barre oblique finale.**
`/parc` ouvre la liste, `` `/parc/${id}` `` ouvre une fiche et ne laisse qu'un littéral
`/parc/`. La dépouiller faisait passer **tout** écran de détail pour atteignable dès qu'un
lien menait à sa liste.

```
AssertionError: expected true to be false
```

#### Le jumeau

Une porte retirée de la page d'aiguillage :

```
- []
+ [ "/parametres/trajets" ]
```

### Ce que la page NE fait pas

**Aucune lecture de base, aucun décompte.** Une pastille « 3 forfaits » se lirait comme
une mesure, et il faudrait alors décider ce qu'elle affiche quand la lecture échoue — le
motif de D88. *Une porte dit où elle mène, pas ce qu'il y a derrière.*

### Commit

`e03e72d` — `pnpm verify` → **EXIT=0**, 1704 unitaires · 826 d'isolation, à `20:05 UTC`.

---

## J4 — Q8 : LE LIEN DE PREMIER ACCÈS A ENFIN UN CANAL

**Et c'est une réparation qui a créé le problème**, ce qu'il faut lire avant de juger. Le
12/09, le flux « Ouvrir le PREMIER compte » a cessé d'imprimer l'URL — masque **et**
retrait, deux barrières qui ne se recouvrent pas — parce que le dépôt était devenu public
et qu'*un dépôt rendu public publie aussi son passé*. **C'était juste.** Mais le lien ne
sortait alors plus du flux **du tout** : il fallait un terminal, donc un ordinateur, donc
quelqu'un d'autre.

*La note de `docs/mise-en-ligne.md` disait encore « acceptable si le dépôt est PRIVÉ » :
barrée et non effacée, avec sa date et ce qui l'a remplacée.*

### L'interface est étroite EXPRÈS

Trois types et une méthode. **Un seul fichier du dépôt connaît un prestataire**, et un
gardien l'exige. Trois choses n'y sont pas, et chacune est une porte qu'on n'ouvre pas :
pièce jointe, HTML, destinataires multiples — *un courriel d'authentification qui porte du
HTML est un courriel qu'on apprend à ouvrir sans réfléchir.*

### `Envoi` est une SOMME et jamais un `void`

C'est le cœur. Un appelant ne peut pas ignorer la moitié « pas parti » sans que le
compilateur le dise. **Un canal qui laisse croire qu'il a envoyé est pire qu'un canal
absent** : l'agence pense avoir invité, la personne n'a rien reçu, et personne ne le sait
avant le coup de téléphone. *C'est le §9 appliqué à un canal — le silence a exactement la
forme du succès.*

**Trois silences refusés nommément**, et le deuxième est celui qu'on compterait pour un
succès : un refus du prestataire ; **un `2xx` sans référence d'envoi** — on ne sait alors
pas ce qui s'est passé, et *« je ne sais pas » ne se corrige pas comme « c'est parti »* ;
un réseau muet.

### Le refus, mesuré sur le chemin réel

```
$ pnpm exec tsx <appel de envoyerLienPremierAcces sans configuration>
{
  "parti": false,
  "motif": "L'envoi de courriel n'est pas configuré : COURRIEL_API_CLE et
            COURRIEL_EXPEDITEUR sont absentes. […] RIEN N'A ÉTÉ ENVOYÉ."
}
```

*Et quand une seule manque, il ne nomme QUE celle-là* — nommer les deux enverrait chercher
une variable déjà posée.

### Je n'ai choisi aucun prestataire

**Le §2 du `CLAUDE.md` impose Resend depuis l'origine**, et cette ligne est antérieure à la
question : *ce n'est pas une dépendance nouvelle, c'en est une qu'on active* — et elle
s'active **sans rien installer**, son interface étant un `POST` en HTTPS. Trente lignes
plutôt que 200 Ko (§2).

**La seconde voie — le SMTP d'une boîte Gmail — demande une DÉPENDANCE** : aucun client
SMTP n'est installé et `fetch` n'en tient pas lieu. C'est un arbitrage, pas un ticket. Les
deux voies sont comparées dans `docs/mise-en-ligne.md` avec ce que chacune coûte, exige et
**risque** — *un mot de passe d'application donne accès à la boîte entière.*

### Aucun secret, nulle part

Le module ne connaît que des **noms** de variables. Un gardien refuse une clé ou un jeton
porteur en clair dans `lib/courriel/`, et **la clé ne sort jamais dans un motif de refus**
— éprouvé en faisant répondre au prestataire un message qui la contient.

### Commit

`df2d33f` — `pnpm verify:full` → **EXIT=0**, 1718 unitaires · 826 d'isolation ·
27 Playwright, le 12/09/2026 à `20:30:43 UTC`.

### UN ROUGE, ET IL N'ÉTAIT PAS DANS LE CODE — troisième occurrence de la même cause

Le premier `verify:full` a rendu **dix scénarios Playwright rouges**, tous sur
`connexion?motif=auth.refus`. *Le journal du 12/09 décrit deux fois ce symptôme, chaque
fois pour une cause d'environnement.* **La troisième est nouvelle et mérite d'être
écrite :**

`playwright.config.ts` lit `process.env.E2E_DATABASE_URL` **au chargement de la
configuration**, avant que quoi que ce soit n'ait chargé `.env`. La variable était dans mon
`.env` et **pas dans le shell** : `environnementDuServeur()` a donc rendu `{}`, le serveur
de test est retombé sur le `DATABASE_URL` du `.env` — une base jamais migrée —, pendant que
la préparation, elle, semait bien la bonne base. *Les deux moitiés du harnais regardaient
deux bases différentes, et le message d'échec ne dit ni l'une ni l'autre.*

Mesuré plutôt que supposé : la base `codiplan_e2e` portait bien ses 9 identités et
`adv@codima.test` bien son mot de passe ; le port 3100 était libre. Les variables exportées
dans le shell, les 27 scénarios passent.

*C'est encore « un message juste sur une cause fausse » — la famille du 08/09.*

---

## J5 — L2-13 : DEUX EXIGENCES DE D96 NE PEUVENT PAS ÊTRE VRAIES ENSEMBLE (Q9)

**C'était le premier travail libre de la file, et il ne l'est pas.** En l'ouvrant, une
contradiction interne à D96 est apparue — *ce n'est ni un refus ni une réduction de
périmètre en silence : c'est une contradiction entre deux moitiés d'une même décision de
rang 1, qui se SIGNALE plutôt qu'elle ne s'arbitre* (§1 du `CLAUDE.md`).

D96 range la table en **troisième catégorie de I1** — *« un lien d'invitation est un
matériau d'authentification : il se range comme tel »* —, donc sans `societe_id` et sous la
forme « désignation » : *on ne lit que la ligne qu'on nommait déjà*, en présentant son
jeton. **Et le même D96 exige « tracé — qui a invité qui, quand ».** L'agence ne possède
pas le jeton : il est montré une fois, à usage unique, non relisible. *Sous cette forme,
personne au back-office ne peut relire une seule ligne — pas même celles qu'il vient
d'écrire.* Le journal d'audit ne comble pas le trou : I8 ne couvre que la première
catégorie.

**J'ai cherché une troisième voie et je n'en ai pas trouvé qui tienne** — je le dis plutôt
que d'affirmer qu'il n'y en a pas. Faire poser le contexte de société par un jeton
présenté par un inconnu contredirait L1-02e mot pour mot ; une fonction `SECURITY DEFINER`
est refusée par un gardien dont la liste d'exceptions est close **et vide**.

### Un gardien rendait une fausse alerte, découvert en passant

Le contrôle de cohérence du backlog ne reconnaît que les tickets de **lot** comme en-tête —
c'est voulu, eux seuls portent une estampille — **mais il s'en servait aussi de BORNE**. Le
dernier ticket de lot du document absorbait donc tous les tickets de reprise qui le
suivent : le bloc de `L1-12` portait le texte de `R3-06` et `R3-07`, et ses « sources
citées » étaient celles de quatre tickets. *Toute retouche à la fin du document faisait
rougir son empreinte* — un ticket écrit ce jour-là citant `D95` a suffi.

```
AssertionError: expected [ 'D10', 'D95', 'D96' ] to deeply equal [ 'D10' ]
```

*Ouvrir un ticket et fermer le précédent ne sont pas la même chose* : le nouveau motif
FERME, sans jamais ouvrir.

### Commit

`614ef27` — `pnpm verify:full` → **EXIT=0**, 1720 · 826 · 27, à `20:48 UTC`.

---

## J6 — R1-07, et le lot 7 fermé avec sa mesure

**Le §5 du protocole portait quatre sections ; il en porte cinq.** Le **TITRE** — sans
jargon, sous 80 caractères — parce que *c'est ce qu'une notification montre avant que
quiconque décide d'ouvrir* ; et **« ce qu'elle INTERDIT »** à côté de « ce qu'elle coûte »,
parce qu'*un coût se paie une fois tandis qu'une porte fermée ne se rouvre pas toujours.*

**Et la règle a mordu son auteur dans le même geste** : le titre de Q9, écrit une heure
plus tôt, faisait **84 caractères**. Il en fait 66.

### Le lot 7 est fermé, et c'est mesuré

L7-01 et L7-03 étaient marqués `LIBRE`. Les trois moitiés du constat : `lireRole`
n'accorde un contexte de société qu'à une identité portant une ligne dans
`utilisateur_societe` **ou** `utilisateur_client`, et le §22.5 n'en donne aucune à un rôle
éditeur ; `app/(editeur)/` n'existe pas ; le semis ne sème **aucune** identité
`admin_plateforme`.

**Et je n'ai PAS posé la politique d'avance**, contrairement à l'habitude du dépôt.
*Mesuré sur `pg_policies` : `second_facteur` porte quatre politiques et **aucune pour
`DELETE`**.* Sous `FORCE`, un verbe sans politique est refusé **pour tout le monde** —
l'état le plus sûr, et le cœur de D58/D59. La doctrine §2 dit qu'une règle de cloisonnement
n'a pas besoin d'appelant, *mais elle parle de FERMER un trou, jamais d'OUVRIR une porte
devant laquelle personne ne peut encore se présenter.*

### Commit

`4eac7d5` — `pnpm verify:full` → **EXIT=0**, 1724 · 826 · 27, à `21:00 UTC`.

---

## J7 — Deux notes qui mentaient (R1-09, R1-11)

**R1-09** — le §5.1 envoyait **créer une base de production, y déposer deux secrets et
amorcer une société** pour atteindre un écran qui s'ouvre sans rien de tout cela. La phrase
est barrée avec sa date et son commit ; une section **« LA VOIE COURTE »** donne les huit
clics, en nommant l'identité et l'identifiant de société **lus dans `prisma/seed.ts`**
(I9). Et **une seconde phrase caduque** a été trouvée dans le même paragraphe — *« le dépôt
est privé »*, première des trois conditions qui rendaient acceptable qu'un jeton entre dans
un journal.

Le gardien que le ticket réclamait dit ce qui rendrait la **nouvelle** phrase fausse :

```
AssertionError: le semis pose un mot de passe. […] le cliquet de D65 lit
`mot_de_passe IS NULL`, et une empreinte semée FERMERAIT la réémission pour
toujours, sur des comptes que personne n'a ouverts.
```

**R1-11** — `nuit.yml` portait `schedule: cron "0 16 * * *"` alors que le flux est
désactivé. *Re-mesuré plutôt que cité : `state: "disabled_manually"`, 11/09 à 12:54:55
+11:00.* C'est le §9 du 31/08 à l'envers — là une **garantie** reposait sur un attribut
extérieur, ici c'est une **neutralisation**. Et `claude.yml` ne reçoit aucune mention,
**parce que son état ne le justifie pas** : `active`, sans aucun `schedule`.

### Commit

`75c0055` — `pnpm verify:full` → **EXIT=0**, 1726 · 826 · 27, à `21:08 UTC`.

---

## J8 — R2-01 : le second thème est ce qui ÉPROUVE le mécanisme

**Tant qu'il n'y avait qu'une apparence, la promesse de D95 n'était ni vérifiable ni
démentable.** Il a fallu un bloc CSS et une entrée de liste — **rien d'autre**, et c'est
désormais mesuré plutôt que promis.

**L'impossibilité a été chiffrée avant d'être refusée.** `d03a4a5`, où les valeurs sont
lues, n'existait pas dans ce clone — superficiel, **55 commits sur 362**.
`git fetch --unshallow` a coûté **vingt secondes**. *Un devis se chiffre avant d'être
refusé* (§9, 08/09).

**Ce qui a dû être DÉRIVÉ est dit.** L'apparence d'avant ne portait pas trente jetons :
elle portait des classes utilitaires, et plusieurs rôles n'avaient aucun équivalent — ni
bordure rouge, ni bordure orange. Ceux-là sont pris sur la même rampe, au même degré que
leurs voisins. *Une valeur dérivée présentée comme recouvrée serait une mesure inventée.*

Le ticket dit « vingt-neuf jetons » ; il y en a **trente**, mesuré sur `JETONS`.

```
AssertionError: expected [ 'tableau' ] to deeply equal []
AssertionError: expected 1 to be greater than or equal to 2
```

### Commit

`97c3504` — `pnpm verify:full` → **EXIT=0**, 1731 · 826 · 27, à `21:16 UTC`.

---

## J9 — LA PRISE DE VUE : 72 images, et deux écrans VIDES

**72 images à `c1ffd56`**, prise lue à l'horloge : `2026-09-12 21:29 UTC`. Seize de plus
que la veille — les six écrans que personne ne pouvait voir : `/parc`, `/sites`,
`/parametres/trajets`, `/parametres`, `/vgp`, `/vgp/a-determiner`.

**QUATRE refus, et ce sont les mêmes que le 10 et le 12/09**, re-mesurés plutôt que
recopiés : les quatre images du portail. *C'est exactement ce que Q9 rouvre par l'autre
bout.*

### Huit autres refus étaient les miens, et la mesure les a nommés

La première prise a tourné sous `adv@codima.test`. Les écrans d'enrôlement et de défi ont
été refusés, et leur refus disait *« le compte porte déjà un second facteur »*. **La cause
était ailleurs** : RG-DRO-05 ne rend le second facteur obligatoire que sur
`admin_plateforme`, `admin_societe` et `direction`. Sous un rôle `adv`, ces deux écrans
**n'existent pas**, et c'est juste. *Encore un message juste sur une cause fausse.*

Et la seconde prise a buté sur ce que le README annonçait déjà — **56 refus**, parce que la
prise précédente avait enrôlé le compte et qu'*une clé d'enrôlement passée n'est pas
rejouable*. La note le dit depuis le 12/09 ; je l'ai lue après.

### Deux écrans sont photographiés VIDES, et ce n'est pas un défaut d'écran

*Mesuré sur la base de la prise :* `machine` **0**, `famille_materiel` **0** — contre
`client` 5, `site` 7, `intervention` 32. `/parc` et `/vgp` disent donc « Aucune machine
n'est enregistrée pour cette société », et **ils disent vrai**.

**L'arbitre doit le savoir avant de juger ces images** : ce qu'elles montrent est la FORME
de l'écran, pas ce qu'il rend sur des données. Et l'effet dépasse les images — *le registre
VGP porte tout le lot 9, et aucune de ses distinctions ne peut être VUE tant qu'aucune
machine n'existe.* Porté à la file en **R3-10**.

### ET LE MÊME PIÈGE A MORDU UNE TROISIÈME FOIS, sur le `verify:full` de clôture

Dix scénarios Playwright rouges sur `auth.refus` — **mon propre serveur de prise de vue
occupait encore le port 3100**, et le harnais a mesuré une application branchée sur la base
des captures. *C'est littéralement l'avertissement que le README des captures porte depuis
le 10/09, et que le journal du 12/09 consigne déjà comme l'ayant subi.* Serveur arrêté, les
27 scénarios passent.

**Trois occurrences de la même famille en une journée** — le harnais dont une variable
n'était pas exportée, le compte sans second facteur obligatoire, le port occupé — et
**aucune ne se lit dans son message d'échec** : `auth.refus` est juste, et sa cause est
ailleurs à chaque fois. *La famille du 08/09, et ce qui la rend coûteuse n'est pas qu'elle
soit difficile : c'est qu'elle soit CRÉDIBLE.*

### Ce que l'image montre, et qu'aucune assertion n'aurait dit

La page de paramétrage rend ses **quatre portes**, la barre allume « Sociétés & tarifs », et
le chemin vers les temps de trajet existe enfin — **R3-08 en acte, sur une image plutôt que
dans un test.**

### Commits

`c1ffd56` (les six écrans) et `7acb469` (les images).

---

## LA MESURE QUE JE NE TRANCHE PAS — le trajet dans le taux de charge (D107)

*Écrite ici pour être relisible dans quelques semaines, et pour rien d'autre.* Sur le jeu
de démonstration, **un technicien à 06:30 engagées porte 24:00 de trajet, soit 69 % presque
entièrement fait de route**. Alexis a choisi d'**observer avant de conclure**. D107 n'est
pas rouverte, rien n'est plafonné, et aucun code n'a bougé de ce fait.

---

## CE QUI EST ÉCRIT AU RECUEIL

| | |
|---|---|
| **§9 du `CLAUDE.md`** | *le verdict le plus grave était le verdict par défaut* — un contrôle interrompu criait à la faute. **Une seule inscription cette session** (§6 du protocole). |

| **Doctrine §3** | *le verdict par défaut d'un contrôle est celui qui affirme le moins* |
| **D114** | les quatre origines de VGP **ratifiées**, avec leur date |
| **Protocole §5** | la forme d'un paragraphe d'arbitrage passe à **cinq** sections (R1-07) |

## CE QUI EST SUR `main`

| Commit | Ce qu'il porte |
|---|---|
| `f86b8b8` | la veille réparée (#169, R1-01), Q7 ratifiée, les écrans sans porte (R3-08) |
| `3213c26` | le journal, la leçon au §9, #169 et #163 closes |
| `614ef27` | L2-13 bloqué avec Q9 ; la borne des blocs du backlog ; trois marqueurs corrigés |
| `4eac7d5` | R1-07, et le lot 7 fermé avec sa mesure |
| `75c0055` | R1-09 et R1-11 |
| `97c3504` | R2-01 — le second thème |
| `c1ffd56`, `7acb469` | la prise de vue : 72 images |

*Chaque ligne « vert mesuré » de ce journal nomme `pnpm verify:full` et son heure, lue à
l'horloge.* **Le vert de CLÔTURE, mesuré après la prise de vue : `pnpm verify:full` →
EXIT=0, 1731 unitaires · 826 d'isolation · 27 Playwright, le 12/09/2026 à `21:42:16 UTC`.**

## CE QUI EST EN ATTENTE

**Une question nouvelle : Q9** — *le lien d'invitation : qui peut relire la trace qu'il
laisse ?* Elle bloque **L2-13**, donc l'entrée des clients au portail. Q7 et Q8 sont
tranchées et inscrites ; les six précédentes l'étaient déjà.

**Six tickets sont passés de `LIBRE` à `BLOQUÉ` ou `LIVRÉ` avec leur mesure** — L2-13,
L7-01, L7-03 d'un côté ; R1-01, R1-02, R1-10 de l'autre. *Un ticket dont l'état ment est
pire qu'un ticket bloqué, et chacun coûtait une lecture pour découvrir qu'il n'y avait
rien à faire.*

## LE GESTE QUI RESTE À ALEXIS

**UN SEUL, et il dure trois minutes : déposer la clé d'envoi de courriel.**

> **`github.com/alexis97310/codiplan` → Settings → Secrets and variables → Actions → New
> repository secret**, deux fois :
>
> | Nom exact | Ce qu'on y met |
> |---|---|
> | `COURRIEL_API_CLE` | une clé d'API créée sur **resend.com** (gratuit sous faible volume) |
> | `COURRIEL_EXPEDITEUR` | l'adresse d'expédition, p. ex. `CODIPLAN <acces@votre-domaine.nc>` |
>
> **Puis vérifier, sans rien casser** : Actions → **Ouvrir le PREMIER compte** → *Run
> workflow* — base `demonstration`, confirmation `oui`, société
> `0192f0a0-0000-7000-8000-000000000001`, votre adresse, l'URL de l'application —
> **« Réémettre » coché** et **« Envoyer le lien par courriel » coché**. *La réémission ne
> crée rien et ne referme rien.*

La marche à suivre complète, avec les trois sorties possibles et ce que chacune veut dire,
est dans **`docs/mise-en-ligne.md`, section « LE CANAL D'ENVOI DE COURRIEL »**. *Et rien
n'est bloqué en attendant : l'envoi non configuré échoue en nommant ce qui manque, et le
lien reste imprimé dans tous les cas.*

**Aucune migration n'a été écrite cette journée** — le §12 du protocole n'appelle donc
aucun geste de base.
