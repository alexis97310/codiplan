import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  avecConsolidation,
  VARIABLE_URL_CONSOLIDATION,
} from "@/lib/reporting/connexion";

import {
  clientApp,
  clientOwner,
  fermerClients,
  urlApp,
  urlReporting,
} from "./setup/db";
import { UTILISATEUR_INTERNE_A } from "./setup/fixtures";

/**
 * LE SEUL CHEMIN QUI TRAVERSE LE CLOISONNEMENT, ÉPROUVÉ (D21, D38).
 *
 * ## POURQUOI CE FICHIER EXISTE
 *
 * `avecConsolidation` ouvre la connexion `codiplan_reporting`, qui est
 * **`BYPASSRLS`** : c'est la seule du dépôt qui lise au-dessus des sociétés.
 * D21 lui pose trois garde-fous, et le deuxième est un COMPORTEMENT plutôt
 * qu'un privilège — *toute requête est journalisée avec l'utilisateur
 * d'origine*. **Aucun test ne l'exécutait.**
 *
 * Les privilèges, eux, étaient déjà gardés — `tests/isolation/reporting.test.ts`
 * les mesure dans `role_table_grants`, et un gardien statique refuse que la
 * variable d'environnement soit nommée hors de `lib/reporting/`. *Ce qui
 * manquait est la fonction elle-même : la seule porte, et personne ne l'avait
 * jamais poussée.*
 *
 * ## LES DEUX COMPORTEMENTS GARDÉS
 *
 *   1. **La trace précède la requête.** Une consolidation qui ÉCHOUE laisse
 *      quand même la trace de qui l'a demandée — sinon il suffirait de faire
 *      échouer sa requête pour lire sans laisser d'ombre.
 *   2. **Une URL qui n'est pas celle de `codiplan_reporting` est REFUSÉE.** Le
 *      §5 du CLAUDE.md en fait un interdit absolu : *ce rôle voit toutes les
 *      sociétés et peut se connecter — c'est une clé passe-partout.* Un
 *      déploiement qui y poserait `DATABASE_URL` rendrait l'application
 *      capable de contourner son propre cloisonnement.
 *
 * ## LA MÉMOÏSATION EST REMISE À ZÉRO ENTRE LES CAS, ET C'EST NÉCESSAIRE
 *
 * `clientConsolidation` et `garantirRoleConsolidation` mémorisent sur
 * `globalThis`, **échec compris** : sans remise à zéro, le second cas
 * mesurerait la décision prise au premier. *Deux cas qui partagent un cache ne
 * sont pas deux mesures.*
 */

type CacheConsolidation = {
  prismaConsolidation?: unknown;
  controleRoleConsolidation?: unknown;
};

function oublierLaConnexion(): void {
  const cache = globalThis as unknown as CacheConsolidation;
  delete cache.prismaConsolidation;
  delete cache.controleRoleConsolidation;
}

const urlDOrigine = process.env[VARIABLE_URL_CONSOLIDATION];

afterAll(async () => {
  if (urlDOrigine === undefined) {
    delete process.env[VARIABLE_URL_CONSOLIDATION];
  } else {
    process.env[VARIABLE_URL_CONSOLIDATION] = urlDOrigine;
  }
  await fermerClients();
});

beforeEach(oublierLaConnexion);

