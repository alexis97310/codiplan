# Questions pour Alexis — file de nuit du 12/09/2026

*Ouvert le 12/09/2026 par la session de nuit. Chaque question suit la forme du §5 du
protocole de session : la question, ce qui a été mesuré, les issues avec leur coût, ce
qui est bloqué et ce qui continue.*

*Ce fichier n'est pas le canal officiel : le §5 du protocole veut un ticket portant
l'étiquette `arbitrage`. Le §9 du `CLAUDE.md` porte la mesure du 12/09/2026 qui dit
pourquoi ce canal-là est clos — `gh` répond « the 'alexis97310/codiplan' repository has
disabled issues ». **Je n'ai pas refait cette mesure moi-même** ; je la cite. La
consigne de nuit nomme ce fichier, et c'est ici que les trois questions sont posées.*

---

## Q1 — Le pourcentage de charge sous le nom du technicien : lequel, quand il y en a deux ?

### La question

Vous voulez voir le taux de charge d'un technicien sous son nom, dans la colonne de
gauche du planning. Cette colonne a **une ligne par personne**. Or le taux se calcule
par **couple (personne, établissement)** : une personne qui travaille pour deux
établissements a deux taux, et la ligne n'en montre qu'un.

### Ce que j'ai mesuré

`lib/interventions/occupation.ts` rend un taux dont le dénominateur vient du
**calendrier de l'agence** — c'est I7, et c'est ce qui donne la maille
`(technicien, agence)`. Le type porte les deux termes ensemble et refuse de laisser un
pourcentage voyager seul (D56).

`lib/calendar/technicien.ts` dit qu'un technicien a **une** agence de rattachement
(`technicien.agence_id`, `L3-01a`) : aujourd'hui, une personne n'a donc **jamais deux
taux**. Le cas à deux agences n'est pas possible en base au 12/09/2026.

### Les issues possibles

1. **Le taux de son agence de rattachement, et rien d'autre.** Coût : nul aujourd'hui,
   puisqu'il n'y en a qu'une. Le jour où une personne travaillera pour deux agences,
   l'écran montrera un taux qui ne dit pas lequel — le défaut que D56 a nommé.
2. **Le taux de son agence, avec le nom de l'agence à côté du chiffre.** Coût : deux
   mots de plus dans une colonne déjà étroite. Bénéfice : le chiffre ne peut plus être
   lu de travers le jour où la seconde agence arrive. *C'est celle que je recommande —
   c'est exactement la règle de D56, « un nombre dont la signification dépend d'une
   autre colonne ne voyage jamais seul ».*
3. **Une ligne par couple (personne, agence).** Coût : la colonne cesse d'avoir une
   ligne par personne, et la grille du planning change d'axe — ce n'est plus un
   réglage d'affichage, c'est L2-08b.

### En attendant

**Bloqué** : l'affichage du pourcentage sous le nom. **Continue** : tout le reste du
planning ; le calcul du taux existe déjà et il est gardé.

---

## Q2 — Un technicien peut-il être posé sur une intervention d'une autre agence que la sienne ?

### La question

Une intervention est rattachée à un établissement ; un technicien aussi. Aujourd'hui
rien n'empêche de poser le technicien de Ducos sur une intervention de Koné. Est-ce une
situation à refuser, ou une situation normale qu'il ne faut surtout pas refuser ?

### Ce que j'ai mesuré

Sur une base **de démonstration** fraîchement migrée et semée le 12/09/2026
(`pnpm db:deploy` puis `pnpm db:seed`), la requête

```sql
SELECT count(*) FROM intervention WHERE technicien_id IS NOT NULL;            -- 26
SELECT count(*) FROM intervention i JOIN technicien t ON t.id = i.technicien_id
  WHERE i.agence_id <> t.agence_id;                                           --  0
```

rend **26 interventions affectées et 0 hors agence**, sur 32 interventions au total :
le cas est **possible** et ne se produit pas. Aucun contrôle de pose ne le regarde —
`lib/interventions/pose.ts` vérifie le calendrier de l'agence visée, le chevauchement,
l'habilitation et l'absence, et rien d'autre. *Ce sont les données de `prisma/seed.ts`,
jamais celles de la base hébergée (I9).*

