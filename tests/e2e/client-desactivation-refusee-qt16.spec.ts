import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { mot } from "@/lib/i18n/vocabulaire";
import { t } from "@/lib/i18n/fr";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * QT-16 (D165, audit du 28/09/2026 ; précisions du pilote du 03/10/2026, à
 * valider par Alexis) — CLIENT INACTIF : désactivation refusée si des
 * interventions restent ouvertes, état visible sur la fiche client, sur
 * `/sites` et sur la fiche site.
 *
 * **Scène à SOI, créée par ce fichier** (jamais `SCENE.*` partagée) : deux
 * clients préfixés `QT16-`, l'un sans aucune intervention, l'autre avec une
 * intervention ouverte — exactement ce que le ticket interdit de mélanger
 * avec le semis de démonstration, sous peine de compter large comme
 * `46-SELECTEURS-1` l'a appris à ses dépens.
 */

test.describe.configure({ mode: "serial" });

const CLIENT_SANS_INTERVENTION = "e2e00000-0000-7000-8000-000000016101";
const SITE_SANS_INTERVENTION = "e2e00000-0000-7000-8000-000000016102";
const CLIENT_AVEC_INTERVENTION = "e2e00000-0000-7000-8000-000000016103";
const SITE_AVEC_INTERVENTION = "e2e00000-0000-7000-8000-000000016104";
const INTERVENTION_OUVERTE = "e2e00000-0000-7000-8000-000000016105";

const LIBELLE_CLIENT_SANS = "QT16- Client sans intervention";
const LIBELLE_CLIENT_AVEC = "QT16- Client avec intervention ouverte";
const LIBELLE_SITE_SANS = "QT16- Site sans intervention";
const LIBELLE_SITE_AVEC = "QT16- Site avec intervention ouverte";

test.beforeAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });

    await client.intervention.deleteMany({
      where: { id: INTERVENTION_OUVERTE },
    });
    await client.site.deleteMany({
      where: { id: { in: [SITE_SANS_INTERVENTION, SITE_AVEC_INTERVENTION] } },
    });
    await client.client.deleteMany({
      where: {
        id: { in: [CLIENT_SANS_INTERVENTION, CLIENT_AVEC_INTERVENTION] },
      },
    });

    await client.client.create({
      data: {
        id: CLIENT_SANS_INTERVENTION,
        societe_id: societe.id,
        raison_sociale: LIBELLE_CLIENT_SANS,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_SANS_INTERVENTION,
        societe_id: societe.id,
        client_id: CLIENT_SANS_INTERVENTION,
        agence_id: agence.id,
        libelle: LIBELLE_SITE_SANS,
        actif: true,
      },
    });

    await client.client.create({
      data: {
        id: CLIENT_AVEC_INTERVENTION,
        societe_id: societe.id,
        raison_sociale: LIBELLE_CLIENT_AVEC,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_AVEC_INTERVENTION,
        societe_id: societe.id,
        client_id: CLIENT_AVEC_INTERVENTION,
        agence_id: agence.id,
        libelle: LIBELLE_SITE_AVEC,
        actif: true,
      },
    });
    // `statut` retombe sur son défaut (`a_planifier`) — une OUVERTE de la
    // file d'attente, exactement le cas que QT-16 bloque.
    await client.intervention.create({
      data: {
        id: INTERVENTION_OUVERTE,
        societe_id: societe.id,
        client_id: CLIENT_AVEC_INTERVENTION,
        site_id: SITE_AVEC_INTERVENTION,
        agence_id: agence.id,
        type: "curatif",
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
    await client.intervention.deleteMany({
      where: { id: INTERVENTION_OUVERTE },
    });
    await client.site.deleteMany({
      where: { id: { in: [SITE_SANS_INTERVENTION, SITE_AVEC_INTERVENTION] } },
    });
    await client.client.deleteMany({
      where: {
        id: { in: [CLIENT_SANS_INTERVENTION, CLIENT_AVEC_INTERVENTION] },
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("refuse la désactivation d'un client avec une intervention ouverte, et affiche la liste", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT_AVEC_INTERVENTION}`);
  await page.locator('select[name="actif"]').selectOption("false");
  await page
    .getByRole("button", { name: t("clients.action.modifier") })
    .click();

  const bandeau = page.locator(
    '[data-motif="client.refus.interventions_ouvertes"]',
  );
  await expect(bandeau).toBeVisible();
  await expect(bandeau).toContainText(t("client.refus.interventions_ouvertes"));
  await expect(
    bandeau.locator(`a[href="/interventions/${INTERVENTION_OUVERTE}"]`),
  ).toBeVisible();

  // LE REFUS N'A RIEN CHANGÉ : la fiche reste celle d'un client ACTIF — les
  // deux actions normalement offertes à ce rôle sont toujours là.
  await expect(
    page.getByRole("link", {
      name: `${t("action.ajouter")} ${mot("site")}`,
    }),
  ).toBeVisible();
});

test("désactive un client SANS intervention ouverte, montre le badge, masque les actions, et le dit sur /sites", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT_SANS_INTERVENTION}`);
  await page.locator('select[name="actif"]').selectOption("false");
  await page
    .getByRole("button", { name: t("clients.action.modifier") })
    .click();

  await expect(page.locator('[data-motif="clients.modifie"]')).toBeVisible();

  // LE BADGE, EN TÊTE DE FICHE (CS15).
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(t("clients.inactif")),
  ).toBeVisible();

  // LES DEUX ACTIONS DISPARAISSENT, ET LA RAISON EST EN CLAIR (CS15).
  await expect(
    page.getByRole("link", {
      name: `${t("action.ajouter")} ${mot("site")}`,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", {
      name: t("clients.action.ajouter_intervention"),
    }),
  ).toHaveCount(0);
  await expect(page.locator('[data-aide="client-inactif-actions"]')).toHaveText(
    t("clients.fiche.actions_masquees_inactif"),
  );

  // LA CARTE DE /sites LE DIT AUSSI (CS27). Recherche écrite dans l'URL —
  // c'est un formulaire `GET` — plutôt qu'un remplissage de champ.
  // `sans_equipement=1` : ce site d'épreuve n'a aucun équipement, et la
  // recherche les masque par défaut (LISTES-1).
  await page.goto(
    `/sites?q=${encodeURIComponent(LIBELLE_SITE_SANS)}&sans_equipement=1`,
  );
  const carte = page.locator("article").filter({ hasText: LIBELLE_SITE_SANS });
  await expect(carte).toHaveCount(1);
  await expect(carte.getByText(t("clients.inactif"))).toBeVisible();
});
