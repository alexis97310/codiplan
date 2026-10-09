# Captures — 9EQ-CORRECTIFS-SOLDE-FICHE (point 53)

Prises le 09/10/2026 par `tests/e2e/captures-9eq-fiche-onglets.spec.ts`, sur
sa propre scène (préfixe `9EQ-CAP-` : un client, un site complet — adresse,
horaires lun.–ven., consignes —, un donneur d'ordre actif avec courriel, et
quatre interventions, une par statut). Deux largeurs par capture : 1280 px et
375 px, `fullPage`.

## AVANT / APRÈS

**APRÈS** (40 PNG, `<statut>-<onglet>-apres-<largeur>.png`) : les cinq
onglets de la fiche (Résumé, Temps, Rapport, Valorisation, Historique), sur
le code livré par ce lot, pour chacun des quatre statuts (`a-planifier`,
`en-cours`, `terminee`, `cloturee`).

**AVANT** (8 PNG, `<statut>-avant-<largeur>.png`) : la même page, sur un
`git worktree` jeté sur `aeb3520d` — le commit juste avant celui qui a
introduit les onglets et la carte « Sur place » (`c94e953c`,
9EE-TP-UX4-1-FICHE-INTERVENTION-2). Cette révision ignore `?onglet=` et ne
connaît qu'une seule disposition par fiche : une capture par statut et par
largeur, à comparer aux CINQ captures APRÈS du même statut — c'est elle qui
montre ce que les onglets ont changé.

Pour rejouer l'AVANT : `git worktree add --detach <chemin> aeb3520d`, copier
`tests/e2e/captures-9eq-fiche-onglets.spec.ts` et `tests/e2e/setup/` depuis
ce commit, et ajouter à la fin de l'objet `fr` de `lib/i18n/fr.ts` **de ce
worktree seulement** (jamais commité) les cinq clés `9ee2.e2e.rue`,
`9ee2.e2e.consignes`, `9eq.e2e.client`, `9eq.e2e.lieu`, `9eq.e2e.contact_nom`
que cette révision ne porte pas encore — `package.json`, `pnpm-lock.yaml` et
`prisma/schema.prisma` sont identiques entre `aeb3520d` et ce commit, un
lien symbolique vers `node_modules` suffit, aucune réinstallation.

## Tableau — écran → fichier → ce qu'il prouve

| Statut | Fichier AVANT | Fichiers APRÈS (un par onglet) | Ce que la comparaison prouve |
|---|---|---|---|
| À planifier | `a-planifier-avant-{1280,375}.png` | `a-planifier-{resume,temps,rapport,valorisation,historique}-apres-{1280,375}.png` | La fiche d'avant n'avait ni onglets ni carte « Sur place » ; Résumé porte désormais l'adresse, les horaires, le donneur d'ordre (lien `tel:`), les consignes et l'agence, que les quatre autres onglets n'affichent plus (point 54) |
| En cours | `en-cours-avant-{1280,375}.png` | `en-cours-{resume,temps,rapport,valorisation,historique}-apres-{1280,375}.png` | Le segment ouvert (compteur en marche) reste visible depuis l'en-tête ; l'onglet Temps regroupe désormais les segments et les pauses, séparés du reste |
| Terminée | `terminee-avant-{1280,375}.png` | `terminee-{resume,temps,rapport,valorisation,historique}-apres-{1280,375}.png` | Le bloc « prête à clôturer » (temps mesuré) migre dans Rapport ; Valorisation porte le mode et le forfait, toujours visibles, et le bloc de calcul, filtré par rôle |
| Clôturée | `cloturee-avant-{1280,375}.png` | `cloturee-{resume,temps,rapport,valorisation,historique}-apres-{1280,375}.png` | Fiche figée (D160) : les cinq onglets restent accessibles en lecture, aucune action n'apparaît dans aucun |

Aucun manque à nommer pour ce point : les quatre statuts demandés et les cinq
onglets de chacun sont tous capturés, aux deux largeurs, avant et après.
