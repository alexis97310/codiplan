# Journal d'audit — écrit par la base, en ajout seul, sans `SECURITY DEFINER`

*Ticket L0-10. Invariant I8, arbitrages D32 et D50, chapitre 11.2.*
*29 août 2026.*

---

## Contexte

I8 exige que toute création, modification ou suppression sur une intervention,
un contrat, une machine, un paramétrage société ou un compte client soit
journalisée avec auteur, horodatage et valeurs avant/après, et que le journal
soit protégé « par trigger PostgreSQL, pas seulement par un intercepteur
applicatif ». D32 a tranché le mécanisme et unifié le périmètre. Restait à
construire, et trois questions se sont posées en chemin — dont une que le ticket
a explicitement refusé de trancher en séance.

---

## 1. L'écriture n'est pas facultative — c'est un déclencheur

Le journal est écrit par `journal_audit_tracer()`, posé en `AFTER INSERT OR
UPDATE OR DELETE FOR EACH ROW` sur chaque table du périmètre. Un intercepteur
Prisma ne couvre que les chemins qui passent par Prisma : il laisse dehors le
script de correction, l'import Excel, le `psql` d'un soir de production. C'est le
principe de L0-04 — le filtrage ne vaut que là où **tous** les chemins passent —
et celui de D51 — le rendu est le point de passage obligé —, appliqué une
troisième fois.

Options écartées :

- **Un intercepteur Prisma (`$extends`).** Rejeté par D32 avant ce ticket, et la
  raison tient toujours : l'audit avait raison, un intercepteur ne rend rien
  inaltérable.
- **Un service applicatif qu'on appelle en même temps que l'écriture.** Même
  défaut, en pire : la trace dépend de la discipline de celui qui écrit, et le
  jour où elle manque, rien ne le signale.

**Ce qui reste hors de portée, et qui se dit.** Un déclencheur `FOR EACH ROW` ne
voit pas `TRUNCATE` : la commande vide la table sans passer par les lignes.
La borne est étroite et connue — `TRUNCATE` relève de la **propriété** de la
table, et `codiplan_app` n'est pas propriétaire ; seuls une migration et
`scripts/purge-demonstration.mts` peuvent l'exécuter, tous deux hors de tout
chemin applicatif. Un déclencheur `FOR EACH STATEMENT ON TRUNCATE` n'y changerait
rien d'utile : il ne verrait aucune ligne, donc ni valeurs avant, ni identifiant,
ni société, et ne pourrait écrire qu'une ligne sans société — précisément ce que
la voie retenue en section 3 refuse. Écrire la limite vaut mieux que la combler
par une ligne qui ne dirait rien.

`tests/isolation/journal-audit.test.ts` éprouve le déclencheur sur le chemin le
plus hostile : **toutes ses écritures sont en SQL brut**, hors de tout modèle
Prisma. Et son jumeau retire réellement le déclencheur — `DROP TRIGGER` dans une
transaction annulée — pour montrer que la ligne vient bien de lui.

---

## 2. L'ajout seul, et pourquoi PAS de `SECURITY DEFINER`

