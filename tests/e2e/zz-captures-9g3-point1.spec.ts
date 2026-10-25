import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES AVANT/APRÈS DU POINT 1 DE 9G3-TITRES-CIBLES-ACTIONS — « mots
 * coupés au milieu » (`break-all`) sur la fiche intervention et son bon.
 *
 * Scène forgée, préfixée `9G3P1`, jamais une ligne du semis — un client dont
 * le nom porte PLUSIEURS mots longs et une barre oblique (le défaut mesuré :
 * « Atlas C / opco GA-11 » coupé en deux), pas un seul mot sans espace (ce
 * cas-là reste couvert par `fiche-375.spec.ts`, qui prouve l'absence de
 * débordement). Recette de la mémoire de session « captures-avant-apres-e2e »
 * : ce fichier tourne une fois sur le commit d'AVANT
 * (`CAPTURES_9G3P1_ETAPE=avant`), une fois sur le code livré (`=apres`).
 * Silencieux sans `CAPTURES_9G3P1` (le dossier).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9G3P1 ?? "";
const ETAPE = process.env.CAPTURES_9G3P1_ETAPE ?? "avant";

test.skip(DOSSIER === "", "capture inerte sans CAPTURES_9G3P1");

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${ETAPE}.png`),
  });
}

const PREFIXE = "9G3P1";
const CLIENT_LONG = `${PREFIXE} Atlas Corporation Industries Internationales / opco GA-1142 réglementaire`;
const SITE_LONG = `${PREFIXE} Dépôt de maintenance et stockage réglementaire Bourail`;

let admin: PrismaClient;
// Tirés AVANT toute écriture — un `afterAll` qui nettoierait sur un
// identifiant encore `undefined` verrait Prisma l'omettre du filtre
// (`where: { id: undefined }` devient `where: {}`), c'est-à-dire TOUTE la
// table. Des identifiants fixés dès le départ ne matchent jamais rien
// d'autre, même si `beforeAll` échoue avant de les écrire.
const clientId = randomUUID();
const siteId = randomUUID();
const interventionId = randomUUID();

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

  await admin.client.create({
    data: {
      id: clientId,
      societe_id: societe.id,
      raison_sociale: CLIENT_LONG,
      actif: true,
    },
  });

  await admin.site.create({
    data: {
      id: siteId,
      societe_id: societe.id,
      client_id: clientId,
      agence_id: agence.id,
      libelle: SITE_LONG,
    },
  });

  // `terminee` — nécessaire et suffisant pour `peutGenererLeBon`
  // (`lib/interventions/cycle-de-vie.ts`), sans signature ni créneau requis.
  await admin.intervention.create({
    data: {
      id: interventionId,
      societe_id: societe.id,
      client_id: clientId,
      site_id: siteId,
      agence_id: agence.id,
      type: "controle_reglementaire",
      priorite: "p2",
      statut: "terminee",
      description: `${PREFIXE} panne constatée`,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe",
    },
  });
});

test.afterAll(async () => {
  try {
    await admin.intervention.deleteMany({ where: { id: interventionId } });
    await admin.site.deleteMany({ where: { id: siteId } });
    await admin.client.deleteMany({ where: { id: clientId } });
  } finally {
    await admin.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

const LARGEURS = [1280, 375] as const;

for (const largeur of LARGEURS) {
  test(`capture — fiche intervention, à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1100 });
    await page.goto(`/interventions/${interventionId}`);
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, `interventions-fiche-${largeur}`);
  });

  test(`capture — bon d'intervention, à ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 1100 });
    await page.goto(`/interventions/${interventionId}/bon`);
    await expect(
      page.getByRole("link", {
        name: fr["intervention.bon.retour_fiche"],
        exact: false,
      }),
    ).toBeVisible();
    await capturer(page, `interventions-bon-${largeur}`);
  });
}
