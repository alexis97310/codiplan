import { afterAll, afterEach, describe, expect, it } from "vitest";

import { uuidv7 } from "@/lib/db/uuid";

import { clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  VAR_SOCIETE,
} from "./setup/fixtures";

/**
 * D8 — LE SECOND AXE : `statut_facturation`, POSÉ PAR LA BASE À LA CLÔTURE.
 *
 * ## CE QUE D8 DIT, MOT POUR MOT
 *
 * > `statut_facturation` passe à `a_facturer` **automatiquement** à l'entrée en
 * > `CLOTUREE`, **sauf** si le type est `garantie`, `recensement` ou si
 * > l'intervention est couverte par un contrat forfaitaire — auquel cas
 * > `non_facturable`.
 *
 * ## POURQUOI CE SCÉNARIO EST EN ISOLATION ET NON EN UNITAIRE
 *
 * **La règle n'est écrite nulle part en TypeScript**, et c'est délibéré : D8
 * dit « automatiquement », et une règle écrite dans un dépôt applicatif est
 * hors d'un `UPDATE` direct, d'un import, d'une reprise. L'écrire des deux
 * côtés serait **deux lectures d'un même critère** (§9, 01/09) — dans l'endroit
 * qui décide si un client est facturé. Il n'y a donc rien à éprouver ailleurs
 * qu'en base.
 *
 * ## LA TROISIÈME EXEMPTION N'EST PAS ÉPROUVÉE, ET C'EST ÉCRIT
 *
 * *« … ou si l'intervention est couverte par un contrat forfaitaire »* : aucune
 * table `contrat` n'existe (lot 4), `intervention` ne porte pas de
 * `contrat_id`. La branche est écrite dans le déclencheur pour n'avoir pas à le
 * rouvrir ce jour-là, et **elle ne peut pas se déclencher** — un scénario qui
 * prétendrait l'éprouver mesurerait le vide.
 */

class Annulation extends Error {}

afterAll(fermerClients);

const jetables: string[] = [];

afterEach(async () => {
  if (jetables.length === 0) {
    return;
  }
  const ids = jetables.splice(0, jetables.length);
  await clientOwner().$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT set_config($1, $2, true)",
      VAR_SOCIETE,
      SOCIETE_A,
    );
    await tx.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = ANY($1::uuid[])`,
      ids,
    );
  });
});

/**
 * Pose une intervention `terminee` prête à être clôturée, et rend son
 * identifiant. `temps_reel_min` est renseigné : sans lui,
 * `intervention_cycle_de_vie` refuse la clôture pour une TOUTE AUTRE raison —
 * *le temps réel est l'entrée de l'arrondi et du plancher* (RG-TAR-05) — et le
 * scénario mesurerait le mauvais refus (§9, 24/08).
 */
async function interventionTerminee(type: string): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  await clientOwner().$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT set_config($1, $2, true)",
      VAR_SOCIETE,
      SOCIETE_A,
    );
    await tx.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
         "agence_id", "type", "statut", "temps_reel_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::"TypeIntervention",
               'terminee', 90, now())`,
      id,
      SOCIETE_A,
      CLIENT_A1,
      SITE_A1_S1,
      AGENCE_A,
      type,
    );
  });
  return id;
}

