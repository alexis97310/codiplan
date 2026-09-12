import { afterAll, describe, expect, it } from "vitest";

import {
  clientOwner,
  fermerClients,
  observerSousProprietaire,
} from "./setup/db";
import {
  CLIENT_A1,
  MODELE_A,
  SITE_A1_S1,
  SOCIETE_A,
  VAR_SOCIETE,
} from "./setup/fixtures";

/**
 * D6 — `machine.reference_interne` EST UNIQUE PAR SOCIÉTÉ, LORSQU'ELLE EST
 * PRÉSENTE.
 *
 * ## LE DÉFAUT QUE CET INDEX SUPPRIME, ET IL N'EST PAS THÉORIQUE
 *
 * Quand la plaque d'une machine est illisible, le technicien saisit
 * `SN-INCONNU-<référence interne>` (D6). Cette référence est **saisie** — texte
 * libre facultatif de `lib/machines/saisie.ts`, jamais engendrée ni importée —,
 * si bien qu'*une valeur saisie par un humain n'est unique par aucune
 * construction*. Sans index, deux fiches d'une même société portaient la même
 * référence, donc le même numéro de série de substitution : **le doublon
 * silencieux que D6 existe pour supprimer**, et il apparaît exactement sur les
 * fiches les moins renseignées.
 *
 * ## POURQUOI L'INDEX EST PARTIEL, ET CE QUE LE SCÉNARIO DOIT DONC PROUVER
 *
 * « Lorsqu'elle est présente » n'est pas une nuance : **toutes les machines
 * n'ont pas de référence interne**, et deux fiches sans référence ne sont pas
 * la même machine. Le scénario prouve donc les DEUX moitiés — le refus quand la
 * valeur est là, et le **cas qui doit rester vert pour sa propre raison** quand
 * elle ne l'est pas (§9, 11/09). Sans la seconde, « un refus » serait aussi
 * bien la preuve qu'on ne peut plus écrire de machine du tout.
 */

class Annulation extends Error {}

afterAll(fermerClients);

const REFERENCE = "PONT-DUCOS-07";

/** Deux fiches de la MÊME société, et leur référence interne au choix. */
async function ecrireDeuxMachines(
  reference: string | null,
  avant?: (tx: { $executeRawUnsafe: (...a: unknown[]) => unknown }) => unknown,
): Promise<string> {
  try {
    await clientOwner().$transaction(async (tx) => {
      if (avant !== undefined) {
        await avant(tx as never);
      }
      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VAR_SOCIETE,
        SOCIETE_A,
      );
      for (const [rang, id] of [
        "aaaaaaaa-0000-7000-8000-00000000f001",
        "aaaaaaaa-0000-7000-8000-00000000f002",
      ].entries()) {
        await tx.$executeRawUnsafe(
          `INSERT INTO "machine" ("id", "societe_id", "modele_id", "client_id",
             "site_id", "qr_token", "numero_serie", "reference_interne", "modifie_le")
           VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, $7, $8, now())`,
          id,
          SOCIETE_A,
          MODELE_A,
          CLIENT_A1,
          SITE_A1_S1,
          `jeton-d6-${rang}`,
          `SN-INCONNU-${REFERENCE}-${rang}`,
          reference,
        );
      }
      throw new Annulation();
    });
  } catch (erreur) {
    if (erreur instanceof Annulation) {
      return "";
    }
    return String(erreur);
  }
  return "";
}

