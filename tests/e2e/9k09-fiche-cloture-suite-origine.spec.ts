import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_RM_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9K09-FICHE-CLOTURE-SUITE-ORIGINE — I4 et I5 de l'étude du 08/11/2026.
 *
 * ## I4 — l'ordre des gestes
 *
 * Sur une `terminee` au rapport NON validé, « Valider le rapport » se rend
 * AVANT « Clôturer » (l'étude mesurait l'inverse, constat 5) ; pour le RM,
 * qui détient les deux capacités, une case « Valider et clôturer » dans le
 * dialogue fait les deux dans la même requête.
 *
 * ## I5 — la fiche connaît sa suite et son origine
 *
 * La tuile « Suite à donner » montre le statut du dossier et un lien vers le
 * registre une fois qualifié, le bouton « Qualifier » avant ; la fiche d'une
 * reprise montre un lien vers son origine.
 *
 * SA PROPRE SCÈNE, préfixée `9K09-` — `mode: "serial"` : plusieurs scénarios
 * partagent le même client/site jetables, posés en `beforeAll`, effacés en
 * `afterAll` (même discipline que `fiche-cloturer.spec.ts`).
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9K09 = uuidv7();
const SITE_9K09 = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9K09-FICHE-CLOTURE-SUITE-ORIGINE/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

async function connecterRM(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_RM_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/planning/);
}

let agenceId = "";
let technicienId = "";

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    agenceId = agence.id;
    technicienId = reperes.technicienDucos;

    await client.client.create({
      data: {
        id: CLIENT_9K09,
        societe_id: reperes.societeId,
        raison_sociale: "9K09 client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9K09,
        societe_id: reperes.societeId,
        client_id: CLIENT_9K09,
        agence_id: agence.id,
        libelle: "9K09 site",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "notification" WHERE "suite_a_donner_id" IN (SELECT "id" FROM "suite_a_donner" WHERE "intervention_origine_id" IN (SELECT "id" FROM "intervention" WHERE "client_id" = $1::uuid))`,
      CLIENT_9K09,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "suite_a_donner" WHERE "intervention_origine_id" IN (SELECT "id" FROM "intervention" WHERE "client_id" = $1::uuid)`,
      CLIENT_9K09,
    );
    await client.$executeRawUnsafe(
      `UPDATE "intervention" SET "technicien_id" = NULL WHERE "client_id" = $1::uuid`,
      CLIENT_9K09,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" IN (SELECT "id" FROM "intervention" WHERE "client_id" = $1::uuid)`,
      CLIENT_9K09,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9K09,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9K09 } });
    await client.client.deleteMany({ where: { id: CLIENT_9K09 } });
  } finally {
    await client.$disconnect();
  }
});

async function interventionTermineeAvecSegment(
  tempsMesureMin: number,
): Promise<string> {
  const id = uuidv7();
  const client = admin();
  try {
    await client.intervention.create({
      data: {
        id,
        societe_id: (await reperesDeLaScene()).societeId,
        client_id: CLIENT_9K09,
        site_id: SITE_9K09,
        agence_id: agenceId,
        technicien_id: technicienId,
        type: "curatif",
        statut: "terminee",
        date_planifiee: new Date("2026-10-20T00:00:00Z"),
        duree_estimee_min: 60,
        commentaire_technicien: fr["terrain.e2e.commentaire"],
      },
    });
    await client.$executeRawUnsafe(
      `INSERT INTO "segment_travail" ("id","societe_id","intervention_id","utilisateur_id","nom_technicien_affiche","debut","fin","modifie_le")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid,
               (SELECT "nom" FROM "utilisateur" WHERE "id" = $3::uuid), now() - interval '${tempsMesureMin} minutes', now(), now())`,
      (await reperesDeLaScene()).societeId,
      id,
      technicienId,
    );
    await client.intervention.update({
      where: { id },
      data: { temps_mesure_min: tempsMesureMin },
    });
  } finally {
    await client.$disconnect();
  }
  return id;
}

// ── I4 — L'ADV N'A JAMAIS « VALIDER LE RAPPORT », ET AUCUNE CASE COMBINÉE ───
// (habilitations.ts : `valider_rapport` exclut l'ADV — « jamais l'ADV » —,
// inchangé par ce ticket ; seul l'ORDRE pour les rôles qui l'ONT, mesuré par
// le test RM ci-dessous, est nouveau.)
//
// CHAQUE TEST OUVRE SA PROPRE SESSION — jamais de `beforeEach` commun : le
// test RM change de rôle EN COURS DE FICHIER, et `/connexion` déjà
// authentifié redirige sans montrer le formulaire (vu une première fois en
// écrivant ce fichier).

