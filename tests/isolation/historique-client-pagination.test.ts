import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import {
  compterInterventionsDuClient,
  dernieresInterventionsDuClient,
} from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import { AGENCE_A, SOCIETE_A, SOCIETE_B, UTILISATEUR_INTERNE_A } from "./setup/fixtures";

/**
 * LA FICHE D'UN CLIENT S'ARRÊTAIT À DOUZE INTERVENTIONS, SUR 1751
 * (HISTORIQUE-CLIENT-1, mesuré le 23/09/2026).
 *
 * ## Le constat que ce fichier fait ROUGIR sur `main`
 *
 * `dernieresInterventionsDuClient` prenait `(contexte, clientId, limite,
 * client?)` — une troncature sans second appel possible : au-delà de la
 * douzième ligne, rien. Ce fichier compte ce qu'une lecture PAGINÉE ramène —
 * `dernieresInterventionsDuClient(contexte, clientId, limite, page, client?)`
 * et le nouveau `compterInterventionsDuClient` — et non ce que l'écran rend :
 * `tests/e2e/historique-client.spec.ts` regarde le RENDU.
 *
 * ## Un client posé EXPRÈS, jamais CLIENT_A1
 *
 * `dernieresInterventionsDuClient` filtre par `client_id`, pas par `site_id` :
 * poser les interventions sur un SITE neuf rattaché à `CLIENT_A1` ferait
 * quand même grossir le compte de `CLIENT_A1`, que d'autres scénarios
 * (`ecran-client.test.ts`) lisent DYNAMIQUEMENT — un client à soi n'a pas ce
 * risque, un client partagé en aurait un.
 *
 * ## La scène — quinze interventions, comme HISTORIQUE-SITE-1
 *
 * Douze DATÉES, une par an à partir de 2099 (hors de portée de tout comptage
 * daté réel), et trois SANS DATE. Les identifiants sont CROISSANTS avec le
 * rang : « `id desc` » a un ordre attendu écrit, le rang le plus haut
 * d'abord.
 */

afterAll(fermerClients);

const SESSION = {
  utilisateurId: UTILISATEUR_INTERNE_A,
  societeId: SOCIETE_A,
  role: Role.adv,
  secondFacteurValide: true,
  adresseIp: null,
  clientId: null,
};

const CLIENT_HISTORIQUE = "aaaaaaaa-0000-7000-8000-0000000c9c13";
const SITE_HISTORIQUE = "aaaaaaaa-0000-7000-8000-0000000c9c14";
const DATEES = 12;
const SANS_DATE = 3;
const NOMBRE_D_INTERVENTIONS = DATEES + SANS_DATE;
const BORNE = 5;

function idIntervention(rang: number): string {
  return `aaaaaaaa-0000-7000-8000-000000c9c1${String(rang).padStart(2, "0")}`;
}

/** Une date par an à partir de 2099 pour les `DATEES` premiers rangs ; `null` ensuite. */
function dateDuRang(rang: number): string | null {
  return rang < DATEES ? `${2099 + rang}-01-01` : null;
}

/**
 * L'ORDRE ATTENDU : les datées du rang le plus haut (le plus récent) au plus
 * bas, puis les sans date par `id` décroissant.
 */
const ORDRE_ATTENDU: readonly string[] = [
  ...Array.from({ length: DATEES }, (_, r) => idIntervention(DATEES - 1 - r)),
  ...Array.from({ length: SANS_DATE }, (_, r) =>
    idIntervention(NOMBRE_D_INTERVENTIONS - 1 - r),
  ),
];

beforeAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "client" ("id", "societe_id", "raison_sociale", "code_externe")
     VALUES ($1::uuid, $2::uuid, 'Client à quinze interventions (HISTORIQUE-CLIENT-1)', NULL)
     ON CONFLICT ("id") DO NOTHING`,
    CLIENT_HISTORIQUE,
    SOCIETE_A,
  );
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle", "temps_trajet_min")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'Site du client à quinze interventions', 15)
     ON CONFLICT ("id") DO NOTHING`,
    SITE_HISTORIQUE,
    SOCIETE_A,
    CLIENT_HISTORIQUE,
    AGENCE_A,
  );
  for (let rang = 0; rang < NOMBRE_D_INTERVENTIONS; rang += 1) {
    await clientOwner().$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "date_planifiee", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', $7::"StatutIntervention", NULL, $6::date, now())
       ON CONFLICT ("id") DO NOTHING`,
      idIntervention(rang),
      SOCIETE_A,
      CLIENT_HISTORIQUE,
      SITE_HISTORIQUE,
      AGENCE_A,
      dateDuRang(rang),
      dateDuRang(rang) === null ? "a_planifier" : "planifiee",
    );
  }
});

afterAll(async () => {
  for (let rang = 0; rang < NOMBRE_D_INTERVENTIONS; rang += 1) {
    await clientOwner().$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      idIntervention(rang),
    );
  }
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "site" WHERE "id" = $1::uuid`,
    SITE_HISTORIQUE,
  );
  await clientOwner().$executeRawUnsafe(
    `DELETE FROM "client" WHERE "id" = $1::uuid`,
    CLIENT_HISTORIQUE,
  );
});

