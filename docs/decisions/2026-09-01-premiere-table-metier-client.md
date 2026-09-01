# La première table métier, et l'épreuve du contrat R0-a

_Ticket L1-01 — 1er septembre 2026._

## Contexte

Le lot 1 s'ouvre sur `client`. C'est la première table métier ordinaire du
dépôt — première application réelle de la première catégorie de I1 — et c'est
aussi le passage que la revue R0 avait désigné comme **le point le plus
dangereux du lot 1** (écart É14) : le jour où la vraie table `client` existe, la
réparation la plus naturelle du harnais d'isolation réduit la couverture sans
qu'aucun gardien ne s'en aperçoive. Le ticket R0-a avait rendu ce contrat
structurel et confié sa tenue à trois gardiens indépendants. Personne ne l'avait
encore éprouvé pour de bon.

## L'épreuve, et ce qu'elle a mesuré

La réparation naïve a été écrite **avant** la bonne, en trois temps, et chaque
temps a été mesuré séparément. Le protocole est celui du §9 du CLAUDE.md : on ne
demande pas si un gardien est juste — il l'est presque toujours — on regarde
**ce qu'il regarde**, et on le vérifie en dehors de lui.

| Temps | Le geste, tel qu'une session le ferait | Ce qui est tombé |
| --- | --- | --- |
| **A** | Migration créant `client` avec la « forme imposée » de L0-04, c'est-à-dire la clause société seule. Les listes closes ne sont pas touchées. | **5 scénarios, 3 fichiers.** `politiques-rls.test.ts` nomme le filtre perdu mot pour mot : « la politique « cloisonnement_societe » a perdu le filtre `app.client_id` … un compte portail voit alors tout le parc de la société au lieu du sien (D10) ». Plus deux scénarios de `roles.test.ts` et un de `portail-client.test.ts`. |
| **B** | Le geste qui fait taire le gardien précédent : retirer `client` de `TABLES_PARC` **et** de `CONTRAT_PARC`, des deux côtés à la fois pour que le contrôle de dérive ne dise rien. | **10 scénarios d'isolation, 4 fichiers, plus 1 test unitaire.** `ecartsListeParc` refuse le RETRAIT et le dit : « c'est le retrait qui est dangereux, pas l'addition ». Et un **quatrième** gardien, que le contrat ne revendiquait pas, tombe aussi : la clôture par le schéma de `force-rls.test.ts` — « `client` ne figure dans AUCUNE des trois listes d'état RLS ». |
| **C** | Le dernier geste : supprimer le scénario portail devenu rouge, qui est celui qui « part avec la fixture ». | **4 tests unitaires.** Le plancher d'`EXIGENCES_L0_05` refuse la baisse : « 4 scénario(s) l'honoraient, 3 le font encore. **Le plancher ne se baisse jamais.** » Et son témoin de non-vacuité tombe avec lui. |

**Verdict : le contrat de R0-a a tenu, sur les trois legs, et il en avait un
quatrième qu'il ne réclamait pas.** Aucun temps ne peut être franchi en silence,
et chaque message nomme la chose perdue plutôt que la règle enfreinte.

**Une limite, mesurée et pas supposée.** Les gardiens 1 et 2 vivent dans
`tests/isolation/` : ils exigent le PostgreSQL jetable, donc `pnpm test:isolation`.
Le gardien 3 est statique et parle dans `pnpm test`. `pnpm verify` joue les deux,
et c'est la porte de chaque ticket — mais une session qui n'exécuterait que
`pnpm test` ne verrait tomber que le troisième leg. `ecartsListeParc` est de la
logique pure et pourrait rejoindre `tests/unit/` ; ce n'est pas fait ici, faute
d'appartenir au périmètre du ticket, et c'est écrit pour ne pas être oublié.

## Ce que la table porte, et les décisions qui s'y attachent

**La forme de la politique est « parc », et c'est la seule décision structurante
de la migration.** Deux clients d'une même société ne sont pas séparés par le
filtre société ; seul `app.client_id` les sépare. Sans lui, un compte portail
(D10) lirait la fiche de tous les autres clients de sa société — c'est RG-DRO-01.
`client` ne porte pas le filtre `app.perimetre_sites` : elle EST le client, il
n'y a pas de site au-dessus d'elle.

