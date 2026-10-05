import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { Role } from "@/lib/auth/roles";
import { lireClasseur } from "@/lib/excel/classeur";
import {
  listerInterventions,
  listerInterventionsPourExport,
} from "@/lib/interventions/depot";
import { schemaRechercheInterventions } from "@/lib/interventions/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  SOCIETE_B,
} from "./setup/fixtures";

/**
 * L'EXPORT DU REGISTRE DES INTERVENTIONS (MO-9, D169) — ÉPROUVÉ SUR LA VRAIE
 * BASE.
 *
 * `listerInterventionsPourExport` partage `filtreDesInterventions` avec
 * `listerInterventions` (AT-07) : ce fichier prouve qu'elle rend EXACTEMENT
 * les lignes du filtre, cloisonnées, SANS LE PLAFOND DE PAGE — 60 fiches
 * dédiées, posées exprès pour dépasser `LIMITE_RECHERCHE_PAR_DEFAUT` (50).
 */

afterAll(fermerClients);

const DATE_DEDIEE = "2097-07-07";
const TYPE_DEDIE = "recensement";
const NOMBRE_DE_FICHES = 60;
const idsCrees: string[] = [];
let idSocieteB = "";

beforeAll(async () => {
  const valeurs = Array.from(
    { length: NOMBRE_DE_FICHES },
    () =>
      `(gen_random_uuid(), '${SOCIETE_A}'::uuid, '${CLIENT_A1}'::uuid, '${SITE_A1_S1}'::uuid, '${AGENCE_A}'::uuid, '${TYPE_DEDIE}', 'a_planifier', '${DATE_DEDIEE}'::date, now())`,
  ).join(",\n");
  const creees = await clientOwner().$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "intervention"
       ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "date_planifiee", "modifie_le")
     VALUES ${valeurs}
     RETURNING "id"`,
  );
  idsCrees.push(...creees.map((c) => c.id));
  expect(idsCrees).toHaveLength(NOMBRE_DE_FICHES);

  const [b] = await clientOwner().$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "intervention"
       ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "date_planifiee", "modifie_le")
     VALUES (gen_random_uuid(), $1::uuid,
       (SELECT id FROM "client" WHERE societe_id = $1::uuid LIMIT 1),
       (SELECT id FROM "site" WHERE societe_id = $1::uuid LIMIT 1),
       (SELECT id FROM "agence" WHERE societe_id = $1::uuid LIMIT 1),
       $2::"TypeIntervention", 'a_planifier', $3::date, now())
     RETURNING "id"`,
    SOCIETE_B,
    TYPE_DEDIE,
    DATE_DEDIEE,
  );
  idSocieteB = b!.id;
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "type" = $1::"TypeIntervention" AND "date_planifiee" = $2::date`,
    TYPE_DEDIE,
    DATE_DEDIEE,
  );
});

const INTERNE_A = {
  utilisateurId: "aaaaaaaa-0000-7000-8000-00000000f0e1",
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const INTERNE_B = { ...INTERNE_A, societeId: SOCIETE_B };

const CRITERES = schemaRechercheInterventions.parse({
  type: TYPE_DEDIE,
  du: DATE_DEDIEE,
  au: DATE_DEDIEE,
});

describe("listerInterventionsPourExport — exactement le filtre, cloisonné, sans plafond (MO-9)", () => {
  it("rend les 60 fiches dédiées de la société A, aucune de la société B", async () => {
    const exportees = await listerInterventionsPourExport(
      INTERNE_A,
      CRITERES,
      clientApp(),
    );
    expect(exportees.map((l) => l.id).sort()).toEqual([...idsCrees].sort());
    expect(exportees.map((l) => l.id)).not.toContain(idSocieteB);
  });

  it("la société B ne voit que sa propre fiche dédiée", async () => {
    const exportees = await listerInterventionsPourExport(
      INTERNE_B,
      CRITERES,
      clientApp(),
    );
    expect(exportees.map((l) => l.id)).toEqual([idSocieteB]);
  });

  it("TÉMOIN — la liste PAGINÉE, elle, s'arrête à 50 : la différence est le plafond que l'export retire", async () => {
    const paginee = await listerInterventions(INTERNE_A, CRITERES, clientApp());
    expect(paginee.length).toBe(50);
  });
});

/**
 * LA ROUTE, DE BOUT EN BOUT — porte fabriquée (même patron que
 * `droits-import-par-type.test.ts`), tout le reste (base réelle, RLS) est le
 * chemin de production.
 */
vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn(),
  motifDuRefus: vi.fn().mockResolvedValue("auth.refus_droit"),
}));

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/export-interventions.test.ts.",
    );
  }
  const url = new URL(base);
  url.username = "codiplan_app";
  url.password = "";
  process.env.DATABASE_URL = url.toString();
});

const { exigerCapacite } = await import("@/lib/auth/porte");
const { GET: getExport } =
  await import("@/app/api/interventions/exporter/route");

describe("GET /api/interventions/exporter — deux capacités, comme D150 (MO-9, D169)", () => {
  it("un rôle SANS importer_exporter (technicien) est refusé, aucun classeur rendu", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(null);
    const reponse = await getExport(
      new Request(
        `https://codiplan.test/api/interventions/exporter?type=${TYPE_DEDIE}&du=${DATE_DEDIEE}&au=${DATE_DEDIEE}`,
      ),
    );
    expect(reponse.status).toBe(303);
    expect(reponse.headers.get("Location")).toContain("/interventions?motif=");
  });

  it("un rôle avec les deux capacités reçoit un .xlsx sans colonne de montant, exactement les 60 lignes", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce({
      ...INTERNE_A,
      societeId: SOCIETE_A,
      role: Role.admin_societe,
    });
    const reponse = await getExport(
      new Request(
        `https://codiplan.test/api/interventions/exporter?type=${TYPE_DEDIE}&du=${DATE_DEDIEE}&au=${DATE_DEDIEE}`,
      ),
    );
    expect(reponse.status).toBe(200);
    expect(reponse.headers.get("Content-Disposition")).toContain(
      "interventions-",
    );

    const classeur = Buffer.from(await reponse.arrayBuffer());
    const feuilles = await lireClasseur(classeur);
    const lignes = feuilles[0]?.lignes ?? [];
    const entetes = lignes[0]?.map((c) => c?.texte) ?? [];
    expect(entetes).toEqual([
      "Référence",
      "Client",
      "Machine",
      "Site",
      "Technicien",
      "Date planifiée",
      "Priorité",
      "Statut",
    ]);
    expect(
      entetes.some((e) =>
        (e ?? "").toLocaleLowerCase("fr").includes("montant"),
      ),
    ).toBe(false);
    // En-têtes + 60 lignes — aucun marqueur de rechargement (D169, un export
    // ne se réimporte jamais, à la différence de `classeurDesRejets`).
    expect(lignes.length).toBe(1 + NOMBRE_DE_FICHES);
  });
});
