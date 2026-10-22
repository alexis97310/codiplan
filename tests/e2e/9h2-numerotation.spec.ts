import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { choisirPriorite } from "./setup/formulaire-creation";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9H2-NUMEROTATION-INTERVENTIONS, point 4 — DE BOUT EN BOUT : CRÉER UNE
 * INTERVENTION PAR L'ÉCRAN FAIT PARAÎTRE « INT-AAAA-NNNN », PAS « Local-… »,
 * SUR LA FICHE, LE REGISTRE ET LE BON.
 *
 * Le site est RELU depuis le semis (« Atelier principal », Ducos) — même
 * geste que `parcours-creer-puis-planifier.spec.ts` —, jamais créé par ce
 * fichier : il ne compte rien sur ce site, seulement la fiche qu'il crée
 * lui-même.
 */

const REFERENCE_COMPLETE = /INT-\d{4}-\d{4,}/;

async function siteDucosPrincipal(): Promise<{ readonly siteLibelle: string }> {
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
        libelle: "Atelier principal",
      },
      select: { libelle: true },
    });
    return { siteLibelle: site.libelle };
  } finally {
    await client.$disconnect();
  }
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("créer une intervention par l'écran fait paraître INT-AAAA-NNNN — fiche, registre et bon", async ({
  page,
}) => {
  const { siteLibelle } = await siteDucosPrincipal();
  await page.goto("/interventions/nouvelle");
  await choisirResultatParTexte(page, "site", siteLibelle, siteLibelle);
  await page.locator('select[name="type"]').selectOption("curatif");
  await choisirPriorite(page, "p2");
  await page
    .locator('textarea[name="description"]')
    .fill("Épreuve 9H2 — numérotation à la création");
  await page
    .locator("#contenu")
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+(\?cree=1)?$/);
  const id = new URL(page.url()).pathname.split("/").pop() as string;

  // LA FICHE — une référence COMPLÈTE, jamais « Local-… ».
  const texteFiche = await page.locator("body").innerText();
  const correspondance = texteFiche.match(REFERENCE_COMPLETE);
  expect(correspondance).not.toBeNull();
  const reference = correspondance?.[0] as string;
  expect(texteFiche).not.toContain("Local-");

  // LE SEUL NUMÉRO (« ce que les utilisateurs taperont en premier »)
  // RETROUVE LA FICHE DANS LE REGISTRE.
  const numeroSeul = reference.split("-")[2];
  await page.goto(`/interventions?q=${numeroSeul}`);
  await expect(page.locator(`a[href*="${id}"]`).first()).toBeVisible();
  await expect(page.getByText(reference).first()).toBeVisible();

  // LE BON — même référence, jamais « Local-… » non plus.
  await page.goto(`/interventions/${id}/bon`);
  const texteBon = await page.locator("body").innerText();
  expect(texteBon).toContain(reference);
  expect(texteBon).not.toContain("Local-");
});