### Les issues possibles

1. **Ne rien faire.** Coût : nul. Le jour où un dépannage inter-agence sera nécessaire,
   il passera sans discussion.
2. **Refuser.** Coût : un renfort entre Ducos et Koné devient impossible, et la règle
   de majoration de D12 — qui lit le calendrier de l'agence **du technicien**, pas de
   l'intervention — n'aurait plus d'objet.
3. **Avertir sans refuser.** Coût : un avertissement de plus dans un écran qui en porte
   déjà ; et un avertissement qu'on voit 0 fois sur 26 est un avertissement qu'on
   apprend à ne plus lire (§9 du CLAUDE.md, 11/09).

**Aucun refus n'a été ajouté** : la consigne de nuit le demandait explicitement, et la
mesure lui donne raison.

### En attendant

**Bloqué** : rien. **Continue** : tout.

---

## Q3 — La forme du catalogue des prestations

### La question

D109 dit la **règle** — une prestation porte une durée, jamais un taux ; un prix fixe
désigne un forfait. Elle ne dit pas la **forme** : quelles colonnes, et surtout comment
une prestation désigne son forfait.

### Ce que j'ai mesuré

Le §7 du cahier des charges énumère « code, libellé, durée standard, ~~taux
applicable~~, famille concernée, checklist type » — et c'est du **narratif**, donc non
normatif (§1 du CLAUDE.md). Le **chapitre 10 est muet** sur les prestations : aucune
règle `RG-PRE-*` n'existe. Le chapitre 11 ne porte aucune table `prestation`.

D109 tranche en outre deux choses qui, elles, ne se rediscutent pas : le catalogue est
une **table métier cloisonnée** (`societe_id NOT NULL`), et il s'**amorce par copie**
d'un modèle à la création d'une société.

### Les issues possibles

1. **`prestation` avec `forfait_id` nullable.** Une prestation qui se vend à prix fixe
   pointe son forfait ; les autres se facturent au temps. Coût : une clé étrangère de
   plus, et la question « que se passe-t-il si le forfait pointé ne s'applique pas à la
   zone de l'intervention ? » — les trois axes de RG-TAR-06 peuvent le disqualifier.
2. **Aucun lien : le forfait se choisit à l'intervention, par ses trois axes.** La
   prestation ne porte que durée, checklist, famille, type. Coût : rien ne dit qu'une
   prestation « se vend à prix fixe » ; le pont de D109 reste une phrase et non une
   colonne. *C'est la plus petite table, et celle qui n'invente rien.*
