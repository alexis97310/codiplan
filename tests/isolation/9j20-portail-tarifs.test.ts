import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { sansCommentaires } from "../unit/outils/fichiers-source";

/**
 * LE BARÈME DU PORTAIL (9J20-PORTAIL-GRILLE-TARIFAIRE, CLI-7) — LA ROUTE
 * ISOLÉE, ET SA TRANSACTION QUI N'OUVRE JAMAIS LE PARC.
 *
 * ## CE QUE CE FICHIER GARDE, SUR LE MODÈLE DE `contexte-arme.test.ts`
 *
 * Deux mesures de nature différente, et il faut les deux (même doctrine) :
 *
 *   1. **STATIQUE** — `app/api/portail/tarifs/lecture.ts`, la transaction
 *      dédiée, ne RÉFÉRENCE dans son code source ni `app.client_id`, ni
 *      `app.perimetre_sites`, ni aucune table de forme « parc » (`client`,
 *      `site`, `machine`), « habilitation » (`utilisateurClient`) ou
 *      « rattachement » (`rattachementsDuCompte`, `lib/portail/depot`). Un
 *      gardien qui ne lirait que le COMPORTEMENT observé ne verrait rien
 *      tant que personne n'a posé la question depuis un compte à deux
 *      clients ; celui-ci mord dès que la ligne est écrite, que la question
 *      ait été posée ou non.
 *   2. **VIVANTE** — sous la base réelle, `lireBaremePortail(societeId)` ne
 *      rend que le taux, le catalogue et les réglages de LA société passée
 *      en paramètre, jamais ceux d'une autre (forme « société », I1) — et
 *      elle fonctionne avec UNIQUEMENT une société, sans qu'aucun client ni
 *      périmètre de sites n'ait jamais besoin d'être résolu : c'est son
 *      SEUL paramètre.
 */

vi.mock("@/app/api/portail/tarifs/contexte", () => ({
  contextePortailTarifs: vi.fn(),
  refusPortailTarifs: vi.fn(async () => ({
    motif: "auth.refus" as const,
    status: 401 as const,
  })),
}));

// ── env posé AVANT tout import de `lib/db/client` (même recette que
// `tests/isolation/9j04-portail-demandes-creer.test.ts`) — le client Prisma
// singleton doit se connecter sous le rôle applicatif, jamais le propriétaire.
vi.hoisted(() => {
  const base = process.env.TEST_DATABASE_URL;
  if (base === undefined) {
    throw new Error(
      "TEST_DATABASE_URL est requis pour tests/isolation/9j20-portail-tarifs.test.ts.",
    );
  }
  const url = new URL(base);
  url.username = "codiplan_app";
  url.password = "";
  process.env.DATABASE_URL = url.toString();
});

import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";

import {
  contextePortailTarifs,
  refusPortailTarifs,
} from "@/app/api/portail/tarifs/contexte";
import { lireBaremePortail } from "@/app/api/portail/tarifs/lecture";
import { GET as obtenirTarifsPortail } from "@/app/api/portail/tarifs/route";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { SOCIETE_A, SOCIETE_B } from "./setup/fixtures";

describe("STATIQUE — la transaction dédiée ne référence aucune table « parc »/« habilitation »/« rattachement »", () => {
  const source = sansCommentaires(
    readFileSync(
      join(process.cwd(), "app/api/portail/tarifs/lecture.ts"),
      "utf8",
    ),
  );

  it("ne cite jamais app.client_id ni app.perimetre_sites", () => {
    expect(source).not.toContain("client_id");
    expect(source).not.toContain("perimetre_sites");
  });

  it("n'interroge aucune table de forme « parc » ou « habilitation »/« rattachement »", () => {
    expect(source).not.toMatch(
      /\btx\.(client|site|machine|utilisateurClient)\b/,
    );
    expect(source).not.toMatch(
      /rattachementsDuCompte|parcDuClient|lib\/portail\/depot/,
    );
  });

  it("n'utilise que `avecSociete` — jamais `avecContexteApplicatif`, qui poserait un client depuis la session", () => {
    expect(source).toContain("avecSociete(");
    expect(source).not.toContain("avecContexteApplicatif");
  });

  it("TÉMOIN — le fichier a bien été lu, et il n'est pas vide", () => {
    expect(source.length).toBeGreaterThan(200);
  });
});

describe("STATIQUE — la porte elle-même ne résout aucun rattachement", () => {
  const source = sansCommentaires(
    readFileSync(
      join(process.cwd(), "app/api/portail/tarifs/contexte.ts"),
      "utf8",
    ),
  );

  it("ne cite ni `rattachementsDuCompte` ni `lib/portail/depot`, à la différence des portes des autres routes du portail", () => {
    expect(source).not.toMatch(/rattachementsDuCompte|lib\/portail\/depot/);
  });

  it("ne rend que `societeId`, jamais un `clientId`", () => {
    expect(source).toContain("societeId");
    expect(source).not.toContain("clientId");
  });
});

