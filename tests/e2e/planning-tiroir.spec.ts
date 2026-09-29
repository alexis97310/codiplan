import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { cleDeJour } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LE TIROIR (PG-C5-TIROIR) — clic sur une carte du planning : le tiroir
 * s'ouvre, l'URL le porte, et le planning ne se recharge JAMAIS (aucune
 * navigation de page complète).
 *
 * *Chaque scénario forge SA PROPRE intervention* (préfixe `PGC5-`) et la
 * retire en fin de test — jamais une fixture `SCENE.*` partagée.
 */

async function creerInterventionAPlanifier(societeId: string): Promise<string> {
  const id = uuidv7();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: societeId, agence_id: agence.id },
      select: { id: true, client_id: true },
      orderBy: { libelle: "asc" },
    });
    await client.intervention.create({
      data: {
        id,
        societe_id: societeId,
        agence_id: agence.id,
        client_id: site.client_id,
        site_id: site.id,
        technicien_id: null,
        type: "curatif",
        priorite: "p2",
        statut: "a_planifier",
        date_planifiee: null,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "PGC5 — intervention forgée par l'épreuve",
      },
    });
    return id;
  } finally {
    await client.$disconnect();
  }
}

async function retirerIntervention(id: string): Promise<void> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.intervention.deleteMany({ where: { id } });
  } finally {
    await client.$disconnect();
  }
}

test("le clic sur une carte ouvre le tiroir, l'URL le porte, et Échap le ferme sans recharger le planning", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  const interventionId = await creerInterventionAPlanifier(reperes.societeId);

  try {
    await ouvrirUneSession(page);
    await page.goto(
      `/planning?vue=semaine&semaine=${cleDeJour(reperes.lundi)}`,
    );

    // UN TÉMOIN QUE LE PLANNING NE SE RECHARGE PAS : posé sur `window`, il ne
    // survivrait pas à une navigation de page complète.
    await page.evaluate(() => {
      (window as unknown as { __pgc5Temoin?: boolean }).__pgc5Temoin = true;
    });

    const carte = page.locator(
      `a[data-tiroir-declencheur="${interventionId}"]`,
    );
    await expect(carte).toBeVisible();
    await carte.click();

    await expect(page).toHaveURL(new RegExp(`intervention=${interventionId}`));
    const tiroir = page.locator(`[data-tiroir-ouvert="${interventionId}"]`);
    await expect(tiroir).toBeVisible();
    await expect(tiroir).toHaveAttribute("role", "dialog");

    // LE CONTENU S'EST CHARGÉ SANS RECHARGER LA PAGE (`/api/.../resume`) —
    // témoin toujours présent, et la référence de la fiche apparaît.
    await expect(
      page.evaluate(
        () => (window as unknown as { __pgc5Temoin?: boolean }).__pgc5Temoin,
      ),
    ).resolves.toBe(true);
    await expect(
      tiroir.getByText(fr["planning.tiroir.ouvrir_la_fiche"]),
    ).toBeVisible();

    // ÉCHAP FERME, ET REND LE FOYER À LA CARTE.
    await page.keyboard.press("Escape");
    await expect(tiroir).toHaveCount(0);
    await expect(page).not.toHaveURL(/intervention=/);
    await expect(carte).toBeFocused();
    await expect(
      page.evaluate(
        () => (window as unknown as { __pgc5Temoin?: boolean }).__pgc5Temoin,
      ),
    ).resolves.toBe(true);
  } finally {
    await retirerIntervention(interventionId);
  }
});
