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
 * 3. QE-9, D176 (9ED-TP-UX3-D2-DEMANDES) — l'ANCIEN bouton primaire « Créer
 *    une intervention depuis cette demande », qui menait à
 *    `/interventions/nouvelle?demande=<id>`, est devenu un formulaire EN
 *    LIGNE sur la fiche elle-même : les champs cachés portent déjà le lieu de
 *    la demande, et le soumettre crée l'intervention ET passe la demande
 *    « Transformée » (décision 14 d'Alexis du 05/10/2026), dans le MÊME
 *    geste.
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
  // LA TROISIÈME ÉPREUVE (D176) EN CRÉE UNE SECONDE, DEPUIS DEMANDE_SANS_ID —
  // `INTERVENTION_ID` seul ne suffit plus à vider la table avant `demande`.
  await client.intervention.deleteMany({
    where: {
      OR: [
        { id: INTERVENTION_ID },
        { demande_id: { in: [DEMANDE_SANS_ID, DEMANDE_AVEC_ID] } },
      ],
    },
  });
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

test("le formulaire « Transformer en intervention » porte déjà le lieu de la demande, et la créer la passe « Transformée »", async ({
  page,
}) => {
  await page.goto(`/demandes/${DEMANDE_SANS_ID}`);

  const forme = page.locator('form[action="/api/interventions/creer"]');
  await expect(forme).toBeVisible();
  await expect(forme.locator('input[name="demande_id"]')).toHaveValue(
    DEMANDE_SANS_ID,
  );
  await expect(forme.locator('input[name="site"]')).toHaveValue(
    `${CLIENT_ID}:${SITE_ID}`,
  );
  // AUCUN LIEN VERS /interventions/nouvelle (D176) : le formulaire est EN
  // LIGNE sur la fiche elle-même.
  await expect(
    page.getByRole("link", {
      name: fr["demande.transformer.creer_intervention"],
    }),
  ).toHaveCount(0);

  await forme.locator('select[name="type"]').selectOption("curatif");
  // LE BOUTON PORTE DÉSORMAIS « Créer l'intervention » (D188, partie 4).
  await forme
    .getByRole("button", {
      name: fr["demandes.fiche.creer_intervention"],
    })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+(\?cree=1)?$/);

  // DÉCISION 14 D'ALEXIS DU 05/10/2026 — LA DEMANDE EST DÉSORMAIS
  // « TRANSFORMÉE », SANS AVOIR CLIQUÉ « MARQUER COMME TRANSFORMÉE ».
  await page.goto(`/demandes/${DEMANDE_SANS_ID}`);
  await expect(
    page.getByText(fr["demande.statut.transformee"], { exact: true }),
  ).toBeVisible();
  await expect(page.locator('[data-bloc="demande-actions"] form')).toHaveCount(
    0,
  );
});
