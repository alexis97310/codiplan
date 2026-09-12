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

---

## Q7 — Les quatre origines d'une information de VGP : la liste est-elle la bonne ? — **TRANCHÉE le 13/09/2026**

> **RÉPONSE : issue 1 — les quatre valeurs restent telles quelles, et l'axe qui les
> ordonne (la valeur probante le jour d'un contrôle) est ratifié.** Inscrite sous **D114**
> dans `docs/arbitrages.md`, section « LES QUATRE VALEURS SONT RATIFIÉES ». *Une liste
> proposée puis approuvée n'est plus une proposition : le prochain lecteur doit pouvoir
> le savoir sans relire ce recueil.* Gardée dans les deux sens par
> `tests/unit/docs/origines-vgp-ratifiees.test.ts` — le schéma et l'arbitrage ne peuvent
> plus diverger en silence.


*D114 demande expressément que la session **propose** cette liste plutôt que de la
figer : c'est du vocabulaire d'exploitation, et le §1 du protocole vous le réserve. La
table est construite avec la colonne ; **les valeurs se complètent par une migration qui
ne coûte rien** — `ALTER TYPE … ADD VALUE`.*

### La question

Quand quelqu'un enregistre qu'une machine a été vérifiée, il doit dire **d'où il le
tient**. Quelles réponses lui propose-t-on ?

### Ce que j'ai construit, et ce qui l'a guidé

L'axe retenu est **la valeur probante le jour d'un contrôle** — c'est le motif exact de
D114 —, et les quatre valeurs sont rangées de la plus forte à la plus faible :

| Valeur | Ce qu'elle dit | Ce qu'elle ne dit pas |
|---|---|---|
| `rapport_organisme` | nous tenons la pièce, **et de sa source** | — |
| `rapport_transmis_client` | la pièce est là ; **sa chaîne de transmission ne l'est pas** | qu'elle est complète, ni à jour |
| `vignette_constatee` | une vérification a eu lieu, **à cette date** | ce qu'elle a conclu |
| `declaration_client` | quelqu'un nous l'a dit | tout le reste |

*La distinction entre les deux premières est celle qui m'a demandé le plus de réflexion.
Elle tient parce que D88 dit que **les VGP sont commandées par les clients** : le cas
ordinaire est donc que le client ait la pièce et nous la transmette, et le cas où
l'organisme nous écrit directement est l'exception — les confondre effacerait justement
ce qui distingue CODIMA d'un tiers dans la chaîne.*

### Ce que je n'ai PAS mis, et pourquoi

- **`inconnue`.** Il faudrait alors décider ce qu'elle vaut, et *une origine inconnue
  enregistrée comme une origine est exactement ce que la colonne existe pour empêcher.*
  Une ligne dont on ne sait pas d'où elle vient **ne devrait pas s'écrire**.
- **`observation_technicien`.** Un technicien qui constate une vignette relève déjà
  `vignette_constatee` ; s'il constate autre chose, ce n'est plus une VGP.
- **Une échelle numérique de fiabilité.** Elle inviterait à comparer, donc à calculer —
  et *CODIPLAN n'affirme jamais la conformité.*

### Les issues possibles

1. **Garder les quatre.** Coût : nul. *C'est celle que je recommande, et elle est déjà
   en base.*
2. **En ajouter.** Coût : une migration d'une ligne. Dites simplement le mot et la
   nuance qu'il porte.
3. **En retirer une.** Coût : plus élevé qu'il n'y paraît — retirer une valeur d'une
   énumération PostgreSQL demande de réécrire le type. À faire **avant** la première
   ligne réelle, donc.

### En attendant

**Bloqué** : rien. **Continue** : tout — L9-08, L9-09 et L9-10 sont livrés.

---

## Q8 — PAR QUEL CANAL un lien de premier accès parvient-il à une personne ?

*Écrite le 12/09/2026 au soir. **Non tranchée** : un canal d'envoi demande un service externe et une clé, donc l'accord d'Alexis (§8 du CLAUDE.md — service externe payant ; et « tu ne poses jamais de secret », qui est la règle de cette file).*

### CE QUI LA REND URGENTE, ET C'EST MESURÉ

**Alexis ne peut plus entrer dans sa propre application.** La purge du 12/09 au soir a effacé les comptes ; le semis les recrée avec `mot_de_passe NULL`, ce qui est l'état voulu — *le semis ne pose aucun mot de passe, la base étant en ligne et le dépôt public.* **La seule porte est donc le lien de premier accès**, et ce lien n'a aujourd'hui **aucun canal** :

| | |
|---|---|
| il sortait d'un **journal d'exécution** GitHub Actions | le dépôt est **public** depuis le 12/09 — un lien de premier accès y est un matériau d'authentification lisible par tout le monde |
| il sort d'une **console locale** | Alexis travaille depuis un téléphone ; il n'a ni terminal ni accès à la base |
| il sortirait d'un **courriel** | **aucun expéditeur n'est configuré**, et en poser un est un geste hors du dépôt qui demande une clé |

*Mesuré ce soir : `scripts/amorcage-premier-compte.mts --reemettre` imprime bien l'URL, et il l'imprime là où personne ne peut la lire depuis un téléphone.*

### CE QUE LE DÉPÔT A DÉJÀ TRANCHÉ, ET QU'IL NE FAUT PAS REDÉCIDER

**D96 (ticket L2-13) a écarté l'envoi pour le PORTAIL**, avec sa raison : *« une fonction d'envoi sans expéditeur est pire qu'une interface sans appelant — elle en a un, et elle échoue en production, à l'instant où une agence croit avoir invité un client. »* En V1, le lien est **engendré dans le back-office** et l'agence le transmet par ses propres moyens.

**La question posée ici n'est pas celle-là.** L2-13 traite du client ; celle-ci traite de **l'exploitant lui-même**, qui n'a aucun back-office ouvert tant qu'il n'est pas entré. *C'est un problème d'amorçage, pas d'invitation* — et il se pose à chaque base neuve.

### TROIS ISSUES, AVEC CE QU'ELLES COÛTENT ET CE QU'ELLES INTERDISENT

| | Ce que c'est | Ce que ça coûte | Ce que ça interdit |
|---|---|---|---|
| **1** | **Un écran d'amorçage sans compte**, atteignable une seule fois sur une base neuve — comme `/premier-acces`, mais qui ENGENDRE le lien au lieu de le consommer | aucun service externe, aucune clé. **Mais c'est une porte ouverte sur une base publique** : il faut un cliquet en base (un fait, pas un drapeau) et il faut décider ce qui le referme | rien, et c'est le problème : une porte qu'on peut rouvrir par erreur est une porte |
| **2** | **Un envoi par courriel** — le §2 du CLAUDE.md nomme **Resend** | une clé à poser dans les secrets de l'hébergeur, et un domaine d'expédition. *Le §2 l'a déjà choisi : ce n'est pas une dépendance nouvelle, c'est une dépendance qu'on active* | rien de structurel ; le lien devient traçable et transmis à une adresse plutôt qu'à qui le lit |
| **3** | **Le flux d'exploitation imprime le lien dans un canal PRIVÉ** — résumé d'exécution d'un dépôt privé, ou variable de sortie chiffrée | rien à construire, mais **le dépôt est public** : il faudrait un second dépôt privé ou un canal hors GitHub. *C'est déplacer le problème, pas le résoudre* | rien, et c'est un vestige du monde d'avant le 12/09 |

### CE QUE JE N'AI PAS FAIT, ET POURQUOI

**Je n'ai posé aucun mot de passe dans le semis** — la consigne le dit, et le motif tient tout seul : la base est en ligne et le dépôt public. **Je n'ai choisi aucun service et écrit aucun secret.** *Un canal d'envoi est une décision d'exploitation avec une clé au bout ; ce n'est pas une décision de session.*

**Ce qui marche ce soir, et qui n'est pas une réponse :** si Alexis peut atteindre un terminal, `pnpm exec tsx scripts/amorcage-premier-compte.mts --reemettre --societe <uuid> --email <courriel>` imprime le lien. *C'est exactement le geste que cette question cherche à supprimer.*

---

## Q9 — Le lien d'invitation au portail : qui a le droit de LIRE la trace qu'il laisse ?

*Écrite le 13/09/2026, en ouvrant L2-13. **Non tranchée** : elle touche le cloisonnement
(§8 du `CLAUDE.md`) et la porte d'entrée du portail, c'est-à-dire ce qu'un client voit
(§1 de la doctrine d'arbitrage).*

### La question

Quand une agence invite un client, la trace de cette invitation — **qui a invité qui, et
quand** — doit pouvoir être relue par l'agence. Aujourd'hui, le rangement que D96 donne à
cette table l'en empêche. Faut-il la ranger autrement ?

### Ce que j'ai mesuré

**D96 tranche déjà la moitié qui compte, et je ne la rouvre pas.** Il écrit, mot pour
mot : *« Un lien d'invitation est un matériau d'authentification : il se range comme tel
**(I1, troisième catégorie)** »*. La troisième catégorie de I1, c'est **aucune colonne
`societe_id`** et la forme de politique dite « désignation » : *on ne lit que la ligne
qu'on nommait déjà*, c'est-à-dire, pour une invitation, **en présentant son jeton**.

**Et le même D96 exige quatre garanties, dont la quatrième est « tracé — qui a invité qui,
quand ».** Les deux ne peuvent pas être vraies ensemble :

> **L'agence ne possède pas le jeton.** Il est montré une fois, il est à usage unique, et
> il n'est pas relisible — c'est ce qui en fait un matériau d'authentification. Sous la
> forme « désignation », **personne au back-office ne peut donc relire une seule ligne de
> cette table**, pas même celles qu'il vient d'écrire.

*Une trace que personne ne peut lire n'est pas une trace.* Et l'autre voie habituelle est
fermée aussi : le journal d'audit (I8) ne couvre que les tables métier **de la première
catégorie**, dont celle-ci ne fait justement pas partie.

**J'ai cherché une troisième voie et je n'en ai pas trouvé qui tienne** — je le dis plutôt
que d'affirmer qu'il n'y en a pas. Faire poser le contexte de société par un jeton
présenté par un inconnu contredirait une règle écrite : *« la valeur d'une désignation est
dérivée d'un contexte authentifié, jamais reçue d'un appelant »* (L1-02e). Et une fonction
qui verrait par-dessus les politiques est refusée par un gardien statique dont la liste
d'exceptions est close **et vide**.

### Les issues possibles

| | Ce que c'est | Ce que ça coûte | Ce que ça interdit |
|---|---|---|---|
| **1** | **Garder le rangement de D96 tel quel** — troisième catégorie, forme « désignation » pure | rien à construire de plus | **la quatrième garantie de D96 devient inapplicable** : l'agence n'a aucun écran où voir qui elle a invité, ni révoquer un lien qu'elle ne retrouve pas. *Une promesse écrite et silencieusement intenable est ce que ce dépôt refuse le plus constamment.* |
| **2** | **Une table métier cloisonnée** (première catégorie, forme « interne » — société **et** aucun compte de portail), **plus** une lecture par jeton pour la seule consommation | **une QUATORZIÈME forme de politique**, avec sa liste close, ses gardiens et son jumeau — une demi-journée. C'est un arbitrage de cloisonnement, pas un ticket | rien. Les quatre garanties de D96 tiennent toutes : l'agence lit et révoque ses invitations, l'invité consomme la sienne sans société, et **aucun compte de portail ne lit cette table** |
| **3** | **Deux tables** : la donnée métier d'un côté, le jeton dans la table de vérification qui existe déjà | en apparence rien de neuf | *le lien entre les deux devrait lui-même être lu avant qu'une société soit connue* — le problème est déplacé, pas résolu. Et ce serait **deux écritures d'un même fait** |

**Je recommande l'issue 2**, pour une raison qui n'est pas le confort : c'est la seule où
les quatre garanties que D96 a écrites sont réellement tenues par la base. *Son coût est
visible — une forme de plus, gardée comme les treize autres ; celui de l'issue 1 ne l'est
pas, et c'est ce qui le rend cher.*

### En attendant

**Bloqué** : L2-13 tout entier — la table, l'écran d'invitation, la consommation du lien,
et donc **l'entrée des clients au portail**. Le marqueur de file est passé à `BLOQUÉ` avec
ce motif, et non laissé à `LIBRE` : *un ticket dont l'état ment est pire qu'un ticket
bloqué.*

**Continue** : tout le reste. Le portail LIT déjà correctement — D92 a fermé cette
moitié-là, et `/portail` existe depuis L2-12. Ce qui manque est la porte, pas la pièce.
