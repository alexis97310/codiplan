import type { DelaisTransaction } from "../lib/db/rls";

import {
  type SocieteSeed,
  anneeDeDepartFeries,
  ecartsDeLAgence,
} from "./seed-data";

/**
 * Les délais de la transaction du seed, et l'arithmétique qui les fixe.
 *
 * **Le défaut de Prisma est une valeur de réseau local.** Une transaction
 * interactive expire au bout de 5 000 ms, et l'attente d'une connexion au bout
 * de 2 000 ms. Sur un PostgreSQL jetable en local, un aller-retour coûte une
 * milliseconde : la transaction du seed en enchaîne une trentaine et se termine
 * en quelques dizaines de millisecondes, très loin du plafond. Sur la base
 * hébergée — Neon, `ap-southeast-2`, Sydney — chaque aller-retour coûte deux
 * cents millisecondes depuis un exécuteur GitHub. Le même code franchit alors
 * le plafond AU MILIEU de la transaction, et Prisma répond P2028 : la
 * transaction a déjà été fermée par le moteur, la requête suivante ne la
 * retrouve plus.
 *
 * Le remède N'EST PAS de découper la transaction : le seed doit rester
 * atomique, une société à moitié écrite est pire qu'un seed en échec. Le remède
 * est de dire explicitement combien de temps cette transaction a le droit de
 * durer, et de le dire en fonction de ce qu'elle fait.
 *
 * **L'arithmétique.** La durée d'une transaction du seed est, à la
 * milliseconde de calcul près, son nombre d'ALLERS-RETOURS multiplié par la
 * LATENCE. Le nombre d'allers-retours se compte (`allersRetoursTransaction`) ;
 * la latence se majore. Le produit doit tenir sous `DUREE_MAXIMALE_MS`, et
 * `tests/unit/seed-delais.test.ts` échoue le jour où il n'y tient plus — c'est
 * ce test, pas cette constante, qui est le garde-fou : il redemande la question
 * à chaque fois que le seed grossit.
 */

/**
 * Latence majorée d'un aller-retour vers la base hébergée, en millisecondes.
 *
 * L'incident du 23 août 2026 en donne la mesure : l'étape de seed a duré 15 s
 * pour environ 66 allers-retours, soit près de 200 ms l'unité. On majore à
 * 500 ms pour absorber la gigue, un réveil de la base après mise en veille et
 * une journée où le réseau est mauvais. Ce n'est pas une valeur métier — aucun
 * chapitre 10 ne la fixe — c'est une borne d'infrastructure, et elle est écrite
 * ici pour être révisée en connaissance de cause plutôt que devinée.
 */
export const LATENCE_PESSIMISTE_MS = 500;

/**
 * Durée maximale d'une transaction du seed : deux minutes.
 *
 * À 500 ms l'aller-retour, cela autorise 240 écritures consécutives dans une
 * même transaction, contre une trentaine aujourd'hui. La marge est large
 * volontairement : ce délai ne protège de rien — il n'existe que pour qu'une
 * transaction réellement bloquée finisse par rendre la main — et le vrai
 * plafond de l'étape est le `timeout-minutes: 20` du workflow.
 */
export const DUREE_MAXIMALE_MS = 120_000;

/**
 * Attente maximale d'une connexion avant le `BEGIN` : trente secondes.
 *
 * Les 2 000 ms de Prisma supposent, là encore, une base à portée de main. Une
 * base Neon en veille met plusieurs secondes à se réveiller, et c'est
 * exactement la situation d'un seed déclenché à la main sur une base qui ne
 * sert pas en continu.
 */
export const ATTENTE_CONNEXION_MS = 30_000;

/** Les délais à passer à chaque transaction du seed. */
export const DELAIS_SEED: DelaisTransaction = {
  maxWait: ATTENTE_CONNEXION_MS,
  timeout: DUREE_MAXIMALE_MS,
};

/**
 * Le nombre d'allers-retours de la transaction cloisonnée d'une société.
 *
 * **Ce décompte suit la forme de `seed.ts` et doit être relu avec lui.** Il
 * n'est pas une mesure, c'est un budget : son seul emploi est de faire échouer
 * `tests/unit/seed-delais.test.ts` quand le seed grossit au point que le délai
 * fixé ci-dessus ne suffit plus. Un décompte légèrement faux ne casse donc
 * rien ; un décompte absent laisserait revenir l'incident.
 *
 * Ce qui est compté, dans l'ordre où `seed.ts` l'émet : le `BEGIN`, les deux
 * `set_config` de `avecSociete`, la société, chaque calendrier, chaque plage,
 * chaque agence, chaque écart local, la lecture du férié que certains écarts
 * résolvent, et le `COMMIT`.
 */
export function allersRetoursTransaction(societe: SocieteSeed): number {
  const anneeDeDepart = anneeDeDepartFeries(societe);

  const plages = societe.calendriers.reduce(
    (total, calendrier) => total + calendrier.plages.length,
    0,
  );

  let ecarts = 0;
  let lecturesFerie = 0;
  for (const agence of societe.agences) {
    for (const ecart of ecartsDeLAgence(agence, anneeDeDepart)) {
      ecarts += 1;
      if (ecart.ferie_libelle !== null) {
        lecturesFerie += 1;
      }
    }
  }

  return (
    1 + // BEGIN
    2 + // set_config app.societe_id, app.role
    1 + // societe.upsert
    societe.calendriers.length +
    plages +
    societe.agences.length +
    ecarts +
    lecturesFerie +
    1 // COMMIT
  );
}
