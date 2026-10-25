import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES AVANT/APRÈS DU POINT 2 DE 9G3-TITRES-CIBLES-ACTIONS — cibles
 * tactiles de 44 px au téléphone : le déclencheur « Clôturer » de la fiche
 * intervention, « Nouveau client », le bandeau terrain (« Se déconnecter »)
 * et le lien `tel:` du contact sur place.
 *
 * Recette de la mémoire de session « captures-avant-apres-e2e ». Silencieux
 * sans `CAPTURES_9G3P2`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9G3P2 ?? "";
const ETAPE = process.env.CAPTURES_9G3P2_ETAPE ?? "avant";

test.skip(DOSSIER === "", "capture inerte sans CAPTURES_9G3P2");

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}-${ETAPE}.png`) });
}

const LARGEUR_TELEPHONE = { width: 375, height: 900 };

let admin: PrismaClient;
// Tirés AVANT toute écriture — un `afterAll` qui nettoierait sur un
// identifiant encore `undefined` verrait Prisma l'omettre du filtre
// (`where: { id: undefined }` devient `where: {}`), c'est-à-dire TOUTE la
// table. Des identifiants fixés dès le départ ne matchent jamais rien
// d'autre, même si `beforeAll` échoue avant de les écrire.
const clientId = randomUUID();
const siteId = randomUUID();
const contactId = randomUUID();
const interventionId = randomUUID();
let technicienUtilisateurId: string;

test.beforeAll(async () => {
  admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });

  const societe = await admin.societe.findFirstOrThrow({
    where: { code: "CODIMA-NC" },
    select: { id: true },
  });
  const agence = await admin.agence.findFirstOrThrow({
    where: { societe_id: societe.id },
    select: { id: true },
  });
  const technicien = await admin.utilisateur.findFirstOrThrow({
    where: { email: COMPTE_TECHNICIEN_EPREUVE },
    select: { id: true },
  });
  technicienUtilisateurId = technicien.id;

  await admin.client.create({
    data: {
      id: clientId,
      societe_id: societe.id,
      raison_sociale: "9G3P2 Client de capture",
      actif: true,
    },
  });

  await admin.site.create({
    data: {
      id: siteId,
      societe_id: societe.id,
      client_id: clientId,
      agence_id: agence.id,
      libelle: "9G3P2 Site",
    },
  });

  await admin.contact.create({
    data: {
      id: contactId,
      societe_id: societe.id,
      client_id: clientId,
      site_id: siteId,
      nom: "9G3P2 Contact",
      telephone: "+687 71.22.33",
      email: "9g3p2-contact@codima.test",
      roles: ["donneur_ordre"],
      canaux: ["email"],
    },
  });

  await admin.intervention.create({
    data: {
      id: interventionId,
      societe_id: societe.id,
      client_id: clientId,
      site_id: siteId,
      agence_id: agence.id,
      technicien_id: technicienUtilisateurId,
      contact_id: contactId,
      type: "curatif",
      priorite: "p3",
      statut: "en_cours",
      description: "9G3P2 panne constatée",
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe",
    },
  });
});

test.afterAll(async () => {
  try {
    await admin.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      interventionId,
    );
    await admin.intervention.deleteMany({ where: { id: interventionId } });
    await admin.contact.deleteMany({ where: { id: contactId } });
    await admin.site.deleteMany({ where: { id: siteId } });
    await admin.client.deleteMany({ where: { id: clientId } });
  } finally {
    await admin.$disconnect();
  }
});

test("capture — « Nouveau client », à 375px", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.setViewportSize(LARGEUR_TELEPHONE);
  await page.goto("/clients");
  await expect(
    page.getByRole("link", { name: fr["clients.creer"] }),
  ).toBeVisible();
  await capturer(page, "clients-nouveau-375");
});

test("capture — bandeau terrain, « Se déconnecter », à 375px", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.setViewportSize(LARGEUR_TELEPHONE);
  await page.goto("/terrain");
  await expect(
    page.getByRole("button", { name: fr["nav.deconnexion"] }),
  ).toBeVisible();
  await capturer(page, "terrain-bandeau-375");
});

test("capture — lien tel: du contact sur place, à 375px", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.setViewportSize(LARGEUR_TELEPHONE);
  await page.goto(`/terrain/${interventionId}`);
  await expect(page.locator("main")).toBeVisible();
  await capturer(page, "terrain-fiche-tel-375");
});
