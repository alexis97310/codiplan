# L'application du technicien — journée du 15 septembre 2026

*Chantier : L3-08, le verrou qui bloque L3-07, L3-09 à L3-14, L9-11 et R3-05.
Consigne : **construire le socle dont ils dépendent, pas eux.** Quatre étapes,
quatre branches, quatre propositions — aucune fusionnée.*

---

## Ce qui est ouvert, dans l'ordre de fusion

| | Proposition | Base | Ce qu'elle porte |
|---|---|---|---|
| 1 | **#189** — R5-01 (socle) | `main` | la restriction par personne, lue dans la matrice |
| 2 | **#190** — R5-01 (écran) | #189 | `app/(mobile)/terrain`, quatrième groupe de routes |
| 3 | **#192** — R5-02 (table) | `main` | `segment_travail`, la règle, les verrous — **indépendante des deux premières** |
| 4 | **#193** — R5-02 (écran) | #190 + #192 | le compteur sur le terrain, de bout en bout |

**#192 peut se fusionner seule et dans n'importe quel ordre** : elle ne lit rien
de la restriction. #193 contient les trois autres.

*Une branche par étape depuis `main` était la consigne, et elle a été suivie
pour 1 et 3.* **Elle a été refusée pour 2 et 4, avec son motif** : branchée sur
`main`, la journée du technicien lirait `listerPlanning` **sans** la restriction
— elle montrerait le planning entier de l'agence. *Un écran dont la garantie
vit dans la branche d'à côté est faux si on le fusionne seul.*

---

## Ce qui est resté en plan, et pourquoi

**Les photos (R5-03) et la signature (R5-04)**, qui sont dans le périmètre du
jour. *Mesuré le 15/09/2026 :* `lib/pdf/` **n'existe pas** ; aucun module de
stockage d'objets n'existe — `document.objet_cle` est *fournie, jamais
fabriquée*, et `lib/documents/depot.ts` l'écrit en toutes lettres ; et
`intervention` ne porte **aucune** colonne de signature, de photo, de checklist
ni de diagnostic (`information_schema.columns`, zéro ligne).

*Ce ne sont pas des tickets à prendre : ce sont deux chaînes entières.* Poser
une interface de stockage sans implémentation serait **l'interface sans
appelant** que l'exploitation a elle-même refusée le 13/09.

---

## LES QUESTIONS QUE JE N'AI PAS TRANCHÉES

*C'est la liste qui compte. Aucune n'a reçu de réponse par accident : chacune
est écrite dans le code qui la contourne.*

### 1. Démarrer le compteur fait-il passer l'intervention EN COURS ?

**Alexis écrit** : *« il pourra démarrer son intervention, et qu'à ce moment le
compteur commence »* — un seul geste, en apparence.

**Ce qui l'empêche** : RG-INT-01 exige une **machine rattachée** au passage en
statut de travail, et **la base le tient** (`intervention_machine`, trois
statuts). Or *le dépannage à l'aveugle est le cas ordinaire* — c'est écrit dans
le dépôt depuis L2-08a. **Coupler les deux rendrait le compteur indémarrable sur
l'appel du matin.**

*En attendant :* le compteur ne touche pas au statut, et l'écran ne fait pas
semblant — il affiche celui que le planning porte, et le temps mesuré à côté.

### 2. Qui écrit `intervention.temps_reel_min` désormais ?

**D119 dit que le compteur fait foi pour le temps.** Or cette colonne a
**UN seul chemin d'écriture** — la clôture depuis le back-office, à la main.
Le compteur faisant foi, ce chemin devient une **seconde source du même fait** :
la divergence du §9, sur la valeur qui entre dans l'arrondi et le plancher.

*Ce n'est pas un détail d'implémentation : la réparation touche ce qu'un client
paie.* Trois issues visibles — le compteur écrit la colonne à chaque arrêt ; la
clôture la dérive des segments ; la colonne disparaît au profit de la somme.

### 3. « Pause » et « arrêt » doivent-ils différer ?

**Sur les segments, ils ne diffèrent pas** : les deux ferment le segment ouvert
et rien d'autre. Ce qui les distinguerait est ce que l'arrêt ferait au statut —
c'est-à-dire la question 1. *En offrir deux qui font la même chose serait mentir
sur l'un des deux*, donc il n'y en a qu'un, nommé « pause ».

### 4. La base doit-elle porter la restriction « je ne vois que mes interventions » ?

Aujourd'hui elle vit dans la **couche applicative**, et le scénario d'isolation
l'écrit plutôt que de le taire : sous le contexte cloisonné du technicien, la
base rend **2** interventions, et le dépôt en retranche une. La forme « parc »
(D84) répond *quelle société, quel client, quels sites* — jamais *quelle
personne*.

