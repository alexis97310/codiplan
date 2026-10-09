import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * `POST /api/demandes/creer` — LE DÉPÔT DEPUIS LE VOLET « + DEMANDE »
 * (D188, 9EDZ-DEMANDES-CONNEXION-MAQUETTE, partie 2).
 *
 * Même patron que `tests/isolation/clients-homonymes.test.ts` : la porte
 * (`exigerCapacite`) est fabriquée pour un rôle donné, tout le reste (base
 * réelle, politique RLS) est le chemin de production. Deux forgeries
 * jouées directement contre la route, sans passer par l'écran — le dépôt
 * `lib/demandes/depot.ts` est déjà confronté à la base par
 * `tests/isolation/demande.test.ts` ; ce fichier-ci confronte ce que LA
 * ROUTE ajoute par-dessus (le contrôle « machine du bon lieu », absent du
 * schéma, chapitre 11).
 */

vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn(),
  motifDuRefus: vi.fn(async () => "auth.refus" as const),
}));

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/9edz-demandes-creer.test.ts.",
    );
  }
  const url = new URL(base);
  url.username = "codiplan_app";
  url.password = "";
  process.env.DATABASE_URL = url.toString();
});

import { type ContexteActif } from "@/lib/auth/contexte";
import { exigerCapacite } from "@/lib/auth/porte";
import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";

import { POST as creerDemande } from "@/app/api/demandes/creer/route";

import { clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_B1,
  MACHINE_A3,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

function contexte(societeId = SOCIETE_A): ContexteActif {
  return {
    utilisateurId: UTILISATEUR_PAR_ROLE[Role.adv],
    societeId,
    role: Role.adv,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
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
  const reponse = await creerDemande(
    new Request("http://localhost/api/demandes/creer", {
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

async function compterDemandes(id: string): Promise<number> {
  const lignes = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*)::bigint AS n FROM "demande" WHERE "id" = $1::uuid`,
    id,
  );
  return Number(lignes[0]?.n ?? 0);
}

afterAll(fermerClients);

describe("POST /api/demandes/creer — le refus de droit, verdict RÉEL de la matrice", () => {
  it("un rôle sans `creer_demande` (éditeur commercial) est refusé — même famille que les routes soeurs", async () => {
    // AUCUN rôle de CODIMA-NC ordinaire n'en est privé (ADMS, DIR, RM, RS,
    // ADV, TEC et CLI la portent tous, §5.2) : seuls les trois rôles de
    // PLATEFORME en sont dépourvus — `exigerCapacite` rend donc `null`
    // directement pour ce rôle, sans qu'aucune société active n'ait à être
    // fabriquée pour le prouver.
    vi.mocked(exigerCapacite).mockResolvedValueOnce(null);
    const id = uuidv7();
    const { statut, motif } = await appeler({
      id,
      source: "appel",
      client_id: CLIENT_A1,
      site_id: SITE_A1_S1,
      machine_id: "",
      description: "9EDZ — tentative sans la capacité",
    });
    expect(statut).toBe(303);
    expect(motif).toBe("auth.refus");
    expect(await compterDemandes(id)).toBe(0);
  });
});

describe("POST /api/demandes/creer — cloisonnée par le CONTEXTE, pas par les champs soumis", () => {
  it("un client d'une AUTRE société, forgé, ne crée rien — refusé comme un lieu inconnu", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(SOCIETE_A));
    const id = uuidv7();
    const { statut, motif } = await appeler({
      id,
      source: "appel",
      // SITE_A1_S1 appartient à CLIENT_A1 — CLIENT_B1 est de la société B.
      // Même sous le contexte de la société A, le couple ne correspond à
      // AUCUN site réel : `deposerDemande` le lit comme un lieu inconnu,
      // jamais comme une société.
      client_id: CLIENT_B1,
      site_id: SITE_A1_S1,
      machine_id: "",
      description: "9EDZ — dépôt forgé, client d'une autre société",
    });
    expect(statut).toBe(303);
    expect(motif).toBe("demande.refus.lieu_inconnu");
    expect(await compterDemandes(id)).toBe(0);
  });

  it("une machine d'un AUTRE lieu, forgée, est refusée — AUCUNE demande créée", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(SOCIETE_A));
    const id = uuidv7();
    const { statut, motif } = await appeler({
      id,
      source: "appel",
      client_id: CLIENT_A1,
      site_id: SITE_A1_S1,
      // MACHINE_A3 est installée sur SITE_A1_S2 (voir `setup/fixtures.ts`) —
      // un AUTRE lieu du MÊME client, dans la MÊME société : le schéma ne
      // porte aucune clé étrangère entre `machine.site_id` et le site
      // soumis (chapitre 11), c'est la ROUTE qui doit le refuser.
      machine_id: MACHINE_A3,
      description: "9EDZ — dépôt forgé, machine d'un autre lieu",
    });
    expect(statut).toBe(303);
    expect(motif).toBe("demande.refus.machine_hors_lieu");
    expect(await compterDemandes(id)).toBe(0);
  });
});
