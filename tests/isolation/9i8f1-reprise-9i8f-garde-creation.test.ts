import { afterAll, afterEach, describe, expect, it } from "vitest";

import { exigerContexteActif, type ContexteSession } from "@/lib/auth/contexte";
import { avecContexteApplicatif } from "@/lib/db/client";
import { resoudreEtatMachineDuFormulaire } from "@/lib/machines/garde-statut";
import { Role } from "@/lib/auth/roles";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  MACHINE_A1,
  MACHINE_A2,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9I8F1-REPRISE-9I8F, D227 — `resoudreEtatMachineDuFormulaire`
 * (`lib/machines/garde-statut.ts`), SOUS LE CONTEXTE APPLICATIF RÉEL — la
 * fonction que `deposerDemande` et `creerIntervention` appellent avant
 * d'écrire l'état de machine posté avec une création. `MACHINE_A1` est
 * mutée temporairement (bloc « remplacee »/« fusionnee » ci-dessous) et
 * remise dans son état initial après chaque épreuve qui la touche —
 * `fileParallelism: false` sur ce projet (`vitest.config.mts`) rend cette
 * fixture partagée sûre à muter : aucun autre fichier ne la lit en même
 * temps.
 */

afterAll(fermerClients);

const ADV_A: ContexteSession = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.adv],
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const TECHNICIEN_A: ContexteSession = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.technicien],
  societeId: SOCIETE_A,
  role: Role.technicien,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

async function resoudre(
  contexte: ContexteSession,
  machineId: string,
  etat: "en_service" | "en_panne" | "arretee" | null,
) {
  return avecContexteApplicatif(
    contexte,
    (tx) =>
      resoudreEtatMachineDuFormulaire(
        tx,
        exigerContexteActif(contexte),
        machineId,
        etat,
      ),
    clientApp(),
  );
}

afterEach(async () => {
  await clientOwner().$executeRawUnsafe(
    `UPDATE "machine" SET "statut" = 'en_service' WHERE "id" = '${MACHINE_A1}'`,
  );
});

describe("resoudreEtatMachineDuFormulaire — la valeur (point 1, règle 2)", () => {
  it("une machine « remplacee », « en_service » forgé : IGNORÉ, jamais une réactivation", async () => {
    await clientOwner().$executeRawUnsafe(
      `UPDATE "machine" SET "statut" = 'remplacee' WHERE "id" = '${MACHINE_A1}'`,
    );
    const resultat = await resoudre(ADV_A, MACHINE_A1, "en_service");
    expect(resultat).toEqual({ action: "ignorer" });
  });

  it("une machine « fusionnee », « en_service » forgé : IGNORÉ, jamais une réactivation", async () => {
    await clientOwner().$executeRawUnsafe(
      `UPDATE "machine" SET "statut" = 'fusionnee' WHERE "id" = '${MACHINE_A1}'`,
    );
    const resultat = await resoudre(ADV_A, MACHINE_A1, "en_service");
    expect(resultat).toEqual({ action: "ignorer" });
  });

  it("une machine déjà active : la valeur postée est appliquée", async () => {
    const resultat = await resoudre(ADV_A, MACHINE_A1, "en_panne");
    expect(resultat).toEqual({ action: "ecrire", statut: "en_panne" });
  });

  it("aucune valeur postée : IGNORÉ, sans même lire la machine", async () => {
    const resultat = await resoudre(ADV_A, MACHINE_A1, null);
    expect(resultat).toEqual({ action: "ignorer" });
  });
});

describe("resoudreEtatMachineDuFormulaire — la capacité et le périmètre (point 2)", () => {
  it("un technicien HORS périmètre QT-2 (MACHINE_A2) : refus nommé", async () => {
    const resultat = await resoudre(TECHNICIEN_A, MACHINE_A2, "en_panne");
    expect(resultat).toEqual({ action: "refuser" });
    const fiche = await clientOwner().$queryRawUnsafe<
      Array<{ statut: string }>
    >(`SELECT "statut" FROM "machine" WHERE "id" = $1::uuid`, MACHINE_A2);
    expect(fiche[0]?.statut).toBe("en_service");
  });

  it("un compte interne (gerer_machine en plein, sans restriction de périmètre) : appliqué", async () => {
    const resultat = await resoudre(ADV_A, MACHINE_A1, "arretee");
    expect(resultat).toEqual({ action: "ecrire", statut: "arretee" });
  });
});
