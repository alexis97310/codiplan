import { PrismaClient } from "@prisma/client";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { glisser } from "./setup/glisser";
import { reperesDeLaScene } from "./setup/reperes";
import { MARDI, cleDeJour, jourDeLaScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * PARCOURS-1 — CRÉER UNE DEMANDE, PUIS PLANIFIER : DEUX GESTES, DANS CET
 * ORDRE (23/09/2026, arbitrage Alexis).
 *
 * > *« Lors de la création d'intervention, on ne peut pas décider ni de la
 * > date d'intervention, ni du technicien affecté : il doit y avoir un ordre
 * > précis — Créer demande d'intervention → Planifier et qualifier
 * > l'intervention. »*
 *
 * Ce fichier éprouve LE PARCOURS, à travers l'écran :
 *
 *   1. CRÉER ne porte ni date, ni heure, ni technicien — seulement le lieu, la
 *      panne signalée (obligatoire) et au plus une machine. L'intervention
 *      née est `a_planifier`, et paraît dans la file d'attente du planning.
 *   2. PLANIFIER exige les QUATRE valeurs — date, heure, durée, technicien —
 *      ENSEMBLE : incomplet, il refuse en nommant ce qui manque ; complet, il
 *      accepte et l'intervention paraît dans la grille de la vue jour.
 *   3. LE GLISSER-DÉPOSER D'UNE CARTE « À PLANIFIER » N'EST PAS UN
 *      CONTOURNEMENT : déposée sur une case de la vue semaine — qui ne porte
 *      ni heure ni durée —, la même règle refuse, avec la MÊME route que le
 *      formulaire de la fiche (R2-19, « même route, même décision »).
 */

test.describe.configure({ mode: "serial" });

async function siteDeDucos(): Promise<{
  readonly siteId: string;
  readonly clientId: string;
}> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: {
        societe_id: societe.id,
        agence_id: agence.id,
        client: { actif: true },
      },
      select: { id: true, client_id: true },
      orderBy: { libelle: "asc" },
    });
    return { siteId: site.id, clientId: site.client_id };
  } finally {
    await client.$disconnect();
  }
}

function formulairePlanifier(page: Page): Locator {
  return page.locator("form", {
    has: page.getByRole("heading", {
      name: fr["intervention.action.planifier"],
    }),
  });
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("CRÉER ne demande ni date, ni heure, ni technicien — seulement le lieu et la panne", async ({
  page,
}) => {
  const { siteId, clientId } = await siteDeDucos();
  await page.goto("/interventions/nouvelle");

  // LES CHAMPS RETIRÉS N'EXISTENT PLUS DU TOUT (PARCOURS-1).
  await expect(page.locator('input[name="date_planifiee"]')).toHaveCount(0);
  await expect(page.locator('[name="technicien_id"]')).toHaveCount(0);
  await expect(page.locator('input[name="creneau_debut"]')).toHaveCount(0);

  // LA PANNE EST OBLIGATOIRE : soumettre sans elle est refusé par le
  // navigateur lui-même (`required`), et par le serveur si on le contourne.
  await page
    .locator('select[name="site"]')
    .selectOption(`${clientId}:${siteId}`);
  const panne = page.locator('textarea[name="description"]');
  await expect(panne).toHaveAttribute("required", "");

  await panne.fill("Le compresseur ne démarre plus — épreuve PARCOURS-1");
  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+$/);

  // LE STATUT RÉSULTANT EST « À PLANIFIER », et la fiche le dit.
  await expect(
    page.locator("dd", { hasText: fr["statut.a_planifier"] }).first(),
  ).toBeVisible();

  // ELLE PARAÎT DANS LA FILE D'ATTENTE DU PLANNING.
  const id = new URL(page.url()).pathname.split("/").pop();
  await page.goto("/planning");
  await expect(page.locator(`[data-bloc="${id}"]`)).toBeVisible();
});

