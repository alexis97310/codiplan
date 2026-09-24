import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { Role } from "@/lib/auth/roles";
import { rechercherClients } from "@/lib/clients/depot";
import { schemaRechercheClient } from "@/lib/clients/saisie";
import { rechercherModeles } from "@/lib/materiel/depot";
import { schemaRechercheModele } from "@/lib/materiel/saisie";
import { rechercherSites } from "@/lib/sites/depot";
import { schemaRechercheSite } from "@/lib/sites/saisie";

// AUCUNE SESSION RÉELLE — `obtenirSession` dépend de Better Auth et d'une
// base à laquelle ce fichier ne s'adosse pas ; les quatre routes ci-dessous
// ne sont exercées ici QUE pour leur branche 401, qui ne lit rien d'autre.
// Ce mock ne touche que `@/lib/auth/session` : les fonctions de dépôt
// éprouvées plus haut ne l'importent pas et n'en sont pas affectées.
vi.mock("@/lib/auth/session", () => ({
  obtenirSession: vi.fn(async () => null),
}));

import { GET as getClients } from "@/app/api/recherche/clients/route";
import { GET as getModeles } from "@/app/api/recherche/modeles/route";
import { GET as getSiteMachines } from "@/app/api/recherche/site/[id]/route";
import { GET as getSites } from "@/app/api/recherche/sites/route";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  CLIENT_A1,
  CLIENT_B1,
  FAMILLE_A,
  MODELE_A,
  MODELE_B,
  SITE_A1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * LES ROUTES DE RECHERCHE DES SÉLECTEURS (SELECTEURS-1, 24/09/2026).
 *
 * Trois lectures cloisonnées — `rechercherClients`, `rechercherSites` (avec
 * son nouveau critère `client_actif`), `rechercherModeles` — et le refus
 * qu'oppose chaque route SANS session. Les trois premières éprouvent le même
 * point que `tests/isolation/ecran-client.test.ts` : un critère de RECHERCHE
 * (`texte`) n'est jamais ce qui cloisonne, c'est la politique RLS, posée par
 * le CONTEXTE.
 */

const INTERNE_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const INTERNE_B = { ...INTERNE_A, societeId: SOCIETE_B };

afterAll(fermerClients);

describe("la recherche de clients — cloisonnée par le CONTEXTE, jamais par `texte`", () => {
  it("un texte qui correspond dans les DEUX sociétés ne rend que la sienne", async () => {
    // TÉMOIN — les deux sociétés portent un client dont la raison sociale
    // commence par « Client » (`Client A1`, `Client B1`).
    const [temoin] = await clientOwner().$queryRawUnsafe<
      { a: number; b: number }[]
    >(
      `SELECT
         count(*) FILTER (WHERE societe_id = $1::uuid AND raison_sociale ILIKE 'Client%')::int AS a,
         count(*) FILTER (WHERE societe_id = $2::uuid AND raison_sociale ILIKE 'Client%')::int AS b
       FROM "client"`,
      SOCIETE_A,
      SOCIETE_B,
    );
    expect(temoin!.a).toBeGreaterThan(0);
    expect(temoin!.b).toBeGreaterThan(0);

    const criteres = schemaRechercheClient.parse({ texte: "Client" });
    const vuDeA = await rechercherClients(INTERNE_A, criteres, clientApp());
    expect(vuDeA.map((c) => c.id)).toContain(CLIENT_A1);
    expect(vuDeA.map((c) => c.id)).not.toContain(CLIENT_B1);
  });
});

