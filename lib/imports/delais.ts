import type { DelaisTransaction } from "@/lib/db/rls";

/**
 * LES DÉLAIS DE LA TRANSACTION QUI APPLIQUE UN LOT (point 2 de la session du
 * 16/09/2026 ; révisé le même jour, suite — le déploiement Vercel a refusé le
 * premier délai).
 *
 * **Le dépôt l'exigeait déjà avant cet incident.** `lib/db/rls.ts` écrit, au-
 * dessus de `DelaisTransaction` : *« Ces deux défauts [maxWait 2 000 ms,
 * timeout 5 000 ms] sont des valeurs de RÉSEAU LOCAL. […] Un chemin qui
 * enchaîne beaucoup d'écritures dans une seule transaction doit donc les
 * fixer lui-même. »* `avecContexteApplicatif` appelait `avecContexteRls` SANS
 * délais, et l'application d'un lot d'import est exactement ce chemin-là :
 * mesuré en production, un lot de 615 MODIFICATIONS de clients a rendu
 * `POST /api/imports/{id}/appliquer` sans réponse après quatre minutes, le
 * lot restant `controle`.
 *
 * **CE QUE LA PREMIÈRE RÉDACTION AVAIT MANQUÉ, ET QU'UN DÉPLOIEMENT A DIT.**
 * Elle portait `DUREE_MAXIMALE_MS` à vingt minutes et `maxDuration` à 1 200 —
 * un nombre que `pnpm build` compile sans se plaindre, parce que **Next.js
 * compile la route, il n'applique pas la limite de la plateforme qui la
 * sert.** Vercel, sur le plan de ce projet (Hobby), refuse tout `maxDuration`
 * supérieur à `PLAFOND_PLATEFORME_S` — trois cents secondes — et le premier
 * déploiement de cette branche a échoué pour cette seule raison. *`pnpm
 * build` en local ne peut pas le voir : ce n'est pas lui qui applique le
 * plafond.* `PLAFOND_PLATEFORME_S` est donc écrit ici, nommé, et un gardien
 * (`tests/unit/imports/delais-application.test.ts`) confronte désormais le
 * littéral `maxDuration` de la route à CE nombre, pas seulement à
 * `DUREE_MAXIMALE_S` — sans quoi le prochain relèvement repasserait la CI et
 * casserait le déploiement de la même façon : la CI ne regarde pas cela.
 *
 * **Même arithmétique que `prisma/seed-delais.ts`, et elle doit être relue
 * avec lui** : la durée d'une transaction est, à la milliseconde de calcul
 * près, son nombre d'ALLERS-RETOURS multiplié par la LATENCE majorée. Le
 * nombre d'allers-retours se compte (`allersRetoursApplication`), la latence
 * se majore, et le produit doit tenir sous `DUREE_MAXIMALE_MS` — laquelle
 * doit elle-même tenir, avec `ATTENTE_CONNEXION_MS`, sous le plafond de la
 * plateforme.
 *
 * ## CE QUE LE POINT 1 A RÉDUIT, ET CE QU'IL N'A PAS PU RÉDUIRE
 *
 * `appliquerLesLignes` (`lib/imports/application.ts`) ne fait plus, par
 * ligne, une lecture d'AVANT : les cibles de toutes les lignes MODIFICATION
 * d'un lot sont lues en UN SEUL `findMany` (`where: { id: { in: [...] } }`),
 * et les créations s'écrivent en UN SEUL `createMany`. Ce que cette réduction
 * NE PEUT PAS faire disparaître, sans SQL brut (CLAUDE.md §2, interdit hors
 * migrations et politiques RLS) : l'ÉCRITURE d'une modification et sa TRACE
 * sur `import_lot_ligne` restent PAR LIGNE — Prisma ne sait écrire des
 * valeurs DIFFÉRENTES par ligne qu'une requête à la fois, et la trace touche
 * une table auditée (I8) : la reconstituer par un `DELETE` suivi d'un
 * `createMany` ferait porter au journal une suppression et une création là où
 * une seule ligne a été enrichie — *le journal mentirait sur ce qui s'est
 * passé*, exactement ce que le point 1 de la session précédente a fermé pour
 * les écritures elles-mêmes.
 *
 * ## LE POINT D'ARRÊT (§8), MESURÉ PLUTÔT QUE CONTOURNÉ
 *
 * Sous ce budget réduit, le lot mesuré en production — 615 lignes, AU PIRE
 * toutes de VRAIES modifications — ne tient PLUS sous 300 secondes :
 * `allersRetoursApplication(615) × LATENCE_PESSIMISTE_MS` dépasse le plafond
 * de la plateforme d'un facteur deux (voir le calcul dans
 * `tests/unit/imports/delais-application.test.ts`, qui le rend explicite
 * plutôt que de le taire). **Ce n'est pas résolu en relevant `maxDuration`**
 * — la plateforme le refuserait à nouveau — **ni en découpant la transaction
 * en plusieurs requêtes** — l'application d'un lot reste UNE seule
 * transaction, un invariant que cette session ne touche pas. Le lot RÉELLEMENT
 * mesuré (615 lignes classées modification, TOUTES inchangées une fois
 * comparées) ne coûte plus que le socle fixe de la transaction — une fraction
 * de seconde — grâce au point 1 seul ; c'est un lot hypothétique de plusieurs
 * centaines de VRAIS changements simultanés qui resterait hors de portée d'une
 * seule requête HTTP, et il se refuse alors proprement (`delai_depasse`),
 * jamais en silence. Changer de régime pour ce cas-là — une file de jobs,
 * chapitre 2 du CLAUDE.md — est un arbitrage, pas ce ticket.
 */

