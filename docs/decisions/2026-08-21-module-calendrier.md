# Module calendrier — fuseaux, récurrences, fériés et frontière du « quand »

## Contexte

Le ticket L0-08 demande `lib/calendar` : calendriers d'ouverture rattachés à
l'**agence** (D5, I7), calendrier de référence distinct par usage (D13), jours
et heures ouvrés, semaines ISO 8601. Le contexte d'exploitation est la raison
d'être du module : la Nouvelle-Calédonie est à UTC+11 **sans changement
d'heure**, la métropole en change deux fois par an, l'application technicien
fonctionne hors ligne sur un téléphone dont le fuseau peut changer, et la
solution est destinée à être vendue sur d'autres territoires.

Trois pièges se referment sur qui écrit ce genre de module sans y penser. Le
fuseau écrit en dur, qui rend la plateforme calédonienne pour toujours. La
récurrence figée en instants UTC, qui décale de soixante minutes deux fois par
an à Paris et jamais à Nouméa — donc juste dans les tests et fausse chez le
client. Et l'accesseur local de `Date`, qui lit l'heure de l'appareil au lieu
de celle de l'agence : un technicien en déplacement voit alors tout son
planning glisser, sans qu'aucune erreur ne s'affiche.

Un quatrième point n'était pas un piège mais un arbitrage : la table des jours
fériés n'a pas de `societe_id`, et la liste close des référentiels de plateforme
ne la contenait pas. La session s'est arrêtée et a soumis la question, comme
le §8 du CLAUDE.md l'impose — c'est devenu **D46**.

## Options écartées

**Une bibliothèque de fuseaux** (`date-fns-tz`, `luxon`, `@js-joda`). Écartée :
`Intl.DateTimeFormat` porte déjà la base IANA du moteur, et la conversion dans
les deux sens tient en une trentaine de lignes. « Écrire les trente lignes
plutôt qu'ajouter deux cents kilo-octets » (CLAUDE.md §2) s'applique
littéralement, et le poids compte deux fois pour une application hors ligne
chargée sur un réseau mobile calédonien.

**`Temporal`**. Écartée pour la V1 : la disponibilité dépend du moteur, et une
transpilation ramènerait la dépendance qu'on venait d'éviter. Sa **convention de
désambiguïsation** est en revanche reprise telle quelle (voir plus bas) : ne pas
prendre la dépendance n'oblige pas à inventer une sémantique concurrente.

**Un décalage numérique en base** (`+11`). Écartée, et refusée par le schéma de
validation : un décalage est le résultat d'un fuseau et d'une date. Stocké, il
fige ce résultat au jour du calcul — vrai à Nouméa toute l'année, faux à Paris
la moitié.

**Un booléen `ouvert` sur les jours de la semaine.** Écarté au profit de « un
jour sans plage est un jour fermé » : deux sources pour un même fait finissent
par se contredire, et c'est la plage qu'on lit.

**Les fériés dans la seule table cloisonnée `calendrier_ferie`.** Écartée par
D46 : elle n'aurait touché aucune liste close, mais aurait recopié la liste
néo-calédonienne dans chaque calendrier de chaque agence, laissé deux sociétés
d'un même territoire diverger en silence, et fait de l'ouverture d'un nouveau
territoire un travail calendrier par calendrier.

**Une table de récurrences générique.** Écartée : aucune entité métier n'en a
besoin au lot 0, et l'inventer aurait été inventer une règle de gestion que le
cahier des charges ne porte pas (CLAUDE.md §8). La récurrence a bien une forme
de stockage — jour de semaine ISO et minutes locales — et cette forme est déjà
en base : **`calendrier_plage` EST une récurrence**, c'est elle qui éprouve la
règle du point 3 du ticket.

## Choix

**Un instant est une `Date`, une lecture locale est une `DateLocale`.** Deux
types distincts, deux fonctions pour passer de l'un à l'autre, et un fuseau
obligatoire dans les deux sens. `versLocal` est le point de passage unique :
partout ailleurs, lire l'heure d'un instant sans nommer de fuseau revient à
lire celle de l'appareil.

**La désambiguïsation suit la convention de `Temporal` (mode « compatible »),
que suivent aussi java.time et les bibliothèques usuelles.** Une heure locale
inexistante — 2 h 30 le dernier dimanche de mars à Paris — avance du saut et
devient 3 h 30 : un créneau récurrent ce jour-là se pose, il ne disparaît pas.
Une heure ambiguë — 2 h 30 le dernier dimanche d'octobre — rend la **première**
occurrence. La convention est arbitraire ; l'adopter plutôt que d'en inventer
une évite d'avoir un jour à expliquer pourquoi CODIPLAN place un rendez-vous
ailleurs que tout le monde. Techniquement, les deux décalages en vigueur
vingt-quatre heures avant et après encadrent tout changement d'heure : on
retient le candidat qui se relit à l'identique, le plus tôt s'il y en a deux,
le plus tard s'il n'y en a aucun.

**Les récurrences se déroulent en jours locaux, jamais par addition
d'instants.** À Paris, deux lundis consécutifs à 8 h sont séparés de 167 ou
169 heures les semaines de bascule, jamais de 168. Le scénario
`recurrence.test.ts` parcourt l'année 2026 entière — les deux bascules
comprises — et vérifie que les 52 occurrences restent à 8 h locales tandis que
leur heure UTC change ; la même règle à Nouméa ne produit qu'une seule heure
UTC, du 1ᵉʳ janvier au 31 décembre.

