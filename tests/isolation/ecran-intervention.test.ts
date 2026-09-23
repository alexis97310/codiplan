import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  compterInterventions,
  compterInterventionsSansDuree,
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

/**
 * LA MOITIÉ « `numero` » DE LA RÉFÉRENCE, SUR LA VRAIE TABLE (D-08, revue
 * Codex de #236) — `numeroDeReference` (`lib/interventions/depot.ts`) n'est
 * pas exportée, elle ne s'éprouve donc pas hors du chemin réel qui la porte :
 * `listerInterventions`/`compterInterventions`, sous la politique de forme
 * « parc ». `INTERVENTION_DEDIEE` reçoit ici un `numero` que rien d'autre du
 * harnais n'attribue (voir sa note de tête) — la fiche est restituée à
 * `null` par l'`afterAll` de tête de fichier, qui l'efface entièrement.
 */
describe("la référence dans la recherche — `numero` borné, `Local-` jamais un numéro serveur (D-08)", () => {
  const NUMERO_DEDIE = 123456;

  beforeAll(async () => {
    await clientOwner().$executeRawUnsafe(
      `UPDATE "intervention" SET "numero" = $2::int WHERE "id" = $1::uuid`,
      INTERVENTION_DEDIEE,
      NUMERO_DEDIE,
    );
  });

  it("un texte hors bornes de l'Int signé 32 bits ne fait pas échouer la recherche", async () => {
    // AVANT LE CORRECTIF : ce texte partait tel quel en filtre d'égalité vers
    // Prisma, qui refusait l'entier hors bornes — `/interventions` rendait
    // une ERREUR SERVEUR au lieu d'une liste vide.
    const criteres = schemaRechercheInterventions.parse({
      texte: "9999999999",
    });
    await expect(
      listerInterventions(INTERNE_A, criteres, clientApp()),
    ).resolves.toEqual([]);
    await expect(
      compterInterventions(INTERNE_A, criteres, clientApp()),
    ).resolves.toBe(0);
  });

  it("« INT-123456 » retrouve la fiche par son numéro — le TÉMOIN de la forme reconnue", async () => {
    const criteres = schemaRechercheInterventions.parse({
      texte: `INT-${NUMERO_DEDIE}`,
    });
    const ids = (
      await listerInterventions(INTERNE_A, criteres, clientApp())
    ).map((ligne) => ligne.id);
    expect(ids).toContain(INTERVENTION_DEDIEE);
  });

  it("« Local-123456 » NE ramène PAS l'INT-123456 sans rapport", async () => {
    const criteres = schemaRechercheInterventions.parse({
      texte: `Local-${NUMERO_DEDIE}`,
    });
    const ids = (
      await listerInterventions(INTERNE_A, criteres, clientApp())
    ).map((ligne) => ligne.id);
    expect(ids).not.toContain(INTERVENTION_DEDIEE);
  });
});

/**
 * LE COMPTE ET LE FILTRE « SANS DURÉE, À VENIR » (AFFICHAGE-MATERIEL-1,
 * 23/09/2026) — sur la vraie table, sous la politique de forme « parc ».
 *
 * *Mesuré en production le 23/09/2026 à 13h05 : la tuile affichait 1755,
 * presque tout l'historique clôturé.* Quatre fiches, DÉDIÉES, jamais une
 * ligne du semis dont le statut ou la date bougerait d'un scénario à
 * l'autre : seule celle qui devrait compter porte les trois conditions à la
 * fois — non terminale, sans durée, datée d'aujourd'hui ou plus tard, ou
 * sans date.
 */