/**
 * Latence majorée d'un aller-retour vers la base hébergée, en millisecondes.
 *
 * **La même mesure que le seed** (`prisma/seed-delais.ts`, incident du
 * 23/08/2026) : ~190 ms l'aller-retour depuis un exécuteur vers Neon
 * `ap-southeast-2`, majorés à 500 ms pour absorber la gigue et un réveil de
 * la base après mise en veille. Ce n'est pas une valeur métier, c'est une
 * borne d'infrastructure — écrite ici pour être révisée en connaissance de
 * cause plutôt que devinée, et non importée du seed : les deux chemins n'ont
 * pas la même raison de changer, et une dépendance entre `lib/` et `prisma/`
 * n'a pas de sens de lecture (CLAUDE.md §6).
 */
export const LATENCE_PESSIMISTE_MS = 500;

/**
 * LE PLAFOND DE LA PLATEFORME QUI SERT CETTE ROUTE — Vercel, plan Pro.
 *
 * *Huit cents secondes, en disponibilité générale* : le compte Vercel de ce
 * projet est passé du plan Hobby au plan Pro le 20/09/2026. La documentation
 * Vercel du jour (« Duration limits ») porte le maximum du plan Pro à 800 s
 * — généralement disponible, pas en bêta ; la bêta ne concerne que les
 * durées au-delà, jusqu'à 1 800 s, hors de portée de ce fichier.
 *
 * *Ce que ce nombre valait avant, et pourquoi le savoir compte encore* : le
 * premier déploiement de cette branche, sous le plan Hobby d'alors, avait
 * échoué avec `maxDuration=1200` — Vercel refusant tout ce qui dépassait
 * trois cents secondes sur CE plan-là. Ce plafond Hobby (300) est resté ici
 * jusqu'au 20/09/2026 ; il n'est plus le plafond courant, seulement la
 * mesure qui a fait naître cette constante.
 *
 * `maxDuration`, dans la route, ne peut jamais dépasser ce nombre : un
 * gardien statique le confronte (`tests/unit/imports/delais-application.test.ts`).
 */
export const PLAFOND_PLATEFORME_S = 800;

