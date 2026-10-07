import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * `GET /api/clients/homonymes` — LE DOUBLON POSSIBLE, AVEC LA VRAIE BASE
 * (9EK-TP-UX5-2-CREATIONS-1, CS40).
 *
 * Même patron que `tests/isolation/droits-ecrans-tp-s3.test.ts` : la porte
 * est fabriquée pour un rôle donné, et tout le reste (base réelle, politique
 * RLS) est le chemin de production. La route appelle `rechercherClients` et
 * `sitesParClient` SANS client Prisma explicite — elle traverse donc le pool
 * par défaut (`lib/db/client.ts`), qui doit lire la base jetable sous le rôle
 * APPLICATIF, posé AVANT l'import de la route.
 */

vi.mock("@/lib/auth/porte", () => ({
  exigerCapacite: vi.fn(),
}));

vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/clients-homonymes.test.ts.",
    );
  }
  const url = new URL(base);
  url.username = "codiplan_app";
  url.password = "";
  process.env.DATABASE_URL = url.toString();
});

import { type ContexteActif } from "@/lib/auth/contexte";
import { type Capacite, peut } from "@/lib/auth/habilitations";
import { exigerCapacite } from "@/lib/auth/porte";
import { Role } from "@/lib/auth/roles";

import { GET as getHomonymes } from "@/app/api/clients/homonymes/route";

import { clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_PAR_ROLE,
} from "./setup/fixtures";

function contexte(role: Role, societeId = SOCIETE_A): ContexteActif {
  return {
    utilisateurId: UTILISATEUR_PAR_ROLE[role],
    societeId,
    role,
    secondFacteurValide: true,
    adresseIp: null,
    clientId: null,
  };
}

/**
 * LE VERDICT RÉEL DE `peut` — jamais un `null` forcé (même raison qu'à
 * `droits-ecrans-tp-s3.test.ts`) : un `null` forcé prouverait seulement que
 * le test l'affirme, pas que la matrice refuse.
 */
function viaPorte(role: Role, capacite: Capacite): ContexteActif | null {
  return peut(role, capacite) ? contexte(role) : null;
}

type Resultat = {
  readonly id: string;
  readonly raison_sociale: string;
  readonly commune: string | null;
  readonly nombreSites: number;
  readonly actif: boolean;
};

async function appeler(raisonSociale: string): Promise<{
  readonly statut: number;
  readonly resultats?: readonly Resultat[];
}> {
  const reponse = await getHomonymes(
    new Request(
      `http://localhost/api/clients/homonymes?raison_sociale=${encodeURIComponent(raisonSociale)}`,
    ),
  );
  if (reponse.status !== 200) {
    return { statut: reponse.status };
  }
  const corps = (await reponse.json()) as { resultats: Resultat[] };
  return { statut: 200, resultats: corps.resultats };
}

const PREFIXE = "9EK-HOMONYME";
const CLIENT_ACTIF = "aaaaaaaa-0000-7000-8000-00000000ea01";
const CLIENT_INACTIF = "aaaaaaaa-0000-7000-8000-00000000ea02";
const CLIENT_VOISIN = "aaaaaaaa-0000-7000-8000-00000000ea03";
const CLIENT_SOCIETE_B = "bbbbbbbb-0000-7000-8000-00000000ea04";
const SITE_1 = "aaaaaaaa-0000-7000-8000-00000000ea11";
const SITE_2 = "aaaaaaaa-0000-7000-8000-00000000ea12";

// Même nom normalisé (casse, accents, espaces), orthographié différemment —
// c'est précisément ce que `normaliserRaisonSociale` doit faire disparaître.
const RAISON_ACTIVE = `${PREFIXE} Garage Dupont`;
const RAISON_INACTIVE = `${PREFIXE}   garage   DUPONT`;
// Un nom VOISIN, normalisé DIFFÉREMMENT — ne doit jamais être rendu.
const RAISON_VOISINE = `${PREFIXE} Garage Dupont Nord`;

beforeAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "client" ("id", "societe_id", "raison_sociale", "actif")
     VALUES ($1::uuid, $2::uuid, $3, true)
     ON CONFLICT ("id") DO NOTHING`,
    CLIENT_ACTIF,
    SOCIETE_A,
    RAISON_ACTIVE,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "client" ("id", "societe_id", "raison_sociale", "actif")
     VALUES ($1::uuid, $2::uuid, $3, false)
     ON CONFLICT ("id") DO NOTHING`,
    CLIENT_INACTIF,
    SOCIETE_A,
    RAISON_INACTIVE,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "client" ("id", "societe_id", "raison_sociale", "actif")
     VALUES ($1::uuid, $2::uuid, $3, true)
     ON CONFLICT ("id") DO NOTHING`,
    CLIENT_VOISIN,
    SOCIETE_A,
    RAISON_VOISINE,
  );
  // LA SOCIÉTÉ B PORTE LE MÊME NOM — jamais rendu de la société A.
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "client" ("id", "societe_id", "raison_sociale", "actif")
     VALUES ($1::uuid, $2::uuid, $3, true)
     ON CONFLICT ("id") DO NOTHING`,
    CLIENT_SOCIETE_B,
    SOCIETE_B,
    RAISON_ACTIVE,
  );
  // DEUX SITES pour le client actif — `nombreSites` et `commune` en dépendent.
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle", "commune")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'Atelier', 'Dumbéa')
     ON CONFLICT ("id") DO NOTHING`,
    SITE_1,
    SOCIETE_A,
    CLIENT_ACTIF,
    AGENCE_A,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle", "commune")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'Dépôt', 'Dumbéa')
     ON CONFLICT ("id") DO NOTHING`,
    SITE_2,
    SOCIETE_A,
    CLIENT_ACTIF,
    AGENCE_A,
  );
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "site" WHERE "id" IN ($1::uuid, $2::uuid)`,
    SITE_1,
    SITE_2,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "client" WHERE "id" IN ($1::uuid, $2::uuid, $3::uuid, $4::uuid)`,
    CLIENT_ACTIF,
    CLIENT_INACTIF,
    CLIENT_VOISIN,
    CLIENT_SOCIETE_B,
  );
  await fermerClients();
});

describe("GET /api/clients/homonymes (9EK-TP-UX5-2-CREATIONS-1, CS40)", () => {
  it("un technicien, sans `gerer_client_site`, est refusé — verdict RÉEL de la matrice", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      viaPorte(Role.technicien, "gerer_client_site"),
    );
    const { statut } = await appeler(RAISON_ACTIVE);
    expect(statut).toBe(403);
  });

  it("une forme normalisée vide (casse, accents, ponctuation) ne lit rien", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(Role.adv));
    const { statut, resultats } = await appeler("   ---   ");
    expect(statut).toBe(200);
    expect(resultats).toEqual([]);
  });

  it("égalité normalisée trouvée — casse, espaces et accent de rédaction différents", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(Role.adv));
    const { resultats } = await appeler(RAISON_ACTIVE.toLowerCase());
    const ids = resultats!.map((r) => r.id);
    expect(ids).toContain(CLIENT_ACTIF);
    expect(ids).toContain(CLIENT_INACTIF);
    // LE NOM VOISIN N'EST PAS UN HOMONYME — sa forme normalisée diffère.
    expect(ids).not.toContain(CLIENT_VOISIN);
  });

  it("le client INACTIF est rendu, avec son état", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(Role.adv));
    const { resultats } = await appeler(RAISON_ACTIVE);
    const inactif = resultats!.find((r) => r.id === CLIENT_INACTIF);
    expect(inactif?.actif).toBe(false);
  });

  it("la commune et le nombre de sites viennent de `sitesParClient`", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(Role.adv));
    const { resultats } = await appeler(RAISON_ACTIVE);
    const actif = resultats!.find((r) => r.id === CLIENT_ACTIF);
    expect(actif?.commune).toBe("Dumbéa");
    expect(actif?.nombreSites).toBe(2);
  });

  it("la société B ne rend JAMAIS un homonyme de la société A", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(Role.adv));
    const { resultats } = await appeler(RAISON_ACTIVE);
    expect(resultats!.map((r) => r.id)).not.toContain(CLIENT_SOCIETE_B);
  });

  it("n'expose aucun champ hors du contrat de la route", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(contexte(Role.adv));
    const { resultats } = await appeler(RAISON_ACTIVE);
    for (const resultat of resultats!) {
      expect(Object.keys(resultat).sort()).toEqual(
        ["actif", "commune", "id", "nombreSites", "raison_sociale"].sort(),
      );
    }
  });

  it("l'ADV, qui porte `gerer_client_site`, est accepté — verdict RÉEL de la matrice", async () => {
    vi.mocked(exigerCapacite).mockResolvedValueOnce(
      viaPorte(Role.adv, "gerer_client_site"),
    );
    const { statut } = await appeler(RAISON_ACTIVE);
    expect(statut).toBe(200);
  });
});
