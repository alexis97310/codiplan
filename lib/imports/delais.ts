import type { DelaisTransaction } from "@/lib/db/rls";

/**
 * LES DÉLAIS DE LA TRANSACTION QUI APPLIQUE UN LOT (point 2 de la session du
 * 16/09/2026).
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
 * **Même arithmétique que `prisma/seed-delais.ts`, et elle doit être relue
 * avec lui** : la durée d'une transaction est, à la milliseconde de calcul
 * près, son nombre d'ALLERS-RETOURS multiplié par la LATENCE majorée. Le
 * nombre d'allers-retours se compte (`allersRetoursApplication`), la latence
 * se majore, et le produit doit tenir sous `DUREE_MAXIMALE_MS` —
 * `tests/unit/imports/delais-application.test.ts` échoue le jour où il n'y
 * tient plus plutôt que de laisser revenir l'incident.
 *
 * **Ce que ce budget ne fait PAS** : réduire le nombre d'allers-retours par
 * ligne. C'est le point 1 de la même session (`porteEncore`, appelé avant
 * d'écrire) qui fait le plus gros de ce travail — une ligne INCHANGÉE ne
 * coûte plus qu'une lecture, contre trois avant elle — et le point 4 qui
 * MESURE ce qu'il en reste plutôt que de le taire.
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
 * Durée maximale de la transaction qui applique un lot : vingt minutes.
 *
 * À 500 ms l'aller-retour et trois allers-retours par ligne AU PIRE (une
 * lecture, une écriture, une trace — voir `allersRetoursApplication`), le lot
 * mesuré en production — 615 lignes classées MODIFICATION — coûte 1 850
 * allers-retours au pire, soit 925 s si AUCUNE n'était inchangée. Ce plafond
 * lui laisse de la marge (`tests/unit/imports/delais-application.test.ts`
 * l'éprouve) : *avant même le bénéfice du point 1*, qui ramène 615 lignes
 * réellement identiques à 615 simples LECTURES — le cas exact de la mesure.
 * Un lot plus lourd que cela demandera de réduire le nombre d'allers-retours
 * par ligne plutôt que de relever encore ce délai (voir le point 4 de la
 * session : la mesure est écrite, pas réduite, dans ce ticket).
 */
export const DUREE_MAXIMALE_MS = 1_200_000;

/**
 * La même durée, en secondes, arrondie au-dessus — celle que
 * `app/api/imports/[id]/appliquer/route.ts` doit déclarer sous
 * `maxDuration` (Next.js).
 *
 * **La route ne l'IMPORTE PAS**, et ce n'est pas un choix : Next.js analyse
 * `export const maxDuration` STATIQUEMENT, avant toute exécution, et refuse
 * de construire dès qu'il y lit un identifiant importé plutôt qu'un nombre —
 * mesuré au premier `pnpm build` de ce ticket. `maxDuration` est donc un
 * littéral écrit à la main dans la route, exactement le genre de seconde
 * constante que ce module existe pour éviter ailleurs (§9, 01/09). Le lien
 * entre les deux nombres est tenu par un gardien qui lit le FICHIER SOURCE de
 * la route en texte plutôt que par un import :
 * `tests/unit/imports/delais-application.test.ts`.
 */
export const DUREE_MAXIMALE_S = Math.ceil(DUREE_MAXIMALE_MS / 1000);

/**
 * Attente maximale d'une connexion avant le `BEGIN` : trente secondes — même
 * raison qu'au seed (`ATTENTE_CONNEXION_MS`) : une base Neon en veille met
 * plusieurs secondes à se réveiller.
 */
export const ATTENTE_CONNEXION_MS = 30_000;

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
 * Compté dans l'ordre où `appliquerLesLignes` (`lib/imports/application.ts`)
 * les émet : le `BEGIN`, le `set_config` unique de `poserContexte`, la
 * lecture du lot et de ses lignes, PAR LIGNE au pire trois allers-retours —
 * la lecture d'AVANT que `porteEncore` compare, l'écriture, et la trace posée
 * sur la ligne —, la mise à jour finale du lot, et le `COMMIT`. *Au pire*
 * parce qu'une ligne INCHANGÉE n'en coûte qu'un (la lecture, sans écriture ni
 * trace) et qu'une ligne dont le parent a disparu n'en coûte aucun de plus —
 * le budget majore, il ne prétend pas mesurer ce qu'un lot réel produira.
 */
export function allersRetoursApplication(nombreDeLignes: number): number {
  const PAR_LIGNE_AU_PIRE = 3;
  const HORS_LIGNES = 5; // BEGIN, set_config, lecture du lot, mise à jour du lot, COMMIT
  return HORS_LIGNES + PAR_LIGNE_AU_PIRE * nombreDeLignes;
}
