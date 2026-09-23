import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { Role } from "@/lib/auth/roles";
import { dernieresInterventionsDuSite } from "@/lib/interventions/depot";

import { clientApp, clientOwner, fermerClients } from "./setup/db";
import {
  AGENCE_A,
  CLIENT_A1,
  SITE_B1_S1,
  SOCIETE_A,
  SOCIETE_B,
  UTILISATEUR_INTERNE_A,
} from "./setup/fixtures";

/**
 * LES DERNIÈRES INTERVENTIONS D'UN SITE — bornées CÔTÉ BASE, la plus récente
 * en tête, la file d'attente en bas (HISTORIQUE-SITE-1).
 *
 * ## Ce que ce fichier compte, et que l'écran ne peut pas prouver
 *
 * `tests/e2e/historique-site.spec.ts` regarde ce que la fiche REND. Ce
 * fichier compte ce que la lecture RAMÈNE : une page qui recevrait tout
 * l'historique et en jetterait tout sauf douze lignes rendrait le même écran
 * — c'est la faute exacte que PARC-1 a corrigée sur l'aperçu du parc, et
 * elle ne se voit qu'en comptant les lignes que la requête rend.
 *
 * ## Trois propriétés, mesurées séparément
 *
 * 1. **La borne tronque** — sur un site à quinze interventions, une lecture
 *    bornée à cinq rend cinq lignes, et ce sont les cinq PLUS RÉCENTES.
 * 2. **La file d'attente est EN BAS.** Trois des quinze n'ont pas de date : un
 *    `ORDER BY date_planifiee DESC` nu les mettrait en TÊTE sous PostgreSQL
 *    (mesuré sur `/interventions`, `lib/interventions/depot.ts`). Une lecture
 *    bornée qui commettrait cette faute rendrait la file d'attente SOUS le
 *    titre « dernières interventions » et masquerait les vraies dernières —
 *    sans qu'aucune ligne ne manque ni ne rougisse. La borne et l'ordre se
 *    mesurent donc ENSEMBLE.
 * 3. **`site_id` est un SUJET, pas un cloisonnement** : un site d'une autre
 *    société rend zéro parce que la politique de forme « parc » (D84) l'a
 *    décidé, et le témoin montre d'abord que ses lignes existent.
 *
 * ## La scène
 *
 * Un site posé exprès — `SITE_A1_S1` porte des interventions que d'autres
 * scénarios dénombrent — avec douze interventions DATÉES, une par an à partir
 * de 2099 (hors de portée de tout comptage daté), et trois SANS date. Les
 * identifiants sont CROISSANTS avec le rang, si bien que « `id desc` » a un
 * ordre attendu écrit : le rang le plus haut d'abord.
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

const SITE_HISTORIQUE = "aaaaaaaa-0000-7000-8000-00000000513e";
const DATEES = 12;
const SANS_DATE = 3;
const NOMBRE_D_INTERVENTIONS = DATEES + SANS_DATE;
const BORNE = 5;

function idIntervention(rang: number): string {
  return `aaaaaaaa-0000-7000-8000-0000000513${String(rang).padStart(2, "0")}`;
}

/** Une date par an à partir de 2099 pour les `DATEES` premiers rangs ; `null` ensuite. */
function dateDuRang(rang: number): string | null {
  return rang < DATEES ? `${2099 + rang}-01-01` : null;
}

/**
 * L'ORDRE ATTENDU, écrit depuis la scène et non depuis la requête : les datées
 * du rang le plus haut (la date la plus récente) au plus bas, puis les sans
 * date par `id` décroissant — c'est-à-dire, ici aussi, du rang le plus haut au
 * plus bas.
 */
const ORDRE_ATTENDU: readonly string[] = [
  ...Array.from({ length: DATEES }, (_, r) => idIntervention(DATEES - 1 - r)),
  ...Array.from({ length: SANS_DATE }, (_, r) =>
    idIntervention(NOMBRE_D_INTERVENTIONS - 1 - r),
  ),
];