/** Clôture l'intervention et rend le statut de facturation que la base a posé. */
async function cloturerEtLire(id: string): Promise<string | null> {
  return clientOwner().$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT set_config($1, $2, true)",
      VAR_SOCIETE,
      SOCIETE_A,
    );
    await tx.$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'cloturee' WHERE "id" = $1::uuid`,
      id,
    );
    const [ligne] = await tx.$queryRawUnsafe<
      Array<{ statut_facturation: string | null }>
    >(
      `SELECT "statut_facturation" FROM "intervention" WHERE "id" = $1::uuid`,
      id,
    );
    return ligne?.statut_facturation ?? null;
  });
}

describe("D8 — la naissance est NULLE, et ce n'est aucune des trois valeurs", () => {
  it("une intervention non clôturée n'a PAS de statut de facturation", async () => {
    // *Une nouvelle ligne ne naît jamais sur la réponse négative* (doctrine
    // d'arbitrage §3). Naître `non_facturable` confondrait « pas encore » et
    // « jamais », et `non_facturable` est la valeur que les exemptions VISENT.
    const id = await interventionTerminee("curatif");
    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{ statut_facturation: string | null }>
    >(
      `SELECT "statut_facturation" FROM "intervention" WHERE "id" = $1::uuid`,
      id,
    );
    expect(ligne?.statut_facturation ?? null).toBeNull();
  });
});

describe("D8 — la clôture pose la valeur, et le TYPE décide laquelle", () => {
  it("une intervention ordinaire devient « à facturer »", async () => {
    expect(await cloturerEtLire(await interventionTerminee("curatif"))).toBe(
      "a_facturer",
    );
  });

  it("une intervention de GARANTIE devient « non facturable »", async () => {
    expect(await cloturerEtLire(await interventionTerminee("garantie"))).toBe(
      "non_facturable",
    );
  });

  it("un RECENSEMENT devient « non facturable »", async () => {
    expect(
      await cloturerEtLire(await interventionTerminee("recensement")),
    ).toBe("non_facturable");
  });

  it("LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON — un contrôle réglementaire SE FACTURE", async () => {
    // Sans cette moitié, « non_facturable » partout serait aussi bien la preuve
    // que l'exemption s'applique à tout (§9, 11/09). Les deux types exemptés
    // sont NOMMÉS par D8 ; les sept autres ne le sont pas.
    expect(
      await cloturerEtLire(
        await interventionTerminee("controle_reglementaire"),
      ),
    ).toBe("a_facturer");
  });
});

describe("D8 — une intervention peut NAÎTRE clôturée, et elle porte sa réponse", () => {
  it("un INSERT direct au statut `cloturee` reçoit « à facturer »", async () => {
    /*
     * ── LA FAUTE QUE `verify:full` A TROUVÉE ET QUE `verify` NE VOIT PAS ────
     *
     * Le déclencheur a d'abord été écrit `BEFORE UPDATE` seul. `pnpm db:seed` a
     * échoué :
     *
     *     new row for relation "intervention" violates check constraint
     *     "intervention_cloture_a_son_statut_facturation"
     *
     * *Une intervention peut NAÎTRE clôturée* — le semis en pose, et une reprise
     * d'historique en posera par milliers. Un `INSERT` ne passe par aucun
     * `UPDATE` : la valeur n'était jamais posée, et la contrainte refusait **la
     * ligne honnête**.
     *
     * **`pnpm verify` migre une base VIDE ; c'est `verify:full`, qui sème, qui a
     * vu.** *Une porte qui ne garde pas ce que garde la porte suivante produit
     * des verts sincères et faux* (§11 du protocole).
     */
    const id = uuidv7();
    jetables.push(id);
    const [ligne] = await clientOwner().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VAR_SOCIETE,
        SOCIETE_A,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
           "agence_id", "type", "statut", "temps_reel_min", "modifie_le")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
                 'cloturee', 60, now())`,
        id,
        SOCIETE_A,
        CLIENT_A1,
        SITE_A1_S1,
        AGENCE_A,
      );
      return tx.$queryRawUnsafe<Array<{ statut_facturation: string | null }>>(
        `SELECT "statut_facturation" FROM "intervention" WHERE "id" = $1::uuid`,
        id,
      );
    });
    expect(ligne?.statut_facturation).toBe("a_facturer");
  });

  it("et le TYPE décide aussi à la naissance", async () => {
    const id = uuidv7();
    jetables.push(id);
    const [ligne] = await clientOwner().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VAR_SOCIETE,
        SOCIETE_A,
      );
      await tx.$executeRawUnsafe(
        `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
           "agence_id", "type", "statut", "temps_reel_min", "modifie_le")
         VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'garantie',
                 'cloturee', 60, now())`,
        id,
        SOCIETE_A,
        CLIENT_A1,
        SITE_A1_S1,
        AGENCE_A,
      );
      return tx.$queryRawUnsafe<Array<{ statut_facturation: string | null }>>(
        `SELECT "statut_facturation" FROM "intervention" WHERE "id" = $1::uuid`,
        id,
      );
    });
    expect(ligne?.statut_facturation).toBe("non_facturable");
  });

  it("LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON — une naissance NON clôturée reste NULLE", async () => {
    // Sans cette moitié, « le déclencheur pose une valeur » serait aussi bien la
    // preuve qu'il en pose une à TOUTE naissance — et toute intervention
    // entrerait dans la file de ce qui est à facturer dès sa création.
    const id = await interventionTerminee("curatif");
    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{ statut_facturation: string | null }>
    >(
      `SELECT "statut_facturation" FROM "intervention" WHERE "id" = $1::uuid`,
      id,
    );
    expect(ligne?.statut_facturation ?? null).toBeNull();
  });
});

