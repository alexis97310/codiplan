import { afterAll, describe, expect, it } from "vitest";

import { VARIABLES_CONTEXTE } from "@/lib/db/rls";

import {
  SQL_DEMANDES_CONTEXTE,
  demandesContexte,
  ecartsContexteArme,
  type ExpressionObservee,
} from "../../scripts/lib/contexte-rls";
import { clientApp, clientOwner, fermerClients } from "./setup/db";

/**
 * LE CONTEXTE EST-IL ARMÉ ? (ticket L1-02b)
 *
 * **Ce que ce fichier garde, et que rien ne gardait.** Vingt et un fichiers de
 * scénarios prouvent que les politiques mordent. Aucun ne prouvait que le
 * CHEMIN DE PRODUCTION pose les variables que ces politiques lisent — parce que
 * chaque scénario pose le contexte lui-même, par le harnais. Les deux étaient
 * verts, et ils divergeaient : `app.client_id` et `app.perimetre_sites`,
 * réclamées par cinq politiques depuis L1-01 et L1-02, n'étaient posées par
 * aucun chemin de production.
 *
 * **Deux mesures de nature différente, et il faut les deux.** La première est
 * STATIQUE — ce que la base réclame, contre ce que le dépôt déclare poser. La
 * seconde est VIVANTE : sous un contexte posé par `lib/db/rls.ts` lui-même,
 * chaque variable réclamée doit être réellement définie. La première attrape la
 * variable qu'on oublie de déclarer ; la seconde attrape la liste juste dont
 * l'implémentation a cessé de la parcourir. Une liste et un comportement qui se
 * ressemblent ne se contrôlent pas l'un l'autre (§9, 01/09).
 */

/** Sentinelle d'annulation : elle fait retomber la transaction, sans erreur. */
class Annulation extends Error {}

function lireExpressions(client: {
  $queryRawUnsafe: <T>(sql: string) => Promise<T>;
}): Promise<ExpressionObservee[]> {
  return client.$queryRawUnsafe<ExpressionObservee[]>(SQL_DEMANDES_CONTEXTE);
}

const observees = await lireExpressions(clientOwner());
const demandes = demandesContexte(observees);

afterAll(fermerClients);

describe("ce que la base réclame est posé par le chemin de production", () => {
  it("n'observe aucun écart", () => {
    const ecarts = ecartsContexteArme(demandes);
    expect(ecarts, ecarts.join("\n")).toEqual([]);
  });

  it("a réellement lu des expressions et des variables — témoin de non-vacuité", () => {
    // Un décompte nul ressemble toujours à un sans-faute (§9, 30/08).
    expect(observees.length).toBeGreaterThan(20);
    expect(demandes.length).toBeGreaterThanOrEqual(4);

    const variables = demandes.map((demande) => demande.variable);
    // Les deux qui manquaient. Si elles cessent d'être RÉCLAMÉES, ce n'est plus
    // ce gardien qui a raison : c'est la forme « parc » qui a été démontée.
    expect(variables).toContain("app.client_id");
    expect(variables).toContain("app.perimetre_sites");
    // Et celle qu'aucune politique ne nomme : elle n'est lue qu'à travers
    // `app_role()`. Un gardien qui n'aurait regardé que `pg_policies` serait
    // resté creux sur elle.
    expect(variables).toContain("app.role");
  });

  it("nomme les objets qui réclament chaque variable", () => {
    const client = demandes.find((d) => d.variable === "app.client_id");
    expect(client?.sources.some((s) => s.startsWith("politique "))).toBe(true);

    const role = demandes.find((d) => d.variable === "app.role");
    expect(role?.sources).toContain("fonction app_role");
  });
});

