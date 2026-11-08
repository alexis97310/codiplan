import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

/**
 * `POST /api/portail/demandes/creer` — LE DÉPÔT DEPUIS LE PORTAIL
 * (9J04-PORTAIL-DEMANDES, CLI-4).
 *
 * Même patron que `tests/isolation/9edz-demandes-creer.test.ts` : la porte
 * (`contextePortailDemande`) est fabriquée pour un compte donné, tout le
 * reste (base réelle, politique RLS) est le chemin de production. Le dépôt
 * `lib/demandes/depot.ts` est déjà confronté à la base par
 * `tests/isolation/portail-demandes-ecriture.test.ts` ; ce fichier-ci
 * confronte ce que LA ROUTE ajoute par-dessus — la déduction du site depuis
 * la machine (CLI-4.1), le refus d'une machine hors périmètre, et
 * l'imposition de `source` en dur, jamais lue du formulaire (INTERDITS).
 *
 * `machine_arretee` (9K03-PORTAIL-MACHINES-PANNE) ET `urgence` S'OPPOSENT
 * DÉLIBÉRÉMENT : la première VIENT du formulaire depuis 9K03, la seconde
 * RESTE fixée ici en dur (décision d'Alexis du 08/11/2026) — un client ne la
 * choisit pas. Les deux scénarios ci-dessous le montrent côte à côte.
 */

vi.mock("@/app/api/portail/demandes/contexte", () => ({
  contextePortailDemande: vi.fn(),
  motifDuRefusPortailDemande: vi.fn(async () => "auth.refus" as const),
}));

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/9j04-portail-demandes-creer.test.ts.",
    );
  }
  const url = new URL(base);
  url.username = "codiplan_app";
  url.password = "";
  process.env.DATABASE_URL = url.toString();
});

import { type ContexteSession } from "@/lib/auth/contexte";
import { Role } from "@/lib/auth/roles";

import { contextePortailDemande } from "@/app/api/portail/demandes/contexte";
import { POST as creerDemandePortail } from "@/app/api/portail/demandes/creer/route";

import { clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  MACHINE_A1,
  MACHINE_A3,
  PORTAIL_A_CLIENT,
  SITE_A1_S1,
  SOCIETE_A,
} from "./setup/fixtures";

function porte(): { contexte: ContexteSession; clientId: string } {
  return {
    contexte: {
      utilisateurId: PORTAIL_A_CLIENT,
      societeId: SOCIETE_A,
      role: Role.client,
      secondFacteurValide: true,
      adresseIp: null,
      clientId: CLIENT_A1,
    },
    clientId: CLIENT_A1,
  };
}

async function appeler(champs: Record<string, string>): Promise<{
  readonly statut: number;
  readonly motif: string | null;
}> {
  const corps = new FormData();
  for (const [nom, valeur] of Object.entries(champs)) {
    corps.set(nom, valeur);
  }
  const reponse = await creerDemandePortail(
    new Request("http://localhost/api/portail/demandes/creer", {
      method: "POST",
      body: corps,
    }),
  );
  const localisation = reponse.headers.get("location") ?? "";
  const motif = new URL(localisation, "http://localhost").searchParams.get(
    "motif",
  );
  return { statut: reponse.status, motif };
}

async function lireDemande(id: string): Promise<{
  readonly site_id: string;
  readonly machine_id: string | null;
  readonly source: string;
  readonly machine_arretee: boolean;
  readonly urgence: string;
} | null> {
  const lignes = await clientOwner().$queryRawUnsafe<
    Array<{
      site_id: string;
      machine_id: string | null;
      source: string;
      machine_arretee: boolean;
      urgence: string;
    }>
  >(
    `SELECT "site_id", "machine_id", "source", "machine_arretee", "urgence" FROM "demande" WHERE "id" = $1::uuid`,
    id,
  );
  return lignes[0] ?? null;
}

async function compterDemandes(id: string): Promise<number> {
  const lignes = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*)::bigint AS n FROM "demande" WHERE "id" = $1::uuid`,
    id,
  );
  return Number(lignes[0]?.n ?? 0);
}

let demandeIds: string[] = [];

beforeEach(() => {
  demandeIds = [];
  vi.mocked(contextePortailDemande).mockReset();
});

afterEach(async () => {
  for (const id of demandeIds) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "demande" WHERE "id" = $1::uuid`,
      id,
    );
  }
});

afterAll(fermerClients);

describe("POST /api/portail/demandes/creer — le refus de droit", () => {
  it("aucun compte portail désigné (hors session, hors rattachement) : refusé, rien n'est créé", async () => {
    vi.mocked(contextePortailDemande).mockResolvedValueOnce(null);
    const id = crypto.randomUUID();
    const { statut, motif } = await appeler({
      id,
      description: "9J04 — tentative sans porte",
      site_id: SITE_A1_S1,
    });
    expect(statut).toBe(303);
    expect(motif).toBe("auth.refus");
    expect(await compterDemandes(id)).toBe(0);
  });
});

