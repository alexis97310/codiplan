# Comment travailler

**Source de rang 1.** Ce texte était dans le `CLAUDE.md` ; il en a été détaché le
16/09/2026 par le ticket AT-05, **sans qu'une ligne change**. Son rang n'a pas bougé —
le noyau le dit, et le noyau nomme ce fichier dans son index : un fichier que le noyau
ne nommerait pas est un fichier que personne n'ouvrirait, et c'est gardé
(`tests/unit/docs/constitution-indexee.test.ts`).

La numérotation des sections ci-dessous est celle du `CLAUDE.md` d'avant la scission :
des gardiens la lisent, et la renuméroter aurait été une réécriture.

---

## 7. Comment travailler

- **Un ticket à la fois.** Lire le ticket, relire le chapitre 10 correspondant et `docs/arbitrages.md`, écrire le test, écrire le code, `pnpm verify`, commiter, pousser sur `origin main`.
- **Test d'abord** pour toute règle de gestion, avec le numéro de règle en commentaire.
- **Commits atomiques.** Un commit ne couvre jamais deux tickets.
- **Une migration se réécrit tant qu'elle n'a pas touché une base réelle ; après, elle est immuable.** Avant sa première application hors des bases jetables, la corriger sur place vaut mieux que d'en ajouter une seconde : deux migrations dont la seconde défait la première se relisent mal. Une fois appliquée à une base réelle, elle ne se touche plus — on en ajoute une seconde, sans exception. Prisma tient déjà cette seconde moitié tout seul, par empreinte : modifier une migration déjà appliquée fait échouer `migrate deploy`. **Le jugement ne porte donc que sur l'avant-première-application** — et c'est le seul endroit où il faut l'exercer.
- **Le README suit le dépôt, dans la même demande de fusion.** Un ticket qui ajoute un **module**, une **table** ou une **commande** met le README à jour avec le reste. Un README qui ment est le même défaut qu'une procédure fausse : on lui fait confiance, et il est lu par ceux qui connaissent le moins le projet.
- **Décisions structurantes** → un fichier dans `docs/decisions/` : contexte, options écartées, choix, conséquences. Trois paragraphes.
- **En cas de blocage** : ne pas contourner, ne pas réduire le périmètre en silence. S'arrêter, décrire ce qui bloque et les options.

---