test("ADV — aucun bouton « Valider le rapport », et le dialogue de clôture n'offre aucune case combinée", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  const id = await interventionTermineeAvecSegment(90);
  try {
    await page.goto(`/interventions/${id}`);

    await expect(
      page.getByRole("button", {
        name: fr["intervention.action.valider_rapport"],
      }),
    ).toHaveCount(0);

    await capturer(page, "adv-sans-valider-rapport", 1280);
    await capturer(page, "adv-sans-valider-rapport", 375);

    // L'ADV n'a pas `valider_rapport` (habilitations.ts) : la case combinée
    // n'existe pas dans le dialogue de clôture, qui s'ouvre normalement et
    // affiche le refus comme avant ce ticket.
    await page
      .getByRole("button", { name: fr["intervention.action.cloturer"] })
      .click();
    const dialogue = page.locator("dialog[open]");
    await expect(dialogue).toBeVisible();
    await expect(
      dialogue.getByRole("checkbox", {
        name: fr["intervention.cloture.valider_et_cloturer"],
      }),
    ).toHaveCount(0);
    await expect(
      dialogue.getByRole("button", {
        name: fr["intervention.action.cloturer"],
      }),
    ).toBeDisabled();
  } finally {
    const client = admin();
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      id,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      id,
    );
    await client.$disconnect();
  }
});

// ── I4 — « VALIDER ET CLÔTURER » EN UN GESTE, POUR LE RM (les deux) ─────────

test("RM — « Valider le rapport » se rend AVANT « Clôturer », puis « Valider et clôturer » en une seule requête", async ({
  page,
}) => {
  const id = await interventionTermineeAvecSegment(45);
  try {
    await connecterRM(page);
    await page.goto(`/interventions/${id}`);

    // I4 (constat 5 de l'étude du 08/11/2026) — le RM détient les DEUX
    // capacités (`valider_rapport` ET `cloturer_intervention`) : les deux
    // boutons se rendent, « Valider » EN PREMIER dans le document.
    const boutons = page.locator(
      [
        `button:has-text("${fr["intervention.action.valider_rapport"]}")`,
        `button:has-text("${fr["intervention.action.cloturer"]}")`,
      ].join(", "),
    );
    await expect(boutons.first()).toHaveText(
      fr["intervention.action.valider_rapport"],
    );
    await capturer(page, "rm-ordre-valider-avant-cloturer", 1280);
    await capturer(page, "rm-ordre-valider-avant-cloturer", 375);

    await page
      .getByRole("button", { name: fr["intervention.action.cloturer"] })
      .click();
    const dialogue = page.locator("dialog[open]");
    await expect(dialogue).toBeVisible();

    const caseCombinee = dialogue.getByRole("checkbox", {
      name: fr["intervention.cloture.valider_et_cloturer"],
    });
    await expect(caseCombinee).toBeVisible();
    const boutonCloturer = dialogue.getByRole("button", {
      name: fr["intervention.action.cloturer"],
    });
    // REFUSÉ tant que la case n'est pas cochée — le rapport n'est pas
    // encore validé, exactement le refus d'avant ce ticket.
    await expect(boutonCloturer).toBeDisabled();

    await caseCombinee.check();
    await expect(boutonCloturer).toBeEnabled();
    await capturer(page, "rm-valider-et-cloturer", 1280);

    await boutonCloturer.click();
    await expect(
      page.getByRole("heading", { level: 1 }).getByText(fr["statut.cloturee"]),
    ).toBeVisible();

    const client = admin();
    try {
      const ligne = await client.intervention.findUniqueOrThrow({
        where: { id },
        select: {
          statut: true,
          rapport_valide_par: true,
          temps_valide_min: true,
        },
      });
      expect(ligne.statut).toBe("cloturee");
      expect(ligne.rapport_valide_par).not.toBeNull();
      expect(ligne.temps_valide_min).toBe(45);
    } finally {
      await client.$disconnect();
    }
  } finally {
    const client = admin();
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      id,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      id,
    );
    await client.$disconnect();
  }
});

// ── I5 — LA TUILE « SUITE À DONNER » CONNAÎT SON DOSSIER ────────────────────

