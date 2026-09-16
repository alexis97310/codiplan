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

~~`docs/maquette/CODIPLAN_Maquette.html` est une illustration d'intention, **pas une spécification**.~~ **ELLE FAIT FOI SUR LA DISPOSITION ET SUR LES COULEURS** *(D95, 11/09/2026)*. Ce qu'elle montre se suit ; ce qu'elle ne dit pas reste libre, et un écart s'écrit avec sa mesure et le point précis où elle est muette — jamais « la maquette ne prévoyait pas ce cas ». La phrase d'origine est conservée barrée : elle a gouverné le dépôt pendant trois semaines, et ce qui a été décidé un jour se relit. Les deux exceptions qu'elle promouvait déjà — le formatage monétaire et les codes couleur des statuts — restent des règles ; elles ne sont plus des exceptions, elles sont le cas général.

**IL N'EN EXISTE QU'UN EXEMPLAIRE, et c'est gardé** *(11/09/2026)*. Le fichier a vécu quelques heures en double — `docs/` et `docs/maquette/` —, octet pour octet identiques, et rien ne l'aurait dit le jour où l'un des deux aurait bougé : *une source qui fait foi en deux exemplaires n'est plus une source.* `tests/unit/docs/maquette-unique.test.ts` refuse le second.