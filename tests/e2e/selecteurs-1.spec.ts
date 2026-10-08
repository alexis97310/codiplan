import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { libelleCreerSite } from "@/app/(back-office)/sites/presentation";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { choisirPriorite } from "./setup/formulaire-creation";
import {
  choisirResultatEnPaginant,
  choisirResultatParTexte,
} from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * SELECTEURS-1 (24/09/2026) — LE VOLUME EST CRÉÉ PAR L'ÉPREUVE, DANS SA
 * PROPRE SCÈNE.
 *
 * **Aucune ligne n'est ajoutée à `prisma/seed.ts` ni à `prisma/seed-data.ts`**
 * — c'est ce qui a fait tomber CONTRAT-SITE quatre fois (leçon du 24/09).
 * 65 clients et 215 sites, préfixés `SEL1-`, sont créés en `beforeAll` sous
 * la société de l'épreuve (`CODIMA-NC`) et supprimés en `afterAll`, dans
 * l'ordre que les clés étrangères `Restrict` exigent (intervention →
 * machine → site → modèle → famille → client).
 *
 * Trois scènes, une par écran touché par SELECTEURS-1 :
 *   1. `/sites/nouveau` — le 60e client `SEL1-` est trouvable (recherche +
 *      pagination) et reçoit un nouveau site.
 *   2. `/interventions/nouvelle` — le 210e site `SEL1-` est trouvable et
 *      reçoit une intervention, avec sa machine proposée.
 *   3. `/parc/nouvelle` — client → site → modèle s'enchaînent et créent la
 *      machine.
 *
 * Plus un rappel court : `?site=` préremplit toujours (LIENS-1).
 */

test.describe.configure({ mode: "serial" });

const PREFIXE = "SEL1-";
const NOMBRE_CLIENTS = 65;
const NOMBRE_SITES = 215;
const RANG_CLIENT_VISE = 60;
const RANG_SITE_VISE = 210;

function idClient(rang: number): string {
  return `5e11c000-0000-7c11-8000-${rang.toString(16).padStart(12, "0")}`;
}
function idSite(rang: number): string {
  return `5e11c000-0000-7511-8000-${rang.toString(16).padStart(12, "0")}`;
}
const FAMILLE_SEL1 = "5e11c000-0000-7fa1-8000-000000000001";
const MODELE_SEL1 = "5e11c000-0000-7f0d-8000-000000000001";
const MACHINE_SEL1_ATTACHEE = "5e11c000-0000-7a11-8000-000000000001";
const QR_SEL1 = "SEL1QRTOKEN0000000000001";

function libelleClient(rang: number): string {
  return `${PREFIXE} Client ${String(rang).padStart(6, "0")}`;
}
function libelleSite(rang: number): string {
  return `${PREFIXE} Site ${String(rang).padStart(6, "0")}`;
}
const LIBELLE_MODELE_MARQUE = "SEL1MARQUE";
const LIBELLE_MODELE_REFERENCE = "SEL1REF";

let clientAcces: PrismaClient;
let idSiteCreeParLeScenario1: string | null = null;
let idInterventionCreeParLeScenario2: string | null = null;
let idMachineCreeParLeScenario3: string | null = null;