**Le code externe est unique PAR SOCIÉTÉ.** Ce n'est pas une précaution ajoutée
mais la condition d'existence de RG-IMP-05 : le rapprochement à l'import se fait
« sur le code externe s'il existe », et deux fiches qui le partageraient
rendraient la règle indéterminée sans qu'aucune erreur ne se produise. L'unicité
ne porte jamais sur le code seul — deux sociétés vendues séparément ont chacune
son ERP (RG-SOC-04), et le jeu de démonstration le montre en donnant le même
`DEMO-001` aux deux. Les NULL ne se heurtent pas dans un index unique
PostgreSQL, ce qui est exactement ce que D29 exige : « son absence ne suffit plus
à rejeter la ligne ».

**Aucune unicité sur la raison sociale**, et c'est une décision : RG-IMP-05 range
l'ambiguïté de raison sociale en « rejet pour arbitrage humain ». Une contrainte
en base transformerait cet arbitrage en refus, à la saisie plutôt qu'à l'import.

**Aucune énumération n'est fermée.** `categorie` et `conditions_reglement` sont
du texte libre : le chapitre 11 les nomme sans les énumérer, le chapitre 10 est
muet, et fermer une énumération avant d'avoir tranché à qui l'on vend est
l'erreur du 20/08. `commercial_referent` est du texte et non une clé vers
`utilisateur` : le référent d'un client importé de l'ERP n'est pas
nécessairement un compte de la plateforme, et le lier déciderait le contraire.

**La clé étrangère dit ses deux actions** (§9, 24/08) : `client.societe_id`
refuse en suppression — effacer une société emporterait son référentiel client —
et refuse en mise à jour, `RESTRICT` et non le `CASCADE` que Prisma pose par
défaut. C'est D49 : `societe.id` est un UUID v7 technique qui ne change jamais,
et `CASCADE` promettrait silencieusement de réécrire tout un parc client si cela
survenait.

## Ce qui a été délibérément laissé de côté

**Pas de clé étrangère de `utilisateur_client.client_id` vers `client.id`.**
Elle serait utile, et elle est composite pour être juste — `(societe_id,
client_id)` vers `(societe_id, id)`, sur le modèle de D48 —, faute de quoi un
compte portail pourrait désigner le client d'une autre société : les contrôles
d'intégrité référentielle contournent les politiques RLS par construction en
PostgreSQL. Trois raisons de ne pas la poser ici, et la première suffirait : sur
toute base déjà amorcée, `utilisateur_client` porte une ligne de démonstration
qui désigne un client inexistant, si bien que la contrainte ferait **échouer la
migration sur la base hébergée** — et une migration ne supprime pas des données
pour se rendre applicable ; la base hébergée est injoignable depuis une session
cloud, donc invérifiable d'ici ; et l'autre moitié du chaînage,
`perimetre_sites` vers `site`, appartient à L1-02. Chaîner une moitié de D10 ici
et l'autre au ticket suivant scinderait une seule décision — que devient un
compte portail quand son client disparaît ? — en deux migrations.

**Pas de `SELECT` pour `codiplan_reporting`.** Ce rôle voit toutes les sociétés :
c'est une clé passe-partout, et chaque table qu'on lui ouvre est une décision.
La consolidation aura besoin de `client` — le §2.2 demande la marge par client —
mais elle en aura besoin avec `intervention` et `contrat`, au lot 5. Le GRANT
s'écrira dans la migration du lot qui s'en sert.

**Pas d'écran.** Le ticket L1-01 du backlog dit « CRUD … recherche » et ne nomme
aucun écran ; aucun ticket du lot 1 n'en nomme. Le dépôt n'a d'ailleurs aucune
coquille authentifiée — L0-06 s'est arrêté à la couche serveur, et la seule page
existante est l'accueil de L0-01. Ce ticket livre donc la couche serveur
complète (`lib/clients/`), et l'écran viendra avec la coquille qui l'accueillera.

## L'arbitrage qui en est sorti : D55, le périmètre d'audit inversé

La première rédaction de ce ticket laissait `client` **hors** du périmètre
d'audit de I8, et le motivait correctement : la liste était close des deux
côtés, un déclencheur posé sur une table hors liste était refusé, et l'y faire
entrer était un arbitrage. Tout cela était vrai, et passait à côté du défaut.

**Le défaut n'était pas dans le contenu de la liste, il était dans son sens.**
Une liste d'ADMIS tenue à la main oublie, par construction, la table que
personne n'y a ajoutée — et `client` en est la démonstration : elle naissait hors
périmètre non par décision, mais par omission. D52 avait corrigé le contenu de
la liste, D53 sa maison ; ni l'un ni l'autre son sens.

**D55 inverse.** Toute table de la première catégorie de I1 est auditée, moins
une liste d'exemptions écrites et justifiées. L'exhaustivité n'est plus tenue
par personne : elle est héritée du gardien de D41, qui l'énumère déjà contre le
schéma. `client` porte donc son déclencheur, posé dans la migration qui la crée.

