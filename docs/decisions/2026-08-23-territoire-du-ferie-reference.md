# Le territoire d'un jour férié référencé — un chaînage de clés, et une colonne qui devient obligatoire

*23 août 2026 — ticket L0-09a, arbitrage D48.*

## Contexte

Le module calendrier de L0-08 a laissé un trou, trouvé et **constaté en base** à
la livraison, inscrit au registre « Ce qui reste à décider » sans être tranché :
une agence de territoire `NC` pouvait écrire dans `calendrier_ferie` une ligne
dont le `jour_ferie_id` désignait un férié `FR` tombant le même jour — le
1ᵉʳ novembre, par exemple. La clé étrangère composite `(jour_ferie_id, date)`
posée en L0-08 empêche les **dates** de diverger ; elle ne dit rien des
**territoires**.

La portée réelle était faible : `appliquerEcarts` compose par date et tire le
libellé du fait public du bon territoire, si bien que le planning restait juste.
C'est `jour_ferie_id` qui cessait d'être fiable comme « le fait public que cet
écart surcharge » — une colonne dont la valeur ne veut pas dire ce que son nom
annonce. Deux options avaient été soumises : fermer en base par chaînage de
clés, ou n'en faire qu'un contrôle applicatif. La question touchant le schéma et
la forme de I1, elle ne se tranchait pas en séance.

## Options écartées

**Le contrôle applicatif.** Un `zod.refine` ou une vérification dans le service
d'écriture aurait suffi *aujourd'hui*, où un seul chemin écrit dans cette table.
Il y en aura d'autres : l'import Excel du lot 1, la synchronisation hors ligne
du lot 2, la console éditeur du lot 7. Un contrôle applicatif protège les
chemins qu'on connaît ; une contrainte de base protège aussi ceux qu'on écrira
dans trois ans sans avoir relu D46. Le dépôt a déjà fait ce choix pour les
dates, un mois plus tôt, et il n'y a aucune raison de le refaire à l'envers pour
les territoires.

**Laisser `agence.territoire` nullable et poser le chaînage quand même.** C'est
l'option qui avait l'air la moins coûteuse, et c'est la pire : une clé étrangère
dont une colonne vaut NULL n'est **pas contrôlée** en PostgreSQL — c'est
`MATCH SIMPLE`, la règle par défaut. Le verrou aurait été muet exactement là où
la donnée manque, c'est-à-dire chez l'agence la moins bien paramétrée. Un verrou
qui s'ouvre tout seul sur les cas mal renseignés est pire qu'une absence de
verrou : il donne le sentiment d'une garantie.

**Dénormaliser autrement** — porter `territoire` sur `jour_ferie` seulement et
comparer par jointure dans un `CHECK`. PostgreSQL n'accepte pas de sous-requête
dans une contrainte `CHECK` ; il aurait fallu un trigger, c'est-à-dire du code à
maintenir là où deux clés déclaratives suffisent.

## Décision

**Le chaînage de clés composites.** `calendrier_ferie` porte une colonne
`territoire`, et deux clés étrangères la tiennent des deux côtés à la fois :

| Clé | Cible | Contrôlée quand |
|---|---|---|
| `(agence_id, territoire)` | `agence(id, territoire)` | **toujours** — aucune colonne nullable |
| `(jour_ferie_id, date, territoire)` | `jour_ferie(id, date, territoire)` | dès que `jour_ferie_id` est renseigné |

L'agence fixe le territoire de l'écart ; le fait public doit s'y conformer. Les
deux ne peuvent pas être satisfaites en même temps par un férié d'ailleurs :
faire concorder l'écart avec le fait public le fait diverger de son agence.

**`agence.territoire` devient `NOT NULL`.** C'est la conséquence à assumer, et
c'est le cœur du ticket. La migration **refuse de s'appliquer** si une ligne
existante est vide, en nommant l'agence et sa société, plutôt que d'inventer une
valeur : il n'existe aucun défaut légitime, et un `DEFAULT 'NC'` serait le
territoire codé en dur que D46 interdit.

