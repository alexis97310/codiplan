import { afterAll, afterEach, describe, expect, it } from "vitest";

import type { ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";
import {
  compterInterventionsAVenirParTechnicien,
  creerTechnicien,
  listerLesTechniciens,
} from "@/lib/techniciens/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * 9DL-PG-G16-STATUT-RESSOURCE (QG-9, 27/09/2026 ; précisions du pilote du
 * 03/10/2026 ; D163) — SALARIÉ OU PATENTÉ suit EXACTEMENT le cloisonnement
 * déjà tenu par `tests/isolation/` pour `technicien` (`cloisonnement_societe`,
 * `20260913170000_technicien_l3_01a`). Ce fichier ne redémontre pas ce
 * cloisonnement en général — il mesure que la colonne NEUVE le suit, et que
 * les fiches qui n'y ont jamais répondu restent lisibles et planifiables.
 */

const ADMIN_A: ContexteSession = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.admin_societe],
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

/** Un rôle interne de A, SANS la capacité « administrer_utilisateurs ». */
const TECHNICIEN_A: ContexteSession = {
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.technicien],
  societeId: SOCIETE_A,
  role: Role.technicien,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const CONTEXTE_B: ContexteSession = {
  utilisateurId: UTILISATEUR_INTERNE_B,
  societeId: SOCIETE_B,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

/** Un préfixe qui n'appartient qu'à ce fichier — le ménage s'y accroche. */
const PREFIXE = "PGG16-";

function courriel(): string {
  return `${PREFIXE.toLowerCase()}${Math.floor(Math.random() * 1_000_000)}@codima.test`;
}

async function creerTechnicienDeTest(
  statutRessource: "salarie" | "patente",
): Promise<{ utilisateurId: string }> {
  const resultat = await creerTechnicien(
    ADMIN_A,
    {
      nom: "Technicien d'épreuve PG-G16",
      email: courriel(),
      agence_id: AGENCE_A,
      actif: true,
      statut_ressource: statutRessource,
    },
    clientApp(),
  );
  expect(resultat.accepte).toBe(true);
  if (!resultat.accepte) throw new Error("fixture non créée");
  return { utilisateurId: resultat.utilisateurId };
}

afterEach(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "technicien" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE '${PREFIXE.toLowerCase()}%')`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur_societe" WHERE "utilisateur_id" IN (SELECT "id" FROM "utilisateur" WHERE "email" LIKE '${PREFIXE.toLowerCase()}%')`,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "utilisateur" WHERE "email" LIKE '${PREFIXE.toLowerCase()}%'`,
  );
});

afterAll(fermerClients);

describe("créer un technicien PATENTÉ dans A, et le relire (QG-9, D163)", () => {
  it("le statut posé à la création se relit tel quel", async () => {
    const { utilisateurId } = await creerTechnicienDeTest("patente");

    const lignes = await listerLesTechniciens(ADMIN_A, clientApp());
    const ligne = lignes.find((l) => l.utilisateurId === utilisateurId);
    expect(ligne?.statutRessource).toBe("patente");
  });
});

describe("un rôle sans « administrer_utilisateurs » est refusé (gardien de régression)", () => {
  it("creerTechnicien, avec un statut de ressource, reste bloqué par la même politique", async () => {
    await expect(
      creerTechnicien(
        TECHNICIEN_A,
        {
          nom: "Technicien d'épreuve PG-G16",
          email: courriel(),
          agence_id: AGENCE_A,
          actif: true,
          statut_ressource: "salarie",
        },
        clientApp(),
      ),
    ).rejects.toThrow();
  });
});

describe("la société B ne voit jamais un technicien de la société A, statut compris (I1)", () => {
  it("introuvable depuis B", async () => {
    const { utilisateurId } = await creerTechnicienDeTest("patente");

    const lignesB = await listerLesTechniciens(CONTEXTE_B, clientApp());
    expect(lignesB.some((l) => l.utilisateurId === utilisateurId)).toBe(false);
  });
});

describe("un technicien existant SANS statut reste lisible et planifiable", () => {
  it("statutRessource vaut `null`, et il compte dans les interventions à venir", async () => {
    const { utilisateurId } = await creerTechnicienDeTest("salarie");

    // Simule un technicien ANTÉRIEUR à ce lot : jamais répondu à la question
    // (la migration ne backfille rien, voir prisma/migrations/
    // 20261005100000_pg_g16_statut_ressource).
    await clientOwner().$executeRawUnsafe(
      `UPDATE "technicien" SET "statut_ressource" = NULL WHERE "utilisateur_id" = '${utilisateurId}'`,
    );

    const lignes = await listerLesTechniciens(ADMIN_A, clientApp());
    const ligne = lignes.find((l) => l.utilisateurId === utilisateurId);
    expect(ligne?.statutRessource).toBeNull();

    const comptes = await compterInterventionsAVenirParTechnicien(
      ADMIN_A,
      [utilisateurId],
      clientApp(),
    );
    expect(comptes.get(utilisateurId)).toBe(0);
  });
});