describe("sans durée, à venir — le critère de la tuile ET de son lien (AFFICHAGE-MATERIEL-1)", () => {
  const A_VENIR_SANS_DUREE = "aaaaaaaa-0000-7000-8000-00000000af08";
  const PASSEE_CLOTUREE_SANS_DUREE = "aaaaaaaa-0000-7000-8000-00000000af09";
  const FILE_ATTENTE_SANS_DUREE = "aaaaaaaa-0000-7000-8000-00000000af0a";
  const A_VENIR_AVEC_DUREE = "aaaaaaaa-0000-7000-8000-00000000af0b";
  const DATE_LOIN_DANS_LE_FUTUR = "2099-06-01";
  const DATE_LOIN_DANS_LE_PASSE = "2000-01-01";

  beforeAll(async () => {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "date_planifiee", "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'planifiee', NULL, $6::date, NULL, now())
       ON CONFLICT ("id") DO NOTHING`,
      A_VENIR_SANS_DUREE,
      SOCIETE_A,
      CLIENT_A1,
      SITE_A1_S1,
      AGENCE_A,
      DATE_LOIN_DANS_LE_FUTUR,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "date_planifiee", "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'cloturee', NULL, $6::date, NULL, now())
       ON CONFLICT ("id") DO NOTHING`,
      PASSEE_CLOTUREE_SANS_DUREE,
      SOCIETE_A,
      CLIENT_A1,
      SITE_A1_S1,
      AGENCE_A,
      DATE_LOIN_DANS_LE_PASSE,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'a_planifier', NULL, NULL, now())
       ON CONFLICT ("id") DO NOTHING`,
      FILE_ATTENTE_SANS_DUREE,
      SOCIETE_A,
      CLIENT_A1,
      SITE_A1_S1,
      AGENCE_A,
    );
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "date_planifiee", "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'planifiee', NULL, $6::date, 45, now())
       ON CONFLICT ("id") DO NOTHING`,
      A_VENIR_AVEC_DUREE,
      SOCIETE_A,
      CLIENT_A1,
      SITE_A1_S1,
      AGENCE_A,
      DATE_LOIN_DANS_LE_FUTUR,
    );
  });

  afterAll(async () => {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = ANY($1::uuid[])`,
      [
        A_VENIR_SANS_DUREE,
        PASSEE_CLOTUREE_SANS_DUREE,
        FILE_ATTENTE_SANS_DUREE,
        A_VENIR_AVEC_DUREE,
      ],
    );
  });

  it("compterInterventionsSansDuree compte l'à-venir et la file d'attente, jamais le passé clôturé ni ce qui a sa durée", async () => {
    const compte = await compterInterventionsSansDuree(
      INTERNE_A,
      new Date(),
      clientApp(),
    );
    // TÉMOIN — sur la vraie table, comptée avec le SQL le plus littéral qui
    // soit, pour ne pas mesurer la fonction avec elle-même.
    const [temoin] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "intervention"
       WHERE "societe_id" = $1::uuid
         AND "statut" NOT IN ('terminee', 'cloturee', 'annulee')
         AND "duree_estimee_min" IS NULL
         AND ("date_planifiee" IS NULL OR "date_planifiee" >= now())`,
      SOCIETE_A,
    );
    expect(compte).toBe(temoin!.n);
    expect(compte).toBeGreaterThanOrEqual(2);
  });

  it("le lien de la tuile (`sans_duree_a_venir`) retrouve exactement les mêmes fiches", async () => {
    const criteres = schemaRechercheInterventions.parse({
      sans_duree_a_venir: "1",
    });
    const ids = (
      await listerInterventions(INTERNE_A, criteres, clientApp())
    ).map((l) => l.id);
    expect(ids).toContain(A_VENIR_SANS_DUREE);
    expect(ids).toContain(FILE_ATTENTE_SANS_DUREE);
    expect(ids).not.toContain(PASSEE_CLOTUREE_SANS_DUREE);
    expect(ids).not.toContain(A_VENIR_AVEC_DUREE);

    expect(await compterInterventions(INTERNE_A, criteres, clientApp())).toBe(
      ids.length,
    );
  });

  it("sans le paramètre, le filtre ne s'applique pas — le témoin qui doit rester vert", async () => {
    const ids = (await listerInterventions(INTERNE_A, TOUT, clientApp())).map(
      (l) => l.id,
    );
    expect(ids).toContain(PASSEE_CLOTUREE_SANS_DUREE);
    expect(ids).toContain(A_VENIR_AVEC_DUREE);
  });
});