describe("preuve VIVANTE : le module de production pose ce qu'il déclare", () => {
  it("définit réellement chaque variable réclamée par la base", async () => {
    // Le contexte est posé par `lib/db/rls.ts`, jamais par le harnais : ce
    // qu'on éprouve n'est pas qu'une variable bien posée soit bien lue, c'est
    // que le SEUL module qui la pose en production la pose réellement.
    const { avecContexteRls } = await import("@/lib/db/rls");

    const vues = await avecContexteRls(
      clientApp(),
      {
        societeId: "aaaaaaaa-0000-7000-8000-000000000001",
        role: null,
        auteurId: null,
        adresseIp: null,
        clientId: null,
        perimetreSites: [],
      },
      async (tx) => {
        const lignes: string[] = [];
        for (const demande of demandes) {
          const [ligne] = await tx.$queryRawUnsafe<{ definie: boolean }[]>(
            `SELECT current_setting('${demande.variable}', true) IS NOT NULL AS definie`,
          );
          if (ligne?.definie) {
            lignes.push(demande.variable);
          }
        }
        return lignes;
      },
    );

    const manquantes = demandes
      .map((demande) => demande.variable)
      .filter((variable) => !vues.includes(variable));

    expect(
      manquantes,
      "réclamées par la base et NON définies sous le contexte que " +
        `lib/db/rls.ts pose : ${manquantes.join(", ")}`,
    ).toEqual([]);
    // Témoin : la sonde a bien regardé quelque chose.
    expect(vues.length).toBeGreaterThanOrEqual(4);
  });
});

/**
 * Les jumeaux. Chaque refus est éprouvé en retirant RÉELLEMENT le verrou visé,
 * et l'assertion nomme ce qui est perdu (§9, 24/08).
 */
describe("jumeaux — le gardien mord sur la faute telle qu'elle se commettrait", () => {
  it("SENS 1 — retirer une variable du chemin de production la fait nommer", () => {
    // La faute réelle : celle que ce ticket répare. `VARIABLES_CONTEXTE` amputé
    // de `app.client_id`, exactement l'état du dépôt avant L1-02b.
    const ampute = VARIABLES_CONTEXTE.filter(
      (variable) => variable !== "app.client_id",
    );
    expect(ampute, "la variable visée n'a pas été retirée").not.toEqual(
      VARIABLES_CONTEXTE,
    );

    const ecarts = ecartsContexteArme(demandes, ampute);
    expect(ecarts, ecarts.join("\n")).toHaveLength(1);
    expect(ecarts[0]).toContain("app.client_id");
    expect(ecarts[0]).toContain("AUCUN chemin de production");
    // Et il dit QUI la réclame — sans quoi il faut rouvrir une console.
    expect(ecarts[0]).toContain("politique ");
  });

  it("SENS 1bis — l'état exact d'avant le ticket produit DEUX écarts", () => {
    const avant = VARIABLES_CONTEXTE.filter(
      (variable) =>
        variable !== "app.client_id" && variable !== "app.perimetre_sites",
    );
    const ecarts = ecartsContexteArme(demandes, avant);
    expect(ecarts).toHaveLength(2);
  });

  it("SENS 2 — une politique qui lit une variable inconnue est nommée", async () => {
    // La faute est ÉCRITE en base, dans une transaction annulée : le DDL est
    // transactionnel en PostgreSQL. Une politique fabriquée en mémoire aurait
    // prouvé que le motif sait mordre, jamais qu'il mord là où la faute se
    // commet (§9, 21/08).
    let sousLaFaute: ExpressionObservee[] | undefined;
    let sondeVisible = false;

    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `CREATE POLICY "contexte_jumeau" ON "agence" FOR SELECT
             USING ("societe_id" = NULLIF(current_setting('app.agence_id', true), '')::uuid)`,
        );
        sousLaFaute = await lireExpressions(tx);
        sondeVisible = sousLaFaute.some((observee) =>
          observee.expression.includes("app.agence_id"),
        );
        throw new Annulation();
      });
    } catch (erreur) {
      if (!(erreur instanceof Annulation)) throw erreur;
    }

    // La sonde compte autant que l'assertion : c'est elle qui a démasqué les
    // épreuves creuses du 30/08.
    expect(sondeVisible, "la politique fautive n'a pas été écrite").toBe(true);

    const ecarts = ecartsContexteArme(demandesContexte(sousLaFaute ?? []));
    expect(ecarts, ecarts.join("\n")).toHaveLength(1);
    expect(ecarts[0]).toContain("app.agence_id");
    expect(ecarts[0]).toContain("politique agence / contexte_jumeau");
  });

  it("SENS 3 — une lecture creuse est un écart, pas un sans-faute", () => {
    const ecarts = ecartsContexteArme([]);
    expect(ecarts).toHaveLength(1);
    expect(ecarts[0]).toContain("aucune variable de session observée");
  });

  it("la base est bien revenue en l'état après le jumeau", async () => {
    const apres = demandesContexte(await lireExpressions(clientOwner()));
    expect(apres.map((demande) => demande.variable)).not.toContain(
      "app.agence_id",
    );
  });
});
