import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { jourSuivant, cleJour } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9CO-PG-G14A-TRANSMETTRE (D141) — AVANT/APRÈS LE GESTE,
 * SUR LE CODE LIVRÉ (pas un `git worktree`) : ce ticket AJOUTE un geste, il
 * n'en modifie aucun autre à l'écran — la paire AVANT/APRÈS la plus honnête
 * est donc celle de la MÊME fiche avant et après avoir cliqué
 * « Transmettre au technicien », jamais une comparaison de commit.
 *
 * SA PROPRE SCÈNE, préfixée `PGG14ACAP-` — forgée en `beforeAll`, effacée en
 * `afterAll`, aucune ligne au semis (I9).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PGG14A ?? "";

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}.png`), fullPage: true });
}

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTIONS: Record<number, string> = {
  1280: uuidv7(),
  375: uuidv7(),
};

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
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: "PGG14ACAP — client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "PGG14ACAP — site",
      },
    });
    for (const [largeur, id] of Object.entries(INTERVENTIONS)) {
      const jour = jourSuivant(reperes.lundi, 210 + Number(largeur) / 100);
      await client.intervention.create({
        data: {
          id,
          societe_id: reperes.societeId,
          agence_id: agence.id,
          client_id: CLIENT_ID,
          site_id: SITE_ID,
          technicien_id: reperes.technicienDucos,
          type: "curatif",
          priorite: "p3",
          statut: "planifiee",
          date_planifiee: new Date(`${cleJour(jour)}T00:00:00.000Z`),
          creneau_debut: new Date(`${cleJour(jour)}T21:00:00.000Z`),
          creneau_fin: new Date(`${cleJour(jour)}T22:00:00.000Z`),
          duree_estimee_min: 60,
          mode_valorisation: "temps_passe",
          devise_code: "XPF",
          description: "PGG14ACAP — capture",
        },
      });
    }
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    for (const id of Object.values(INTERVENTIONS)) {
      await client.$executeRawUnsafe(
        `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
        id,
      );
    }
    await client.intervention.deleteMany({
      where: { id: { in: Object.values(INTERVENTIONS) } },
    });
    await client.site.deleteMany({ where: { id: SITE_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1100 });
      await ouvrirUneSession(page);
    });

    test(`capture — le tiroir du planning sur une Planifiée, avec « Transmettre au technicien », à ${largeur}px`, async ({
      page,
    }) => {
      const id = INTERVENTIONS[largeur];
      await page.goto(`/planning?intervention=${id}`);
      const tiroir = page.locator(`[data-tiroir-ouvert="${id}"]`);
      await expect(tiroir).toBeVisible();
      await expect(
        tiroir.getByRole("button", {
          name: fr["intervention.action.transmettre"],
        }),
      ).toBeVisible();
      await capturer(page, `tiroir-planifiee-transmettre-${largeur}`);
    });

    test(`capture — fiche d'une Planifiée (bloc Actions), avant/après « Transmettre », à ${largeur}px`, async ({
      page,
    }) => {
      const id = INTERVENTIONS[largeur];

      // AVANT — Planifiée : « Transmettre au technicien » est l'action
      // PRINCIPALE, « Affecter un technicien » secondaire et repliée.
      await page.goto(`/interventions/${id}`);
      await expect(
        page
          .getByRole("heading", { level: 1 })
          .getByText(fr["statut.planifiee"]),
      ).toBeVisible();
      const formTransmettre = page.locator("form#action-transmettre");
      await expect(formTransmettre).toBeVisible();
      await capturer(page, `fiche-planifiee-actions-avant-${largeur}`);

      // APRÈS — un clic sur « Transmettre au technicien » : Affectée. Le
      // tiroir de cette même ligne, capturé par le test précédent, montre
      // donc l'ÉTAT D'AVANT ce clic — c'est voulu, voir l'en-tête du fichier.
      await formTransmettre
        .getByRole("button", { name: fr["intervention.action.transmettre"] })
        .click();
      await page.waitForLoadState("networkidle");
      await expect(
        page
          .getByRole("heading", { level: 1 })
          .getByText(fr["statut.affectee"]),
      ).toBeVisible();
      await capturer(page, `fiche-affectee-apres-${largeur}`);
    });
  });
}
