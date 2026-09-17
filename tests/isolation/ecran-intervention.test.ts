import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  compterInterventions,
  listerInterventions,
} from "@/lib/interventions/depot";
import {
  LIMITE_RECHERCHE_PAR_DEFAUT,
  schemaRechercheInterventions,
  TYPES_INTERVENTION,
} from "@/lib/interventions/saisie";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  AGENCE_B,
  CLIENT_A1,
  INTERVENTION_A1,
  INTERVENTION_A2,
  INTERVENTION_B1,
  SITE_A1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * LA RECHERCHE, LES FILTRES ET LA PAGINATION DU REGISTRE, ÉPROUVÉS SUR LA
 * VRAIE TABLE (AT-07).
 *
 * `tests/unit/interventions/recherche.test.ts` éprouve `schemaRechercheInterventions`,
 * pur. Ce fichier-ci éprouve `filtreDesInterventions` — une seule écriture,
 * lue par `listerInterventions` (la page) ET `compterInterventions` (le total
 * de la pagination) — sous la politique de forme « parc » réelle.
 *
 * **Le type et le statut ne s'éprouvent PAS sur `INTERVENTION_A1`/`A2`** : ces
 * deux fiches sont partagées par tout le harnais, et d'autres scénarios du
 * même run les déplacent, les affectent ou les clôturent — leur statut n'est
 * donc PAS stable d'un fichier à l'autre. Une fiche POSÉE EXPRÈS, avec un type
 * et un statut que rien d'autre ne touche, rend la mesure indépendante de
 * l'ordre d'exécution — même raison que `SANS_CODE_A`/`B` dans
 * `ecran-client.test.ts`.
 */

afterAll(fermerClients);

const INTERNE_A = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const INTERNE_B = { ...INTERNE_A, societeId: SOCIETE_B };

const TOUT = schemaRechercheInterventions.parse({});

/**
 * UNE FICHE POSÉE EXPRÈS, avec un type et un statut RARES — `expertise` et
 * `terminee` — qu'aucun autre scénario du harnais ne produit sur la société A
 * (les fixtures partagées sont toutes `curatif`/`planifiee`). `terminee` est
 * choisi plutôt que `suspendue` : ce dernier statut exige en base une date et
 * un motif de suspension (`intervention_suspension_a_sa_date`,
 * `intervention_suspension_a_son_motif`) que cette fiche n'a pas à porter.
 *
 * **Datée loin dans le futur, et non `NULL`** : une `date_planifiee` nulle
 * range la fiche dans la FILE D'ATTENTE, que d'autres scénarios du harnais
 * dénombrent sur toute la société (`file-attente.test.ts`,
 * `occupation-absences.test.ts`…). Une date que rien ne peut recouvrir la
 * rend invisible à ces comptages, sans qu'elle ait à connaître leur existence.
 */
const INTERVENTION_DEDIEE = "aaaaaaaa-0000-7000-8000-00000000af07";
const DATE_HORS_DE_PORTEE = "2099-01-01";

beforeAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "intervention"
       ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "date_planifiee", "modifie_le")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'expertise', 'terminee', NULL, $6::date, now())
     ON CONFLICT ("id") DO NOTHING`,
    INTERVENTION_DEDIEE,
    SOCIETE_A,
    CLIENT_A1,
    SITE_A1_S1,
    AGENCE_A,
    DATE_HORS_DE_PORTEE,
  );
});

afterAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
    INTERVENTION_DEDIEE,
  );
});

describe("le cloisonnement de la recherche des interventions (AT-07)", () => {
  it("compterInterventions ne compte QUE la société active", async () => {
    const [temoin] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "intervention" WHERE societe_id = $1::uuid`,
      SOCIETE_A,
    );
    expect(temoin!.n).toBeGreaterThan(1);

    const vuDeA = await compterInterventions(INTERNE_A, TOUT, clientApp());
    expect(vuDeA).toBe(temoin!.n);
    const vuDeB = await compterInterventions(INTERNE_B, TOUT, clientApp());
    expect(vuDeA).not.toBe(vuDeB + vuDeA);
  });

  it("le filtre « agence » d'UNE AUTRE société ne fait fuir aucune ligne", async () => {
    // TÉMOIN — AGENCE_B est bien une agence réelle, mais d'une autre société.
    const [temoin] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "agence" WHERE id = $1::uuid`,
      AGENCE_B,
    );
    expect(temoin!.n).toBe(1);

    const criteres = schemaRechercheInterventions.parse({
      agence_id: AGENCE_B,
    });
    const lignes = await listerInterventions(INTERNE_A, criteres, clientApp());
    expect(lignes).toEqual([]);
    expect(await compterInterventions(INTERNE_A, criteres, clientApp())).toBe(
      0,
    );
  });
});

describe("les filtres du registre (agence, type, statut) — AT-07", () => {
  it("l'agence de la société active retrouve ses interventions", async () => {
    const criteres = schemaRechercheInterventions.parse({
      agence_id: AGENCE_A,
    });
    const lignes = await listerInterventions(INTERNE_A, criteres, clientApp());
    const ids = lignes.map((l) => l.id);
    expect(ids).toContain(INTERVENTION_A1);
    expect(ids).toContain(INTERVENTION_A2);
    expect(ids).not.toContain(INTERVENTION_B1);
  });

  it("le type de la fiche dédiée la retrouve", async () => {
    const criteres = schemaRechercheInterventions.parse({
      type: "expertise",
    });
    const ids = (
      await listerInterventions(INTERNE_A, criteres, clientApp())
    ).map((l) => l.id);
    expect(ids).toContain(INTERVENTION_DEDIEE);
  });

  it("un type qu'AUCUNE fiche de la société ne porte rend une liste vide, jamais une erreur", async () => {
    // LE TYPE ABSENT EST CALCULÉ, JAMAIS SUPPOSÉ : d'autres scénarios du même
    // run posent leurs propres fiches sur la société A (par exemple
    // `statut-facturation.test.ts`, qui écrit des fiches `garantie`), et un
    // type choisi au hasard pourrait cesser d'être absent selon l'ordre
    // d'exécution. On lit d'abord ce qui EST présent, et on choisit un type qui
    // n'y figure pas.
    const presents = await clientOwner().$queryRawUnsafe<{ type: string }[]>(
      `SELECT DISTINCT type FROM "intervention" WHERE societe_id = $1::uuid`,
      SOCIETE_A,
    );
    const typesPresents = new Set(presents.map((p) => p.type));
    const typeAbsent = TYPES_INTERVENTION.find(
      (type) => !typesPresents.has(type),
    );
    expect(
      typeAbsent,
      "tous les types sont présents sur la société A : aucun témoin d'absence n'est possible",
    ).toBeDefined();

    const criteres = schemaRechercheInterventions.parse({
      type: typeAbsent,
    });
    expect(await listerInterventions(INTERNE_A, criteres, clientApp())).toEqual(
      [],
    );
    expect(await compterInterventions(INTERNE_A, criteres, clientApp())).toBe(
      0,
    );
  });

  it("le statut de la fiche dédiée la retrouve", async () => {
    const criteres = schemaRechercheInterventions.parse({
      statut: "terminee",
    });
    const ids = (
      await listerInterventions(INTERNE_A, criteres, clientApp())
    ).map((l) => l.id);
    expect(ids).toContain(INTERVENTION_DEDIEE);
  });
});

describe("compterInterventions compte le total FILTRÉ, jamais le compte de la page (AT-07)", () => {
  it("une page d'une seule ligne ne fait pas bouger le total", async () => {
    const total = await compterInterventions(INTERNE_A, TOUT, clientApp());
    expect(total).toBeGreaterThan(1);

    const page1 = await listerInterventions(
      INTERNE_A,
      schemaRechercheInterventions.parse({ page: 1 }),
      clientApp(),
    );
    expect(await compterInterventions(INTERNE_A, TOUT, clientApp())).toBe(
      total,
    );
    expect(page1.length).toBeGreaterThan(0);
  });

  it("`skip` avance dans le registre : au-delà de la dernière page, la liste est vide", async () => {
    const total = await compterInterventions(INTERNE_A, TOUT, clientApp());
    const pageAuDela = Math.ceil(total / LIMITE_RECHERCHE_PAR_DEFAUT) + 1;
    const lignes = await listerInterventions(
      INTERNE_A,
      schemaRechercheInterventions.parse({ page: pageAuDela }),
      clientApp(),
    );
    expect(lignes).toEqual([]);
  });
});