**Ce que l'inversion admet, et la frontière qu'elle a rendue nécessaire.**
`journal_audit` est **hors du domaine**, et non exemptée : un motif d'exemption
se rouvre par argument — « impossibilité » serait élastique —, une frontière est
une liste close d'une entrée gardée dans les deux sens. La raison est doctrinale
et antérieure au ticket : **un gardien ne peut pas se garder lui-même** (§9). La
récursion est réelle — déclencheur posé, une ligne insérée sur la base jetable :

```
ERROR:  stack depth limit exceeded
HINT:  Increase the configuration parameter "max_stack_depth" …
```

— mais elle n'en est que le symptôme. La liste d'exemptions, elle, est **vide**,
et son unique motif recevable est `rejouable`.

**Et ce retrait est payé comptant.** Le journal n'est pas audité, il est
inaltérable, et cela est éprouvé par TENTATIVE : `UPDATE` et `DELETE` tentés sous
le rôle applicatif sur la table mère, puis sur **chacune** des partitions
énumérées par `pg_inherits`. Le durcissement est posé par la fonction qui crée la
partition, dans la même transaction — mesuré. La limite est annoncée : un
`CREATE TABLE … PARTITION OF` écrit à la main produit encore une partition nue,
et la fermer demanderait un déclencheur d'événement, réservé au
superutilisateur ; c'est le contrôle détectif de `controle-cloisonnement.mts` qui
la rattrape.

## Les deux réserves à porter à L1-02

Elles sont écrites ici parce que la décision sur la clé étrangère y est prise, et
qu'un corollaire non écrit est un corollaire perdu.

**1. La ligne orpheline n'est pas un empêchement, c'est la démonstration.** La
base de démonstration contient une ligne de `utilisateur_client` qui référence un
client inexistant. C'est exactement ce que la clé étrangère aurait interdit :
l'argument « on ne peut pas la poser à cause de cette ligne » se retourne en
« cette ligne est la preuve qu'il fallait la poser ». Elle se traite comme une
donnée à réparer, jamais comme une raison de renoncer.

**2. La réparation vit DANS la migration, pas dans une consigne.** « La base
hébergée est injoignable depuis une session cloud » ne doit pas devenir une
vérification déléguée à quelqu'un qui l'oubliera. La migration de L1-02 répare
ou recrée elle-même la ligne de démonstration, puis pose la clé ; si l'état réel
n'est pas celui qu'elle attend, elle échoue bruyamment et on le voit. Aucune
étape manuelle, aucun contrôle « à lancer avant ».

## Conséquences

`client` entre dans `TABLES_CLOISONNEES` (donc dans `TABLES_RLS_FORCEE`), dans
le décompte de l'inventaire et du contrôle de cloisonnement, dans la purge des
données de démonstration, et — depuis D55 — dans le périmètre d'audit, sans que
personne n'ait eu à l'ajouter nulle part. Le contrôle de la base hébergée mesure désormais
« 1 « parc » » parmi les formes de politique, sur une table réelle et non sur une
fixture.

Un défaut a été trouvé par un test pendant l'écriture, et il vaut d'être noté
parce qu'il est silencieux : dans le schéma Zod de modification, `.default(null)`
appliqué avant `.optional()` faisait qu'une modification partielle **effaçait
tous les champs qu'elle ne mentionnait pas**. Les défauts ne vivent plus que dans
le schéma de création, où « non fourni » veut effectivement dire « vide ».

## Point relevé hors du périmètre de ce ticket

`scripts/purge-demonstration.mts` était **déjà cassé avant ce ticket**, depuis
L0-08 : sa liste de tables omet `calendrier`, `calendrier_plage` et
`calendrier_ferie`, qui référencent `societe` et `agence`. Mesuré sur la base
jetable :

```
ERROR:  cannot truncate a table referenced in a foreign key constraint
DETAIL:  Table "calendrier_ferie" references "agence".
```

L'échec est **bruyant** — le `TRUNCATE` est délibérément écrit sans `CASCADE`,
précisément pour cela — et l'entrée `reinitialiser_demo` du workflow est donc
inopérante plutôt que dangereuse. `client` a été ajoutée à la liste au titre de
ce ticket ; les trois tables du calendrier ne l'ont pas été, parce qu'un commit
ne couvre jamais deux tickets (CLAUDE.md §7). C'est une correction d'une ligne à
faire, et elle est écrite ici pour ne pas être perdue.