La forme classique d'un journal inaltérable est un déclencheur `SECURITY
DEFINER` appartenant au propriétaire : le rôle applicatif n'a alors **aucun**
droit sur la table, et seule la fonction, s'exécutant avec les droits de son
propriétaire, peut y écrire. D50 interdit ce mécanisme, sa liste d'exceptions
est **close et vide**, et le ticket L0-10 a explicitement refusé de l'ouvrir.

**La décision : `INSERT` accordé au rôle applicatif, `UPDATE` et `DELETE`
retirés, déclencheur en `SECURITY INVOKER`.**

Le raisonnement, et c'est lui qui rend la décision tenable : **ce contre quoi
nous protégeons est la RÉÉCRITURE de l'histoire, pas l'insertion d'une ligne.**
Une application compromise peut déjà mentir dans les tables métier — et le
journal enregistrera fidèlement son mensonge, ce qui est exactement ce qu'on lui
demande. Ce qu'elle ne doit pas pouvoir faire, c'est revenir effacer sa trace. La
propriété qui compte est l'ajout seul, et `INSERT` sans `UPDATE` ni `DELETE` la
donne.

**Ce qu'on perd, nommé plutôt que tu.** Le rôle applicatif peut insérer une ligne
d'audit qu'aucune écriture métier n'a causée. C'est un **ajout**, donc réversible
par la lecture — la ligne fabriquée se voit, et elle ne cache rien. Une
suppression, elle, ne se voit pas. L'asymétrie est le cœur de l'affaire.

**Deux verrous indépendants, pas un.**

| Verrou | Où il se lit | Ce qu'il fait |
|---|---|---|
| Privilèges | `information_schema.role_table_grants` | `codiplan_app` ne détient que `SELECT` et `INSERT` |
| Politiques | `pg_policies`, sous `FORCE ROW LEVEL SECURITY` | aucune politique `UPDATE` ni `DELETE` — leur absence vaut refus, propriétaire compris |

Le jumeau du §9 les retire **l'un après l'autre**, et c'est ce qui le rend
concluant : le privilège rendu, la politique mord encore (zéro ligne réécrite) ;
les deux retirés, la réécriture passe. Un jumeau qui les aurait retirés d'un coup
n'aurait prouvé que « quelque chose bloquait ».

**Le contrôle est PERMANENT, et il observe.** `scripts/controle-cloisonnement.mts`
relit les privilèges à chaque migration, dans `information_schema` et non dans
une déclaration — exactement comme pour `codiplan_reporting` (D38). Il y a une
raison de plus ici : `ALTER DEFAULT PRIVILEGES` (migration `20260820130000`)
accorde d'avance `UPDATE` et `DELETE` sur **toute table nouvelle**. Le droit
d'écriture n'est donc pas absent par nature — il est **retiré**. Ce qu'une
migration retire, une autre peut le rendre.

Le contrôle échoue aussi sur un privilège **manquant** : le déclencheur
s'exécutant en `SECURITY INVOKER`, un `INSERT` retiré ne dégraderait pas le
journal — il ferait échouer **toute écriture métier**.

---

## 3. La question NON tranchée : les référentiels de plateforme

*Point 4 du ticket. Elle est ici mesurée, pas décidée.*

Le journal enregistre des lignes de tables cloisonnées : il porte donc un
`societe_id` et relève de la première catégorie de I1. Mais `devise`, `parite` et
`jour_ferie` n'ont aucune société à porter. Trois voies, et leurs conséquences.

### Voie A — le journal ne couvre pas les référentiels de plateforme

`journal_audit.societe_id NOT NULL`, première catégorie de I1, aucune liste
touchée.

- **Conformité.** C'est la seule voie qui n'élargisse rien. Le périmètre de I8,
  unifié par D32, est « intervention, contrat, machine, paramétrage société,
  compte client » : ces trois tables n'y ont **jamais** figuré. Les couvrir
  serait un élargissement de périmètre décidé dans un ticket.
- **Cloisonnement.** La politique de L0-04 s'applique sans variante, et **aucune
  ligne ne peut être universellement lisible** — la branche `OR societe_id IS
  NULL` de la forme D4 est structurellement morte.
- **Gardien d'exhaustivité (D41).** Une seule catégorie, sans ambiguïté.
- **Ce qu'on ne trace pas.** Une correction éditeur sur `jour_ferie` — une date
  de férié rectifiée, un libellé — ne laisse aucune trace d'audit. Le trou est
  réel. Il est **antérieur à ce ticket** : il est celui de I8.
- **Et il a déjà une maison.** `journal_acces` enjambe les sociétés par
  construction (D34) et porte déjà les actes des rôles éditeur ; c'est là que
  L7-01 range le déblocage d'un `admin_societe`. Étendre son énumération
  `EvenementAcces` est un arbitrage — pas une décision de session, et pas ce
  ticket.
- **Tenue par la base, pas par une intention.** Le déclencheur **lève** sur une
  table qui n'expose aucune société, en la nommant. Poser le déclencheur sur
  `devise` ou `jour_ferie` casse la première écriture. Deux scénarios d'isolation
  le mesurent.

### Voie B — `societe_id` nullable

- **Elle n'est pas une voie séparée : elle débouche sur B ou C.** Le gardien
  d'exhaustivité de D41 ne reconnaît la première catégorie qu'à un `societe_id`
  **obligatoire** — « le `?` compte », dit son test. Une colonne nullable range
  `journal_audit` dans **zéro catégorie**, ce qui fait échouer la vérification
  jusqu'à ce qu'une liste close soit élargie ou qu'une catégorie soit créée.
- **Et surtout, c'est une brèche de lecture.** La forme imposée par D4 est
  `societe_id = app.societe_id OR societe_id IS NULL`. Une ligne d'audit à
  `societe_id` nul serait donc **lisible par toutes les sociétés** — dans la
  table même qui contient les valeurs avant/après de tout le métier. Il
  suffirait ensuite d'un déclencheur mal branché, ou d'une table ajoutée au
  périmètre sans `societe_id`, pour qu'une ligne métier y tombe. Le `NULL`
  deviendrait un laissez-passer.
- **Leçon du 23/08 (D48), appliquée telle quelle** : poser une contrainte sur une
  colonne nullable, c'est poser une contrainte facultative — et ici, la
  contrainte en question est le cloisonnement lui-même.

### Voie C — une cinquième catégorie de I1

- **Coût immédiat.** Une catégorie de plus, donc un arbitrage, donc une
  cinquième liste close à surveiller. La série D34–D42 a montré ce qu'il advient
  d'une liste close que personne ne re-vérifie.
- **Coût de fond, et il est plus grave.** La catégorie devrait dire **comment**
  le journal se cloisonne en lecture, puisque le point 6 du ticket l'exige. Or
  une cinquième catégorie « cloisonnée autrement » est exactement ce que D42 a
  refusé pour `CLOISONNEE_PAR_IDENTITE` : élargir la règle à « cloisonnée d'une
  manière ou d'une autre » ferait entrer sans décision la table suivante qui
  s'en réclamerait.
- **Le précédent va dans l'autre sens.** `journal_acces` a été rangé en
  troisième catégorie parce qu'il enjambe les sociétés **et ne porte aucune
  valeur métier** (D34). `journal_audit` porte précisément les valeurs métier :
  c'est ce qui interdit de le ranger là, et ce qui rend une catégorie « journaux »
  trompeuse — les deux tables n'ont ni le même contenu, ni le même régime de
  lecture.

### Recommandation : **la voie A**

Trois raisons, dans cet ordre.

1. **C'est la seule qui ne demande aucun arbitrage.** Elle ne touche aucune liste
   close et n'en crée pas. Les deux autres exigent une décision écrite, et le
   ticket a demandé qu'aucune ne se prenne en séance.
2. **C'est la seule conforme au périmètre déjà arbitré.** I8 et D32 disent ce qui
   est journalisé ; les référentiels de plateforme n'y sont pas.
3. **C'est la seule où le cloisonnement en lecture est structurel.** `NOT NULL`
   rend impossible la ligne lisible par tous, sans qu'aucune vigilance n'ait à
   s'exercer.

Le besoin réel — savoir qui a corrigé un férié — existe, il est nommé, et il est
**porté au registre** avec sa maison probable (`journal_acces`). Il n'est pas
construit ici.

*La voie A est celle qui est implémentée. Si l'arbitrage retient B ou C, la
migration à écrire est bornée : rendre la colonne nullable ou créer la
catégorie, adapter la politique de lecture, retirer le refus du déclencheur, et
ranger la table dans le gardien d'exhaustivité.*

---

## 4. Ce que la ligne enregistre, et l'usage qui l'a dessinée

Chapitre 11.2 : « société, entité, identifiant, action, utilisateur, horodatage,
valeurs avant et après, adresse IP ». La table les porte toutes.

L'usage réel, cité par le ticket, a dessiné l'index : **« qui a changé ce statut
d'intervention, et depuis quelle valeur »**. D'où
`(societe_id, entite, entite_id, horodatage)`, et d'où le stockage des lignes
**entières** en `jsonb` plutôt que des seules colonnes modifiées : la question se
pose champ par champ, longtemps après, sur des champs qu'on ne connaît pas
d'avance.

**L'auteur est nullable, et c'est délibéré.** Une écriture faite hors de toute
session — le seed, une migration, une correction manuelle — n'a pas d'auteur, et
le journal l'écrit `NULL` plutôt que d'inventer un compte (CLAUDE.md §8). La
ligne existe **quand même** : une écriture sans auteur reste une écriture, et la
taire serait pire que de l'attribuer à personne. `lib/db/rls.ts` pose
`app.utilisateur_id` et `app.adresse_ip` ; `lib/db/client.ts` les alimente depuis
le contexte de session, qui est le seul endroit du code où un utilisateur est
connu.

**Une écriture qui laisse la ligne identique n'écrit rien.** Ce n'est pas une
dispense accordée à un chemin d'écriture : « valeurs avant » et « valeurs après »
seraient les mêmes, et la ligne ne dirait rien. Le cas est réel — le seed est
idempotent et réécrit ses sociétés, ses agences et ses calendriers à chaque
exécution. *Ce point est le plus facile à renverser de tout le ticket : il tient
en une ligne du déclencheur, et l'arbitre qui préférerait tracer les écritures
sans effet n'a qu'à la retirer.*

**Mesuré sur le chemin réel du seed**, contre un PostgreSQL et non contre un
scénario fabriqué : un `pnpm db:seed` sur base vierge produit **47 lignes
d'audit** — 2 sociétés, 4 agences, 3 calendriers, 31 plages, 6 écarts de
calendrier, 1 compte portail —, toutes en `creation`. **Une seconde exécution du
seed en ajoute zéro** : le seed est idempotent, ses `upsert` laissent les lignes
identiques, et la règle ci-dessus tient sur le chemin qui l'a motivée.

**Aucune clé étrangère, ni sur `societe_id` ni sur `utilisateur_id`.** Le journal
doit **survivre à ce qu'il décrit**. Une clé vers `societe` rendrait la
suppression d'une société soit impossible, soit non journalisable : le
déclencheur `AFTER DELETE` écrirait une ligne désignant une société qui n'existe
plus, et la clé refuserait l'écriture même qu'elle est censée garantir.
L'intégrité vient d'ailleurs et elle suffit — la valeur est recopiée de la ligne
source, dont la clé étrangère était contrôlée au moment de l'écriture. À ne pas
confondre avec les colonnes informatives de `journal_acces` (D34) : celles-là
n'ont ni clé ni index parce qu'elles ne filtrent jamais ; `societe_id` ici
**filtre** — c'est la clé du cloisonnement —, elle est donc indexée, et seule la
clé étrangère est écartée.

---

## 5. Qui peut le lire

Deux politiques plutôt qu'une, parce que la lecture et l'ajout n'ont pas les
mêmes ayants droit.

- **`journal_audit_ajout` (INSERT)** : la société de la ligne, et rien de plus.
  Tout rôle peut *causer* une ligne d'audit, puisque tout rôle peut écrire dans
  les tables qu'il a le droit d'écrire. Exiger ici un rôle particulier rendrait
  le journal facultatif : l'écriture métier échouerait faute de pouvoir se
  journaliser, ce qui reviendrait à laisser le choix entre tracer et écrire.
- **`journal_audit_lecture` (SELECT)** : la société de la ligne **et** un rôle
  habilité. La matrice du §5.2 fait foi et n'accorde « Consulter le journal
  d'audit » qu'à `admin_societe` et `direction` ; `lib/auth/habilitations.ts` la
  transcrit déjà côté applicatif. `app_peut_consulter_journal_audit()` la dit une
  seconde fois — c'est la deuxième barrière du §12.2.

Le principe de D50 s'applique ici sans amendement : **une lecture d'audit
n'apprend rien d'une autre société**, et le refus du déclencheur sur une table
sans société est *lisible* sans être *informatif* — il nomme la table qu'on vient
d'écrire, jamais un décompte ni une société tierce. Un scénario d'isolation
l'éprouve en vérifiant que le message ne contient l'identifiant d'aucune société.

---

## 6. Comment les gardiens ont été éprouvés

Le §9 du CLAUDE.md exige qu'un gardien soit mis à l'épreuve d'une violation
**réellement écrite**, et qu'un gardien lisant du SQL le soit sur les six formes
équivalentes. Mesures consignées.

| Gardien | Violation réellement écrite | Verdict |
|---|---|---|
| `tests/unit/db/perimetre-audit.test.ts` | le déclencheur d'`utilisateur_client` retiré de la vraie migration | **rouge**, en nommant `utilisateur_client` |
| `tests/isolation/journal-audit.test.ts` (ajout seul) | le `REVOKE UPDATE, DELETE, TRUNCATE` retiré de la vraie migration | **rouge** sur deux scénarios — les privilèges observés, et l'écriture qui passe |
| `tests/isolation/journal-audit.test.ts` (périmètre) | le refus « table sans société » retiré du corps du déclencheur | **rouge** sur les deux scénarios de périmètre |

Les six formes, pour `tablesDeclenchees` — le seul gardien de ce ticket qui
inspecte du SQL :

1. **Graphie** — casse, guillemets, retour à la ligne, nom qualifié
   (`"public"."intervention"`) : **vues**, trois graphies éprouvées.
2. **Enveloppe d'exécution** — `CREATE TRIGGER` à l'intérieur d'un `DO $$ …
   EXECUTE '…' $$` : **vue**. Les chaînes littérales restent dans le périmètre
   examiné.
3. **Deux temps** — `DROP TRIGGER` postérieur, et `ALTER TABLE … DISABLE TRIGGER`
   sous ses trois formes (`"journal_audit"`, `ALL`, `USER`) : **vus**. C'est
   l'état final qui compte, pas le verbe qui l'installe, et les migrations sont
   lues dans l'ordre du temps.
4. **L'exemption** — la coupure « documentation contre exécution » penche ici
   dans l'autre sens que celle de D50 : ce gardien risque d'être trop
   **permissif**, une pose citée en commentaire lui ferait croire à une
   couverture inexistante. Les commentaires `--` sont donc retirés, et le cas est
   éprouvé.
5. **La forme voisine** — la faute telle qu'elle se commettra : le ticket L2-07
   crée `intervention` et personne ne pense au journal. Éprouvée contre la
   **vraie** liste des déclencheurs.
6. **Hors de portée, et le gardien le dit** — un nom de table assemblé à
   l'exécution (`EXECUTE format('… ON %I', cible)`) n'est pas vu. Un gardien
   statique arrête la correction bien intentionnée, pas le contournement décidé.

---

## 7. Hors périmètre, porté au registre

**La politique de conservation.** Un journal grossit sans fin, et la question —
combien de temps, et qu'en fait-on ensuite — est réglementaire autant que
technique. Le §15 du cahier des charges avance « conservé 5 ans », mais il est
narratif et donc non normatif (D1) : le chiffre attend d'être ratifié.

Et la question a une conséquence technique que ce ticket vient de créer, et qu'il
vaut mieux nommer maintenant : **purger suppose de supprimer, c'est-à-dire
exactement la clé que l'ajout seul retire.** Il n'existe aujourd'hui aucun rôle
capable d'effacer une ligne du journal — ni `codiplan_app` (privilèges retirés),
ni le propriétaire (aucune politique `DELETE` sous `FORCE ROW LEVEL SECURITY`).
Une politique de conservation devra donc décider **qui** purge et **par quel
chemin**, et ce chemin sera par construction une brèche dans la propriété qu'on
vient d'établir. C'est une décision d'architecture, pas un `cron`.

**`utilisateur_societe`.** L'habilitation d'un compte sur une société est
manifestement sensible — et c'est précisément pourquoi la ranger sans décision
serait une faute. I8 dit « compte client » ; la matrice du §5.2 distingue
« Paramétrer une société » d'« Administrer les utilisateurs ». La table n'est
donc **pas** couverte, et le gardien `perimetre-audit` échoue si quelqu'un l'y
ajoute en séance.
