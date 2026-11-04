import type { PrismaClient } from "@prisma/client";

/**
 * L'INSTRUMENT DE MESURE — ÉPREUVE SEULE (9ID-PERFORMANCES-MESURE-ET-CORRECTIFS).
 *
 * Rien dans `lib/` n'importe ce module : il n'est JAMAIS actif en production.
 * Il instrumente un client Prisma déjà connecté (`clientApp()`, rôle
 * applicatif, base jetable) pour une mesure de page :
 *
 *   - `compteur.requetes` — le nombre de requêtes SQL émises (chaque
 *     opération Prisma, modèle ou brute, compte pour une) ;
 *   - `compteur.transactions` — le nombre de `$transaction` ouvertes, c'est-à-
 *     dire le nombre d'allers-retours RLS (`avecContexteRls` en ouvre une à
 *     chaque appel) ;
 *   - le DÉLAI ARTIFICIEL (`MESURE_PERFORMANCE_DELAI_MS`), posé avant chaque
 *     requête SI la variable d'environnement est renseignée. Tant que les
 *     requêtes d'un rendu s'enchaînent en séquence, le temps de rendu croît
 *     d'autant ; regroupées en `Promise.all`, le délai ne compte qu'une fois.
 *     **Profondeur séquentielle ≈ temps de rendu ÷ délai.**
 *
 * Le délai par défaut est NUL (`0`) : un scénario qui instrumente sans poser
 * la variable ne mesure que des COMPTES, jamais un temps artificiellement
 * ralenti — c'est la bascule qui garde ce module inoffensif tant qu'on ne
 * demande pas explicitement la mesure du temps.
 */

const VARIABLE_DELAI = "MESURE_PERFORMANCE_DELAI_MS";

/** Compteurs accumulés par un client instrumenté. */
export type CompteurMesure = {
  /** Nombre total de requêtes SQL (chaque opération Prisma, brute ou non). */
  requetes: number;
  /** Nombre de `$transaction` ouvertes sur ce client. */
  transactions: number;
  /** Détail par modèle/opération — utile pour nommer la cause d'un pire cas. */
  parOperation: Record<string, number>;
};

export type ClientInstrumente = {
  /** Le client à passer aux fonctions de dépôt (paramètre `client` optionnel). */
  client: PrismaClient;
  /** Les compteurs, mis à jour au fil des appels. */
  compteur: CompteurMesure;
  /** Remet les compteurs à zéro sans rouvrir de connexion. */
  reinitialiser: () => void;
};

function compteurVide(): CompteurMesure {
  return { requetes: 0, transactions: 0, parOperation: {} };
}

function delaiConfigureMs(): number {
  const valeur = process.env[VARIABLE_DELAI];
  if (!valeur) {
    return 0;
  }
  const ms = Number(valeur);
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

function attendre(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Instrumente `base` (un client déjà connecté, p. ex. `clientApp()`) : les
 * requêtes qui transitent par le client retourné — et par tout `tx` reçu
 * d'une transaction ouverte sur lui — sont comptées, et retardées si
 * `MESURE_PERFORMANCE_DELAI_MS` est posée.
 *
 * `base` reste utilisable tel quel par ailleurs : ceci retourne un NOUVEAU
 * client (`$extends`), rien n'est modifié sur `base`.
 */
export function instrumenter(base: PrismaClient): ClientInstrumente {
  const compteur = compteurVide();
  const delai = delaiConfigureMs();

  const etendu = base.$extends({
    name: "mesure-performance-9id",
    query: {
      async $allOperations({ model, operation, args, query }) {
        compteur.requetes += 1;
        const cle = model ?? operation;
        compteur.parOperation[cle] = (compteur.parOperation[cle] ?? 0) + 1;
        if (delai > 0) {
          await attendre(delai);
        }
        return query(args);
      },
    },
  }) as unknown as PrismaClient;

  // `$extends` ne couvre pas `$transaction` lui-même (ce n'est pas une
  // « opération » au sens de l'extension) : compté séparément, en gardant le
  // comportement d'origine pour le reste.
  const transactionDOrigine = etendu.$transaction.bind(etendu);
  const transactionComptee = ((...args: unknown[]) => {
    compteur.transactions += 1;
    return (
      transactionDOrigine as (
        ...a: unknown[]
      ) => ReturnType<PrismaClient["$transaction"]>
    )(...args);
  }) as PrismaClient["$transaction"];
  Object.assign(etendu, { $transaction: transactionComptee });

  return {
    client: etendu,
    compteur,
    reinitialiser: () => {
      compteur.requetes = 0;
      compteur.transactions = 0;
      compteur.parOperation = {};
    },
  };
}

/**
 * Convertit un temps de rendu mesuré (millisecondes) en profondeur
 * séquentielle approchée, sachant le délai artificiel posé sur CE rendu.
 * `delaiMs` à 0 rend `NaN` plutôt qu'une division par zéro silencieuse : un
 * scénario qui l'appelle sans délai artificiel configuré s'est trompé d'outil.
 */
export function profondeurSequentielle(
  dureeMs: number,
  delaiMs: number,
): number {
  if (delaiMs <= 0) {
    return NaN;
  }
  return Math.round(dureeMs / delaiMs);
}