3. **`prestation` porte le TYPE d'intervention, et c'est lui que le forfait
   conditionne.** Le troisième axe de RG-TAR-06 est aujourd'hui **inerte** — les types
   d'intervention n'existent nulle part (`lib/tarification/forfaits.ts` l'écrit). Coût :
   il faut d'abord décider les types d'intervention, ce qui est un arbitrage à part.

### En attendant

**Bloqué** : L1-12, la table `prestation`. **Continue** : tout le reste. Le §7 du cahier
des charges a été corrigé le 12/09/2026 pour que la table ne naisse pas avec un second
endroit où un prix s'écrit — c'était l'urgence, et elle est levée.

---

## Q4 — Sous quelle forme CODIPLAN enregistre-t-il « ce qu'on nous a dit » d'une vérification ?

### La question

Le registre des VGP existe et il est honnête : il affiche « sans information depuis X »
pour chaque machine soumise. Il l'affichera **pour toujours**, parce que rien dans le
produit ne permet aujourd'hui d'enregistrer qu'un organisme nous a dit quelque chose, ni
à quelle date. Sous quelle forme veut-on l'enregistrer ?

### Ce que j'ai mesuré

- `document` porte une **classe** (`client` / `interne`) et une **cible** (le modèle ou
  la machine). **Elle ne porte aucune NATURE** : rien n'y distingue un rapport de
  vérification d'une notice constructeur.
- **Aucune table du dépôt ne porte de date de vérification.** `date_document` existe sur
  `document` depuis L8-06, nullable et lue par personne.
- `lib/vgp/registre.ts` écrit donc `derniereInformation: null` pour **toutes** les
  machines, et l'écran le dit en toutes lettres.

**Trois tickets butent sur ce seul fait, et pas seulement celui qu'on croit.**

| Ticket | Ce qu'il promet | Pourquoi il ne peut pas |
|---|---|---|
| L9-08 | une campagne datée avec **un compteur qui descend** | rien ne peut faire descendre le compteur — *un compteur figé est pire qu'une alerte de trop : il a l'air de mesurer* |
| L9-09 | un compte portail retrouve **les rapports** de ses machines | rien ne dit quels documents sont des rapports |
| L9-10 | un rapport **avec observations** engendre des interventions | rien ne porte d'observation |

### Pourquoi je ne tranche pas

Le §1 du protocole réserve à vous ce qui touche **une obligation légale**, et il nomme
les VGP. La forme de cet enregistrement décide de ce que CODIMA pourra produire le jour
où un contrôle le lui demandera — ce n'est pas une question de schéma.

### Les issues possibles

1. **Une NATURE sur `document`, et rien d'autre.** Un rapport est un document de nature
   `rapport_vgp`, de classe `client`, accroché à la machine ; `date_document` porte la
   date de la vérification. Coût : une colonne, une énumération de plus. *Ce qu'on
   perd* : pas de place pour l'**organisme**, pas de place pour les **observations** de
   L9-10, et donc L9-10 reste bloqué.
2. **Une table `vgp_verification`** : machine, date, organisme, référence du rapport, et
   un lien facultatif vers le `document` qui en porte les octets. Coût : une table, une
   migration, un écran de saisie. *Ce qu'on gagne* : L9-08, L9-09 et L9-10 se
   débloquent ensemble, et l'organisme est nommé — ce qui compte le jour d'un contrôle.
   *C'est celle que je recommande.*
3. **Attendre la saisie du technicien (L9-11).** *« C'est ce qui remplira le registre, et
   rien d'autre ne le remplira »*, dit D88 §11. Coût : le registre reste vide jusqu'au
   lot 3, qui est lui-même bloqué par la file de synchronisation. **Le registre resterait
   donc vide plusieurs lots**, et c'est lui qui rend le service vendable.

### Une question qui vient avec

**Que veut dire « l'organisme nous l'a dit » ?** Un rapport reçu par courriel, une
vignette photographiée par un technicien et une déclaration orale du client n'ont pas la
même valeur le jour d'un contrôle. Faut-il enregistrer **d'où vient l'information** ? *Je
ne l'invente pas* — mais si la réponse est oui, elle change la forme de l'issue 2, et il
vaut mieux le savoir avant la migration qu'après.

### En attendant

**Bloqué** : L9-08, L9-09, L9-10 — marqués comme tels, avec cette mesure.
**Continue** : le registre lui-même est livré et il dit vrai ; L9-01 à L9-07 sont faits.

## Q5 — Les interventions DÉJÀ clôturées : à facturer, ou déjà facturées ?

### La question

Le second axe de l'intervention existe maintenant : à la clôture, elle devient « à
facturer », ou « non facturable » si c'est de la garantie ou du recensement. **Les
interventions clôturées AVANT aujourd'hui n'ont pas cette information**, et il n'existe
aucun moyen de savoir lesquelles ont déjà été facturées.

### Ce que j'ai mesuré

- D8 dit la règle **à l'entrée en clôture**, et **ne dit rien** des interventions déjà
  closes. Le déclencheur `intervention_facturation_a_la_cloture` la pose désormais, et
  un scénario d'isolation le prouve — y compris son jumeau.
- **La colonne qui dirait lesquelles ont été facturées n'existe pas.** Le chapitre 11
  prévoit `reference_facture` et `date_facture`, *« renseignés par import du retour de
  facturation »* ; ni l'une ni l'autre n'est au schéma :
  `ERROR: column "reference_facture" does not exist`.
- Sur la base de **démonstration** : **2 interventions clôturées, 2 sans réponse, 0 de
  type exempté**. Sur la base hébergée, je n'ai pas mesuré — une session ne la touche
  pas.

### Pourquoi je ne tranche pas

**Les deux réponses possibles décident de l'argent, dans les deux sens.** « À facturer »
sur une intervention déjà facturée **la refacture** ; « facturée » sur une intervention
qui ne l'a pas été **y renonce**. Le §1 du protocole vous réserve l'argent facturé à un
client, et c'est exactement ce dont il s'agit.

La contrainte *« une clôture porte une réponse »* est donc posée **`NOT VALID`** (D104) :
elle vaut pour toute clôture nouvelle, et ne relit pas les anciennes. **L'état non validé
est visible** — `scripts/lib/contraintes-non-validees.ts`, lu chaque nuit par
`pnpm veille`. C'est la **troisième** entrée de cette liste, et la note d'origine
prévoyait qu'à **quatre** la question ne serait plus « laquelle ajouter » mais « pourquoi
aucune n'a été rattrapée ». *Nous en sommes à trois.*

### Les issues possibles

1. **Les traiter une par une, à la main.** Deux lignes sur la démonstration ; le nombre
   sur la base réelle se lit en une requête. Coût : quelques minutes si le nombre est
   petit. *C'est celle que je recommande tant que le nombre est petit — et il faut le
   lire avant de choisir.*
2. **Tout marquer « non facturable ».** Coût : on renonce à facturer ce qui ne l'aurait
   pas été. Sans risque de double facturation, mais avec une perte possible.
3. **Attendre le retour de facturation** (`reference_facture`, chapitre 11, module M11).
   Alors la reprise devient mécanique : facturée si la référence existe, à facturer
   sinon. Coût : la contrainte reste non validée jusque-là, et la liste des `NOT VALID`
   garde trois entrées au lieu de deux.

### En attendant

**Bloqué** : rien. Le second axe fonctionne pour toute clôture à partir d'aujourd'hui.
**Continue** : tout. Ce qui attend est le **rattrapage** des clôtures antérieures.

---

*Les cinq questions ci-dessus ont reçu leur réponse le 12/09/2026 au soir — D111 à D115
au recueil. Ce qui suit est né de leur APPLICATION.*

---

## Q6 — D111 et D112 se contredisent le premier jour d'un renfort

### La question

Vous avez tranché deux choses le même soir. **D111** : sous le nom du technicien, le taux
seul, *« parce qu'il n'a qu'une agence, donc jamais deux taux »*. **D112** : un technicien
de Ducos peut être posé sur une intervention de Koné.

**Le jour où quelqu'un fait un renfort, il a deux taux.** Pas parce qu'il est rattaché à
deux agences — il ne l'est pas —, mais parce que le taux se calcule sur le calendrier de
l'agence **où le travail a lieu**.

### Ce que j'ai mesuré

`occupationsDuPlanning` rend une ligne par **(technicien, agence de l'intervention)**, et
non par personne. La condition de réouverture de D111 vise `technicien.agence_id`, qui
est bien une colonne simple et obligatoire — **et ce n'est pas la maille du taux**.

*Le cas ne se produit pas aujourd'hui : 26 interventions affectées, 0 hors agence. Mais
D112 vient précisément de l'autoriser.*

### Ce que j'ai fait en attendant, et pourquoi

**L'écran mesure la condition au lieu de la supposer.** Une seule ligne de charge → le
taux seul, D111 dans sa lettre. Plusieurs → **chacune nomme son agence**, ce que D111
prescrit lui-même « pour ce jour-là ». *Aucune des deux décisions n'est réduite, et
l'écran ne peut plus mentir.* Un gardien tient la condition sur la forme du schéma.

### Les issues possibles

1. **Ne rien changer.** La contradiction est fermée par le code, et les deux décisions
   restent lisibles telles quelles. Coût : la condition de réouverture de D111 reste
   écrite sur la mauvaise chose, et le prochain lecteur la croira.
2. **Réécrire la condition de réouverture de D111** pour qu'elle vise la maille du taux
   plutôt que la colonne. Coût : deux lignes. *C'est celle que je recommande* — et elle
   rend la décision vraie sans rien changer au produit.
3. **Trancher ce qu'un renfort doit montrer** : deux taux nommés, ou un seul agrégé ?
   Coût : l'agrégat demande de décider quel dénominateur — additionner deux calendriers
   d'agences différentes est une règle que personne n'a écrite.

### En attendant

**Bloqué** : rien. **Continue** : tout ; l'affichage est correct dans les deux cas.
