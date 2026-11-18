import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

/**
 * L'ANNULATION, PAR LA ROUTE (décision d'Alexis du 10/11/2026) — quatre
 * propriétés que la fiche d'intervention tient, et qu'aucun scénario
 * n'éprouvait encore contre une vraie base : le motif vide est refusé, une
 * ligne figée (clôturée) ne s'annule pas, une intervention d'une AUTRE
 * société n'est ni lue ni modifiée, et l'annulation laisse une trace dans
 * `journal_audit` (I8).
 *
 * Même patron que `tests/isolation/droits-import-par-type.test.ts` : la
 * porte (`exigerCapacite`) est fabriquée pour un rôle donné, et tout le
 * reste — base réelle, politique RLS, `avecContexteApplicatif`,
 * `intervention_cycle_de_vie` — est le chemin de PRODUCTION. `annulerIntervention`
 * (`lib/interventions/depot.ts`) ne reçoit aucun client Prisma de
 * substitution, à la différence de ses voisines (`suspendreIntervention`,
 * `cloturerIntervention`…) : elle passe donc par le singleton de
 * `lib/db/client.ts`, et `DATABASE_URL` doit pointer vers LA MÊME base
 * jetable que `TEST_DATABASE_URL`, sous le rôle `codiplan_app` — posé AVANT
 * que `lib/db/client.ts` ne soit importé, par `vi.hoisted`.
 */
vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn(),
  motifDuRefus: vi.fn().mockResolvedValue("auth.refus_droit"),
}));

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/annulation.test.ts.",
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

import { POST as postAnnuler } from "@/app/api/interventions/[id]/annuler/route";

import { clientOwner, fermerClients } from "./setup/db";
import { INTERVENTION_A1, INTERVENTION_B1, SOCIETE_A } from "./setup/fixtures";

function contexte(utilisateurId: string, societeId: string): ContexteActif {
  return {
    utilisateurId,
    societeId,
    role: Role.adv,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

function requeteAnnuler(motif: string): Request {
  const corps = new FormData();
  corps.set("motif", motif);
  return new Request("http://localhost/api/interventions/x/annuler", {
    method: "POST",
    body: corps,
  });
}

function motifDeLaRedirection(reponse: Response): string | null {
  const location = reponse.headers.get("location");
  if (location === null) return null;
  return new URL(location, "http://localhost").searchParams.get("motif");
}

async function appeler(id: string, motif: string): Promise<Response> {
  return postAnnuler(requeteAnnuler(motif), {
    params: Promise.resolve({ id }),
  });
}

async function statutEnBase(id: string): Promise<string | null> {
  const [ligne] = await clientOwner().$queryRawUnsafe<
    Array<{ statut: string }>
  >(`SELECT "statut" FROM "intervention" WHERE "id" = $1::uuid`, id);
  return ligne?.statut ?? null;
}

/**
 * UNE LIGNE JETABLE, NÉE PAR INSERT — le déclencheur `intervention_cycle_de_vie`
 * ne porte que sur `BEFORE UPDATE` (même raison que la matrice complète de
 * `tests/isolation/intervention.test.ts`).
 */
const jetables: string[] = [];

afterEach(async () => {
  for (const id of jetables.splice(0)) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = '${id}'`,
    );
  }
});

afterAll(fermerClients);

async function jetable(
  statut: "planifiee" | "cloturee",
  depuis: string,
): Promise<string> {
  const id = uuidv7();
  jetables.push(id);
  const colonnesCloturee =
    statut === "cloturee"
      ? `,"statut_facturation","temps_valide_min","rapport_valide_par","rapport_valide_le"`
      : "";
  const valeursCloturee =
    statut === "cloturee"
      ? `, 'a_facturer', 90, '00000000-0000-7000-8000-00000000f901', now()`
      : "";
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention" ("id","societe_id","client_id","site_id","agence_id",
       "type","statut","date_planifiee","duree_estimee_min","modifie_le"${colonnesCloturee})
     SELECT '${id}', "societe_id", "client_id", "site_id", "agence_id",
            'curatif', '${statut}', DATE '2026-09-14', 60, now()${valeursCloturee}
       FROM "intervention" WHERE "id" = '${depuis}'`,
  );
  return id;
}

describe("l'annulation, par la route (décision d'Alexis du 10/11/2026)", () => {
  it("un motif vide est refusé — la ligne reste inchangée", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      contexte(uuidv7(), SOCIETE_A),
    );
    const id = await jetable("planifiee", INTERVENTION_A1);

    const reponse = await appeler(id, "  ");
    expect(motifDeLaRedirection(reponse)).toBe(
      "intervention.annulation.obligatoire",
    );
    expect(await statutEnBase(id)).toBe("planifiee");
  });

  it("une intervention CLÔTURÉE (figée) ne s'annule pas", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      contexte(uuidv7(), SOCIETE_A),
    );
    const id = await jetable("cloturee", INTERVENTION_A1);

    const reponse = await appeler(id, "Erreur de saisie");
    expect(motifDeLaRedirection(reponse)).toBe(
      "intervention.refus.cloturee_figee",
    );
    expect(await statutEnBase(id)).toBe("cloturee");
  });

  it("une intervention d'une AUTRE société n'est ni lue ni modifiée (D50)", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      contexte(uuidv7(), SOCIETE_A),
    );
    // Jetable de la société B, sous le contexte de la société A : la RLS la
    // rend invisible, exactement comme un identifiant inconnu (D50).
    const id = await jetable("planifiee", INTERVENTION_B1);

    const reponse = await appeler(id, "Erreur de saisie");
    expect(motifDeLaRedirection(reponse)).toBe("intervention.refus.inconnue");

    // Lue SANS politique (propriétaire) : la ligne de B n'a pas bougé.
    const [ligne] = await clientOwner().$queryRawUnsafe<
      Array<{ statut: string }>
    >(`SELECT "statut" FROM "intervention" WHERE "id" = $1::uuid`, id);
    expect(ligne?.statut).toBe("planifiee");
  });

  it("l'annulation acceptée écrit une ligne dans journal_audit (I8)", async () => {
    const auteur = uuidv7();
    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(auteur, SOCIETE_A));
    const id = await jetable("planifiee", INTERVENTION_A1);

    const reponse = await appeler(id, "Client absent, réagendé par téléphone");
    expect(motifDeLaRedirection(reponse)).toBeNull();
    expect(await statutEnBase(id)).toBe("annulee");

    const lignes = await clientOwner().$queryRawUnsafe<
      Array<{
        action: string;
        utilisateur_id: string | null;
        valeurs_avant: { statut?: string } | null;
        valeurs_apres: { statut?: string; motif_annulation?: string } | null;
      }>
    >(
      `SELECT "action", "utilisateur_id", "valeurs_avant", "valeurs_apres"
         FROM "journal_audit"
        WHERE "entite" = 'intervention' AND "entite_id" = $1::uuid
        ORDER BY "horodatage" DESC`,
      id,
    );
    expect(lignes.length).toBeGreaterThan(0);
    const [derniere] = lignes;
    expect(derniere?.action).toBe("modification");
    expect(derniere?.utilisateur_id).toBe(auteur);
    expect(derniere?.valeurs_avant?.statut).toBe("planifiee");
    expect(derniere?.valeurs_apres?.statut).toBe("annulee");
    expect(derniere?.valeurs_apres?.motif_annulation).toBe(
      "Client absent, réagendé par téléphone",
    );
  });
});
