import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
import { lireClasseur } from "@/lib/excel/classeur";

import { clientOwner, fermerClients, urlApp } from "./setup/db";
import {
  CLIENT_A1,
  MODELE_A,
  MODELE_B,
  SITE_A1_S1,
  SOCIETE_A,
  SOCIETE_B,
} from "./setup/fixtures";

/**
 * L'EXPORT DU REGISTRE DES VGP (MO-9, D169) — ÉPROUVÉ SUR LA VRAIE BASE.
 *
 * `listerLeRegistrePourExport` partage `FILTRE_PARC_ACTIF` et le périmètre
 * par personne avec `listerLeRegistre` (D166, QT-2) : ce fichier prouve
 * qu'elle rend TOUTES les machines, cloisonnées, SANS LE PLAFOND DE LECTURE
 * — 60 machines dédiées, posées exprès pour dépasser une lecture bornée à 50
 * (`listerLeRegistre(..., 50)`, le même témoin que `/parc`).
 *
 * **`DATABASE_URL`, PAS `clientApp()`** — même raison que
 * `vgp-compte-tuile-registre.test.ts` : ni `listerLeRegistre` ni
 * `listerLeRegistrePourExport` n'acceptent de client explicite, elles
 * passent TOUJOURS par le client global de `lib/db/client.ts`. `DATABASE_URL`
 * est donc posé sur la base jetable, sous le rôle applicatif, AVANT de
 * charger le module (connexion différée de Prisma) — et la route de l'export
 * partage le MÊME client global, donc le même réglage.
 */

process.env.DATABASE_URL = urlApp();
const { listerLeRegistre, listerLeRegistrePourExport } =
  await import("@/lib/vgp/registre");

vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn(),
  motifDuRefus: vi.fn().mockResolvedValue("auth.refus_droit"),
}));
const { exigerCapacite } = await import("@/lib/auth/porte");
const { GET: getExport } = await import("@/app/api/vgp/exporter/route");

afterAll(fermerClients);

const PREFIXE_SERIE = "SN-EXPORT-VGP9-";
const NOMBRE_DE_MACHINES = 60;
const idsCrees: string[] = [];
let idSocieteB = "";

beforeAll(async () => {
  const valeurs = Array.from(
    { length: NOMBRE_DE_MACHINES },
    (_, i) =>
      `(gen_random_uuid(), '${SOCIETE_A}'::uuid, '${MODELE_A}'::uuid, '${CLIENT_A1}'::uuid, '${SITE_A1_S1}'::uuid, '${PREFIXE_SERIE}${i}', 'QR-EXPORT-VGP9-A-${i}', now())`,
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
       $3, 'QR-EXPORT-VGP9-B-0', now())
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
  utilisateurId: "aaaaaaaa-0000-7000-8000-00000000f0e3",
  societeId: SOCIETE_A,
  role: Role.admin_societe,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const INTERNE_B = { ...INTERNE_A, societeId: SOCIETE_B };

const FUSEAU = schemaFuseau.parse("Pacific/Noumea");
const AUJOURD_HUI = instantDuJour(jourDe(maintenant(FUSEAU).local));

describe("listerLeRegistrePourExport — exactement le filtre, cloisonné, sans plafond (MO-9)", () => {
  it("rend les 60 machines dédiées de la société A, aucune de la société B", async () => {
    const toutes = await listerLeRegistrePourExport(INTERNE_A, AUJOURD_HUI);
    const miennes = toutes.filter((l) =>
      l.numero_serie.startsWith(PREFIXE_SERIE),
    );
    expect(miennes.map((l) => l.id).sort()).toEqual([...idsCrees].sort());
    expect(toutes.map((l) => l.id)).not.toContain(idSocieteB);
  });

  it("la société B ne voit que sa propre machine dédiée", async () => {
    const toutes = await listerLeRegistrePourExport(INTERNE_B, AUJOURD_HUI);
    const miennes = toutes.filter((l) =>
      l.numero_serie.startsWith(PREFIXE_SERIE),
    );
    expect(miennes.map((l) => l.id)).toEqual([idSocieteB]);
  });

  it("TÉMOIN — une lecture BORNÉE à 50, elle, s'arrête à 50 : la différence est le plafond que l'export retire", async () => {
    const bornee = await listerLeRegistre(INTERNE_A, AUJOURD_HUI, 50);
    expect(bornee.length).toBe(50);
  });
});

describe("GET /api/vgp/exporter — deux capacités, comme D150 (MO-9, D169)", () => {
  it("un rôle SANS importer_exporter est refusé, aucun classeur rendu", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(null);
    const reponse = await getExport(
      new Request(
        `https://codiplan.test/api/vgp/exporter?q=${encodeURIComponent(PREFIXE_SERIE)}`,
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
        `https://codiplan.test/api/vgp/exporter?q=${encodeURIComponent(PREFIXE_SERIE)}`,
      ),
    );
    expect(reponse.status).toBe(200);
    expect(reponse.headers.get("Content-Disposition")).toContain("vgp-");

    const classeur = Buffer.from(await reponse.arrayBuffer());
    const feuilles = await lireClasseur(classeur);
    const lignes = feuilles[0]?.lignes ?? [];
    const entetes = lignes[0]?.map((c) => c?.texte) ?? [];
    expect(entetes).toEqual([
      "Machine",
      "Client",
      "Dernier contrôle",
      "Échéance déduite",
      "État",
    ]);
    expect(
      entetes.some((e) =>
        (e ?? "").toLocaleLowerCase("fr").includes("montant"),
      ),
    ).toBe(false);
    expect(lignes.length).toBe(1 + NOMBRE_DE_MACHINES);
  });
});
