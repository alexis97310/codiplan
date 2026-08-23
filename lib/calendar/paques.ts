import { cleJour, jourSuivant, type JourLocal } from "./fuseau";

/**
 * Fêtes mobiles adossées à Pâques (ticket L0-08, point 4).
 *
 * **Ce module produit des DONNÉES, il ne s'exécute pas dans le métier.** Le
 * ticket l'écrit ainsi : « les fêtes mobiles adossées à Pâques peuvent être
 * calculées, mais le calcul produit des données de la table, il ne s'exécute
 * pas à la volée dans le métier ». Il est donc appelé par le seul seed, qui en
 * écrit le résultat dans `jour_ferie` ; aucun chemin applicatif ne l'importe,
 * et `lib/calendar/index.ts` ne le réexporte pas. Le gardien
 * `tests/unit/calendar/sans-date-feriee-en-dur.test.ts` le vérifie.
 *
 * **Pourquoi cette frontière.** Un férié calculé à la volée est un férié qu'on
 * ne peut pas corriger : le jour où un territoire déplace une fête, ou décide
 * qu'un lundi de Pentecôte est travaillé, la correction se fait par une ligne
 * de table et un arbitrage — pas par un correctif logiciel déployé en urgence.
 * Le calcul reste ici parce qu'il évite de recopier deux cents dates à la main,
 * pas parce qu'il ferait autorité.
 */

/**
 * Dimanche de Pâques d'une année grégorienne, par l'algorithme de Meeus.
 *
 * C'est de l'arithmétique pure, exacte de 1583 à 4099 ; elle ne dépend d'aucun
 * fuseau, Pâques étant un jour et non un instant.
 */
export function dimanchePaques(annee: number): JourLocal {
  if (!Number.isInteger(annee) || annee < 1583 || annee > 4099) {
    throw new Error(
      `Année hors du domaine de validité de l'algorithme : ${annee}. ` +
        "Attendu un entier entre 1583 et 4099.",
    );
  }

  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;

  return { annee, mois, jour };
}

/**
 * Le jour situé `decalage` jours après le dimanche de Pâques.
 *
 * **Les LIBELLÉS des fêtes ne sont pas ici** : « Lundi de Pâques »,
 * « Ascension », « Lundi de Pentecôte » sont des données du territoire, et
 * elles vivent avec les autres fériés dans `prisma/seed-data.ts`. Ce module ne
 * connaît qu'un décalage en jours — c'est tout ce que l'arithmétique de Pâques
 * a à dire. Le gardien `tests/unit/calendar/sans-date-feriee-en-dur.test.ts`
 * refuse qu'un férié soit nommé hors du seed.
 */
export function jourAdossePaques(annee: number, decalage: number): JourLocal {
  if (!Number.isInteger(decalage)) {
    throw new Error(
      `Décalage invalide : ${decalage}. Attendu un nombre entier de jours.`,
    );
  }
  return jourSuivant(dimanchePaques(annee), decalage);
}

/** Le même jour, sous sa clé `AAAA-MM-JJ`. */
export function cleJourAdossePaques(annee: number, decalage: number): string {
  return cleJour(jourAdossePaques(annee, decalage));
}
