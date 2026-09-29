# La hiérarchie des sources, et la maquette

**Source de rang 1.** Ce texte était dans le `CLAUDE.md` ; il en a été détaché le
16/09/2026 par le ticket AT-05, **sans qu'une ligne change**. Son rang n'a pas bougé —
le noyau le dit, et le noyau nomme ce fichier dans son index : un fichier que le noyau
ne nommerait pas est un fichier que personne n'ouvrirait, et c'est gardé
(`tests/unit/docs/constitution-indexee.test.ts`).

La numérotation des sections ci-dessous est celle du `CLAUDE.md` d'avant la scission :
des gardiens la lisent, et la renuméroter aurait été une réécriture.

---

**Les trois sources de rang 1 ne se recouvrent pas** *(écrit le 10/09/2026, complété le 11/09/2026)*. `arbitrages.md` dit **ce qui a été décidé** — des décisions particulières, datées, numérotées ; `protocole-session.md` dit **comment une session travaille** — qui décide quoi, les deux seuls cas d'arrêt, la forme d'un ticket `arbitrage`, l'économie de contexte, la forme du rapport ; `doctrine-arbitrage.md` dit **quand une session peut trancher seule sans reposer la question** — les familles de règles, hors ce qui touche l'argent facturé, une obligation légale ou ce qu'un client voit. Elles sont à égalité parce qu'aucune ne peut trancher les autres : une contradiction entre elles est un **défaut à signaler**, jamais une préséance à appliquer. Ces sept sections étaient recopiées à l'identique en tête de chaque consigne depuis dix jours ; *une règle recopiée à la main est une règle qui s'érode.*

~~`docs/maquette/CODIPLAN_Maquette.html` est une illustration d'intention, **pas une spécification**.~~ **ELLE FAIT FOI SUR LA DISPOSITION ET SUR LES COULEURS** *(D95, 11/09/2026)*. ~~Ce qu'elle montre se suit ; ce qu'elle ne dit pas reste libre, et un écart s'écrit avec sa mesure et le point précis où elle est muette — jamais « la maquette ne prévoyait pas ce cas ».~~ La phrase d'origine est conservée barrée : elle a gouverné le dépôt pendant trois semaines, et ce qui a été décidé un jour se relit. Les deux exceptions qu'elle promouvait déjà — le formatage monétaire et les codes couleur des statuts — restent des règles ; elles ne sont plus des exceptions, elles sont le cas général. **Cet état est celui de D95 tel qu'il valait le 11/09/2026 : D124, D125 et D137/D138 (29/09/2026) l'ont chacune repris sur un point précis, et la répartition qui vaut aujourd'hui est celle-ci, jamais celle de la phrase ci-dessus prise seule.**

**LA RÉPARTITION AUJOURD'HUI, POINT PAR POINT.**
- **Les jetons de couleur, la typographie, le rayon et l'ombre** viennent de `docs/maquette/codiplan-maquette-complete.html` (« la maquette complète », D124, 18/09/2026) — **sauf le plancher de 12 px, qui s'applique par-dessus, même là où elle descend à 11 px ou 10,5 px** (D138, 29/09/2026, réponse à QE-1).
- **La disposition des quatorze écrans que la maquette complète dessine** vient d'elle (D125, 18/09/2026), SAUF les écarts nommés qu'Alexis accepte question par question (QE-x de la spécification « ergonomie, graphisme et usage » du 28/09/2026) — dont les tuiles de chiffres, toutes cliquables avec un chevron (D140, 29/09/2026, réponse à QE-13b). Ni la disposition ni ces écarts ne font jamais foi sur le CONTENU ni sur une règle de gestion (D128, 18/09/2026).
- **La disposition de tout autre écran** — ce que ni la maquette complète ni ces écarts ne dessinent — vient désormais de `docs/propositions/ergonomie-2026-09-28/maquette-toutes-pages.html` (« la maquette du 28/09 »), **EN REMPLACEMENT** de `docs/maquette/CODIPLAN_Maquette.html` sur ce seul reliquat (D137, 29/09/2026, réponse à QE-13a). L'ancien fichier reste dans le dépôt, en archive.

**IL N'EN EXISTE QU'UN EXEMPLAIRE DE CHACUNE, et c'est gardé** *(11/09/2026, étendu le 29/09/2026)*. `docs/maquette/CODIPLAN_Maquette.html` a vécu quelques heures en double — `docs/` et `docs/maquette/` —, octet pour octet identiques, et rien ne l'aurait dit le jour où l'un des deux aurait bougé : *une source qui fait foi en deux exemplaires n'est plus une source.* `tests/unit/docs/maquette-unique.test.ts` refuse un second exemplaire de chacune des maquettes qu'il connaît, `CODIPLAN_Maquette.html` comme, depuis D137, `maquette-toutes-pages.html`.