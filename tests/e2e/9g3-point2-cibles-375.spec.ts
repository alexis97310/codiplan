import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * 9G3-TITRES-CIBLES-ACTIONS, POINT 2 — SOUS 900 PX, TROIS FAMILLES DE
 * BOUTONS/LIENS ATTEIGNENT LA CIBLE TACTILE DE 44 PX (plancher TR-47,
 * `docs/arbitrages.md` ~:5944), SANS CHANGER LE BUREAU (modèle
 * `tests/e2e/planning-cibles-375.spec.ts`) :
 *
 * - le déclencheur d'un dialogue de geste (`Button size="sm"`, ici
 *   « Clôturer » sur la fiche intervention) ;
 * - l'action primaire d'un écran (`LienPrimaire`/`ActionPrimaire`, ici
 *   « Nouveau client ») ;
 * - le bouton « Se déconnecter » du bandeau horizontal du terrain.
 *
 * À 1280 px, AUCUN des trois ne grandit : le bureau reste aussi dense
 * qu'avant ce ticket (D144).
 *
 * Scène forgée pour la fiche intervention, préfixée `9G3P2`, jamais une
 * ligne du semis.
 */
test.describe.configure({ mode: "serial" });

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
      raison_sociale: "9G3P2 Client de l'épreuve des cibles",
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

  // `terminee` — nécessaire et suffisant pour que le geste « Clôturer » se
  // rende (`peutClore`, `app/(back-office)/interventions/[id]/page.tsx`).
  await admin.intervention.create({
    data: {
      id: interventionId,
      societe_id: societe.id,
      client_id: clientId,
      site_id: siteId,
      agence_id: agence.id,
      type: "curatif",
      priorite: "p3",
      statut: "terminee",
      description: "9G3P2 panne constatée",
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

const LARGEUR_TELEPHONE = { width: 375, height: 900 };
const LARGEUR_BUREAU = { width: 1280, height: 900 };

test("à 375 px, le déclencheur « Clôturer » atteint 44 px ; à 1280 px, il reste dense", async ({
  page,
}) => {
  await ouvrirUneSession(page);

  await page.setViewportSize(LARGEUR_TELEPHONE);
  await page.goto(`/interventions/${interventionId}`);
  const boutonTelephone = page.getByRole("button", {
    name: fr["intervention.action.cloturer"],
  });
  await expect(boutonTelephone).toBeVisible();
  const boiteTelephone = await boutonTelephone.boundingBox();
  expect(boiteTelephone).not.toBeNull();
  expect(boiteTelephone!.height).toBeGreaterThanOrEqual(44);

  await page.setViewportSize(LARGEUR_BUREAU);
  await page.goto(`/interventions/${interventionId}`);
  const boutonBureau = page.getByRole("button", {
    name: fr["intervention.action.cloturer"],
  });
  await expect(boutonBureau).toBeVisible();
  const boiteBureau = await boutonBureau.boundingBox();
  expect(boiteBureau).not.toBeNull();
  expect(boiteBureau!.height).toBeLessThan(44);
});

test("à 375 px, « Nouveau client » atteint 44 px ; à 1280 px, il reste dense", async ({
  page,
}) => {
  await ouvrirUneSession(page);

  await page.setViewportSize(LARGEUR_TELEPHONE);
  await page.goto("/clients");
  const lienTelephone = page.getByRole("link", { name: fr["clients.creer"] });
  await expect(lienTelephone).toBeVisible();
  const boiteTelephone = await lienTelephone.boundingBox();
  expect(boiteTelephone).not.toBeNull();
  expect(boiteTelephone!.height).toBeGreaterThanOrEqual(44);

  await page.setViewportSize(LARGEUR_BUREAU);
  await page.goto("/clients");
  const lienBureau = page.getByRole("link", { name: fr["clients.creer"] });
  await expect(lienBureau).toBeVisible();
  const boiteBureau = await lienBureau.boundingBox();
  expect(boiteBureau).not.toBeNull();
  expect(boiteBureau!.height).toBeLessThan(44);
});

test("à 375 px, « Se déconnecter » du bandeau terrain atteint 44 px", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.setViewportSize(LARGEUR_TELEPHONE);
  await page.goto("/terrain");
  const bouton = page.getByRole("button", { name: fr["nav.deconnexion"] });
  await expect(bouton).toBeVisible();
  const boite = await bouton.boundingBox();
  expect(boite).not.toBeNull();
  expect(boite!.height).toBeGreaterThanOrEqual(44);
});
