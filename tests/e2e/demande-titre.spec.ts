import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * QE-9 (a) du 03/10/2026, D176 — LE TITRE DE LA FICHE EST LE COUPLE
 * « <client> · <site> » (revient sur GR17-M5, audit GR du 26/09, constat M5).
 *
 * ## Le constat
 *
 * `/demandes/[id]` affichait `demande.titre` (« Demandes ») — le pluriel de
 * la LISTE — comme titre de la fiche d'UNE demande, puis « Demande —
 * <raison sociale> » (GR17-M5). `titreFiche`
 * (`app/(back-office)/demandes/presentation.ts`) compose désormais
 * « <raison sociale> · <site> », au gabarit de la maquette du 28/09 (D176).
 *
 * ## Ce que `tests/unit/demandes/titre-fiche.test.ts` ne peut pas prouver
 *
 * Il éprouve la composition, pure. Ce fichier prouve qu'un écran RÉEL
 * l'affiche, sur sa propre scène, préfixée `ERGO5-`, créée et supprimée par
 * l'épreuve (jamais le semis partagé).
 */
test.describe.configure({ mode: "serial" });

const PREFIXE = "ERGO5-";
const RAISON_SOCIALE = `${PREFIXE}Client (épreuve titre)`;
const LIBELLE_SITE = `${PREFIXE}Lieu (épreuve titre)`;

const CLIENT_ID = randomUUID();
const SITE_ID = randomUUID();
const DEMANDE_ID = randomUUID();

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.demande.deleteMany({ where: { id: DEMANDE_ID } });
  await client.site.deleteMany({ where: { id: SITE_ID } });
  await client.client.deleteMany({ where: { id: CLIENT_ID } });
}

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
        description: `${PREFIXE}Panne (épreuve titre)`,
        urgence: "p2",
        statut: "nouvelle",
        depose_le: maintenant,
        compteur_accuse_le: maintenant,
      },
    });
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

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("le titre de la fiche est « <client> · <site> », pas « Demandes »", async ({
  page,
}) => {
  await page.goto(`/demandes/${DEMANDE_ID}`);
  await expect(page.locator("main")).toBeVisible();

  const prefixeAttendu = `${RAISON_SOCIALE}${fr["ponctuation.point_median"]}${LIBELLE_SITE}`;
  const texteTitre = await page.locator("h1").innerText();
  expect(texteTitre.startsWith(prefixeAttendu)).toBe(true);
});