/**
 * Durée maximale de la transaction qui applique un lot : douze minutes et
 * trente secondes.
 *
 * **Portée depuis le plafond du plan Pro** (le compte Vercel de ce projet
 * est passé du plan Hobby au plan Pro le 20/09/2026 — voir
 * `PLAFOND_PLATEFORME_S`), et STRICTEMENT sous ce plafond, marge comprise
 * pour le reste de la route (authentification, redirection) et pour
 * `ATTENTE_CONNEXION_MS` — les deux comptent dans le temps d'exécution de la
 * fonction, pas seulement celui de la transaction. À 500 ms l'aller-retour et
 * DEUX allers-retours par ligne au pire (une écriture, une trace — voir
 * `allersRetoursApplication`), ce plafond couvre jusqu'à 746 lignes de
 * VRAIES modifications simultanées, et un nombre de créations ou de lignes
 * inchangées bien plus grand, puisque celles-ci ne coûtent presque plus rien
 * par ligne. Au-delà, le lot se refuse proprement (`delai_depasse`) plutôt
 * que de dépasser en silence.
 */
export const DUREE_MAXIMALE_MS = 750_000;

/**
 * La même durée, en secondes, arrondie au-dessus — le PLANCHER de ce que
 * `app/api/imports/[id]/appliquer/route.ts` doit déclarer sous `maxDuration`
 * (Next.js), jamais sa valeur exacte.
 *
 * **`maxDuration` ne peut pas valoir exactement ceci, et c'est une
 * arithmétique, pas un choix** : le temps d'exécution de la ROUTE couvre
 * `ATTENTE_CONNEXION_MS` ET `DUREE_MAXIMALE_MS` — l'attente d'une connexion
 * fait partie du temps passé dans la fonction, pas seulement le temps de la
 * transaction —, PLUS ce que la route fait hors de la transaction
 * (authentification, redirection). `maxDuration` doit donc dépasser
 * `DUREE_MAXIMALE_S`, jamais lui être égal au chiffre près.
 *
 * **La route ne l'IMPORTE PAS**, et ce n'est pas un choix : Next.js analyse
 * `export const maxDuration` STATIQUEMENT, avant toute exécution, et refuse
 * de construire dès qu'il y lit un identifiant importé plutôt qu'un nombre —
 * mesuré au premier `pnpm build` de ce ticket. `maxDuration` est donc un
 * littéral écrit à la main dans la route. Le lien entre les nombres est tenu
 * par un gardien qui lit le FICHIER SOURCE de la route en texte plutôt que
 * par un import : `tests/unit/imports/delais-application.test.ts`, qui exige
 * `DUREE_MAXIMALE_S < maxDuration ≤ PLAFOND_PLATEFORME_S` — la leçon du
 * premier déploiement échoué porte sur le second morceau de cette double
 * inégalité, le premier vaut depuis la toute première rédaction de ce délai.
 */
export const DUREE_MAXIMALE_S = Math.ceil(DUREE_MAXIMALE_MS / 1000);

/**
 * Attente maximale d'une connexion avant le `BEGIN` : vingt secondes — même
 * raison qu'au seed (`ATTENTE_CONNEXION_MS`) : une base Neon en veille met
 * plusieurs secondes à se réveiller. *Resserrée depuis trente secondes* pour
 * laisser sa marge à `maxDuration` sous le plafond de la plateforme : elle
 * compte, elle aussi, dans le temps d'exécution total de la route.
 */
export const ATTENTE_CONNEXION_MS = 20_000;

/** Les délais à passer à `avecContexteApplicatif` pour appliquer un lot. */
export const DELAIS_APPLICATION: DelaisTransaction = {
  maxWait: ATTENTE_CONNEXION_MS,
  timeout: DUREE_MAXIMALE_MS,
};

