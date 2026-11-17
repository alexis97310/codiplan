import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * 9L10-CREER-INTERVENTION-QUALIFIER — décision d'Alexis du 10/11/2026.
 *
 * `POST /api/interventions/creer` exige désormais `qualifier_affecter`,
 * jamais `creer_demande` : créer directement une intervention est le même
 * geste que qualifier une demande (D151, « qualifier une demande, c'est
 * décider qu'on va intervenir »), pas celui de la déposer. Le client et le
 * technicien, qui possèdent `creer_demande` pour déposer une DEMANDE
 * (`/api/demandes/creer`, inchangée), ne possèdent pas `qualifier_affecter`
 * et sont donc refusés ici — sans exception : aucun écran terrain légitime
 * n'appelle cette route (mesuré, 9L10).
 *
 * Même patron que `tests/isolation/droits-ecrans-tp-s3.test.ts` : la porte
 * est fabriquée pour un rôle donné en rejouant le VERDICT RÉEL de `peut`
 * (`lib/auth/habilitations.ts`), et tout le reste — base réelle, politique
 * RLS — est le chemin de production.
 */

vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn(),
  motifDuRefus: vi.fn().mockResolvedValue("auth.refus_droit"),
}));

/**
 * LA PORTE EST FABRIQUÉE, JAMAIS LA BASE — `DATABASE_URL` doit pointer vers
 * la MÊME base jetable que `TEST_DATABASE_URL`, sous le rôle `codiplan_app`,
 * posé AVANT que `lib/db/client.ts` ne soit importé par la route ci-dessous.
 */
vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/9l10-creer-intervention-qualifier.test.ts.",
    );
  }
  const url = new URL(base);
  url.username = "codiplan_app";
  url.password = "";
  process.env.DATABASE_URL = url.toString();
});

import { type ContexteActif } from "@/lib/auth/contexte";
import { peut } from "@/lib/auth/habilitations";
import { exigerCapacite } from "@/lib/auth/porte";
import { Role } from "@/lib/auth/roles";

import { POST as postInterventionCreer } from "@/app/api/interventions/creer/route";

import { clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  SITE_A1_S1,
  SOCIETE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

function contexte(role: Role): ContexteActif {
  return {
    utilisateurId: UTILISATEUR_PAR_ROLE[role],
    societeId: SOCIETE_A,
    role,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

/**
 * LA VRAIE PORTE, PAS UN `null` FORCÉ — rejoue le verdict réel de `peut`
 * pour ce rôle sur `qualifier_affecter` : si la matrice change, l'assertion
 * de refus (ou d'acceptation) rougit pour la bonne raison.
 */
function viaPorte(role: Role): ContexteActif | null {
  return peut(role, "qualifier_affecter") ? contexte(role) : null;
}

function motifDeLaRedirection(reponse: Response): string | null {
  const location = reponse.headers.get("location");
  if (location === null) return null;
  return new URL(location, "http://localhost").searchParams.get("motif");
}

function corpsFormulaire(description: string): FormData {
  const corps = new FormData();
  corps.set("site", `${CLIENT_A1}:${SITE_A1_S1}`);
  corps.set("type", "curatif");
  corps.set("priorite", "p3");
  corps.set("description", description);
  return corps;
}

async function compterParDescription(description: string): Promise<number> {
  const lignes = await clientOwner().$queryRawUnsafe<Array<{ n: bigint }>>(
    `SELECT count(*)::bigint AS "n" FROM "intervention"
     WHERE "societe_id" = $1::uuid AND "description" = $2`,
    SOCIETE_A,
    description,
  );
  return Number(lignes[0]?.n ?? -1);
}

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "societe_id" = $1::uuid AND "description" LIKE '9L10-EPREUVE-%'`,
    SOCIETE_A,
  );
  await fermerClients();
});

describe("9L10 — le client, qui dépose une demande mais ne qualifie rien, est refusé", () => {
  it("création directe refusée, rien n'est écrit", async () => {
    const description = "9L10-EPREUVE-client";
    vi.mocked(exigerCapacite).mockResolvedValueOnce(viaPorte(Role.client));

    const reponse = await postInterventionCreer(
      new Request("http://localhost/api/interventions/creer", {
        method: "POST",
        body: corpsFormulaire(description),
      }),
    );

    expect(reponse.status).toBe(303);
    expect(reponse.headers.get("location")).toMatch(/^\/planning/);
    expect(motifDeLaRedirection(reponse)).toBe("auth.refus_droit");
    expect(await compterParDescription(description)).toBe(0);
  });
});

describe("9L10 — le technicien est refusé, sans exception : aucun chemin terrain n'appelle cette route", () => {
  it("création directe refusée, rien n'est écrit", async () => {
    const description = "9L10-EPREUVE-technicien";
    vi.mocked(exigerCapacite).mockResolvedValueOnce(viaPorte(Role.technicien));

    const reponse = await postInterventionCreer(
      new Request("http://localhost/api/interventions/creer", {
        method: "POST",
        body: corpsFormulaire(description),
      }),
    );

    expect(reponse.status).toBe(303);
    expect(reponse.headers.get("location")).toMatch(/^\/planning/);
    expect(motifDeLaRedirection(reponse)).toBe("auth.refus_droit");
    expect(await compterParDescription(description)).toBe(0);
  });
});

describe("9L10 — l'ADV, qui qualifie et affecte, reste acceptée", () => {
  it("création directe acceptée, la ligne existe", async () => {
    const description = "9L10-EPREUVE-adv";
    vi.mocked(exigerCapacite).mockResolvedValueOnce(viaPorte(Role.adv));

    const reponse = await postInterventionCreer(
      new Request("http://localhost/api/interventions/creer", {
        method: "POST",
        body: corpsFormulaire(description),
      }),
    );

    expect(reponse.status).toBe(303);
    expect(reponse.headers.get("location")).toMatch(/^\/interventions\//);
    expect(await compterParDescription(description)).toBe(1);
  });
});

describe("9L10 — le responsable SAV, qui qualifie et affecte, reste accepté", () => {
  it("création directe acceptée, la ligne existe", async () => {
    const description = "9L10-EPREUVE-responsable";
    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      viaPorte(Role.responsable_sav),
    );

    const reponse = await postInterventionCreer(
      new Request("http://localhost/api/interventions/creer", {
        method: "POST",
        body: corpsFormulaire(description),
      }),
    );

    expect(reponse.status).toBe(303);
    expect(reponse.headers.get("location")).toMatch(/^\/interventions\//);
    expect(await compterParDescription(description)).toBe(1);
  });
});
