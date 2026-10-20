import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn(),
}));

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/terrain-instantane-route.test.ts.",
    );
  }
  const url = new URL(base);
  url.username = "codiplan_app";
  url.password = "";
  process.env.DATABASE_URL = url.toString();
});

import type { ContexteActif } from "@/lib/auth/contexte";
import { exigerCapacite } from "@/lib/auth/porte";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import { GET } from "@/app/api/terrain/instantane/route";

import { clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  AGENCE_B,
  CLIENT_A1,
  CLIENT_B1,
  SITE_A1_S1,
  SITE_B1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * `GET /api/terrain/instantane` SOUS CLOISONNEMENT (9F4H1, point 2) —
 * reprend le patron de `tests/isolation/terrain-technicien-isole.test.ts`
 * (mêmes fonctions de dépôt, lues par cette route) et celui de
 * `tests/isolation/logo-societe-routes.test.ts` (mock de `exigerCapacite`,
 * appel direct du handler).
 *
 * Les lignes sont posées SANS DATE (`date_planifiee: NULL`) — elles tombent
 * dans `journee.sansDate`, le seul compartiment qui ne dépend pas de la date
 * RÉELLE au moment où l'épreuve tourne (la route lit `maintenant(fuseau)`,
 * jamais une date injectée).
 */

afterAll(fermerClients);

const TECHNICIEN_A = UTILISATEUR_PAR_ROLE.technicien;
const AUTRE_TECHNICIEN_A = uuidv7();

function contexteActif(societeId: string, role: Role): ContexteActif {
  return {
    utilisateurId: TECHNICIEN_A,
    societeId,
    role,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

const posees: { readonly id: string; readonly societeId: string }[] = [];

async function creer(champs: {
  readonly societeId: string;
  readonly clientId: string;
  readonly siteId: string;
  readonly agenceId: string;
  readonly technicienId: string | null;
}): Promise<string> {
  const id = uuidv7();
  posees.push({ id, societeId: champs.societeId });
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id", "societe_id", "client_id", "site_id",
       "agence_id", "type", "statut", "priorite", "date_planifiee",
       "duree_estimee_min", "technicien_id", "description", "cree_le",
       "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
             'affectee', 'p3', NULL, 60, $6::uuid,
             '9F4H1 — intervention forgée par l''épreuve d''isolation',
             now(), now())`,
    id,
    champs.societeId,
    champs.clientId,
    champs.siteId,
    champs.agenceId,
    champs.technicienId,
  );
  return id;
}

afterEach(async () => {
  for (const { id, societeId } of posees.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid AND "societe_id" = $2::uuid`,
      id,
      societeId,
    );
  }
  for (const id of prestationsPosees.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "prestation" WHERE "id" = $1::uuid`,
      id,
    );
  }
});

const prestationsPosees: string[] = [];

async function creerPrestation(
  societeId: string,
  code: string,
): Promise<string> {
  const id = uuidv7();
  prestationsPosees.push(id);
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "prestation" ("id", "societe_id", "code", "libelle", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3, $4, now())`,
    id,
    societeId,
    code,
    `9F4H6 — ${code}`,
  );
  return id;
}

describe("GET /api/terrain/instantane — cloisonnement par personne et par société", () => {
  it("rend la ligne (et sa fiche) du technicien lui-même, masque celle d'un autre technicien de A et celle de la société B", async () => {
    const propre = await creer({
      societeId: SOCIETE_A,
      clientId: CLIENT_A1,
      siteId: SITE_A1_S1,
      agenceId: AGENCE_A,
      technicienId: TECHNICIEN_A,
    });
    const autreTechnicienA = await creer({
      societeId: SOCIETE_A,
      clientId: CLIENT_A1,
      siteId: SITE_A1_S1,
      agenceId: AGENCE_A,
      technicienId: AUTRE_TECHNICIEN_A,
    });
    const societeB = await creer({
      societeId: SOCIETE_B,
      clientId: CLIENT_B1,
      siteId: SITE_B1_S1,
      agenceId: AGENCE_B,
      // Même identité que la session — seule la société doit l'écarter.
      technicienId: TECHNICIEN_A,
    });

    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      contexteActif(SOCIETE_A, Role.technicien),
    );
    const reponse = await GET();
    expect(reponse.status).toBe(200);
    const corps = (await reponse.json()) as {
      utilisateurId: string;
      societeId: string;
      journee: { sansDate: { id: string }[] };
      fiches: Record<string, unknown>;
    };

    expect(corps.utilisateurId).toBe(TECHNICIEN_A);
    expect(corps.societeId).toBe(SOCIETE_A);

    const idsSansDate = corps.journee.sansDate.map((l) => l.id);
    expect(idsSansDate).toContain(propre);
    expect(idsSansDate).not.toContain(autreTechnicienA);
    expect(idsSansDate).not.toContain(societeB);

    expect(Object.keys(corps.fiches)).toContain(propre);
    expect(Object.keys(corps.fiches)).not.toContain(autreTechnicienA);
    expect(Object.keys(corps.fiches)).not.toContain(societeB);
  });

  it("rend le catalogue des prestations ACTIVES de la société A, jamais celui de la société B (9F4H6, point 3)", async () => {
    const actifA = await creerPrestation(SOCIETE_A, "9F4H6-ACTIF-A");
    const inactifA = await creerPrestation(SOCIETE_A, "9F4H6-INACTIF-A");
    await clientOwner().$executeRawUnsafe(
      `UPDATE "prestation" SET "actif" = false WHERE "id" = $1::uuid`,
      inactifA,
    );
    const actifB = await creerPrestation(SOCIETE_B, "9F4H6-ACTIF-B");

    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      contexteActif(SOCIETE_A, Role.technicien),
    );
    const reponse = await GET();
    expect(reponse.status).toBe(200);
    const corps = (await reponse.json()) as {
      catalogue: { id: string }[];
    };
    const idsCatalogue = corps.catalogue.map((p) => p.id);
    expect(idsCatalogue).toContain(actifA);
    expect(idsCatalogue).not.toContain(inactifA);
    expect(idsCatalogue).not.toContain(actifB);
  });

  it("refuse un rôle à accès complet (bureau) — même sans capacité manquante, le périmètre n'est pas restreint", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      contexteActif(SOCIETE_A, Role.adv),
    );
    const reponse = await GET();
    expect(reponse.status).toBe(403);
  });

  it("refuse sans session", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(null);
    const reponse = await GET();
    expect(reponse.status).toBe(403);
  });
});