afterEach(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "journal_acces" WHERE "evenement" = 'requete_consolidation'`,
  );
});

async function tracesDeConsolidation(): Promise<
  Array<{ utilisateur_id: string | null; detail: string | null }>
> {
  return clientOwner().$queryRawUnsafe(
    `SELECT "utilisateur_id", "detail" FROM "journal_acces"
      WHERE "evenement" = 'requete_consolidation'
      ORDER BY "id"`,
  );
}

const ORIGINE = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  role: Role.direction,
  motif: "chiffre d'affaires consolidé des deux sociétés",
};

describe("la trace PRÉCÈDE la requête", () => {
  it("une consolidation laisse son origine au journal d'accès", async () => {
    process.env[VARIABLE_URL_CONSOLIDATION] = urlReporting();

    const societes = await avecConsolidation(
      ORIGINE,
      (client) =>
        client.$queryRawUnsafe<Array<{ n: bigint }>>(
          `SELECT count(*) AS "n" FROM "societe"`,
        ),
      clientApp(),
    );

    // TÉMOIN — la connexion a bien LU au-dessus du cloisonnement. Sans lui, une
    // trace écrite et une requête qui ne rend rien se ressembleraient (§9,
    // 30/08) : *un décompte nul ressemble toujours à un sans-faute.*
    expect(Number(societes[0]?.n)).toBeGreaterThanOrEqual(2);

    const traces = await tracesDeConsolidation();
    expect(traces).toHaveLength(1);
    expect(traces[0]?.utilisateur_id).toBe(UTILISATEUR_INTERNE_A);
    expect(traces[0]?.detail).toBe(ORIGINE.motif);
  });

  it("une requête qui ÉCHOUE laisse quand même la trace", async () => {
    // *Sinon il suffirait de faire échouer sa requête pour lire sans laisser
    // d'ombre* — et c'est le cas qui compte, puisqu'il est le seul qu'un
    // curieux puisse provoquer.
    process.env[VARIABLE_URL_CONSOLIDATION] = urlReporting();

    await expect(
      avecConsolidation(
        ORIGINE,
        (client) =>
          client.$queryRawUnsafe(`SELECT * FROM "table_qui_n_existe_pas"`),
        clientApp(),
      ),
    ).rejects.toThrow();

    const traces = await tracesDeConsolidation();
    expect(traces).toHaveLength(1);
    expect(traces[0]?.utilisateur_id).toBe(UTILISATEUR_INTERNE_A);
  });
});

describe("une URL qui n'est pas celle du rôle de consolidation est REFUSÉE", () => {
  it("l'URL applicative est refusée, et rien n'est lu", async () => {
    // D38 : *ce rôle voit toutes les sociétés et peut se connecter — c'est une
    // clé passe-partout.* Le refus vient de `verifierRoleReporting`, qui exige
    // BYPASSRLS et disqualifie tout droit d'écriture.
    process.env[VARIABLE_URL_CONSOLIDATION] = urlApp();

    await expect(
      avecConsolidation(
        ORIGINE,
        (client) => client.$queryRawUnsafe(`SELECT count(*) FROM "societe"`),
        clientApp(),
      ),
    ).rejects.toThrow();

    // LE REFUS PRÉCÈDE MÊME LA TRACE : `garantirRoleConsolidation` est appelée
    // avant l'écriture au journal. Rien n'a été lu, et rien n'a été écrit.
    expect(await tracesDeConsolidation()).toHaveLength(0);
  });

  it("une variable ABSENTE est refusée, et le refus la NOMME", async () => {
    // *Un contrôle qui se tait quand il n'est pas configuré est le contrôle
    // qu'on croit avoir.* Le refus nomme la variable, jamais l'hôte ni la base
    // (D50).
    delete process.env[VARIABLE_URL_CONSOLIDATION];

    await expect(
      avecConsolidation(ORIGINE, async () => undefined, clientApp()),
    ).rejects.toThrow(VARIABLE_URL_CONSOLIDATION);
  });

  it("LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON", async () => {
    // Sans cette moitié, « ça rejette » serait aussi bien la preuve que la
    // fonction rejette TOUJOURS — et les trois refus ci-dessus ne prouveraient
    // rien (§9, 11/09).
    process.env[VARIABLE_URL_CONSOLIDATION] = urlReporting();

    const lu = await avecConsolidation(
      ORIGINE,
      (client) =>
        client.$queryRawUnsafe<Array<{ un: number }>>(`SELECT 1 AS "un"`),
      clientApp(),
    );
    expect(lu[0]?.un).toBe(1);
  });
});
