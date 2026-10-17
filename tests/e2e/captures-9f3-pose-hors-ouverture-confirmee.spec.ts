import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  MERCREDI,
  SAMEDI,
  cleDeJour,
  jourDeLaScene,
  type ReperesDeScene,
} from "./setup/scene";
import { glisser } from "./setup/glisser";
import {
  poserInterventionGlisser,
  retirerInterventionGlisser,
} from "./setup/scene-glisser";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9F3-POSE-HORS-OUVERTURE-CONFIRMEE (D93 d'Alexis,
 * 13/10/2026) — même patron que `captures-9db-retouches-10.spec.ts` :
 * `DOSSIER` vide n'écrit rien, une paire par largeur.
 *
 * Deux écrans, les deux nouveaux de ce lot :
 * - la case de confirmation dans `FenetrePose` (depuis la fiche, « Trouver
 *   un créneau ») puis la mention « Posée hors ouverture, confirmée par … »
 *   sur la fiche, une fois acceptée ;
 * - le dialogue « Poser hors des horaires d'ouverture ? » du glisser-déposer
 *   direct, avant la minuterie « Annuler ».
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9F3 ?? "";

async function capturer(
  page: Page,
  nom: string,
  pleinePage = true,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}.png`),
    fullPage: pleinePage,
  });
}

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const SITE_SEME_KONE = "Dépôt de brousse";

async function creerInterventionAPlanifier(
  reperes: ReperesDeScene,
): Promise<string> {
  const id = uuidv7();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "KONE" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: {
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client: { actif: true },
        libelle: SITE_SEME_KONE,
      },
      select: { id: true, client_id: true },
    });
    await client.intervention.create({
      data: {
        id,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: site.client_id,
        site_id: site.id,
        technicien_id: null,
        type: "preventif_contrat",
        priorite: "p3",
        statut: "a_planifier",
        date_planifiee: null,
        creneau_debut: null,
        creneau_fin: null,
        duree_estimee_min: null,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9F3CAP — intervention forgée par l'épreuve",
      },
    });
    return id;
  } finally {
    await client.$disconnect();
  }
}

async function retirerIntervention(id: string): Promise<void> {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "id" = $1::uuid`,
      id,
    );
  } finally {
    await client.$disconnect();
  }
}

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1100 });
      await ouvrirUneSession(page);
    });

    test(`capture — confirmer un jour fermé depuis la fenêtre de la fiche, puis la mention sur la fiche, à ${largeur}px`, async ({
      page,
    }) => {
      const reperes = await reperesDeLaScene();
      const samedi = jourDeLaScene(reperes, SAMEDI);
      const samediCle = cleDeJour(samedi);
      const interventionId = await creerInterventionAPlanifier(reperes);
      try {
        await page.goto(`/interventions/${interventionId}`);
        await page
          .getByRole("button", {
            name: fr["intervention.action.trouver_creneau"],
          })
          .click();

        const fenetre = page.locator(`[data-fenetre-pose="${interventionId}"]`);
        await expect(fenetre).toBeVisible();
        await fenetre.getByLabel(fr["planning.pose.date"]).fill(samediCle);
        await fenetre.locator("select").selectOption(reperes.technicienKone);
        await fenetre
          .getByRole("button", {
            name: fr["planning.pose.duree_60"],
            exact: true,
          })
          .click();
        await fenetre.getByLabel(fr["planning.pose.heure_autre"]).fill("09:00");
        await expect(
          fenetre.getByLabel(fr["intervention.confirmer_hors_ouverture"]),
        ).toBeVisible();
        await capturer(page, `fenetre-pose-confirmable-${largeur}`);

        await fenetre
          .getByLabel(fr["intervention.confirmer_hors_ouverture"])
          .check();
        await fenetre
          .getByRole("button", {
            name: fr["planning.pose.confirmer"],
            exact: true,
          })
          .click();
        await page.waitForLoadState("networkidle");
        await expect(
          page.getByText(
            fr["intervention.confirmation.hors_ouverture_prefixe"],
          ),
        ).toBeVisible();
        await capturer(page, `fiche-confirmee-${largeur}`);
      } finally {
        await retirerIntervention(interventionId);
      }
    });
  });
}

/**
 * LE GLISSER-DÉPOSER N'A PAS D'ÉQUIVALENT TACTILE (même réserve que
 * `captures-pg-b4-survol-cases.spec.ts`) : à 1280 px seulement.
 */
test.describe("glisser-déposer, à 1280px", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1100 });
    await ouvrirUneSession(page);
  });

  test("capture — le dialogue de confirmation du glisser-déposer direct", async ({
    page,
  }) => {
    const reperes = await reperesDeLaScene();
    const id = await poserInterventionGlisser(reperes, {
      codeAgence: "KONE",
      technicienId: reperes.technicienKone,
      rang: MERCREDI,
      debut: 8 * 60,
      duree: 120,
    });
    try {
      await page.goto(
        `/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`,
      );
      const cible = page.locator(
        `[data-depot-jour="${cleDeJour(jourDeLaScene(reperes, SAMEDI))}"][data-depot-technicien="${reperes.technicienKone}"]`,
      );
      await glisser(page, page.locator(`[data-bloc="${id}"]`), cible);
      const dialogue = page.locator("[data-confirmation-hors-ouverture]");
      await expect(dialogue).toBeVisible();
      await capturer(page, "dialogue-confirmation-glisser-depose-1280");
    } finally {
      await retirerInterventionGlisser(id);
    }
  });
});