**La date courante ne se lit que par `maintenant(fuseau)`.** La signature exige
un fuseau : il devient impossible d'écrire « aujourd'hui » sans dire aujourd'hui
*où*.

**Quatre tables, trois catégories de I1.** `jour_ferie` est un référentiel de
plateforme (D46), clé `(territoire, date)`, lecture ouverte et écriture réservée
aux rôles éditeur. `calendrier`, `calendrier_plage` et `calendrier_ferie` sont
des tables métier portant `societe_id NOT NULL`, en `FORCE ROW LEVEL SECURITY`
comme les autres. La ligne de partage est celle du sens : **les faits du
territoire sont communs, les décisions d'ouverture appartiennent à chaque
société.**

**Une fonction par usage, nommée d'après son ORIGINE** (D13) : `echeanceSla`
prend le calendrier de l'agence de l'intervention, `minutesHorsOuvertureTechnicien`
celui de l'agence du technicien, `conflitPose` le calendrier de travail du
technicien, `avertissementSiteFerme` les horaires du site client. Le scénario
qui les justifie tient en une phrase : une intervention posée à Koné, un samedi,
par un technicien de Ducos. Le SLA court sur Koné, qui est fermée ; la
majoration se calcule sur Ducos, qui ouvre le samedi matin. Deux réponses
opposées sur le même créneau — une signature commune aurait laissé le choix à
l'appelant, et le premier appelant pressé aurait passé le calendrier qu'il avait
sous la main.

**La frontière de D45 est tenue par la forme des retours.**
`minutesHorsOuverture` rend des **minutes**, jamais un montant ni une durée
arrondie : le taux de +50 %, l'assiette main-d'œuvre et l'arrondi au quart
d'heure appartiennent à la valorisation (L2-09). Le calendrier dit combien de
minutes sont hors ouverture ; il ne dit pas ce qu'elles coûtent.

**Trois gardiens statiques**, éprouvés chacun sur des cas fabriqués **puis sur
sept violations réellement écrites dans le code et retirées ensuite** :
`sans-fuseau-en-dur` (aucun identifiant IANA ni décalage déguisé hors du schéma
et de son seed), `sans-date-feriee-en-dur` (aucune date ni aucun libellé de
férié, motifs **dérivés du seed** comme `sans-litteral-de-parite` dérive les
siens des parités, et calcul de Pâques réservé au seed) et
`sans-date-courante-implicite` (ni `new Date()`, ni `Date.now()`, ni accesseur
local de `Date`, ni formatage par la locale, ni chaîne date-heure sans
décalage).

Les trois analysent les sources **commentaires retirés** : la documentation du
module cite les motifs qu'ils traquent — « ex. `Pacific/Noumea` », « jamais par
`getDay()` » —, et un gardien qui lirait le texte brut n'aurait laissé qu'un
seul moyen de passer au vert, appauvrir la documentation.

**L'épreuve sur violation réelle a payé du premier coup.** Six essais sur sept
ont fait tomber le gardien visé ; le septième est passé au travers. La règle
« seul le seed appelle le calcul de Pâques » ne reconnaissait que la forme
lointaine de l'import, `lib/calendar/paques`, et laissait passer `./paques` —
c'est-à-dire **la seule forme qu'un fichier voisin puisse écrire**, donc la
seule qui serait réellement apparue. Le motif est corrigé, l'essai rejoué. La
leçon est inscrite au §9 du CLAUDE.md.

## Conséquences

- Le planning du lot 3, les engagements de service et les indicateurs
  consomment ces primitives sans réécrire ni fuseau ni jour ouvré. Le composant
  Schedule-X (D17) recevra des instants et un fuseau d'agence, jamais des
  heures locales nues.
- `calendrier_plage` est la forme de stockage d'une récurrence hebdomadaire.
  Toute entité future qui aura besoin d'une récurrence — échéances préventives
  d'un contrat, créneaux types d'un technicien — reprendra cette forme :
  **règle locale plus fuseau**, jamais des instants UTC.
- Les quatre tables entrent au périmètre de consolidation de `codiplan_reporting`
  (`SELECT` seul, D21/D38) : D13 range les « jours ouvrés des indicateurs » sous
  « agence, agrégé par société », et aucune d'elles ne porte de donnée
  personnelle. C'est une décision, écrite à la main dans la migration, et le
  scénario d'isolation en tient la liste en toutes lettres.
- Le seed porte des horaires de **démonstration**, dits comme tels dans le
  libellé de chaque calendrier. Les horaires réels des agences CODIMA sont
  inscrits au registre « ce qui reste à décider ». Ce qui n'est pas de la
  démonstration : Ducos ouvre le samedi, Koné non.
- Deux divergences de rédaction ont été signalées et tranchées par la
  hiérarchie des sources, sans qu'aucune décision ne soit prise dans le code :
  1. **`jour_ferie` et la liste close** — soumise, non tranchée en session,
     puis arbitrée par **D46**.
  2. **RG-PLA-01 et RG-PLA-02 disent « site »** là où D5, de rang supérieur,
     impose « agence » et où les exemples cités sont des agences. Tranché par
     **D47** ; le chapitre 10 est corrigé, pas contourné.
