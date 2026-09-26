import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 99Q-GR2-DEMANDE (audit GR du 26/09/2026, constat G4) — LA CONFIRMATION NE
 * S'AFFICHE QUE SI AUCUNE INTERVENTION N'EST ISSUE.
 *
 * ## Ce que ce fichier prouve, par l'ÉCRAN
 *
 * 1. Sur une demande `qualifiee` sans aucune intervention issue, cliquer
 *    « Marquer comme transformée » OUVRE une confirmation ; « Revenir » la
 *    referme sans rien envoyer — la demande reste `qualifiee`.
 * 2. Sur une demande `qualifiee` qui porte déjà une intervention issue, le
 *    même bouton soumet DIRECTEMENT, sans confirmation.
 * 3. Le bouton primaire « Créer une intervention depuis cette demande » mène
 *    au formulaire de création, prérempli par le lieu de la demande.
 *
 * Sa propre scène, préfixée `ERGO2-`, créée et supprimée par l'épreuve —
 * jamais empruntée au semis partagé (mémoire du poste : « un spec qui compte
 * pose SON site »).
 */

test.describe.configure({ mode: "serial" });

const PREFIXE = "ERGO2-";
const RAISON_SOCIALE = `${PREFIXE}Client (épreuve confirmation)`;
const LIBELLE_SITE = `${PREFIXE}Lieu (épreuve confirmation)`;
const DESCRIPTION_SANS = `${PREFIXE}Panne — sans intervention issue`;
const DESCRIPTION_AVEC = `${PREFIXE}Panne — avec intervention issue`;

const CLIENT_ID = randomUUID();
const SITE_ID = randomUUID();
const DEMANDE_SANS_ID = randomUUID();
const DEMANDE_AVEC_ID = randomUUID();
const INTERVENTION_ID = randomUUID();

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.intervention.deleteMany({ where: { id: INTERVENTION_ID } });
  await client.demande.deleteMany({
    where: { id: { in: [DEMANDE_SANS_ID, DEMANDE_AVEC_ID] } },
  });
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
        id: DEMANDE_SANS_ID,
        societe_id: societe.id,
        source: "appel",
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        agence_id: agence.id,
        description: DESCRIPTION_SANS,
        urgence: "p2",
        statut: "qualifiee",
        depose_le: maintenant,
        compteur_accuse_le: maintenant,
      },
    });
    await client.demande.create({
      data: {
        id: DEMANDE_AVEC_ID,
        societe_id: societe.id,
        source: "appel",
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        agence_id: agence.id,
        description: DESCRIPTION_AVEC,
        urgence: "p2",
        statut: "qualifiee",
        depose_le: maintenant,
        compteur_accuse_le: maintenant,
      },
    });
    // UNE INTERVENTION DÉJÀ ISSUE de DEMANDE_AVEC_ID — créée directement en
    // base : ce fichier n'éprouve pas le formulaire de création, déjà couvert
    // par `demandes-2.spec.ts`, seulement ce que sa PRÉSENCE change ici.
    await client.intervention.create({
      data: {
        id: INTERVENTION_ID,
        societe_id: societe.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        agence_id: agence.id,
        demande_id: DEMANDE_AVEC_ID,
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
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("sans intervention issue, « Marquer comme transformée » ouvre une confirmation, et « Revenir » laisse la demande qualifiée", async ({
  page,
}) => {
  await page.goto(`/demandes/${DEMANDE_SANS_ID}`);
  await expect(page.locator("main")).toBeVisible();

  const bouton = page.getByRole("button", {
    name: fr["demande.action.marquer_transformee"],
  });
  await expect(bouton).toBeVisible();
  await bouton.click();

  const dialogue = page.locator("dialog");
  await expect(dialogue).toBeVisible();
  await expect(dialogue).toContainText(fr["demande.transformer.confirmation"]);

  await dialogue
    .getByRole("button", { name: fr["demande.transformer.revenir"] })
    .click();
  await expect(dialogue).toBeHidden();

  // RIEN N'A ÉTÉ ENVOYÉ : la demande est toujours qualifiée, le bouton
  // « Marquer comme transformée » est donc toujours celui qu'on voit.
  await expect(
    page.getByRole("button", {
      name: fr["demande.action.marquer_transformee"],
    }),
  ).toBeVisible();
});

test("avec une intervention déjà issue, « Marquer comme transformée » soumet directement, sans confirmation", async ({
  page,
}) => {
  await page.goto(`/demandes/${DEMANDE_AVEC_ID}`);
  await expect(page.locator("main")).toBeVisible();
  await expect(
    page.getByText(fr["demande.interventions_issues.aucune"]),
  ).toBeHidden();

  await page
    .getByRole("button", {
      name: fr["demande.action.marquer_transformee"],
    })
    .click();

  // AUCUN DIALOGUE : la soumission part directement.
  await expect(page.locator("dialog")).toBeHidden();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByText(fr["demande.statut.transformee"], { exact: true }),
  ).toBeVisible();
});

test("« Créer une intervention » mène au formulaire, préremplie par le lieu de la demande", async ({
  page,
}) => {
  await page.goto(`/demandes/${DEMANDE_SANS_ID}`);

  const lien = page.getByRole("link", {
    name: fr["demande.transformer.creer_intervention"],
  });
  await expect(lien).toHaveAttribute(
    "href",
    `/interventions/nouvelle?demande=${DEMANDE_SANS_ID}`,
  );
  await lien.click();
  await expect(page).toHaveURL(
    `/interventions/nouvelle?demande=${DEMANDE_SANS_ID}`,
  );
  await expect(
    page.locator('[data-selecteur="site"] input[type="text"]'),
  ).toHaveValue(`${RAISON_SOCIALE} — ${LIBELLE_SITE}`);
});
