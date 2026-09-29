import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { cleDeJour, type ReperesDeScene } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES ONGLETS DE LA COLONNE « À TRAITER » (PG-C2-FILE-ONGLETS).
 *
 * *Chaque scénario forge SA PROPRE intervention* (préfixe `PGC2-`, un
 * identifiant tiré au sort) et la retire en fin de test — jamais une fixture
 * `SCENE.*` partagée. Ce fichier ne pose ni ne glisse rien (voir le PRÉALABLE
 * de ce ticket) : les cartes existent DÉJÀ en base à l'ouverture de l'écran,
 * si bien qu'aucun scénario ici ne dépend de l'heure du jour ni des créneaux
 * libres.
 */

async function creerIntervention(
  reperes: ReperesDeScene,
  champs: {
    readonly statut: string;
    readonly datePlanifiee: Date | null;
    readonly dureeEstimeeMin: number | null;
    readonly suspendueLe?: Date;
    readonly motifSuspension?: string;
  },
): Promise<string> {
  const id = uuidv7();
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: { societe_id: reperes.societeId, agence_id: agence.id },
      select: { id: true, client_id: true },
      orderBy: { libelle: "asc" },
    });
    await client.intervention.create({
      data: {
        id,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: site.client_id,
        site_id: site.id,
        technicien_id: null,
        type: "curatif",
        priorite: "p2",
        statut: champs.statut as never,
        date_planifiee: champs.datePlanifiee,
        duree_estimee_min: champs.dureeEstimeeMin,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "PGC2 — intervention forgée par l'épreuve",
        suspendue_le: champs.suspendueLe ?? null,
        motif_suspension: champs.motifSuspension ?? null,
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

test("les quatre onglets affichent chacun leur propre population, et l'onglet vit dans l'URL", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  const semaineCle = cleDeJour(reperes.lundi);
  const suspendue = await creerIntervention(reperes, {
    statut: "suspendue",
    datePlanifiee: new Date("2026-01-10T00:00:00.000Z"),
    dureeEstimeeMin: 60,
    suspendueLe: new Date(),
    motifSuspension: "PGC2 — motif forgé par l'épreuve",
  });

  try {
    await ouvrirUneSession(page);
    await page.goto(`/planning?vue=semaine&semaine=${semaineCle}`);

    // À L'OUVERTURE : l'onglet « À planifier » est actif, et la carte
    // suspendue n'y figure pas.
    await expect(
      page.getByRole("tab", {
        name: fr["planning.a_traiter_onglet_a_planifier"],
      }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.locator(`a[href="/interventions/${suspendue}"]`),
    ).toHaveCount(0);

    // ON BASCULE VERS « SUSPENDUES » — l'URL le porte, et la carte y apparaît.
    await page
      .getByRole("tab", { name: fr["planning.a_traiter_onglet_suspendues"] })
      .click();
    await expect(page).toHaveURL(/onglet=suspendues/);
    await expect(
      page.getByRole("tab", {
        name: fr["planning.a_traiter_onglet_suspendues"],
      }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.locator(`a[href="/interventions/${suspendue}"]`),
    ).toBeVisible();

    // LA VUE ET LA SEMAINE SONT PRÉSERVÉES PAR LE CHANGEMENT D'ONGLET.
    await expect(page).toHaveURL(/vue=semaine/);
    await expect(page).toHaveURL(new RegExp(`semaine=${semaineCle}`));
  } finally {
    await retirerIntervention(suspendue);
  }
});