test("PLANIFIER refuse sans les quatre valeurs, nomme ce qui manque, et accepte complet", async ({
  page,
}) => {
  const { siteId, clientId } = await siteDeDucos();
  await page.goto("/interventions/nouvelle");
  await page
    .locator('select[name="site"]')
    .selectOption(`${clientId}:${siteId}`);
  await page
    .locator('textarea[name="description"]')
    .fill("Épreuve PARCOURS-1 — planifier");
  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+$/);

  const formulaire = formulairePlanifier(page);
  await expect(formulaire).toBeVisible();
  // LES QUATRE CHAMPS SONT MARQUÉS OBLIGATOIRES.
  await expect(
    formulaire.locator('input[name="date_planifiee"]'),
  ).toHaveAttribute("required", "");
  await expect(formulaire.locator('input[name="heure_debut"]')).toHaveAttribute(
    "required",
    "",
  );
  await expect(formulaire.locator('input[name="duree_min"]')).toHaveAttribute(
    "required",
    "",
  );
  await expect(
    formulaire.locator('select[name="technicien_id"]'),
  ).toHaveAttribute("required", "");

  // ── REFUS : la date et l'heure sont données, la durée et le technicien
  // manquent — contourner le `required` du navigateur pour éprouver le
  // REFUS DU SERVEUR, pas seulement l'ergonomie du formulaire.
  const reperes = await reperesDeLaScene();
  const mardi = jourDeLaScene(reperes, MARDI);
  await formulaire
    .locator('input[name="date_planifiee"]')
    .fill(cleDeJour(mardi));
  await formulaire.locator('input[name="heure_debut"]').fill("11:00");
  await formulaire.evaluate((form) => {
    for (const nom of ["duree_min", "technicien_id"]) {
      const champ = form.querySelector(`[name="${nom}"]`);
      champ?.removeAttribute("required");
    }
  });
  await formulaire
    .getByRole("button", { name: fr["intervention.action.planifier"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(
    /\/interventions\/[0-9a-f-]+\?motif=intervention\.refus\.planification_duree_manquante/,
  );
  await expect(page.getByRole("status")).toContainText(
    fr["intervention.refus.planification_duree_manquante"],
  );
  // L'INTERVENTION EST TOUJOURS « À PLANIFIER » — le refus est réel.
  await expect(
    page.locator("dd", { hasText: fr["statut.a_planifier"] }).first(),
  ).toBeVisible();

  // ── ACCEPTE, complet ─────────────────────────────────────────────────────
  const formulaireComplet = formulairePlanifier(page);
  await formulaireComplet
    .locator('input[name="date_planifiee"]')
    .fill(cleDeJour(mardi));
  await formulaireComplet.locator('input[name="heure_debut"]').fill("11:00");
  await formulaireComplet.locator('input[name="duree_min"]').fill("60");
  const options = formulaireComplet.locator(
    'select[name="technicien_id"] option:not([value=""])',
  );
  await expect(options.first()).toBeAttached();
  const technicien = await options.first().getAttribute("value");
  await formulaireComplet
    .locator('select[name="technicien_id"]')
    .selectOption(technicien ?? "");
  await formulaireComplet
    .getByRole("button", { name: fr["intervention.action.planifier"] })
    .click();
  await page.waitForLoadState("networkidle");

  const id = new URL(page.url()).pathname.split("/").pop();
  // LE STATUT N'EST PLUS « À PLANIFIER », et le bloc « Planifier » a disparu
  // au profit d'« Affecter »/« Déplacer ».
  await expect(formulairePlanifier(page)).toHaveCount(0);
  await expect(page.locator('form[action$="/affecter"]')).toBeVisible();

  // ELLE PARAÎT DANS LA GRILLE DE LA VUE JOUR, au jour planifié.
  await page.goto(`/planning?vue=jour&jour=${cleDeJour(mardi)}`);
  await expect(page.locator(`[data-bloc="${id}"]`)).toBeVisible();
});

test("le glisser-déposer d'une carte « à planifier » n'est pas un contournement", async ({
  page,
}) => {
  const { siteId, clientId } = await siteDeDucos();
  const reperes = await reperesDeLaScene();

  // Une intervention À PLANIFIER, créée par le formulaire.
  await page.goto("/interventions/nouvelle");
  await page
    .locator('select[name="site"]')
    .selectOption(`${clientId}:${siteId}`);
  await page
    .locator('textarea[name="description"]')
    .fill("Épreuve PARCOURS-1 — glisser-déposer");
  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  const id = new URL(page.url()).pathname.split("/").pop();

  // LA VUE SEMAINE NE PORTE NI HEURE NI DURÉE — un dépôt là-dessus ne peut
  // donc jamais réunir les quatre valeurs que PLANIFIER exige.
  await page.goto("/planning");
  const carte = page.locator(`[data-bloc="${id}"]`);
  await expect(carte).toBeVisible();
  const caseCible = page.locator(
    `td[data-depot-technicien="${reperes.technicienDucos}"]`,
  );
  await expect(caseCible.first()).toBeAttached();

  await glisser(page, carte, caseCible.first());

  // LE REFUS S'AFFICHE — la carte reste dans la file d'attente, jamais
  // silencieusement « planifiée » à moitié.
  const refus = page.locator("[data-refus]");
  await expect(refus).toBeVisible();
  await expect(refus).toHaveAttribute(
    "data-refus",
    "intervention.refus.planification_duree_manquante",
  );
  await expect(
    page
      .locator('[data-maquette-bloc="cartes-dossier-file"]')
      .locator(`[data-bloc="${id}"]`),
  ).toBeVisible();
});