/** Pose un taux pour une société — même forme que `taux-horaire.test.ts`. */
function poserTaux(
  societeId: string,
  dateEffet: string,
  montantMineur: number,
  devise: string,
): Promise<unknown> {
  return avecContexteRls(
    clientApp(),
    { societeId, role: Role.direction },
    (tx) =>
      tx.$executeRawUnsafe(
        `INSERT INTO "taux_horaire" ("id","societe_id","date_effet","montant_mineur","devise_code")
         VALUES ($1::uuid, $2::uuid, $3::date, $4::bigint, $5)`,
        uuidv7(),
        societeId,
        dateEffet,
        montantMineur,
        devise,
      ),
  );
}

/** Pose un forfait actif — même forme que `forfaits.test.ts`. */
function poserForfait(
  societeId: string,
  code: string,
  devise: string,
  rang: number,
): Promise<unknown> {
  return avecContexteRls(
    clientApp(),
    { societeId, role: Role.direction },
    (tx) =>
      tx.$executeRawUnsafe(
        `INSERT INTO "forfait"
         ("id","societe_id","code","libelle","type","montant_mineur",
          "devise_code","cumulable_temps","rang")
       VALUES ($1::uuid, $2::uuid, $3, $3, 'deplacement', 5000, $4, false, $5)`,
        uuidv7(),
        societeId,
        code,
        devise,
        rang,
      ),
  );
}

afterAll(fermerClients);

describe("VIVANT — `lireBaremePortail` ne compose que la société passée en paramètre", () => {
  afterEach(async () => {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "forfait" WHERE "code" LIKE '9J20-%'`,
    );
    await clientOwner().$executeRawUnsafe(`DELETE FROM "taux_horaire"`);
  });

  it("un taux et un forfait posés chez A n'apparaissent jamais dans le barème de B", async () => {
    await poserTaux(SOCIETE_A, "2026-01-01", 7500, "XPF");
    await poserForfait(SOCIETE_A, "9J20-DEP-A", "XPF", 1);

    const baremeA = await lireBaremePortail(SOCIETE_A);
    const baremeB = await lireBaremePortail(SOCIETE_B);

    expect(baremeA.tauxHoraire?.valeur).toBe(BigInt(7500));
    expect(baremeA.forfaits.map((f) => f.code)).toContain("9J20-DEP-A");

    expect(
      baremeB.tauxHoraire,
      "un taux posé chez A ne doit jamais se lire depuis B — c'est un prix de vente",
    ).toBeNull();
    expect(
      baremeB.forfaits.map((f) => f.code),
      "un forfait posé chez A ne doit jamais apparaître dans le catalogue de B",
    ).not.toContain("9J20-DEP-A");
  });

  it("rend la règle de comptage du temps et la majoration de LA société demandée, chacune avec sa devise", async () => {
    const baremeA = await lireBaremePortail(SOCIETE_A);
    expect(baremeA.devise.code).toBe("XPF");
    expect(typeof baremeA.majorationHorsOuverturePct).toBe("string");
    expect(baremeA.regleArrondi.plancherMinutes).toBeGreaterThan(0);

    const baremeB = await lireBaremePortail(SOCIETE_B);
    expect(baremeB.devise.code).toBe("EUR");
  });
});

describe("LA ROUTE — refus et composition, porte mockée (même patron que 9j04)", () => {
  beforeEach(() => {
    vi.mocked(contextePortailTarifs).mockReset();
    vi.mocked(refusPortailTarifs).mockReset();
  });

  it("sans porte : refusée", async () => {
    vi.mocked(contextePortailTarifs).mockResolvedValueOnce(null);
    vi.mocked(refusPortailTarifs).mockResolvedValueOnce({
      motif: "auth.refus",
      status: 401,
    });
    const reponse = await obtenirTarifsPortail();
    expect(reponse.status).toBe(401);
    const corps = (await reponse.json()) as { erreur: string };
    expect(corps.erreur).toBe("auth.refus");
  });

  it("avec porte — UNE SEULE société, jamais un client : le barème composé porte le forfait posé chez A", async () => {
    await poserForfait(SOCIETE_A, "9J20-ROUTE-A", "XPF", 2);
    try {
      vi.mocked(contextePortailTarifs).mockResolvedValueOnce({
        societeId: SOCIETE_A,
      });
      const reponse = await obtenirTarifsPortail();
      expect(reponse.status).toBe(200);
      const corps = (await reponse.json()) as {
        forfaits: readonly { code: string }[];
      };
      expect(corps.forfaits.map((f) => f.code)).toContain("9J20-ROUTE-A");
    } finally {
      await clientOwner().$executeRawUnsafe(
        `DELETE FROM "forfait" WHERE "code" = '9J20-ROUTE-A'`,
      );
    }
  });
});