test("la tuile « Suite à donner » propose « Qualifier » avant le dossier, puis son statut et un lien après", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  const id = uuidv7();
  const client = admin();
  const reperes = await reperesDeLaScene();
  try {
    await client.intervention.create({
      data: {
        id,
        societe_id: reperes.societeId,
        client_id: CLIENT_9K09,
        site_id: SITE_9K09,
        agence_id: agenceId,
        type: "curatif",
        statut: "cloturee",
        duree_estimee_min: 60,
        suite_a_donner: "Courroie à remplacer",
        cloturee_le: new Date(),
      },
    });

    await page.goto(`/interventions/${id}`);
    const tuile = page.locator("section", {
      has: page.getByRole("heading", {
        name: fr["intervention.realisation.suite_a_donner"],
      }),
    });
    const boutonQualifier = tuile.getByRole("button", {
      name: fr["suites_a_donner.action.qualifier"],
    });
    await expect(boutonQualifier).toBeVisible();
    await capturer(page, "tuile-suite-avant-qualification", 1280);
    await capturer(page, "tuile-suite-avant-qualification", 375);

    await boutonQualifier.click();
    await expect(page).toHaveURL(/\/interventions\/suites-a-donner/);

    await page.goto(`/interventions/${id}`);
    const tuileApres = page.locator("section", {
      has: page.getByRole("heading", {
        name: fr["intervention.realisation.suite_a_donner"],
      }),
    });
    await expect(
      tuileApres.getByText(fr["suites_a_donner.statut.qualifiee"]),
    ).toBeVisible();
    await expect(
      tuileApres.getByRole("link", {
        name: fr["intervention.suite_a_donner.lien_registre"],
      }),
    ).toHaveAttribute("href", "/interventions/suites-a-donner");
    await capturer(page, "tuile-suite-apres-qualification", 1280);
    await capturer(page, "tuile-suite-apres-qualification", 375);
  } finally {
    await client.$executeRawUnsafe(
      `DELETE FROM "suite_a_donner" WHERE "intervention_origine_id" = $1::uuid`,
      id,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      id,
    );
    await client.$disconnect();
  }
});

// ── I5 — LA FICHE D'UNE REPRISE MONTRE SON ORIGINE ──────────────────────────

test("la fiche d'une reprise affiche un lien vers l'intervention d'origine", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  const origineId = uuidv7();
  const repriseId = uuidv7();
  const client = admin();
  const reperes = await reperesDeLaScene();
  let suiteId: string | null = null;
  try {
    await client.intervention.create({
      data: {
        id: origineId,
        societe_id: reperes.societeId,
        client_id: CLIENT_9K09,
        site_id: SITE_9K09,
        agence_id: agenceId,
        type: "curatif",
        statut: "cloturee",
        duree_estimee_min: 60,
        suite_a_donner: "Pièce à commander",
        cloturee_le: new Date(),
      },
      select: { id: true, annee: true, numero: true },
    });
    const origine = await client.intervention.findUniqueOrThrow({
      where: { id: origineId },
      select: { annee: true, numero: true },
    });
    await client.intervention.create({
      data: {
        id: repriseId,
        societe_id: reperes.societeId,
        client_id: CLIENT_9K09,
        site_id: SITE_9K09,
        agence_id: agenceId,
        type: "curatif",
        statut: "a_planifier",
        duree_estimee_min: 60,
      },
    });
    suiteId = uuidv7();
    await client.$executeRawUnsafe(
      `INSERT INTO "suite_a_donner" ("id","societe_id","intervention_origine_id","intervention_reprise_id","statut","modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'a_replanifier'::"StatutSuiteADonner", now())`,
      suiteId,
      reperes.societeId,
      origineId,
      repriseId,
    );

    await page.goto(`/interventions/${repriseId}`);
    const tuile = page.locator("section", {
      has: page.getByRole("heading", {
        name: fr["intervention.realisation.suite_a_donner"],
      }),
    });
    const prefixe = fr["intervention.suite_a_donner.reprise_prefixe"];
    const lien = tuile.getByRole("link", { name: new RegExp(prefixe) });
    await expect(lien).toBeVisible();
    await expect(lien).toHaveAttribute("href", `/interventions/${origineId}`);
    if (origine.annee !== null && origine.numero !== null) {
      await expect(lien).toContainText(String(origine.numero));
    }
    await capturer(page, "fiche-reprise-origine", 1280);
    await capturer(page, "fiche-reprise-origine", 375);
  } finally {
    if (suiteId !== null) {
      await client.$executeRawUnsafe(
        `DELETE FROM "suite_a_donner" WHERE "id" = $1::uuid`,
        suiteId,
      );
    }
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" IN ($1::uuid, $2::uuid)`,
      repriseId,
      origineId,
    );
    await client.$disconnect();
  }
});
