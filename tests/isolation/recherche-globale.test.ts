import { afterAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";

import { fermerClients, urlApp } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_B1,
  INTERVENTION_A1,
  INTERVENTION_A2,
  MACHINE_A1,
  MACHINE_A2,
  MACHINE_A3,
  MACHINE_B1,
  SOCIETE_A,
  UTILISATEUR_INTERNE_A,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

/**
 * `rechercherGlobalement` (`lib/navigation/recherche-globale.ts`) NE PASSE
 * AUCUN CLIENT PRISMA EXPLICITE — comme `listerLeRegistre`
 * (`tests/isolation/parc-perimetre-technicien.test.ts`, même motif) : elle
 * transite par le client global de `lib/db/client.ts`. `DATABASE_URL` est
 * donc posée AVANT l'import dynamique, pour que ce client global pointe sur
 * le rôle `codiplan_app` du harnais plutôt que sur une base absente.
 */
const URL_DATABASE_AVANT = process.env.DATABASE_URL;
process.env.DATABASE_URL = urlApp();
const { rechercherGlobalement } =
  await import("@/lib/navigation/recherche-globale");

afterAll(async () => {
  process.env.DATABASE_URL = URL_DATABASE_AVANT;
  await fermerClients();
});

const ADMIN_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const TECHNICIEN_A = {
  ...ADMIN_A,
  utilisateurId: UTILISATEUR_PAR_ROLE[Role.technicien] as string,
  role: Role.technicien,
};

function groupe(
  groupes: readonly {
    readonly cle: string;
    readonly resultats: readonly { readonly id: string }[];
  }[],
  cle: string,
): readonly { readonly id: string }[] {
  return groupes.find((g) => g.cle === cle)?.resultats ?? [];
}

describe("la recherche globale — cloisonnée par la société, jamais par le texte", () => {
  it("« Client » ne rend que le client de la société ACTIVE", async () => {
    const groupes = await rechercherGlobalement(ADMIN_A, "Client");
    const ids = groupe(groupes, "clients").map((r) => r.id);
    expect(ids).toContain(CLIENT_A1);
    expect(ids).not.toContain(CLIENT_B1);
  });

  it("« SN- » (numéro de série) ne rend que les machines de la société ACTIVE", async () => {
    const groupes = await rechercherGlobalement(ADMIN_A, "SN-");
    const ids = groupe(groupes, "machines").map((r) => r.id);
    expect(ids).toContain(MACHINE_A1);
    expect(ids).not.toContain(MACHINE_B1);
  });

  it("« Client A1 » ne rend que les interventions de ce client, dans la société ACTIVE", async () => {
    const groupes = await rechercherGlobalement(ADMIN_A, "Client A1");
    const ids = groupe(groupes, "interventions").map((r) => r.id);
    expect(ids).toContain(INTERVENTION_A1);
    expect(ids).toContain(INTERVENTION_A2);
  });
});

describe("le technicien RESTREINT (QT-2, D152) n'a droit qu'à SON périmètre", () => {
  it("machines — seule MACHINE_A1 (rattachée à l'une de SES interventions) apparaît", async () => {
    const groupes = await rechercherGlobalement(TECHNICIEN_A, "SN-");
    const ids = groupe(groupes, "machines").map((r) => r.id);
    expect(ids).toContain(MACHINE_A1);
    expect(ids).not.toContain(MACHINE_A2);
    expect(ids).not.toContain(MACHINE_A3);
  });

  it("interventions — INTERVENTION_A1 (la sienne) apparaît, INTERVENTION_A2 (un collègue) non", async () => {
    const groupes = await rechercherGlobalement(TECHNICIEN_A, "Client A1");
    const ids = groupe(groupes, "interventions").map((r) => r.id);
    expect(ids).toContain(INTERVENTION_A1);
    expect(ids).not.toContain(INTERVENTION_A2);
  });
});

describe("aucun montant — la recherche ne rend que des désignations", () => {
  it("chaque résultat, de chaque groupe, ne porte que id/libelle/href", async () => {
    const groupes = await rechercherGlobalement(ADMIN_A, "Client");
    let temoin = 0;
    for (const g of groupes) {
      for (const resultat of g.resultats) {
        temoin += 1;
        expect(Object.keys(resultat).sort()).toEqual(["href", "id", "libelle"]);
      }
    }
    // Témoin de non-vacuité : sans lui, un tableau vide passerait la même épreuve.
    expect(temoin).toBeGreaterThan(0);
  });
});

describe("un texte vide ne cherche rien", () => {
  it("quatre groupes vides, pour un texte blanc", async () => {
    const groupes = await rechercherGlobalement(ADMIN_A, "   ");
    expect(groupes).toHaveLength(4);
    for (const g of groupes) {
      expect(g.resultats).toEqual([]);
    }
  });
});