**La porter en base serait une quatorzième forme de politique**, avec sa liste
close, ses gardiens et son jumeau : un arbitrage de cloisonnement (§8). R5-01
écrit lui-même *« aucune nouvelle donnée, aucune migration »*.

### 5. Un rôle interne voit-il les montants qu'il ne devrait pas voir ?

*Mesuré en passant, et ce n'est pas le ticket.* La matrice du §5.2, amendée par
**D37**, retire les montants de vente à `admin_societe` — *« il ne lit pas les
données financières »*. **Aucun écran ne lit cette ligne** : la fiche
d'intervention affiche la valorisation à qui l'ouvre. Ce n'est pas une fuite de
cloisonnement, c'est une règle écrite que rien n'applique.

*Je ne l'ai pas réparée* : le seul rôle interne du semis est `admin_societe`, si
bien que corriger cela ferait **disparaître les montants de toute la
démonstration** — un changement visible que personne n'a demandé.

### 6. « Terminée (bon signé) » — le cycle d'états d'Alexis et celui du dépôt

*La consigne du jour donne* : Planifiée → En cours → Terminée (bon signé) → À
facturer → Facturée, plus Annulée et En attente.

**Le dépôt porte deux axes, et ils s'y retrouvent presque exactement** (D8) :
`statut` va de `a_planifier` à `cloturee`, `statut_facturation` porte
`a_facturer` et `facturee`. **Deux écarts de vocabulaire restent, et ils ne sont
pas neutres** : « En attente » est `suspendue`, qui **exige un motif** depuis
L2-10 ; et le dépôt distingue `terminee` de `cloturee` — *le technicien termine,
le responsable valide et clôture* (arbitrage 3.17) —, là où la consigne n'a
qu'un état. **Faut-il fusionner les deux, ou garder la validation ?**

---

## Ce qui a été mesuré, et ce que ça a coûté

**Trois gardiens ont rougi à raison** sur le compteur : l'échange
d'authentification (D64), l'horloge sans fuseau (L0-08), l'habillage des liens.
Aucun n'a été assoupli.

**Un défaut réel, trouvé en l'éprouvant.** La première rédaction de la migration
croyait refuser `DELETE` et ne le refusait pas. *Deux causes s'additionnaient, et
chacune suffisait* : une politique sans clause `FOR` couvre les quatre verbes, et
`ALTER DEFAULT PRIVILEGES` accorde d'avance `DELETE` sur **toute table créée
ensuite** — un `GRANT` qui en nomme trois n'en retire aucun. C'est le §9 du
30/08 sur les partitions, un cran plus loin.

**Le gardien de la filiation a posé une vraie question.** `segment_travail` est
la première table de `TABLES_INTERNES` à être aussi une **fille** d'une table du
parc. Le critère la réclamait sous « filiation » ; elle porte « interne », qui
**ferme davantage**, et la comparaison est écrite dans `ecartsTablesFilles`
plutôt que supposée — le traitement que « héritage » avait déjà.

**Une prise de vue a photographié une page d'erreur, et le témoin l'a refusée.**
`/terrain/<id>` rendait *« The table public.segment_travail does not exist »* :
ma base locale était en retard d'une migration — **l'asymétrie du §12 du
protocole, reproduite sur un poste**. La base a été recréée, migrée, semée, et
la prise refaite.

---

## Ce qui a été mesuré sur `main`, et qui n'est pas de ce chantier

- **Les issues du dépôt ne sont plus désactivées.** R3-17 écrit, le 15/09,
  *« les issues sont désactivées sur le dépôt (R3-07) »* ; l'issue **#191** a été
  ouverte aujourd'hui sans difficulté. *Un état affirmé vieillit.*
- **L'empreinte photographiée `f13c2c6` n'existe dans aucun historique** —
  `git cat-file -t` sur un clone complet. C'est **R3-17**, déjà écrit, avec une
  mesure plus précise que la mienne : la prise avait été faite sur une branche,
  fusionnée en squash. *Les prises de vue de ce chantier tombent sous le même
  ticket.*

---

## Où reprendre

**Rien n'est en cours.** Les quatre branches sont poussées, aucune n'est
fusionnée. Ce qui suit dépend des réponses ci-dessus : les questions 1 et 2
décident de la suite du compteur, la 4 décide de sa garde, et R5-03 comme R5-04
attendent deux chaînes entières que ce chantier n'a pas ouvertes.

*Geste d'exploitation : **aucun**. #192 touche `prisma/migrations/`, que D116
porte à la base `demonstration` sans qu'une main l'y porte ; aucune proposition
ne touche `prisma/seed.ts`.*
