import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * RETIRER UNE EXIGENCE DE SITE, PAR LA ROUTE (décision d'Alexis du
 * 10/11/2026) — `retirerExigence` (`lib/habilitations/depot.ts`) ne juge
 * elle-même aucune capacité : c'est la porte de la route
 * (`app/api/habilitations/exigences/[id]/retirer/route.ts`,
 * `gerer_client_site`) qui le fait. Même patron que
 * `tests/isolation/droits-import-par-type.test.ts` et
 * `tests/isolation/annulation.test.ts` : la porte est fabriquée pour un rôle
 * donné, et tout le reste — base réelle, RLS, `avecContexteApplicatif` — est
 * le chemin de PRODUCTION. La route n'appelle `retirerExigence` avec AUCUN
 * client de substitution : `DATABASE_URL` doit donc pointer vers la MÊME
 * base jetable que `TEST_DATABASE_URL`, sous le rôle `codiplan_app`, posé
 * AVANT que `lib/db/client.ts` ne soit importé.
 */
vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn(),
  motifDuRefus: vi.fn().mockResolvedValue("auth.refus_droit"),
}));

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/retirer-exigence.test.ts.",
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
import { creerExigence, creerHabilitation } from "@/lib/habilitations/depot";

import { POST as postRetirer } from "@/app/api/habilitations/exigences/[id]/retirer/route";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  SITE_A1_S1,
  SITE_B1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_INTERNE_B,
} from "./setup/fixtures";

const SESSION_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
} as const;

const SESSION_B = {
  ...SESSION_A,
  utilisateurId: UTILISATEUR_INTERNE_B,
  societeId: SOCIETE_B,
};

function contexteActif(societeId: string, role: Role): ContexteActif {
  return {
    utilisateurId: uuidv7(),
    societeId,
    role,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

function requeteRetirer(siteId: string): Request {
  const corps = new FormData();
  corps.set("site_id", siteId);
  return new Request("http://localhost/api/habilitations/exigences/x/retirer", {
    method: "POST",
    body: corps,
  });
}

function motifDeLaRedirection(reponse: Response): string | null {
  const location = reponse.headers.get("location");
  if (location === null) return null;
  return new URL(location, "http://localhost").searchParams.get("motif");
}

async function appeler(id: string, siteId: string): Promise<Response> {
  return postRetirer(requeteRetirer(siteId), {
    params: Promise.resolve({ id }),
  });
}

async function exigenceExiste(id: string): Promise<boolean> {
  const compte = await clientOwner().siteHabilitationRequise.count({
    where: { id },
  });
  return compte > 0;
}

const habilitationsPosees: string[] = [];
const exigencesPosees: string[] = [];

afterEach(async () => {
  if (exigencesPosees.length > 0) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "site_habilitation_requise" WHERE "id" IN (${exigencesPosees.map((id) => `'${id}'`).join(",")})`,
    );
    exigencesPosees.length = 0;
  }
  if (habilitationsPosees.length > 0) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "habilitation" WHERE "id" IN (${habilitationsPosees.map((id) => `'${id}'`).join(",")})`,
    );
    habilitationsPosees.length = 0;
  }
});

afterAll(fermerClients);

/** Les DERNIERS caractères d'un UUID v7, jamais les premiers (I10, §9 14/09). */
function code(prefixe: string): string {
  return `${prefixe}-${uuidv7().replaceAll("-", "").slice(-12)}`;
}

async function uneExigence(
  session: typeof SESSION_A | typeof SESSION_B,
  siteId: string,
): Promise<string> {
  const habilitation = await creerHabilitation(
    session,
    {
      code: code("RETIRER"),
      libelle: "Habilitation de test",
      duree_validite_mois: null,
    },
    clientApp(),
  );
  if (!habilitation.accepte) {
    throw new Error(`création de l'habilitation refusée : ${habilitation.motif}`);
  }
  habilitationsPosees.push(habilitation.id);

  const exigence = await creerExigence(
    session,
    { site_id: siteId, habilitation_id: habilitation.id, bloquant: true },
    clientApp(),
  );
  if (!exigence.accepte) {
    throw new Error(`création de l'exigence refusée : ${exigence.motif}`);
  }
  exigencesPosees.push(exigence.id);
  return exigence.id;
}

describe("retirer une exigence de site, par la route (décision d'Alexis du 10/11/2026)", () => {
  it("accepté — l'exigence disparaît", async () => {
    const id = await uneExigence(SESSION_A, SITE_A1_S1);
    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      contexteActif(SOCIETE_A, Role.adv),
    );

    const reponse = await appeler(id, SITE_A1_S1);
    expect(motifDeLaRedirection(reponse)).toBeNull();
    expect(await exigenceExiste(id)).toBe(false);
  });

  it("refusé SANS la capacité — l'exigence reste", async () => {
    const id = await uneExigence(SESSION_A, SITE_A1_S1);
    // Un rôle sans `gerer_client_site` (ADMS, DIR, ADV seuls la détiennent) :
    // la porte rend `null`, exactement comme une session absente (D-12).
    vi.mocked(exigerCapacite).mockResolvedValueOnce(null);

    const reponse = await appeler(id, SITE_A1_S1);
    expect(motifDeLaRedirection(reponse)).toBe("auth.refus_droit");
    expect(await exigenceExiste(id)).toBe(true);
  });

  it("une exigence d'une AUTRE société n'est ni lue ni retirée", async () => {
    const id = await uneExigence(SESSION_B, SITE_B1_S1);
    // La capacité est accordée, mais pour la société A : la RLS rend
    // l'exigence de B invisible, exactement comme un identifiant inconnu.
    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      contexteActif(SOCIETE_A, Role.adv),
    );

    const reponse = await appeler(id, SITE_B1_S1);
    expect(motifDeLaRedirection(reponse)).toBe("habilitations.refus.introuvable");
    expect(await exigenceExiste(id)).toBe(true);
  });
});