**Oui, le chaînage impose une colonne `territoire` redondante sur
`calendrier_ferie`** — la question était posée, la voici dite plutôt que glissée.
Elle ne porte aucune information nouvelle : elle est toujours celle de l'agence,
et la base refuse toute autre valeur. Elle n'existe que pour rendre la contrainte
**déclarative** : sans colonne portée par la ligne, aucune clé étrangère ne peut
relier en un seul geste l'agence et le fait public. Une redondance qui rend une
contrainte déclarative n'est pas une duplication de données — c'est le prix du
verrou, et il se paie une fois, à l'écriture, dans un `upsert` qui recopie une
valeur.

**Ce que le NULL reste.** `jour_ferie_id` demeure nullable : c'est le **pont**,
un jour ordinaire que l'agence chôme, sans fait public en face. `MATCH SIMPLE`,
qui rendait l'option dangereuse sur `agence.territoire`, la rend ici utile — et
le pont n'échappe pas pour autant à la première clé, qui tient son territoire.

## Conséquences

**Une agence ne change plus de territoire sans reprendre ses écarts.** Avec
`ON UPDATE CASCADE`, ses ponts suivent ; ses fériés travaillés font échouer la
mise à jour, faute de fait public correspondant sur le nouveau territoire. Le
comportement est voulu et il a été vérifié : un déménagement d'agence se règle en
reprenant ses écarts, pas en les laissant pointer sur les fêtes d'ailleurs.

**Le contrôle « agence sans territoire » du script d'horizon a disparu, et c'est
un renforcement.** Il existait parce que rien en base ne l'empêchait ; la
garantie a changé de nature — d'un rapport nocturne qui **nommait** une agence
fautive à une contrainte qui l'**empêche** d'exister. `chargerCalendrierAgence`
perd du même coup sa branche « pas de territoire déclaré ».

**Les épreuves, et elles sont réelles.** Un gardien vert sur un cas fabriqué
n'est pas un gardien éprouvé (CLAUDE.md §9). Trois épreuves ont été jouées :

1. `tests/isolation/territoire-chaine.test.ts` porte, à côté de chaque refus,
   un scénario qui **retire réellement** la contrainte — dans une transaction
   annulée, le DDL étant transactionnel en PostgreSQL — et montre que l'écriture
   fautive passe alors. Le retrait est automatisé : il rejoue à chaque
   `pnpm verify`.
2. Le chaînage a été retiré **de la migration elle-même**, puis la suite
   rejouée : les six scénarios concernés sont passés au rouge. Un test qui reste
   vert sans la contrainte ne prouve rien de la contrainte.
3. Les deux préalables de la migration ont été éprouvés sur une base réelle
   portant les données fautives. Le second est le plus instructif : la ligne
   fautive — agence `NC`, férié `FR`, même date — **a bien été acceptée** par le
   schéma L0-08 avant que la migration ne la nomme et refuse. Le défaut n'était
   pas théorique.

**La reprise après un refus.** Prisma marque une migration refusée comme
échouée. Après correction de la donnée, la reprise passe par
`prisma migrate resolve --rolled-back 20260823130000_territoire_du_ferie_reference`
puis `prisma migrate deploy`. Rien n'a été écrit : le préalable lève avant tout
DDL, et la transaction de Prisma retombe entière.

## Ce que l'épisode enseigne

**Une colonne nullable posée « faute de défaut légitime » est un choix honnête,
et elle devient obligatoire au moment où une contrainte s'appuie dessus.** Ce
moment est le bon, pas plus tard.

`agence.territoire` a été posée nullable à bon droit en L0-08 : il n'existait
aucune valeur par défaut qui ne soit pas un mensonge, et la rendre obligatoire
d'emblée aurait fait échouer la migration sur une base portant déjà des agences.
La colonne est aujourd'hui renseignée partout, et le coût de l'obligation ne sera
jamais plus bas : deux sociétés, quatre agences, uniquement des données de
démonstration. Attendre, c'est le payer au centuple — et, entre-temps, laisser un
verrou muet sur les lignes qu'il devait précisément protéger.

Le corollaire vaut pour la suite du projet : **poser une contrainte sur une
colonne nullable, c'est poser une contrainte facultative**. Chaque fois qu'une
clé composite s'appuiera sur une colonne « pas encore obligatoire », la question
à trancher n'est pas « peut-on chaîner quand même » mais « rend-on la colonne
obligatoire maintenant, ou renonce-t-on au chaînage ».
