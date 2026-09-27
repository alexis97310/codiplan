import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, type Page, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9AO-GR17-DEMANDE-CHAMP-NATURE (27/09/2026) — même recette
 * que `captures-9an-gr17-planning-barre.spec.ts` : rien n'est écrit sans la
 * variable d'environnement qui nomme le dossier, pour que `pnpm test:e2e`
 * ordinaire n'écrive jamais de fichier.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `ERGO5-` — un client, un site et une demande,
 * créés en `beforeAll`, supprimés en `afterAll`. La fiche machine capturée
 * est une machine de démonstration DÉJÀ rattachée à une intervention du
 * semis (`intervention_machine`) — la première trouvée pour CODIMA-NC —,
 * jamais une machine forgée par cette scène : c'est son HISTORIQUE, déjà
 * peuplé, que ce point du lot (M16) montre.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot (worktree sur le commit de départ), une fois sur le
 * code livré.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9AO ?? "";

const PREFIXE = "ERGO5-";
const RAISON_SOCIALE = `${PREFIXE}Client (captures GR17)`;
const LIBELLE_SITE = `${PREFIXE}Lieu (captures GR17)`;

const CLIENT_ID = randomUUID();
const SITE_ID = randomUUID();
const DEMANDE_ID = randomUUID();

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.demande.deleteMany({ where: { id: DEMANDE_ID } });
  await client.site.deleteMany({ where: { id: SITE_ID } });
  await client.client.deleteMany({ where: { id: CLIENT_ID } });
}

let machineAvecHistoriqueId: string;

test.beforeAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: societe.id,
        raison_sociale: RAISON_SOCIALE,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: societe.id,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: LIBELLE_SITE,
        temps_trajet_min: 10,
      },
    });
    const maintenant = new Date();
    await client.demande.create({
      data: {
        id: DEMANDE_ID,
        societe_id: societe.id,
        source: "appel",
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        agence_id: agence.id,
        description: `${PREFIXE}Panne (captures GR17)`,
        urgence: "p2",
        statut: "nouvelle",
        depose_le: maintenant,
        compteur_accuse_le: maintenant,
      },
    });

    const rattachement = await client.interventionMachine.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { machine_id: true },
    });
    machineAvecHistoriqueId = rattachement.machine_id;
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [1280, 375] as const) {
  test(`capture — fiche demande ERGO5- à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto(`/demandes/${DEMANDE_ID}`);
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "fiche-demande-ergo5", largeur);
  });

  test(`capture — formulaire après refus « panne manquante » à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto(
      "/interventions/nouvelle?motif=intervention.refus.panne_manquante",
    );
    await expect(page.getByRole("status")).toContainText(
      fr["intervention.refus.panne_manquante"],
    );
    await capturer(page, "formulaire-refus-panne", largeur);
  });

  test(`capture — registre des interventions, filtre « Nature » à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto("/interventions");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "registre-filtre-nature", largeur);
  });

  test(`capture — fiche machine, historique à ${largeur}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: largeur, height: 1200 });
    await ouvrirUneSession(page);
    await page.goto(`/parc/${machineAvecHistoriqueId}`);
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "fiche-machine-historique", largeur);
  });
}
