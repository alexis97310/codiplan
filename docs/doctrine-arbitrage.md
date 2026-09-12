# CODIPLAN — Doctrine d'arbitrage

**Rang 1, aux côtés de `docs/arbitrages.md` et de `docs/protocole-session.md`, et sans les recouvrir.** `arbitrages.md` dit **ce qui a été décidé** — des décisions particulières, datées, numérotées. `protocole-session.md` dit **comment une session travaille** — qui décide quoi, les cas d'arrêt, la forme d'un ticket. Ce document dit une troisième chose : **les familles de règles déjà tranchées**, assez souvent pour qu'une question qui y tombe n'ait plus besoin d'être reposée.

*Écrit le 11/09/2026. Motif : beaucoup de questions qui remontent à Alexis appartiennent à des familles déjà tranchées dix fois — au chapitre 10, dans `docs/arbitrages.md`, au §9 du `CLAUDE.md`. Reposer la question à chaque occurrence coûte une journée d'attente pour un raisonnement déjà fait.*

---

## Objet

Quand une question nouvelle tombe sous une des règles ci-dessous, **la session tranche seule** en s'appuyant sur cette règle : elle écrit la décision **avec sa condition de réouverture** — vérifiable, jamais « si cela pose problème » — et elle **n'ouvre pas de ticket `arbitrage`**.

Ce document ne remplace ni le chapitre 10, ni `docs/arbitrages.md`, ni le §9 du `CLAUDE.md` : il en tire des maximes d'usage courant. Une règle ci-dessous qui contredirait une décision déjà écrite ailleurs ne l'emporte pas — c'est une divergence à signaler, comme toute contradiction entre sources (§1 du `CLAUDE.md`).

---

## 1. Ce qui reste à Alexis, et rien d'autre

Une décision appartient à Alexis si et seulement si elle touche l'une de ces choses :

- **l'argent facturé à un client** — un montant, un taux, une majoration, une règle qui change ce qu'un client paie ;
- **une obligation légale** ;
- **ce qu'un client voit** ;
- plus largement, **tout ce qui serait irréversible dans une relation client**.

**Aucune règle des sections suivantes n'autorise à trancher à la place d'Alexis dans ces cas.** Elles s'appliquent à ce qui reste — et c'est déjà la majorité des questions qui remontent.

---

## 2. Cloisonnement

- **En cas de doute entre montrer et cacher : on cache.**
- **Une fuite par déduction est une fuite.** Un compteur à zéro affiché là où il n'y a rien à afficher en est une.
- **L'accès à un objet partagé passe par les objets que le compte possède déjà, jamais par sa société.**
- **Aucune politique de cloisonnement n'évalue l'heure** : un fait qui dépend du temps est matérialisé dans une colonne qu'un travail écrit.
- **Un compte de portail ne lit aucune table de référence** : ce dont il a besoin est porté par les objets qu'il a le droit de lire.
- **Une règle de cloisonnement n'a pas besoin d'appelant — elle a besoin qu'il n'y ait pas de trou.** Seule exception à « on ne construit rien qui n'ait d'appelant ».

## 3. Absence et vacuité

- **Une absence d'information ne s'affiche JAMAIS comme une réponse négative.**
- **« Sans information depuis X » n'est ni « à jour » ni « en retard ».**
- **Un contrôle dont la population est vide rend une absence de mesure, pas un vert.**
- **Ne jamais affirmer un état observable sans l'avoir observé.**
- **Distinguer toujours « je n'en ai pas trouvé » de « il n'y en a pas ».**
- **Un gardien se montre en train de rougir avant d'être déclaré bon.**
- **Un booléen ne peut pas porter trois états** : une nouvelle ligne naît « à déterminer », jamais sur la réponse négative.
- **Un gabarit d'alarme n'affirme aucune cause qu'un contrôle ne mesure.**
- **Le verdict par défaut d'un contrôle est celui qui AFFIRME LE MOINS** : ce qui se reconnaît nommément est la faute, jamais l'excuse. Un contrôle interrompu rend une absence de mesure, jamais une faute.

## 4. Argent

- **Un prix se fige sur le document au moment de la clôture** : une facture ne change pas quand un tarif change.
- **Toute règle qui produit un montant porte un jumeau qui prouve le refus dans le cas symétrique.**
- **Un ordre qui décide d'un montant est explicite et stocké, jamais implicite.**

*Rappel du §1 : ces trois règles disent comment coder une règle d'argent déjà donnée — elles ne dispensent jamais de faire trancher par Alexis le montant, le taux ou la règle elle-même.*

## 5. Listes et clôture

- **Toute liste close est produite par le schéma, jamais tenue à la main.**
- **Chaque élément est couvert, ou exempté NOMMÉMENT avec son motif.**
- **Un changement de périmètre qui produirait des centaines d'alertes ouvre une CAMPAGNE DATÉE avec un compteur, jamais des centaines d'alertes.**

## 6. Diagnostic et réparation

- **Un diagnostic juste rendu inaudible par un diagnostic faux qui parle plus fort n'existe pas** : la garde qui dit vrai tombe EN PREMIER.
- **Une explication jamais réfutée est une hypothèse, pas une cause.** On ne répare pas sur une explication vraisemblable : la réparation suit la mesure.

## 7. Décisions

- **Toute décision porte sa condition de réouverture, écrite pour être vérifiable.**
- **Une consigne mesurée fausse se refuse, et le refus se motive.**
- **Une empreinte, une date, un état ne s'écrivent jamais de mémoire : ils se lisent.**
