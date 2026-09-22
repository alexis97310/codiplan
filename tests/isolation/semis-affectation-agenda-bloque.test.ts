import { afterAll, afterEach, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import { clientOwner, fermerClients, sousSocieteEtRole } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 28-SEMIS-3 — LE CONTRAT QUE LA PASSE D'AFFECTATION DU SEMIS DOIT HONORER.
 *
 * ## Le défaut mesuré
 *
 * `pnpm exec tsx prisma/seed.ts`, rejoué à la main le 23/09/2026 sur une base
 * jetable qui portait déjà la démonstration ET un blocage d'agenda posé sur le
 * technicien et le jour que la passe allait précisément lui redonner :
 * l'étape « affectation des interventions aux techniciens » meurt en `23514`
 * sur `intervention_pas_sur_blocage_agenda` — le même refus, le même code, que
 * les cinq exécutions rouges du flux `DB migrate & seed` (#64 à #68).
 *
 * `prisma/seed.ts` (§ 9) écrit `technicien_id` ET `date_planifiee` **dans le
 * même `tx.intervention.update`**, sur une ligne qui ne porte ni l'un ni
 * l'autre — c'est une forme que `tests/isolation/blocage-agenda-verrous.test.ts`
 * n'éprouve pas : ses scénarios posent `technicien_id` à la création et ne
 * changent que la date ensuite. Ce fichier éprouve LA FORME EXACTE du semis :
 * les deux colonnes écrites ensemble, depuis `NULL`.
 *
 * ## Ce que ce fichier prouve, et ce qu'il ne prouve pas
 *
 * Il prouve que le déclencheur refuse cette écriture précise, sous le rôle
 * applicatif restreint — le contrat que la passe corrigée doit honorer en la
 * sautant plutôt qu'en la tentant. Il ne rejoue pas `prisma/seed.ts` lui-même
 * (le fichier s'auto-exécute à l'import et suppose une base neuve) : cette
 * exécution réelle, AVANT et APRÈS le correctif, a été mesurée à la main sur
 * une base jetable et est rapportée dans
 * `docs/propositions/28-SEMIS-3/passation.md`, avec les journaux complets —
 * même compromis assumé que `tests/unit/db/colonnes-de-suspension.test.ts`
 * pour la même section du semis.
 */

const TECHNICIEN = UTILISATEUR_PAR_ROLE[Role.technicien] as string;

/** Un lundi ouvert du calendrier de l'agence A — comme les scénarios voisins. */
const JOUR_BLOQUE = new Date("2026-09-14T00:00:00.000Z");
const JOUR_LIBRE = new Date("2026-09-15T00:00:00.000Z");

const absencesPosees: string[] = [];
const interventionsPosees: string[] = [];

function squelette(id: string) {
  interventionsPosees.push(id);
  return {
    id,
    societe_id: SOCIETE_A,
    client_id: CLIENT_A1,
    site_id: SITE_A1_S1,
    agence_id: AGENCE_A,
    type: "curatif" as const,
    statut: "planifiee" as const,
  };
}

async function bloquer(du: Date, au: Date): Promise<void> {
  const id = uuidv7();
  absencesPosees.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "absence" ("id", "societe_id", "utilisateur_id", "du", "au", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::date, $5::date, now())`,
    id,
    SOCIETE_A,
    TECHNICIEN,
    du,
    au,
  );
}

afterEach(async () => {
  if (interventionsPosees.length > 0) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" IN (${interventionsPosees.map((id) => `'${id}'`).join(",")})`,
    );
    interventionsPosees.length = 0;
  }
  if (absencesPosees.length > 0) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "absence" WHERE "id" IN (${absencesPosees.map((id) => `'${id}'`).join(",")})`,
    );
    absencesPosees.length = 0;
  }
});

afterAll(fermerClients);

describe("28-SEMIS-3 — la forme d'écriture de la passe d'affectation du semis", () => {
  it("TÉMOIN — sans blocage, technicien_id et date_planifiee posés ENSEMBLE, depuis NULL, sont acceptés", async () => {
    const id = uuidv7();
    await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
      tx.intervention.create({ data: squelette(id) }),
    );
    const affectee = await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
      tx.intervention.update({
        where: { id },
        data: { technicien_id: TECHNICIEN, date_planifiee: JOUR_LIBRE },
      }),
    );
    expect(affectee.technicien_id).toBe(TECHNICIEN);
    expect(affectee.date_planifiee).toEqual(JOUR_LIBRE);
  });

  it("est REFUSÉE par le déclencheur — même forme, jour bloqué", async () => {
    await bloquer(JOUR_BLOQUE, JOUR_BLOQUE);
    const id = uuidv7();
    await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
      tx.intervention.create({ data: squelette(id) }),
    );
    await expect(
      sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
        tx.intervention.update({
          where: { id },
          data: { technicien_id: TECHNICIEN, date_planifiee: JOUR_BLOQUE },
        }),
      ),
    ).rejects.toThrow(/intervention_pas_sur_blocage_agenda/);
  });

  it("et rien n'est écrit : ni le technicien ni la date ne sont posés", async () => {
    await bloquer(JOUR_BLOQUE, JOUR_BLOQUE);
    const id = uuidv7();
    await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
      tx.intervention.create({ data: squelette(id) }),
    );
    await sousSocieteEtRole(SOCIETE_A, Role.adv, (tx) =>
      tx.intervention.update({
        where: { id },
        data: { technicien_id: TECHNICIEN, date_planifiee: JOUR_BLOQUE },
      }),
    ).catch(() => undefined);
    const lignes = await clientOwner().$queryRawUnsafe<
      Array<{ technicien_id: string | null; date_planifiee: Date | null }>
    >(
      `SELECT "technicien_id", "date_planifiee" FROM "intervention" WHERE "id" = $1::uuid`,
      id,
    );
    expect(lignes).toHaveLength(1);
    expect(lignes[0]?.technicien_id).toBeNull();
    expect(lignes[0]?.date_planifiee).toBeNull();
  });
});