describe("POST /api/portail/demandes/creer — CLI-4.1, le site est DÉDUIT de la machine", () => {
  it("une machine identifiée, dans le périmètre : la demande porte le SITE de cette machine, jamais celui soumis", async () => {
    vi.mocked(contextePortailDemande).mockResolvedValueOnce(porte());
    const id = crypto.randomUUID();
    const { statut, motif } = await appeler({
      id,
      description: "9J04 — machine identifiée",
      machine_id: MACHINE_A1,
      // Un lieu soumis EN PLUS de la machine est ignoré par la route — même
      // SITE_A1_S1 n'importe pas ici, c'est la déduction qui compte.
    });
    expect(statut).toBe(303);
    expect(motif).toBe("portail.demandes.cree");
    demandeIds.push(id);
    const ligne = await lireDemande(id);
    expect(ligne?.machine_id).toBe(MACHINE_A1);
    expect(ligne?.site_id).toBe(SITE_A1_S1);
  });

  it("une machine HORS du périmètre du compte (forgée) : refusée, aucune demande créée", async () => {
    vi.mocked(contextePortailDemande).mockResolvedValueOnce(porte());
    const id = crypto.randomUUID();
    // MACHINE_A3 est installée sur SITE_A1_S2 (voir `setup/fixtures.ts`) —
    // hors du périmètre de PORTAIL_A_CLIENT, même client, même société :
    // `lireMachine` la lit SOUS LE CONTEXTE et rend `null`, exactement comme
    // une machine inexistante (D35, D50).
    const { statut, motif } = await appeler({
      id,
      description: "9J04 — machine hors périmètre, forgée",
      machine_id: MACHINE_A3,
    });
    expect(statut).toBe(303);
    expect(motif).toBe("portail.demandes.refus.machine_inconnue");
    expect(await compterDemandes(id)).toBe(0);
  });
});

describe("POST /api/portail/demandes/creer — CLI-4.2, matériel non identifié", () => {
  it("aucune machine, un lieu choisi : la demande porte ce lieu, sans machine", async () => {
    vi.mocked(contextePortailDemande).mockResolvedValueOnce(porte());
    const id = crypto.randomUUID();
    const { statut, motif } = await appeler({
      id,
      description: "9J04 — sans machine identifiée",
      site_id: SITE_A1_S1,
    });
    expect(statut).toBe(303);
    expect(motif).toBe("portail.demandes.cree");
    demandeIds.push(id);
    const ligne = await lireDemande(id);
    expect(ligne?.machine_id).toBeNull();
    expect(ligne?.site_id).toBe(SITE_A1_S1);
  });

  it("ni machine ni lieu : refusée, rien n'est créé", async () => {
    vi.mocked(contextePortailDemande).mockResolvedValueOnce(porte());
    const id = crypto.randomUUID();
    const { statut, motif } = await appeler({
      id,
      description: "9J04 — ni machine ni lieu",
    });
    expect(statut).toBe(303);
    expect(motif).toBe("portail.demandes.refus.saisie");
    expect(await compterDemandes(id)).toBe(0);
  });
});

describe("POST /api/portail/demandes/creer — « machine à l'arrêt » (9K03), `urgence` reste fixée", () => {
  it("la case cochée écrit `machine_arretee = true`, `urgence` reste « p3 »", async () => {
    vi.mocked(contextePortailDemande).mockResolvedValueOnce(porte());
    const id = crypto.randomUUID();
    const { statut, motif } = await appeler({
      id,
      description: "9K03 — machine à l'arrêt",
      machine_id: MACHINE_A1,
      machine_arretee: "on",
    });
    expect(statut).toBe(303);
    expect(motif).toBe("portail.demandes.cree");
    demandeIds.push(id);
    const ligne = await lireDemande(id);
    expect(ligne?.machine_arretee).toBe(true);
    expect(ligne?.urgence).toBe("p3");
  });

  it("la case absente écrit `machine_arretee = false`", async () => {
    vi.mocked(contextePortailDemande).mockResolvedValueOnce(porte());
    const id = crypto.randomUUID();
    const { statut } = await appeler({
      id,
      description: "9K03 — sans la case",
      machine_id: MACHINE_A1,
    });
    expect(statut).toBe(303);
    demandeIds.push(id);
    const ligne = await lireDemande(id);
    expect(ligne?.machine_arretee).toBe(false);
  });

  it("un `urgence` forgé dans le formulaire est IGNORÉ : la demande reste « p3 »", async () => {
    vi.mocked(contextePortailDemande).mockResolvedValueOnce(porte());
    const id = crypto.randomUUID();
    const { statut } = await appeler({
      id,
      description: "9K03 — urgence forgée",
      machine_id: MACHINE_A1,
      urgence: "p1",
    });
    expect(statut).toBe(303);
    demandeIds.push(id);
    const ligne = await lireDemande(id);
    expect(ligne?.urgence).toBe("p3");
  });
});

describe("POST /api/portail/demandes/creer — `source` est IMPOSÉ, jamais lu du formulaire (INTERDITS)", () => {
  it('un `source` forgé dans le formulaire est IGNORÉ : la demande porte toujours "portail"', async () => {
    vi.mocked(contextePortailDemande).mockResolvedValueOnce(porte());
    const id = crypto.randomUUID();
    const { statut, motif } = await appeler({
      id,
      description: "9J04 — source forgée",
      site_id: SITE_A1_S1,
      source: "echeance_contrat",
    });
    expect(statut).toBe(303);
    expect(motif).toBe("portail.demandes.cree");
    demandeIds.push(id);
    const ligne = await lireDemande(id);
    expect(ligne?.source).toBe("portail");
  });
});
