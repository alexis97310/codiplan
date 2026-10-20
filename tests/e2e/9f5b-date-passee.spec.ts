import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { jourSuivant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  dialogueOuvert,
  formulaireDialogue,
  ouvrirSaisieManuelle,
} from "./setup/saisie-manuelle";
import { cleDeJour } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * D123 d'Alexis (19/10/2026, Projet ; constat 2 de l'audit fonctionnel 9F5,
 * décision D217) — « AVERTIR, LAISSER FAIRE » : une date déjà passée devient
 * une porte « à confirmer », à la pose comme à la transmission individuelle,
 * jamais un silence (comme avant ce lot) ni un refus infranchissable.
 */

const PREFIXE = "zz9F5B-date-passee";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function creerInterventionDucos(suffixe: string): Promise<string> {
  const client = admin();
  try {
    const reperes = await reperesDeLaScene();
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: reperes.societeId, agence: { code: "DUCOS" } },
      select: { id: true, client_id: true, agence_id: true },
      orderBy: { libelle: "asc" },
    });
    const id = uuidv7();
    await client.intervention.create({
      data: {
        id,
        societe_id: reperes.societeId,
        agence_id: site.agence_id,
        client_id: site.client_id,
        site_id: site.id,
        type: "curatif",
        priorite: "p3",
        statut: "a_planifier",
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: `${PREFIXE} — ${suffixe}`,
      },
    });
    return id;
  } finally {
    await client.$disconnect();
  }
}

async function supprimerIntervention(id: string): Promise<void> {
  const client = admin();
  try {
    await client.intervention.deleteMany({ where: { id } });
  } finally {
    await client.$disconnect();
  }
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9F5B-CORRECTIFS-AUDIT-FONCTIONNEL/captures",
);

/** Capture EN VIEWPORT (jamais `fullPage`) — point 5 du lot. */
async function capturer(
  page: Page,
  nom: string,
  largeur: 375 | 1280,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
  });
}

test("planifier à la main sur une date passée, SANS confirmation : refusé, rien n'est écrit", async ({
  page,
}) => {
  const id = await creerInterventionDucos("pose sans confirmation");
  try {
    const reperes = await reperesDeLaScene();
    const lundiPasse = jourSuivant(reperes.lundi, -7);

    await ouvrirLaSessionSensible(page, "adv@codima.test");
    await page.goto(`/interventions/${id}`);
    await ouvrirSaisieManuelle(page);
    const formulaire = formulaireDialogue(page);
    await formulaire
      .locator('input[name="date_planifiee"]')
      .fill(cleDeJour(lundiPasse));
    await formulaire.locator('input[name="heure_debut"]').fill("10:00");
    await formulaire.locator('input[name="duree_min"]').fill("60");
    const technicien = await formulaire
      .locator('select[name="technicien_id"] option:not([value=""])')
      .first()
      .getAttribute("value");
    await formulaire
      .locator('select[name="technicien_id"]')
      .selectOption(technicien ?? "");
    // LA CASE RESTE DÉCOCHÉE, délibérément.
    await dialogueOuvert(page)
      .getByRole("button", {
        name: fr["intervention.action.planifier_a_la_main"],
      })
      .click();
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(
      /\/interventions\/[0-9a-f-]+\?motif=intervention\.refus\.date_passee/,
    );
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: fr["intervention.refus.date_passee"] }),
    ).toBeVisible();
    // ENCORE « à planifier » — rien n'a été écrit.
    await expect(
      page
        .getByRole("heading", { level: 1 })
        .getByText(fr["statut.a_planifier"]),
    ).toBeVisible();
    await capturer(page, "9f5b-date-passee-pose-refus", 1280);
  } finally {
    await supprimerIntervention(id);
  }
});

test("planifier à la main sur une date passée, CONFIRMÉE : acceptée, avertissement affiché", async ({
  page,
}) => {
  const id = await creerInterventionDucos("pose confirmée");
  try {
    const reperes = await reperesDeLaScene();
    const lundiPasse = jourSuivant(reperes.lundi, -7);

    await ouvrirLaSessionSensible(page, "adv@codima.test");
    await page.goto(`/interventions/${id}`);
    await ouvrirSaisieManuelle(page);
    const formulaire = formulaireDialogue(page);
    await formulaire
      .locator('input[name="date_planifiee"]')
      .fill(cleDeJour(lundiPasse));
    await formulaire.locator('input[name="heure_debut"]').fill("10:00");
    await formulaire.locator('input[name="duree_min"]').fill("60");
    const technicien = await formulaire
      .locator('select[name="technicien_id"] option:not([value=""])')
      .first()
      .getAttribute("value");
    await formulaire
      .locator('select[name="technicien_id"]')
      .selectOption(technicien ?? "");
    await capturer(page, "9f5b-date-passee-pose-dialogue-avant", 375);
    await formulaire
      .getByLabel(fr["intervention.confirmer_date_passee"])
      .check();
    await dialogueOuvert(page)
      .getByRole("button", {
        name: fr["intervention.action.planifier_a_la_main"],
      })
      .click();
    await page.waitForLoadState("networkidle");

    expect(new URL(page.url()).searchParams.get("motif")).toBeNull();
    await expect(
      page.getByRole("heading", { level: 1 }).getByText(fr["statut.planifiee"]),
    ).toBeVisible();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: fr["intervention.avertissement.date_passee"] }),
    ).toBeVisible();
    await capturer(page, "9f5b-date-passee-pose-accepte", 1280);

    // ── LA TRANSMISSION, SUR CETTE MÊME LIGNE DÉSORMAIS PLANIFIÉE ────────
    await page
      .getByRole("button", { name: fr["intervention.action.transmettre"] })
      .click();
    await capturer(page, "9f5b-date-passee-transmission-dialogue", 375);
    const dialogueTransmettre = dialogueOuvert(page);
    await dialogueTransmettre
      .getByLabel(fr["intervention.confirmer_date_passee"])
      .check();
    await dialogueTransmettre
      .getByRole("button", { name: fr["intervention.action.transmettre"] })
      .click();
    await page.waitForLoadState("networkidle");

    expect(new URL(page.url()).searchParams.get("motif")).toBeNull();
    await expect(
      page.getByRole("heading", { level: 1 }).getByText(fr["statut.affectee"]),
    ).toBeVisible();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: fr["intervention.avertissement.date_passee"] }),
    ).toBeVisible();
    await capturer(page, "9f5b-date-passee-transmission-accepte", 1280);
  } finally {
    await supprimerIntervention(id);
  }
});