/** LE TÉMOIN — le client porte bien ses quinze interventions EN BASE, dont trois sans date. */
async function temoinDeLaScene(): Promise<void> {
  const [ligne] = await clientOwner().$queryRawUnsafe<
    Array<{ total: number; sans_date: number }>
  >(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE "date_planifiee" IS NULL)::int AS sans_date
       FROM "intervention" WHERE "client_id" = $1::uuid`,
    CLIENT_HISTORIQUE,
  );
  expect(ligne?.total).toBe(NOMBRE_D_INTERVENTIONS);
  expect(ligne?.sans_date).toBe(SANS_DATE);
}

describe("la pagination des interventions d'un client (HISTORIQUE-CLIENT-1)", () => {
  it("PAGE 1 : rend exactement la borne, les plus récentes d'abord", async () => {
    await temoinDeLaScene();
    const page1 = await dernieresInterventionsDuClient(
      SESSION,
      CLIENT_HISTORIQUE,
      BORNE,
      1,
      clientApp(),
    );
    expect(page1).toHaveLength(BORNE);
    expect(page1.map((l) => l.id)).toEqual(ORDRE_ATTENDU.slice(0, BORNE));
    expect(page1.every((ligne) => ligne.client_id === CLIENT_HISTORIQUE)).toBe(
      true,
    );
  });

  it("PAGE 2 : la ligne SUIVANTE, sans doublon ni trou à la charnière", async () => {
    await temoinDeLaScene();
    const page1 = await dernieresInterventionsDuClient(
      SESSION,
      CLIENT_HISTORIQUE,
      BORNE,
      1,
      clientApp(),
    );
    const page2 = await dernieresInterventionsDuClient(
      SESSION,
      CLIENT_HISTORIQUE,
      BORNE,
      2,
      clientApp(),
    );
    expect(page2).toHaveLength(BORNE);
    expect(page2.map((l) => l.id)).toEqual(ORDRE_ATTENDU.slice(BORNE, 2 * BORNE));
    // Aucun id de la page 1 ne réapparaît sur la page 2.
    const idsPage1 = new Set(page1.map((l) => l.id));
    expect(page2.some((l) => idsPage1.has(l.id))).toBe(false);
    // La dernière ligne de la page 1 précède immédiatement la première de la
    // page 2 dans l'ordre attendu — aucun rang sauté.
    const rangDernierePage1 = ORDRE_ATTENDU.indexOf(page1[page1.length - 1]!.id);
    const rangPremierePage2 = ORDRE_ATTENDU.indexOf(page2[0]!.id);
    expect(rangPremierePage2).toBe(rangDernierePage1 + 1);
  });

  it("LA DERNIÈRE PAGE PORTE LE RESTE, et la FILE D'ATTENTE FERME la dernière page", async () => {
    await temoinDeLaScene();
    const derniereBorne = 4;
    const totalPages = Math.ceil(NOMBRE_D_INTERVENTIONS / derniereBorne);
    const derniere = await dernieresInterventionsDuClient(
      SESSION,
      CLIENT_HISTORIQUE,
      derniereBorne,
      totalPages,
      clientApp(),
    );
    // 15 lignes, borne 4 : la dernière page (page 4) porte les 3 restantes.
    expect(derniere).toHaveLength(NOMBRE_D_INTERVENTIONS % derniereBorne || derniereBorne);
    // Les trois SANS DATE ferment la dernière page — jamais mêlées aux datées.
    expect(derniere.every((l) => l.date_planifiee === null)).toBe(true);
  });

  it("compterInterventionsDuClient compte le total, JAMAIS le compte d'une page", async () => {
    await temoinDeLaScene();
    const total = await compterInterventionsDuClient(
      SESSION,
      CLIENT_HISTORIQUE,
      clientApp(),
    );
    expect(total).toBe(NOMBRE_D_INTERVENTIONS);

    // Une page d'une seule ligne ne fait pas bouger le total.
    const uneSeulePage = await dernieresInterventionsDuClient(
      SESSION,
      CLIENT_HISTORIQUE,
      1,
      1,
      clientApp(),
    );
    expect(uneSeulePage.length).toBe(1);
    expect(
      await compterInterventionsDuClient(SESSION, CLIENT_HISTORIQUE, clientApp()),
    ).toBe(total);
  });

  it("un client d'une AUTRE société rend zéro ligne ET un compte de zéro — la POLITIQUE décide", async () => {
    const SESSION_B = { ...SESSION, societeId: SOCIETE_B };
    const vues = await dernieresInterventionsDuClient(
      SESSION_B,
      CLIENT_HISTORIQUE,
      20,
      1,
      clientApp(),
    );
    expect(vues).toEqual([]);
    expect(
      await compterInterventionsDuClient(SESSION_B, CLIENT_HISTORIQUE, clientApp()),
    ).toBe(0);
  });

  it("une limite ou une page qui ne sont pas des entiers strictement positifs sont REFUSÉES avant toute requête", async () => {
    for (const borne of [0, -5, 1.5, Number.NaN]) {
      await expect(
        dernieresInterventionsDuClient(
          SESSION,
          CLIENT_HISTORIQUE,
          borne,
          1,
          clientApp(),
        ),
      ).rejects.toThrow(/entier strictement positif/);
    }
    for (const page of [0, -1, 1.5, Number.NaN]) {
      await expect(
        dernieresInterventionsDuClient(
          SESSION,
          CLIENT_HISTORIQUE,
          BORNE,
          page,
          clientApp(),
        ),
      ).rejects.toThrow(/entier strictement positif/);
    }
  });
});