/**
 * Le nombre d'allers-retours de la transaction d'application, AU PIRE, pour
 * un lot de `nombreDeLignes` lignes retenues (créations + modifications).
 *
 * **Ce n'est pas une mesure, c'est un budget** — la même distinction qu'au
 * seed : son seul emploi est de faire échouer le gardien de délai quand
 * l'application grossit au point que `DUREE_MAXIMALE_MS` ne suffit plus.
 *
 * ## LE COMPTE, DEPUIS LA RÉDUCTION DU POINT 1 (suite du 16/09/2026)
 *
 * Hors lignes (SEPT, une fois par lot, jamais par ligne) : le `BEGIN`, le
 * `set_config` unique de `poserContexte`, la lecture du lot et de ses lignes,
 * l'écriture GROUPÉE des créations (`createMany`, un seul aller-retour quel
 * que soit leur nombre), la lecture GROUPÉE des « avant » des modifications
 * (`findMany … id IN […]`, un seul aller-retour quel que soit leur nombre),
 * la mise à jour finale du lot, et le `COMMIT`.
 *
 * Par ligne, AU PIRE DEUX — contre trois avant cette réduction : une
 * modification RÉELLEMENT écrite coûte son ÉCRITURE et sa TRACE (aucune
 * lecture : elle est déjà dans le lot groupé ci-dessus) ; une CRÉATION ne
 * coûte plus que sa TRACE (son écriture est, elle aussi, dans le lot
 * groupé). *Le budget prend le pire des deux* — DEUX — parce qu'il ne sait
 * pas d'avance quelle proportion du lot sera l'un ou l'autre, et qu'une
 * modification coûte plus qu'une création. Une ligne INCHANGÉE, elle, ne
 * coûte plus RIEN de plus que sa part de la lecture groupée — c'est le
 * bénéfice du point 1 de la session précédente, entier depuis cette
 * réduction : un lot de N lignes TOUTES inchangées ne coûte que le socle fixe
 * ci-dessus, quel que soit N.
 */
export function allersRetoursApplication(nombreDeLignes: number): number {
  const PAR_LIGNE_AU_PIRE = 2;
  // BEGIN, set_config, lecture du lot, createMany des créations, lecture
  // groupée des avant, mise à jour du lot, COMMIT.
  const HORS_LIGNES = 7;
  return HORS_LIGNES + PAR_LIGNE_AU_PIRE * nombreDeLignes;
}

/**
 * CE QUE CE FICHIER APPELLE UN BUDGET, MESURÉ UNE FOIS (IMPORT-2, 23/09/2026).
 *
 * `scripts/mesure-delais-import.mts` rejoue `appliquerLeLotDeClients` en
 * conditions réelles (rôle applicatif, base locale jetable) à plusieurs
 * tailles, pour les deux régimes — créations et VRAIES modifications — et
 * écrit le résultat dans `docs/propositions/23-IMPORT-2/mesure.md`. Ce que
 * cette mesure montre, en local : le coût par ligne (~0,5 ms en création,
 * ~0,9 ms en modification — le double, comme le docblock d'
 * `allersRetoursApplication` l'affirme) est des CENTAINES de fois plus bas
 * que `LATENCE_PESSIMISTE_MS` ne le budgète, si bien que la casse mesurée
 * (extrapolée, jamais atteinte en local) se situe entre huit cent mille et un
 * million et demi de lignes, contre 746 pour le budget théorique.
 *
 * **Ce que la mesure NE dit PAS** — écrit là plutôt que résumé ici, pour ne
 * pas s'en tenir à une lecture optimiste hors de son contexte : elle tourne
 * en local, jamais contre la base hébergée (Neon, latence réseau, mise en
 * veille), et sur l'entité « clients », jamais sur « historique » ou « VGP »
 * — les imports RÉELS d'Alexis, qui ne savent que créer. Le rapport entre les
 * deux — combien de fois la latence réelle vers Neon dépasse la latence
 * locale — reste à mesurer, pas à supposer.
 */

/**
 * DEPUIS LE 23/09/2026 (MESURE-1), CE BUDGET N'EST PLUS LA SEULE SOURCE.
 *
 * Le chemin qu'il budgète mesure désormais chaque application RÉELLE :
 * `import_lot.duree_application_ms` (`prisma/schema.prisma`), écrite par
 * `appliquerLesLignes` (`lib/imports/application.ts`) au chronomètre
 * (`process.hrtime.bigint()`), du début du travail jusqu'à son `COMMIT`. Ce
 * n'est toujours pas ce fichier qui change : `DUREE_MAXIMALE_MS`,
 * `PLAFOND_PLATEFORME_S` et `LATENCE_PESSIMISTE_MS` restent les mêmes
 * nombres — relever un plafond sur la foi d'une première mesure serait
 * exactement la faute que le premier déploiement de ce chemin a déjà coûtée.
 * *Ce que la mesure réelle donne, à qui veut confronter le budget à la
 * production* : l'écran d'un lot (`app/(back-office)/imports/[id]/page.tsx`)
 * montre sa durée, et le journal des chargements en accumule un par import.
 */
