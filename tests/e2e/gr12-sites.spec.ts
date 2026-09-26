import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import {
  libelleAfficherSitesMasques,
  phraseSitesMasques,
} from "@/app/(back-office)/sites/presentation";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * GR12b (audit du 26/09/2026, constat G15) — sous les filtres de `/sites`, un
 * rappel dit COMBIEN de sites le masquage par défaut (LISTES-1) cache, et un
 * lien « Afficher » les révèle sans quitter la recherche en cours.
 *
 * ## Ce que ce scénario prouve, et que rien d'autre ne peut prouver
 *
 * Un gardien unitaire pourrait prouver que `phraseSitesMasques` compose
 * juste ; il ne peut pas prouver que l'ÉCRAN calcule le bon compte (la
 * différence entre les deux lectures de `compterSites`) NI que le lien
 * « Afficher » pose réellement `sans_equipement=1` sur la MÊME recherche —
 * c'est l'objet de ce fichier.
 *
 * ## Scène propre, préfixée `ERGO12`, créée et supprimée par l'épreuve
 *
 * Un client, deux sites : l'un porte une machine (jamais masqué), l'autre
 * n'en porte aucune (masqué par défaut, LISTES-1). `q=ERGO12` isole les deux
 * du reste du semis — aucune ligne n'est ajoutée au semis
 * (`prisma/seed*.ts`).
 */

test.describe.configure({ mode: "serial" });

const PREFIXE = "ERGO12";

let admin: PrismaClient;
let clientId: string;
let siteAvecEquipementId: string;
let siteSansEquipementId: string;
let machineId: string;

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
  const modele = await admin.modeleMateriel.findFirstOrThrow({
    where: { societe_id: societe.id },
    select: { id: true },
  });

  const client = await admin.client.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      raison_sociale: fr["gr12sites.e2e.client"],
      actif: true,
    },
  });
  clientId = client.id;

  const [siteAvec, siteSans] = await Promise.all([
    admin.site.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        client_id: clientId,
        agence_id: agence.id,
        libelle: fr["gr12sites.e2e.site_avec_equipement"],
      },
    }),
    admin.site.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        client_id: clientId,
        agence_id: agence.id,
        libelle: fr["gr12sites.e2e.site_sans_equipement"],
      },
    }),
  ]);
  siteAvecEquipementId = siteAvec.id;
  siteSansEquipementId = siteSans.id;

  const machine = await admin.machine.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      modele_id: modele.id,
      client_id: clientId,
      site_id: siteAvecEquipementId,
      qr_token: `${PREFIXE}QR${randomUUID().slice(0, 20)}`,
      numero_serie: `${PREFIXE}-SN`,
    },
  });
  machineId = machine.id;
});

test.afterAll(async () => {
  try {
    await admin.machine.deleteMany({ where: { id: machineId } });
    await admin.site.deleteMany({
      where: { id: { in: [siteAvecEquipementId, siteSansEquipementId] } },
    });
    await admin.client.deleteMany({ where: { id: clientId } });
  } finally {
    await admin.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("la phrase de rappel compte le site masqué, et « Afficher » le révèle sur la même recherche", async ({
  page,
}) => {
  await page.goto(`/sites?q=${encodeURIComponent(PREFIXE)}`);

  await expect(
    page.locator(`article:has(a[href="/sites/${siteAvecEquipementId}"])`),
  ).toBeVisible();
  await expect(
    page.locator(`article:has(a[href="/sites/${siteSansEquipementId}"])`),
  ).toHaveCount(0);

  await expect(
    page.getByText(phraseSitesMasques(1), { exact: false }),
  ).toBeVisible();
  const lien = page.getByRole("link", {
    name: libelleAfficherSitesMasques(),
  });
  await expect(lien).toBeVisible();

  await lien.click();

  // MÊME RECHERCHE (`q=`), `sans_equipement=1` en plus — jamais une remise à
  // zéro du filtre en cours.
  await expect(page).toHaveURL(/q=ERGO12/);
  await expect(page).toHaveURL(/sans_equipement=1/);
  await expect(
    page.locator(`article:has(a[href="/sites/${siteAvecEquipementId}"])`),
  ).toBeVisible();
  await expect(
    page.locator(`article:has(a[href="/sites/${siteSansEquipementId}"])`),
  ).toBeVisible();
  await expect(
    page.getByText(phraseSitesMasques(1), { exact: false }),
  ).toHaveCount(0);
});