describe("la recherche de sites — `client_actif` (RG-PLA-08)", () => {
  const CLIENT_INACTIF = "aaaaaaaa-0000-7000-8000-00000000ec10";
  const SITE_DU_CLIENT_INACTIF = "aaaaaaaa-0000-7000-8000-00000000ec11";

  beforeAll(async () => {
    // Posé sous le PROPRIÉTAIRE — une donnée de scénario, pas une écriture à
    // éprouver — et retiré à la fin (voir `ecran-client.test.ts`, même
    // discipline).
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "client" ("id", "societe_id", "raison_sociale", "actif")
       VALUES ($1::uuid, $2::uuid, 'Client désactivé SELECTEURS-1', false)
       ON CONFLICT ("id") DO NOTHING`,
      CLIENT_INACTIF,
      SOCIETE_A,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle")
       SELECT $1::uuid, $2::uuid, $3::uuid, agence_id, 'Site du client désactivé'
       FROM "site" WHERE id = $4::uuid
       ON CONFLICT ("id") DO NOTHING`,
      SITE_DU_CLIENT_INACTIF,
      SOCIETE_A,
      CLIENT_INACTIF,
      SITE_A1_S1,
    );
  });

  afterAll(async () => {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "site" WHERE "id" = $1::uuid`,
      SITE_DU_CLIENT_INACTIF,
    );
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "client" WHERE "id" = $1::uuid`,
      CLIENT_INACTIF,
    );
  });

  it("TÉMOIN — le site du client désactivé existe bien", async () => {
    const [temoin] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "site" WHERE id = $1::uuid`,
      SITE_DU_CLIENT_INACTIF,
    );
    expect(temoin!.n).toBe(1);
  });

  it("`client_actif: true` exclut le site d'un client INACTIF", async () => {
    const criteres = schemaRechercheSite.parse({ client_actif: true });
    const vus = await rechercherSites(INTERNE_A, criteres, clientApp());
    expect(vus.map((s) => s.id)).not.toContain(SITE_DU_CLIENT_INACTIF);
    // LE CAS QUI DOIT RESTER VERT POUR SA PROPRE RAISON : un site d'un
    // client ACTIF reste proposé — sans lui, un critère câblé pour tout
    // exclure passerait la même épreuve.
    expect(vus.map((s) => s.id)).toContain(SITE_A1_S1);
  });

  it("SANS `client_actif` (défaut `null`), le site du client désactivé reste visible", async () => {
    const criteres = schemaRechercheSite.parse({});
    const vus = await rechercherSites(INTERNE_A, criteres, clientApp());
    expect(vus.map((s) => s.id)).toContain(SITE_DU_CLIENT_INACTIF);
  });

  it("le critère reste cloisonné par la société, `client_actif` compris", async () => {
    const criteres = schemaRechercheSite.parse({ client_actif: true });
    const vuDeB = await rechercherSites(INTERNE_B, criteres, clientApp());
    expect(vuDeB.map((s) => s.id)).not.toContain(SITE_A1_S1);
  });
});

describe("la recherche de modèles — même marque, deux sociétés", () => {
  it("« Atlas » ne rend que le modèle de LA société active", async () => {
    // TÉMOIN — les deux sociétés portent un modèle « Atlas GA-11 » (mêmes
    // marque et référence, fixture délibérée — voir global.ts).
    const [temoin] = await clientOwner().$queryRawUnsafe<
      { a: number; b: number }[]
    >(
      `SELECT
         count(*) FILTER (WHERE societe_id = $1::uuid AND marque = 'Atlas')::int AS a,
         count(*) FILTER (WHERE societe_id = $2::uuid AND marque = 'Atlas')::int AS b
       FROM "modele_materiel"`,
      SOCIETE_A,
      SOCIETE_B,
    );
    expect(temoin!.a).toBe(1);
    expect(temoin!.b).toBe(1);

    const criteres = schemaRechercheModele.parse({ texte: "Atlas" });
    const vuDeA = await rechercherModeles(INTERNE_A, criteres, clientApp());
    expect(vuDeA.map((m) => m.id)).toEqual([MODELE_A]);
    expect(vuDeA.map((m) => m.id)).not.toContain(MODELE_B);
  });

  it("`famille_id` filtre, et reste cloisonné : la famille de B est invisible de A", async () => {
    const criteres = schemaRechercheModele.parse({ famille_id: FAMILLE_A });
    const vus = await rechercherModeles(INTERNE_A, criteres, clientApp());
    expect(vus.map((m) => m.id)).toEqual([MODELE_A]);
  });
});

describe("les routes de recherche refusent SANS session (401)", () => {
  it("`/api/recherche/clients` rend 401 sans session", async () => {
    const reponse = await getClients(
      new Request("http://localhost/api/recherche/clients"),
    );
    expect(reponse.status).toBe(401);
  });

  it("`/api/recherche/sites` rend 401 sans session", async () => {
    const reponse = await getSites(
      new Request("http://localhost/api/recherche/sites"),
    );
    expect(reponse.status).toBe(401);
  });

  it("`/api/recherche/modeles` rend 401 sans session", async () => {
    const reponse = await getModeles(
      new Request("http://localhost/api/recherche/modeles"),
    );
    expect(reponse.status).toBe(401);
  });

  it("`/api/recherche/site/[id]` rend 401 sans session", async () => {
    const reponse = await getSiteMachines(
      new Request(`http://localhost/api/recherche/site/${SITE_A1_S1}`),
      { params: Promise.resolve({ id: SITE_A1_S1 }) },
    );
    expect(reponse.status).toBe(401);
  });
});