beforeAll(async () => {
  await clientOwner().$executeRawUnsafe(
    `INSERT INTO "site" ("id", "societe_id", "client_id", "agence_id", "libelle", "temps_trajet_min")
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'Site à quinze interventions', 15)
     ON CONFLICT ("id") DO NOTHING`,
    SITE_HISTORIQUE,
    SOCIETE_A,
    CLIENT_A1,
    AGENCE_A,
  );
  for (let rang = 0; rang < NOMBRE_D_INTERVENTIONS; rang += 1) {
    await clientOwner().$executeRawUnsafe(
      // `duree_estimee_min` EST POSÉE (PARCOURS-1, 23/09/2026) quand le rang
      // est `planifiee` — `intervention_planifiee_a_sa_duree` l'exige.
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type", "statut", "technicien_id", "date_planifiee", "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', $7::"StatutIntervention", NULL, $6::date, $8::int, now())
       ON CONFLICT ("id") DO NOTHING`,
      idIntervention(rang),
      SOCIETE_A,
      CLIENT_A1,
      SITE_HISTORIQUE,
      AGENCE_A,
      dateDuRang(rang),
      // Une ligne sans date est une ligne « à planifier » ; une ligne datée
      // dans le futur est planifiée. Le statut suit la date, comme en
      // exploitation.
      dateDuRang(rang) === null ? "a_planifier" : "planifiee",
      dateDuRang(rang) === null ? null : 60,
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
});

/**
 * LE TÉMOIN — le site porte bien ses quinze interventions EN BASE, dont trois
 * sans date, lues sous le propriétaire avant toute assertion. Sans lui, un
 * `INSERT` qui n'aurait rien inséré ferait rendre zéro à la lecture bornée, et
 * zéro est inférieur à cinq.
 */
async function temoinDeLaScene(): Promise<void> {
  const [ligne] = await clientOwner().$queryRawUnsafe<
    Array<{ total: number; sans_date: number }>
  >(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE "date_planifiee" IS NULL)::int AS sans_date
       FROM "intervention" WHERE "site_id" = $1::uuid`,
    SITE_HISTORIQUE,
  );
  expect(ligne?.total).toBe(NOMBRE_D_INTERVENTIONS);
  expect(ligne?.sans_date).toBe(SANS_DATE);
}

describe("les dernières interventions d'un site (HISTORIQUE-SITE-1)", () => {
  it("la lecture bornée à CINQ rend EXACTEMENT cinq lignes sur un site qui en porte quinze", async () => {
    await temoinDeLaScene();
    const tete = await dernieresInterventionsDuSite(
      SESSION,
      SITE_HISTORIQUE,
      BORNE,
      clientApp(),
    );
    expect(tete).toHaveLength(BORNE);
    expect(tete.every((ligne) => ligne.site_id === SITE_HISTORIQUE)).toBe(true);
  });

  it("les cinq sont les cinq PLUS RÉCENTES, du plus récent au plus ancien — jamais la file d'attente", async () => {
    await temoinDeLaScene();
    const tete = await dernieresInterventionsDuSite(
      SESSION,
      SITE_HISTORIQUE,
      BORNE,
      clientApp(),
    );
    expect(tete.map((l) => l.id)).toEqual(ORDRE_ATTENDU.slice(0, BORNE));
    // Et « la plus récente d'abord » se lit sur les dates elles-mêmes.
    expect(tete[0]?.date_planifiee?.toISOString().slice(0, 10)).toBe(
      dateDuRang(DATEES - 1),
    );
    expect(tete.every((l) => l.date_planifiee !== null)).toBe(true);
  });

  it("LA FILE D'ATTENTE EST EN BAS — sur une lecture qui couvre tout, les sans date ferment la liste, triées par id décroissant", async () => {
    await temoinDeLaScene();
    const tout = await dernieresInterventionsDuSite(
      SESSION,
      SITE_HISTORIQUE,
      NOMBRE_D_INTERVENTIONS + 10,
      clientApp(),
    );
    expect(tout).toHaveLength(NOMBRE_D_INTERVENTIONS);
    expect(tout.map((l) => l.id)).toEqual(ORDRE_ATTENDU);
    // Aucune ligne datée ne suit une ligne sans date.
    const premiereSansDate = tout.findIndex((l) => l.date_planifiee === null);
    expect(premiereSansDate).toBe(DATEES);
    expect(
      tout.slice(premiereSansDate).every((l) => l.date_planifiee === null),
    ).toBe(true);
  });

  it("un site d'une AUTRE société rend zéro ligne — la POLITIQUE décide, pas le site_id", async () => {
    // TÉMOIN — le site de B porte bien des interventions.
    const [temoin] = await clientOwner().$queryRawUnsafe<{ n: number }[]>(
      `SELECT count(*)::int AS n FROM "intervention"
        WHERE "site_id" = $1::uuid AND "societe_id" = $2::uuid`,
      SITE_B1_S1,
      SOCIETE_B,
    );
    expect(temoin!.n).toBeGreaterThan(0);

    const vues = await dernieresInterventionsDuSite(
      SESSION,
      SITE_B1_S1,
      20,
      clientApp(),
    );
    expect(vues).toEqual([]);
  });

  it("un site qui n'existe NULLE PART rend zéro, sans lever — même refus qu'un site hors périmètre (D35, D50)", async () => {
    const vues = await dernieresInterventionsDuSite(
      SESSION,
      "aaaaaaaa-0000-7000-8000-00000000beef",
      20,
      clientApp(),
    );
    expect(vues).toEqual([]);
  });

  it("une borne qui n'est pas un entier strictement positif est REFUSÉE avant toute requête", async () => {
    // Prisma lit un `take` négatif comme « depuis la FIN » : `-5` rendrait les
    // plus ANCIENNES sous le titre « dernières interventions », sans qu'aucune
    // ligne ne manque ni ne rougisse — la raison même de `teteDeLHistorique`.
    for (const borne of [0, -5, 1.5, Number.NaN]) {
      await expect(
        dernieresInterventionsDuSite(
          SESSION,
          SITE_HISTORIQUE,
          borne,
          clientApp(),
        ),
      ).rejects.toThrow(/entier strictement positif/);
    }
  });
});