describe("D6 — deux fiches d'une société ne partagent pas une référence interne", () => {
  it("le second doublon est refusé, et le refus DÉSIGNE le bon verrou", async () => {
    const motif = await ecrireDeuxMachines(REFERENCE);
    /*
     * ── CE QUE L'ASSERTION NOMME, ET POURQUOI PAS LE NOM DE L'INDEX ─────────
     *
     * §9, 24/08 : *l'assertion NOMME la contrainte, sans quoi un refus venu
     * d'ailleurs passe pour le bon.* Mesuré ici : sur un `$executeRawUnsafe`,
     * **Prisma ne rend pas le nom de l'index** — le message reçu est
     * `Code: 23505 … Key (societe_id, reference_interne)=(…) already exists`.
     *
     * Le COUPLE DE COLONNES tient donc le même rôle, et le scénario suivant
     * prouve qu'il le tient bien : **un seul index unique de `machine` porte
     * exactement ce couple.** Assertion et témoin ensemble disent ce que le nom
     * aurait dit seul ; l'un sans l'autre ne le dirait pas.
     */
    expect(motif).toContain("23505");
    expect(motif).toContain("(societe_id, reference_interne)");
  });

  it("TÉMOIN — un seul index unique porte ce couple de colonnes", async () => {
    const index = await observerSousProprietaire(
      "énumérer les index uniques de « machine » qui portent exactement " +
        "(societe_id, reference_interne) : c'est ce décompte qui fait du couple " +
        "de colonnes une désignation aussi précise que le nom de l'index.",
    ).$queryRawUnsafe<Array<{ indexname: string }>>(
      `SELECT indexname FROM pg_indexes
        WHERE tablename = 'machine'
          AND indexdef LIKE '%UNIQUE%'
          AND indexdef LIKE '%(societe_id, reference_interne)%'`,
    );
    expect(index.map((i) => i.indexname)).toEqual([
      "machine_societe_reference_interne_key",
    ]);
  });

  it("LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON — deux fiches SANS référence passent", async () => {
    // *Toutes les machines n'en ont pas*, et deux `NULL` ne sont pas la même
    // machine. C'est la clause `WHERE … IS NOT NULL` de l'index qui le dit, et
    // c'est elle qu'un `@@unique` de Prisma aurait tue.
    const motif = await ecrireDeuxMachines(null);
    expect(motif).toBe("");
  });

  it("JUMEAU — l'index retiré, le doublon PASSE", async () => {
    let ecrites = 0;
    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP INDEX "machine_societe_reference_interne_key"`,
        );
        await tx.$executeRawUnsafe(
          "SELECT set_config($1, $2, true)",
          VAR_SOCIETE,
          SOCIETE_A,
        );
        for (const [rang, id] of [
          "aaaaaaaa-0000-7000-8000-00000000f003",
          "aaaaaaaa-0000-7000-8000-00000000f004",
        ].entries()) {
          ecrites += await tx.$executeRawUnsafe(
            `INSERT INTO "machine" ("id", "societe_id", "modele_id", "client_id",
               "site_id", "qr_token", "numero_serie", "reference_interne", "modifie_le")
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, $7, $8, now())`,
            id,
            SOCIETE_A,
            MODELE_A,
            CLIENT_A1,
            SITE_A1_S1,
            `jeton-d6-jumeau-${rang}`,
            `SN-INCONNU-JUMEAU-${rang}`,
            REFERENCE,
          );
        }
        // Le DDL est transactionnel en PostgreSQL : l'index revient au
        // `ROLLBACK`, et le jumeau rejoue à chaque `pnpm verify` au lieu d'être
        // une vérification faite une fois à la main.
        throw new Annulation();
      });
    } catch (erreur) {
      if (!(erreur instanceof Annulation)) {
        throw erreur;
      }
    }
    // LA VIOLATION A BIEN EU LIEU (§9, 30/08) : sans ce décompte, le jumeau
    // serait vert sans avoir écrit la moindre ligne.
    expect(ecrites).toBe(2);
  });

  it("TÉMOIN — l'index est bien revenu après le jumeau", async () => {
    const [presence] = await observerSousProprietaire(
      "lire pg_class après le jumeau : un DROP INDEX qui ne serait pas annulé " +
        "laisserait tous les scénarios suivants verts sur une base sans verrou.",
    ).$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*) AS "n" FROM pg_class
        WHERE relname = 'machine_societe_reference_interne_key'`,
    );
    expect(Number(presence?.n)).toBe(1);
  });
});