describe("D8 — le déclencheur n'ÉCRASE jamais une valeur déjà posée", () => {
  it("une intervention déjà « facturée » le reste après sa clôture", async () => {
    /*
     * ── CE QUE CE SCÉNARIO A DÛ CORRIGER, ET LA MESURE QUI L'A IMPOSÉ ───────
     *
     * Il était écrit pour la RÉOUVERTURE — clôturer, marquer « facturée »,
     * rouvrir, reclôturer — et **cette suite est impossible** :
     *
     *     ERROR: Intervention clôturée : elle ne se modifie plus sans trace.
     *     Seule l'annulation reste possible (I5 donne à ANNULEE la préséance
     *     sur CLOTUREE).
     *
     * `cloturee` est TERMINAL (D8), et la base le tient. La garde
     * `statut_facturation IS NULL` ne protège donc PAS d'une réouverture — elle
     * protège d'un **autre chemin** : un retour de facturation, un import, une
     * correction administrative qui poserait la valeur avant la clôture.
     * *Écrire l'inverse aurait donné un scénario vert sur une hypothèse
     * fausse.*
     */
    const id = await interventionTerminee("curatif");
    await clientOwner().$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        "SELECT set_config($1, $2, true)",
        VAR_SOCIETE,
        SOCIETE_A,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "intervention" SET "statut_facturation" = 'facturee' WHERE "id" = $1::uuid`,
        id,
      );
    });
    expect(await cloturerEtLire(id)).toBe("facturee");
  });
});

describe("LA BASE REFUSE UNE CLÔTURE SANS RÉPONSE, et le jumeau le montre", () => {
  it("JUMEAU — le déclencheur retiré, la clôture est REFUSÉE par la contrainte NOMMÉE", async () => {
    const id = await interventionTerminee("curatif");
    let motif = "";
    try {
      await clientOwner().$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `DROP TRIGGER "intervention_facturation_a_la_cloture" ON "intervention"`,
        );
        await tx.$executeRawUnsafe(
          "SELECT set_config($1, $2, true)",
          VAR_SOCIETE,
          SOCIETE_A,
        );
        await tx.$executeRawUnsafe(
          `UPDATE "intervention" SET "statut" = 'cloturee' WHERE "id" = $1::uuid`,
          id,
        );
        throw new Annulation();
      });
    } catch (erreur) {
      motif = erreur instanceof Annulation ? "" : String(erreur);
    }
    // DEUX GARANTIES QUI NE SE RECOUVRENT PAS : le déclencheur POSE, la
    // contrainte REFUSE qu'on s'en passe. Sans la seconde, un `UPDATE` qui
    // contournerait le déclencheur laisserait une intervention close sans
    // réponse — et rien ne le dirait.
    expect(motif).toContain("intervention_cloture_a_son_statut_facturation");
  });

  it("TÉMOIN — le déclencheur est bien revenu après le jumeau", async () => {
    const [presence] = await clientOwner().$queryRawUnsafe<
      Array<{ n: bigint }>
    >(
      `SELECT count(*) AS "n" FROM pg_trigger
        WHERE tgname = 'intervention_facturation_a_la_cloture'`,
    );
    expect(Number(presence?.n)).toBe(1);
  });
});
