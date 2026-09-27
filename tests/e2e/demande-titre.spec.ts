import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * GR17-M5 (audit GR du 26/09/2026, constat M5) — LE TITRE DE LA FICHE PORTE
 * LE CLIENT, PAS LE PLURIEL DE LA LISTE.
 *
 * ## Le constat
 *
 * `/demandes/[id]` affichait `demande.titre` (« Demandes ») — le pluriel de
 * la LISTE — comme titre de la fiche d'UNE demande. `titreFiche`
 * (`app/(back-office)/demandes/presentation.ts`) compose désormais
 * « Demande — <raison sociale> ».
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

test("le titre de la fiche est « Demande — <client> », pas « Demandes »", async ({
  page,
}) => {
  await page.goto(`/demandes/${DEMANDE_ID}`);
  await expect(page.locator("main")).toBeVisible();

  const prefixeAttendu = `${fr["demande.fiche.titre"]}${fr["ponctuation.separateur"]}${RAISON_SOCIALE}`;
  const texteTitre = await page.locator("h1").innerText();
  expect(texteTitre.startsWith(prefixeAttendu)).toBe(true);
});
