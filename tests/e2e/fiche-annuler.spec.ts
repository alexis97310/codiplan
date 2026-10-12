import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { referenceAffichee } from "@/app/(back-office)/interventions/presentation";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 84-FICHE-ANNULER — LE SEUL FORMULAIRE D'ANNULATION D'UNE INTERVENTION,
 * DANGER, EN DERNIER, CONFIRMÉ.
 *
 * ## Le constat (audit d'ergonomie du 25/09, constat 20 « Bloquant »)
 *
 * Le bouton « Annuler l'intervention » avait le même style gris que toutes
 * les autres actions, se soumettait d'un clic sans confirmation, et le motif
 * « obligatoire » n'était annoncé qu'en texte — la route refusait ensuite,
 * après l'aller-retour. Une annulation est tracée et ne s'efface pas : un
 * clic de trop coûte une intervention à recréer.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `ANN1-`
 *
 * Un client, un site, une intervention `planifiee` — créés en `beforeAll`,
 * supprimés en `afterAll`, aucune ligne ajoutée au semis (même discipline que
 * `tests/e2e/bon-5.spec.ts`).
 *
 * ## SÉRIE : LES TROIS ÉPREUVES PROGRESSENT SUR LA MÊME LIGNE
 *
 * Le bouton désactivé (1), la confirmation refusée qui ne change rien (2),
 * puis la confirmation acceptée qui annule (3) : trois états successifs de
 * LA MÊME intervention, dans cet ordre — `test.describe.configure({ mode:
 * "serial" })` le garantit, comme `porte-capacites.spec.ts`.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_ANN1 = uuidv7();
const SITE_ANN1 = uuidv7();
const INTERVENTION_ANN1 = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_ANN1,
        societe_id: reperes.societeId,
        raison_sociale: fr["annuler1.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ANN1,
        societe_id: reperes.societeId,
        client_id: CLIENT_ANN1,
        agence_id: agence.id,
        libelle: fr["annuler1.e2e.site"],
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_ANN1,
        societe_id: reperes.societeId,
        client_id: CLIENT_ANN1,
        site_id: SITE_ANN1,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "planifiee",
        date_planifiee: new Date("2026-09-24T00:00:00Z"),
        duree_estimee_min: 60,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    // CASCADE efface l'intervention avec elle-même — aucun segment, aucune
    // pause n'ont été posés par cette scène.
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_ANN1,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_ANN1 } });
    await client.client.deleteMany({ where: { id: CLIENT_ANN1 } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/84-FICHE-ANNULER/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-1280.png`),
    fullPage: true,
  });
}

/**
 * « ANNULER » VIT DANS LE MENU « ⋯ » DE L'EN-TÊTE (9ES-TP-UX4-3-FICHE-
 * GESTES-1, décision n° 63 d'Alexis, 08/10/2026, D194) — plus un `<details>`
 * de la carte Actions : il faut d'abord ouvrir le menu, puis choisir
 * « Annuler l'intervention » pour que le dialogue (`DialogueAnnuler`) s'ouvre.
 */
async function ouvrirAnnuler(page: Page): Promise<void> {
  await page.getByRole("button", { name: fr["ui.menu_plus.titre"] }).click();
  await page
    .getByRole("menuitem", { name: fr["intervention.action.annuler"] })
    .click();
}

test("le bouton « Annuler l'intervention » est désactivé tant qu'aucun motif n'est saisi", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_ANN1}`);
  await ouvrirAnnuler(page);

  const dialogue = page.locator("dialog[open]");
  await expect(dialogue).toBeVisible();
  await expect(
    dialogue.getByText(
      referenceAffichee({ id: INTERVENTION_ANN1, numero: null }),
    ),
  ).toBeVisible();

  const bouton = dialogue.getByRole("button", {
    name: fr["intervention.action.annuler"],
  });
  await expect(bouton).toBeVisible();
  await expect(bouton).toBeDisabled();

  await capturer(page, "dialogue-ouvert");
});

test("un motif saisi puis « Garder l'intervention » ne change rien", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_ANN1}`);
  await ouvrirAnnuler(page);

  const dialogue = page.locator("dialog[open]");
  await dialogue
    .getByLabel(fr["intervention.annulation.motif"])
    .fill(fr["annuler1.e2e.motif"]);

  const bouton = dialogue.getByRole("button", {
    name: fr["intervention.action.annuler"],
  });
  await expect(bouton).toBeEnabled();

  await page
    .getByRole("button", { name: fr["intervention.annulation.garder"] })
    .click();
  await expect(dialogue).toBeHidden();

  // RIEN N'A ÉTÉ ENVOYÉ — ni la page (toujours la fiche, non rechargée), ni
  // la base : le statut reste `planifiee`.
  await expect(page).toHaveURL(`/interventions/${INTERVENTION_ANN1}`);
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.planifiee"]),
  ).toBeVisible();

  const client = admin();
  try {
    const ligne = await client.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_ANN1 },
      select: { statut: true, motif_annulation: true },
    });
    expect(ligne.statut).toBe("planifiee");
    expect(ligne.motif_annulation).toBeNull();
  } finally {
    await client.$disconnect();
  }
});

test("une confirmation acceptée annule l'intervention avec son motif", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_ANN1}`);
  await ouvrirAnnuler(page);

  const dialogue = page.locator("dialog[open]");
  await dialogue
    .getByLabel(fr["intervention.annulation.motif"])
    .fill(fr["annuler1.e2e.motif"]);
  await dialogue
    .getByRole("button", { name: fr["intervention.action.annuler"] })
    .click();

  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.annulee"]),
  ).toBeVisible();
  await expect(page.getByText(fr["annuler1.e2e.motif"])).toBeVisible();

  const client = admin();
  try {
    const ligne = await client.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_ANN1 },
      select: { statut: true, motif_annulation: true },
    });
    expect(ligne.statut).toBe("annulee");
    expect(ligne.motif_annulation).toBe(fr["annuler1.e2e.motif"]);
  } finally {
    await client.$disconnect();
  }
});
