import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EU-SOLDE-FICHE-PLANNING (solde 164) — ÉCHAP REND TOUJOURS LE FOCUS À CE
 * QUI A OUVERT LE DIALOGUE.
 *
 * Sur une `en_cours`, « Suspendre… » ouvre son dialogue DIRECTEMENT depuis
 * l'en-tête : Échap le ferme et rend le focus NATIVEMENT à ce bouton (le
 * déclencheur n'est jamais démonté). Sur une `planifiee`, « Annuler
 * l'intervention » s'ouvre DEPUIS le menu « ⋯ » : le déclencheur (le
 * `menuitem`) est démonté avec le menu à la fermeture, le focus natif
 * retomberait sur `<body>` sans le renvoi explicite posé dans `MenuPlus`
 * (`fermerEtRendreFocus`) — Échap doit rendre le focus au bouton « ⋯ »
 * lui-même, jamais à `<body>`.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `zz9EU-`
 *
 * Un client, un site, deux interventions (`en_cours`, `planifiee`) — créées
 * en `beforeAll`, supprimées en `afterAll`, aucune ligne ajoutée au semis.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_FOCUS = uuidv7();
const SITE_FOCUS = uuidv7();
const INTERVENTION_EN_COURS = uuidv7();
const INTERVENTION_PLANIFIEE = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_FOCUS,
        societe_id: reperes.societeId,
        raison_sociale: "zz9EU-DIALOGUE-FOCUS — client forgé",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_FOCUS,
        societe_id: reperes.societeId,
        client_id: CLIENT_FOCUS,
        agence_id: agence.id,
        libelle: "zz9EU-DIALOGUE-FOCUS — site forgé",
      },
    });

    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "duree_estimee_min", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'en_cours', 60, now())`,
      INTERVENTION_EN_COURS,
      reperes.societeId,
      CLIENT_FOCUS,
      SITE_FOCUS,
      agence.id,
    );
    await client.intervention.create({
      data: {
        id: INTERVENTION_PLANIFIEE,
        societe_id: reperes.societeId,
        client_id: CLIENT_FOCUS,
        site_id: SITE_FOCUS,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "planifiee",
        date_planifiee: new Date("2026-09-24T00:00:00Z"),
        duree_estimee_min: 60,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_FOCUS,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_FOCUS } });
    await client.client.deleteMany({ where: { id: CLIENT_FOCUS } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("Suspendre (en-tête) : Échap ferme et rend le focus à son propre bouton", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_EN_COURS}`);

  const bouton = page.getByRole("button", {
    name: fr["intervention.action.suspendre"],
  });
  await bouton.click();

  const dialogue = page.locator("dialog[open]");
  await expect(dialogue).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialogue).toHaveCount(0);
  await expect(bouton).toBeFocused();
});

test("Annuler (menu « ⋯ ») : Échap ferme et rend le focus au bouton « ⋯ »", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_PLANIFIEE}`);

  const boutonMenu = page.getByRole("button", {
    name: fr["ui.menu_plus.titre"],
  });
  await boutonMenu.click();
  await page
    .getByRole("menuitem", { name: fr["intervention.action.annuler"] })
    .click();

  const dialogue = page.locator("dialog[open]");
  await expect(dialogue).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialogue).toHaveCount(0);
  await expect(boutonMenu).toBeFocused();
});

/**
 * LE CLIC SUR LE FOND, RESTREINT (solde 178, 9EW-SOLDE-DIALOGUES-FICHE) —
 * ferme SAUF si un champ a été modifié depuis l'ouverture (`components/ui/
 * dialogue.tsx`). `{ position: { x: 4, y: 4 } }` vise la marge `p-4` de la
 * feuille basse (le coin de la boîte, jamais son contenu) : la cible du clic
 * y est l'ÉLÉMENT `<dialog>` lui-même.
 */
test("Suspendre (en-tête) : clic sur le fond ferme quand rien n'est saisi", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_EN_COURS}`);

  const bouton = page.getByRole("button", {
    name: fr["intervention.action.suspendre"],
  });
  await bouton.click();

  const dialogue = page.locator("dialog[open]");
  await expect(dialogue).toBeVisible();

  await dialogue.click({ position: { x: 4, y: 4 } });
  await expect(dialogue).toHaveCount(0);
  await expect(bouton).toBeFocused();
});

test("Suspendre (en-tête) : clic sur le fond ne ferme pas quand un champ est saisi, et garde sa valeur", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_EN_COURS}`);

  await page
    .getByRole("button", { name: fr["intervention.action.suspendre"] })
    .click();

  const dialogue = page.locator("dialog[open]");
  await expect(dialogue).toBeVisible();
  const champMotif = dialogue.getByLabel(fr["intervention.suspension.motif"]);
  await champMotif.fill("Pièce manquante");

  await dialogue.click({ position: { x: 4, y: 4 } });
  await expect(dialogue).toBeVisible();
  await expect(champMotif).toHaveValue("Pièce manquante");
});

test("Suspendre (en-tête) : « Fermer » ferme et rend le focus à son propre bouton", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_EN_COURS}`);

  const bouton = page.getByRole("button", {
    name: fr["intervention.action.suspendre"],
  });
  await bouton.click();

  const dialogue = page.locator("dialog[open]");
  await expect(dialogue).toBeVisible();

  await dialogue
    .getByRole("button", { name: fr["ui.dialogue.fermer"] })
    .click();
  await expect(dialogue).toHaveCount(0);
  await expect(bouton).toBeFocused();
});

test("Annuler (menu « ⋯ ») : clic sur le fond avec un motif saisi ne ferme pas, et garde le motif", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_PLANIFIEE}`);

  const boutonMenu = page.getByRole("button", {
    name: fr["ui.menu_plus.titre"],
  });
  await boutonMenu.click();
  await page
    .getByRole("menuitem", { name: fr["intervention.action.annuler"] })
    .click();

  const dialogue = page.locator("dialog[open]");
  await expect(dialogue).toBeVisible();
  const champMotif = dialogue.getByLabel(fr["intervention.annulation.motif"]);
  await champMotif.fill("Changement de programme client");

  await dialogue.click({ position: { x: 4, y: 4 } });
  await expect(dialogue).toBeVisible();
  await expect(champMotif).toHaveValue("Changement de programme client");
});

test("Annuler (menu « ⋯ ») : « Garder l'intervention » ferme et rend le focus au bouton « ⋯ »", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_PLANIFIEE}`);

  const boutonMenu = page.getByRole("button", {
    name: fr["ui.menu_plus.titre"],
  });
  await boutonMenu.click();
  await page
    .getByRole("menuitem", { name: fr["intervention.action.annuler"] })
    .click();

  const dialogue = page.locator("dialog[open]");
  await expect(dialogue).toBeVisible();

  await page
    .getByRole("button", { name: fr["intervention.annulation.garder"] })
    .click();
  await expect(dialogue).toHaveCount(0);
  await expect(boutonMenu).toBeFocused();
});
