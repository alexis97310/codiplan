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