test.beforeAll(async () => {
  clientAcces = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });

  const societe = await clientAcces.societe.findFirstOrThrow({
    where: { code: "CODIMA-NC" },
    select: { id: true },
  });
  const agence = await clientAcces.agence.findFirstOrThrow({
    where: { societe_id: societe.id },
    select: { id: true },
  });

  await clientAcces.client.createMany({
    data: Array.from({ length: NOMBRE_CLIENTS }, (_, i) => ({
      id: idClient(i + 1),
      societe_id: societe.id,
      raison_sociale: libelleClient(i + 1),
      actif: true,
    })),
  });
  await clientAcces.site.createMany({
    data: Array.from({ length: NOMBRE_SITES }, (_, i) => ({
      id: idSite(i + 1),
      societe_id: societe.id,
      client_id: idClient(1),
      agence_id: agence.id,
      libelle: libelleSite(i + 1),
    })),
  });
  await clientAcces.familleMateriel.create({
    data: {
      id: FAMILLE_SEL1,
      societe_id: societe.id,
      code: "SEL1FAM",
      libelle: `${PREFIXE} Famille`,
    },
  });
  await clientAcces.modeleMateriel.create({
    data: {
      id: MODELE_SEL1,
      societe_id: societe.id,
      famille_id: FAMILLE_SEL1,
      marque: LIBELLE_MODELE_MARQUE,
      reference: LIBELLE_MODELE_REFERENCE,
    },
  });
  // UNE MACHINE DÉJÀ ATTACHÉE au site visé du scénario 2 — pour que
  // `/interventions/nouvelle` ait une machine à PROPOSER une fois ce site
  // choisi, comme l'exige la scène.
  await clientAcces.machine.create({
    data: {
      id: MACHINE_SEL1_ATTACHEE,
      societe_id: societe.id,
      modele_id: MODELE_SEL1,
      client_id: idClient(1),
      site_id: idSite(RANG_SITE_VISE),
      qr_token: QR_SEL1,
      numero_serie: "SEL1-SN-001",
    },
  });
});

