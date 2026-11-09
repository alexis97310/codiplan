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

/**
 * UNE FICHE CLÔTURÉE AVEC LES SIX COLONNES WINPRO REMPLIES
 * (9K12-EXPORT-WINPRO) — CLIENT_A1 porte déjà `code_externe = 'C-001'`
 * (`tests/isolation/setup/global.ts`), aucun second client à poser.
 */
const TYPE_AVEC_VALEURS = "controle_reglementaire";
const DATE_AVEC_VALEURS = "2097-07-09";
const REFERENCE_CLIENT_DEDIEE = "BC-9K12";
const CLOTUREE_LE_DEDIEE = "2097-07-10T00:00:00.000Z";
const TEMPS_VALIDE_DEDIE = 125;
let idAvecValeurs = "";

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

  const [avecValeurs] = await clientOwner().$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO "intervention"
       ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
        "statut", "date_planifiee", "reference_client", "cloturee_le",
        "temps_valide_min", "modifie_le")
     VALUES (gen_random_uuid(), '${SOCIETE_A}'::uuid, '${CLIENT_A1}'::uuid,
       '${SITE_A1_S1}'::uuid, '${AGENCE_A}'::uuid, $1::"TypeIntervention",
       'cloturee', $2::date, $3, $4::timestamptz, $5::int, now())
     RETURNING "id"`,
    TYPE_AVEC_VALEURS,
    DATE_AVEC_VALEURS,
    REFERENCE_CLIENT_DEDIEE,
    CLOTUREE_LE_DEDIEE,
    TEMPS_VALIDE_DEDIE,
  );
  idAvecValeurs = avecValeurs!.id;
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "type" = $1::"TypeIntervention" AND "date_planifiee" = $2::date`,
    TYPE_DEDIE,
    DATE_DEDIEE,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "type" = $1::"TypeIntervention" AND "date_planifiee" = $2::date`,
    TYPE_AVEC_VALEURS,
    DATE_AVEC_VALEURS,
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

  /**
   * LE CRITÈRE `id` (TP-UX3-1-REGISTRE-2) — AUCUN scénario, avant ce ticket,
   * ne l'envoyait jamais : `filtreDesInterventions` (lib/interventions/
   * depot.ts:~4281) le traduit en `id IN (...)`, mais sans témoin, une
   * régression qui l'ignorerait silencieusement (exportant TOUT le filtre
   * des autres critères) resterait verte.
   */
  it("le critère `id` restreint à EXACTEMENT les fiches demandées, cloisonné — un id du même lot jamais demandé, et un id d'une autre société, en sortent", async () => {
    const idsDemandes = [idsCrees[0]!, idsCrees[1]!, idSocieteB];
    const criteres = schemaRechercheInterventions.parse({ id: idsDemandes });
    const exportees = await listerInterventionsPourExport(
      INTERNE_A,
      criteres,
      clientApp(),
    );
    expect(exportees.map((l) => l.id).sort()).toEqual(
      [idsCrees[0]!, idsCrees[1]!].sort(),
    );
  });

  /**
   * LES SIX COLONNES WINPRO (9K12-EXPORT-WINPRO) — code client, référence
   * client, date de clôture, temps validé : `SELECTION_LIGNE_PLANNING` les
   * porte maintenant, et cette fiche dédiée en a une valeur CONNUE de
   * chacune, jamais `null` par accident de fixture.
   */
  it("une fiche clôturée rend son code client (fixture), sa référence client, sa date de clôture et son temps validé", async () => {
    const criteres = schemaRechercheInterventions.parse({
      id: [idAvecValeurs],
    });
    const [exportee] = await listerInterventionsPourExport(
      INTERNE_A,
      criteres,
      clientApp(),
    );
    expect(exportee?.client.code_externe).toBe("C-001");
    expect(exportee?.reference_client).toBe(REFERENCE_CLIENT_DEDIEE);
    expect(exportee?.cloturee_le?.toISOString()).toBe(CLOTUREE_LE_DEDIEE);
    expect(exportee?.temps_valide_min).toBe(TEMPS_VALIDE_DEDIE);
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
      "Nature",
      "Code externe",
      "Référence client / n° de bon de commande",
      "Clôturée le",
      "Temps validé",
      "Temps validé (minutes)",
    ]);
    // AUCUN MONTANT, AUCUN TAUX, AUCUN FORFAIT CHIFFRÉ (décision d'Alexis du
    // 09/11/2026, 9K12-EXPORT-WINPRO) — Winpro calcule le prix, ce fichier ne
    // le fait jamais. Un gardien qui FIGE l'absence, pas seulement « montant »
    // comme avant ce ticket.
    for (const motInterdit of ["montant", "taux", "forfait"]) {
      expect(
        entetes.some((e) =>
          (e ?? "").toLocaleLowerCase("fr").includes(motInterdit),
        ),
      ).toBe(false);
    }
    // En-têtes + 60 lignes — aucun marqueur de rechargement (D169, un export
    // ne se réimporte jamais, à la différence de `classeurDesRejets`).
    expect(lignes.length).toBe(1 + NOMBRE_DE_FICHES);
  });

  it("la fiche clôturée dédiée porte ses six colonnes Winpro dans le classeur, sans aucun montant", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce({
      ...INTERNE_A,
      societeId: SOCIETE_A,
      role: Role.admin_societe,
    });
    const reponse = await getExport(
      new Request(
        `https://codiplan.test/api/interventions/exporter?id=${idAvecValeurs}`,
      ),
    );
    expect(reponse.status).toBe(200);
    const classeur = Buffer.from(await reponse.arrayBuffer());
    const feuilles = await lireClasseur(classeur);
    const lignes = feuilles[0]?.lignes ?? [];
    expect(lignes.length).toBe(2);
    const valeurs = lignes[1]?.map((c) => c?.texte) ?? [];
    expect(valeurs.slice(8)).toEqual([
      "Contrôle réglementaire",
      "C-001",
      REFERENCE_CLIENT_DEDIEE,
      "10/07/2097",
      "2 h 05",
      "125",
    ]);
  });

  it("un `id` non-UUID fait échouer TOUT le filtre (schemaRechercheInterventions) — jamais une liste partielle silencieuse", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce({
      ...INTERNE_A,
      societeId: SOCIETE_A,
      role: Role.admin_societe,
    });
    const reponse = await getExport(
      new Request(
        "https://codiplan.test/api/interventions/exporter?id=pas-un-uuid",
      ),
    );
    expect(reponse.status).toBe(303);
    expect(reponse.headers.get("Location")).toContain("/interventions?motif=");
  });

  it("le filtre `id` de la route rend un classeur avec EXACTEMENT les fiches demandées", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce({
      ...INTERNE_A,
      societeId: SOCIETE_A,
      role: Role.admin_societe,
    });
    // DEUX ids du lot dédié + un id de la société B (cloisonnement) — et le
    // troisième id du lot dédié (`idsCrees[2]`) n'est jamais demandé : le
    // classeur ne doit porter ni l'un ni l'autre.
    const parametres = [idsCrees[0]!, idsCrees[1]!, idSocieteB]
      .map((id) => `id=${id}`)
      .join("&");
    const reponse = await getExport(
      new Request(
        `https://codiplan.test/api/interventions/exporter?${parametres}`,
      ),
    );
    expect(reponse.status).toBe(200);
    const classeur = Buffer.from(await reponse.arrayBuffer());
    const feuilles = await lireClasseur(classeur);
    const lignes = feuilles[0]?.lignes ?? [];
    // En-têtes + EXACTEMENT deux lignes.
    expect(lignes.length).toBe(1 + 2);
  });
});
