import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { Role } from "@/lib/auth/roles";
import { lireClasseur } from "@/lib/excel/classeur";
import {
  rechercherLeParc,
  rechercherLeParcPourExport,
} from "@/lib/machines/depot";
import { schemaRechercheParc } from "@/lib/machines/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  MODELE_A,
  MODELE_B,
  SITE_A1_S1,
  SOCIETE_A,
  SOCIETE_B,
} from "./setup/fixtures";

/**
 * L'EXPORT DU PARC MACHINES (MO-9, D169) — ÉPROUVÉ SUR LA VRAIE BASE.
 *
 * `rechercherLeParcPourExport` partage `filtreDuParc` avec `rechercherLeParc`
 * (AT-07) : ce fichier prouve qu'elle rend EXACTEMENT les fiches du filtre,
 * cloisonnées, SANS LE PLAFOND DE PAGE — 60 machines dédiées, posées exprès
 * pour dépasser `LIMITE_RECHERCHE_PAR_DEFAUT` (50).
 */

afterAll(fermerClients);

const PREFIXE_SERIE = "SN-EXPORT-MOD9-";
const NOMBRE_DE_MACHINES = 60;
const idsCrees: string[] = [];
let idSocieteB = "";

beforeAll(async () => {
  const valeurs = Array.from(
    { length: NOMBRE_DE_MACHINES },
    (_, i) =>
      `(gen_random_uuid(), '${SOCIETE_A}'::uuid, '${MODELE_A}'::uuid, '${CLIENT_A1}'::uuid, '${SITE_A1_S1}'::uuid, '${PREFIXE_SERIE}${i}', 'QR-EXPORT-MOD9-A-${i}', now())`,
  ).join(",\n");
  const creees = await clientOwner().$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "machine" (id, societe_id, modele_id, client_id, site_id, numero_serie, qr_token, modifie_le)
     VALUES ${valeurs}
     RETURNING "id"`,
  );
  idsCrees.push(...creees.map((c) => c.id));
  expect(idsCrees).toHaveLength(NOMBRE_DE_MACHINES);

  const [b] = await clientOwner().$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "machine" (id, societe_id, modele_id, client_id, site_id, numero_serie, qr_token, modifie_le)
     VALUES (gen_random_uuid(), $1::uuid, $2::uuid,
       (SELECT id FROM "client" WHERE societe_id = $1::uuid LIMIT 1),
       (SELECT id FROM "site" WHERE societe_id = $1::uuid LIMIT 1),
       $3, 'QR-EXPORT-MOD9-B-0', now())
     RETURNING "id"`,
    SOCIETE_B,
    MODELE_B,
    `${PREFIXE_SERIE}0`,
  );
  idSocieteB = b!.id;
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "machine" WHERE "numero_serie" LIKE $1`,
    `${PREFIXE_SERIE}%`,
  );
});

const INTERNE_A = {
  utilisateurId: "aaaaaaaa-0000-7000-8000-00000000f0e2",
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const INTERNE_B = { ...INTERNE_A, societeId: SOCIETE_B };

const CRITERES = schemaRechercheParc.parse({ texte: PREFIXE_SERIE });
const MAINTENANT = new Date("2026-09-17T00:00:00Z");

describe("rechercherLeParcPourExport — exactement le filtre, cloisonné, sans plafond (MO-9)", () => {
  it("rend les 60 machines dédiées de la société A, aucune de la société B", async () => {
    const exportees = await rechercherLeParcPourExport(
      INTERNE_A,
      CRITERES,
      MAINTENANT,
      clientApp(),
    );
    expect(exportees.map((l) => l.id).sort()).toEqual([...idsCrees].sort());
    expect(exportees.map((l) => l.id)).not.toContain(idSocieteB);
  });

  it("la société B ne voit que sa propre machine dédiée", async () => {
    const exportees = await rechercherLeParcPourExport(
      INTERNE_B,
      CRITERES,
      MAINTENANT,
      clientApp(),
    );
    expect(exportees.map((l) => l.id)).toEqual([idSocieteB]);
  });

  it("TÉMOIN — la liste PAGINÉE, elle, s'arrête à 50 : la différence est le plafond que l'export retire", async () => {
    const paginee = await rechercherLeParc(
      INTERNE_A,
      CRITERES,
      MAINTENANT,
      clientApp(),
    );
    expect(paginee.length).toBe(50);
  });
});

vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn(),
  motifDuRefus: vi.fn().mockResolvedValue("auth.refus_droit"),
}));

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/export-parc.test.ts.",
    );
  }
  const url = new URL(base);
  url.username = "codiplan_app";
  url.password = "";
  process.env.DATABASE_URL = url.toString();
});

const { exigerCapacite } = await import("@/lib/auth/porte");
const { GET: getExport } = await import("@/app/api/parc/exporter/route");

describe("GET /api/parc/exporter — deux capacités, comme D150 (MO-9, D169)", () => {
  it("un rôle SANS importer_exporter est refusé, aucun classeur rendu", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(null);
    const reponse = await getExport(
      new Request(
        `https://codiplan.test/api/parc/exporter?q=${encodeURIComponent(PREFIXE_SERIE)}`,
      ),
    );
    expect(reponse.status).toBe(403);
  });

  it("un rôle avec les deux capacités reçoit un .xlsx sans colonne de montant, exactement les 60 lignes", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce({
      ...INTERNE_A,
      societeId: SOCIETE_A,
      role: Role.admin_societe,
    });
    const reponse = await getExport(
      new Request(
        `https://codiplan.test/api/parc/exporter?q=${encodeURIComponent(PREFIXE_SERIE)}`,
      ),
    );
    expect(reponse.status).toBe(200);
    expect(reponse.headers.get("Content-Disposition")).toContain("parc-");

    const classeur = Buffer.from(await reponse.arrayBuffer());
    const feuilles = await lireClasseur(classeur);
    const lignes = feuilles[0]?.lignes ?? [];
    const entetes = lignes[0]?.map((c) => c?.texte) ?? [];
    expect(entetes).toEqual([
      "Référence",
      "Client",
      "Site",
      "Agence",
      "Famille",
      "Marque",
      "Référence du modèle",
      "N° de série",
      "Année de vente",
      "Statut",
    ]);
    expect(
      entetes.some((e) =>
        (e ?? "").toLocaleLowerCase("fr").includes("montant"),
      ),
    ).toBe(false);
    expect(lignes.length).toBe(1 + NOMBRE_DE_MACHINES);
  });
});