test.afterAll(async () => {
  try {
    // PAR RELATION, PAS PAR IDENTIFIANT SUIVI — plus robuste : une machine
    // ou une intervention créée par un chemin qu'un identifiant capturé
    // n'aurait pas suivi (rejeu, double soumission sous charge) reste quand
    // même rattrapée, puisqu'elle désigne forcément UN de NOS modèles ou UN
    // de NOS sites.
    const tousLesSites = Array.from({ length: NOMBRE_SITES }, (_, i) =>
      idSite(i + 1),
    );
    if (idSiteCreeParLeScenario1 !== null) {
      tousLesSites.push(idSiteCreeParLeScenario1);
    }
    await clientAcces.intervention.deleteMany({
      where: { site_id: { in: tousLesSites } },
    });
    await clientAcces.machine.deleteMany({
      where: { modele_id: MODELE_SEL1 },
    });
    await clientAcces.site.deleteMany({ where: { id: { in: tousLesSites } } });
    await clientAcces.modeleMateriel.delete({ where: { id: MODELE_SEL1 } });
    await clientAcces.familleMateriel.delete({ where: { id: FAMILLE_SEL1 } });
    await clientAcces.client.deleteMany({
      where: {
        id: {
          in: Array.from({ length: NOMBRE_CLIENTS }, (_, i) => idClient(i + 1)),
        },
      },
    });
  } finally {
    await clientAcces.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("le 60e client SEL1- est trouvable et reçoit un site depuis /sites/nouveau", async ({
  page,
}) => {
  const cible = libelleClient(RANG_CLIENT_VISE);
  await page.goto("/sites/nouveau");

  await choisirResultatEnPaginant(
    page,
    "client_id",
    PREFIXE,
    cible,
    fr["selecteur.voir_plus"],
  );

  await page.locator('select[name="agence_id"]').selectOption({ index: 1 });
  const libelleDuNouveauSite = `${PREFIXE} site créé pour le 60e client`;
  await page.locator('input[name="libelle"]').fill(libelleDuNouveauSite);
  await page
    .locator("#contenu")
    .getByRole("button", { name: libelleCreerSite() })
    .click();

  await expect(page).toHaveURL(/\/sites\/[0-9a-f-]{36}/);
  idSiteCreeParLeScenario1 =
    new URL(page.url()).pathname.split("/").pop() ?? null;
  expect(idSiteCreeParLeScenario1).not.toBeNull();

  // La fiche du site nomme bien le 60e client, par un lien vers sa fiche —
  // dans le SOUS-TITRE (`<header>`, LIENS-1), pas dans le fil d'Ariane
  // (FICHE-360-1, `<nav>`) : les deux portent le même libellé depuis la
  // fusion des deux lots, et un sélecteur non scopé serait ambigu (deux
  // liens, aucun rapport avec ce que ce scénario éprouve).
  await expect(
    page.locator("header").getByRole("link", { name: cible }),
  ).toBeVisible();
});

test("le 210e site SEL1- est trouvable et reçoit une intervention, avec sa machine proposée", async ({
  page,
}) => {
  const cible = libelleSite(RANG_SITE_VISE);
  await page.goto("/interventions/nouvelle");

  await choisirResultatEnPaginant(
    page,
    "site",
    PREFIXE,
    new RegExp(cible.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    fr["selecteur.voir_plus"],
  );

  // LA MACHINE ATTACHÉE À CE SITE EST PROPOSÉE — preuve que
  // `/api/recherche/site/[id]` a bien été interrogée pour CE site.
  // UNE SEULE machine attachée : TP-UX5-1-FORMULAIRES rend donc un groupe de
  // boutons radio (`SEUIL_CHOIX_VISIBLES`), jamais le `<select>`.
  const groupeMachine = page
    .getByRole("radiogroup")
    .filter({ has: page.locator('input[name="machine_ids"]') });
  await expect(
    groupeMachine.locator(`input[value="${MACHINE_SEL1_ATTACHEE}"]`),
  ).toBeAttached();
  await groupeMachine
    .locator(`label:has(input[value="${MACHINE_SEL1_ATTACHEE}"])`)
    .click();

  await page.locator('select[name="type"]').selectOption("curatif");
  await choisirPriorite(page, "p2");
  await page
    .locator('textarea[name="description"]')
    .fill("Épreuve SELECTEURS-1 — 210e site");
  await page
    .locator("#contenu")
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();

  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+(\?cree=1)?$/);
  idInterventionCreeParLeScenario2 =
    new URL(page.url()).pathname.split("/").pop() ?? null;
  expect(idInterventionCreeParLeScenario2).not.toBeNull();

  await expect(
    page.locator("dd").filter({ hasText: "SEL1MARQUE" }),
  ).toBeVisible();
});

test("/parc/nouvelle enchaîne client → site → modèle et crée la machine", async ({
  page,
}) => {
  await page.goto("/parc/nouvelle");

  await choisirResultatParTexte(
    page,
    "client_id",
    libelleClient(1),
    libelleClient(1),
  );
  await choisirResultatParTexte(
    page,
    "site_id",
    libelleSite(1),
    libelleSite(1),
  );
  await choisirResultatParTexte(
    page,
    "modele_id",
    LIBELLE_MODELE_MARQUE,
    new RegExp(LIBELLE_MODELE_MARQUE),
  );

  await page.locator('input[name="numero_serie"]').fill("SEL1-SN-PARC-1");
  // D184 (9EK-TP-UX5-2-CREATIONS-2) — « Créer la machine », au gabarit du
  // 28/09 ; `machine.action.enregistrer` reste le texte du mode modification.
  await page.getByRole("button", { name: fr["machine.action.creer"] }).click();

  await expect(page).toHaveURL(/\/parc\/[0-9a-f-]{36}/);
  idMachineCreeParLeScenario3 =
    new URL(page.url()).pathname.split("/").pop() ?? null;
  expect(idMachineCreeParLeScenario3).not.toBeNull();
});

test("?site= préremplit toujours le sélecteur de site (LIENS-1)", async ({
  page,
}) => {
  const siteVise = idSite(1);
  await page.goto(`/interventions/nouvelle?site=${siteVise}`);
  const valeurCachee = page.locator(
    '[data-selecteur="site"] input[type="hidden"]',
  );
  await expect(valeurCachee).toHaveValue(new RegExp(`:${siteVise}$`));
});
