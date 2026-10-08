import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import {
  libelleCreerEtAjouterSite,
  ligneHomonyme,
} from "@/app/(back-office)/clients/presentation";
import {
  libelleCreerSite,
  titreSitesExistants,
} from "@/app/(back-office)/sites/presentation";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import {
  choisirResultatParTexte,
  valeurChamp,
} from "./setup/selecteur-recherche";
import {
  COMMUNE_HOMONYME_9EK as COMMUNE_HOMONYME,
  LIBELLE_SITE_HOMONYME_9EK as LIBELLE_SITE_HOMONYME,
  PREFIXE_9EK as PREFIXE,
  RAISON_HOMONYME_9EK as RAISON_HOMONYME,
} from "./setup/scene-9ek";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EK-TP-UX5-2-CREATIONS-1 — `/clients/nouveau` et `/sites/nouveau` au
 * gabarit du 28/09 (D181).
 *
 * **SA PROPRE SCÈNE, PRÉFIXÉE `9EK-`** — jamais `SCENE.*` : un client
 * homonyme et son site, posés en `beforeAll` sous le PROPRIÉTAIRE, retirés
 * en `afterAll` par leur identité (préfixe), jamais par un décompte seul.
 * Les clients CRÉÉS PAR LES SCÉNARIOS eux-mêmes (raison sociale préfixée
 * `9EK-`, UUID v7 tiré par le test) sont retirés par le même filtre.
 *
 * Le TEXTE de la scène (raison sociale, commune, libellé du site) vient de
 * `./setup/scene-9ek.ts` — jamais déclaré ici — voir sa note de tête.
 */

test.describe.configure({ mode: "serial" });

const CLIENT_HOMONYME = uuidv7();
const SITE_HOMONYME = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_HOMONYME,
        societe_id: societe.id,
        raison_sociale: RAISON_HOMONYME,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_HOMONYME,
        societe_id: societe.id,
        client_id: CLIENT_HOMONYME,
        agence_id: agence.id,
        libelle: LIBELLE_SITE_HOMONYME,
        commune: COMMUNE_HOMONYME,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.site.deleteMany({
      where: { libelle: { startsWith: PREFIXE, mode: "insensitive" } },
    });
    await client.client.deleteMany({
      where: { raison_sociale: { startsWith: PREFIXE, mode: "insensitive" } },
    });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("l'alerte de doublon nomme l'homonyme (casse et accent différents), et la création reste possible", async ({
  page,
}) => {
  await page.goto("/clients/nouveau");
  // CASSE ET PONCTUATION DIFFÉRENTES, MÊME FORME NORMALISÉE (RG-IMP-05).
  await page
    .locator('input[name="raison_sociale"]')
    .fill(`${PREFIXE}garage   dupont (scène)`.toLowerCase());
  await page.locator('input[name="code_externe"]').focus();

  const alerte = page.getByRole("status").filter({
    hasText: fr["clients.homonymes.titre"],
  });
  await expect(alerte).toBeVisible();
  const lien = alerte.getByRole("link", { name: RAISON_HOMONYME });
  await expect(lien).toHaveAttribute("href", `/clients/${CLIENT_HOMONYME}`);
  await expect(alerte).toContainText(
    ligneHomonyme({
      id: CLIENT_HOMONYME,
      raison_sociale: RAISON_HOMONYME,
      commune: COMMUNE_HOMONYME,
      nombreSites: 1,
      actif: true,
    }),
  );

  // NON BLOQUANT (CS40) — la création reste possible malgré l'alerte.
  await page
    .getByRole("button", { name: fr["clients.action.creer_client"] })
    .click();
  await expect(page).toHaveURL(/\/clients\/[0-9a-f-]{36}\?/);
});

test("« Créer et ajouter un site » enchaîne sur /sites/nouveau, client prérempli, succès en vert", async ({
  page,
}) => {
  const raisonSociale = `${PREFIXE}Client enchaîné ${uuidv7().slice(0, 8)}`;
  await page.goto("/clients/nouveau");
  await page.locator('input[name="raison_sociale"]').fill(raisonSociale);
  await page.getByRole("button", { name: libelleCreerEtAjouterSite() }).click();

  await expect(page).toHaveURL(/\/sites\/nouveau\?client=/);
  const bandeauSucces = page.locator('[role="status"]').filter({
    hasText: fr["clients.cree"],
  });
  await expect(bandeauSucces).toBeVisible();

  // LE CLIENT EST PRÉREMPLI — le sélecteur affiche sa raison sociale.
  await expect(
    page.locator('[data-selecteur="client_id"] input[type="text"]'),
  ).toHaveValue(raisonSociale);

  // AUCUN SITE EXISTANT ENCORE POUR CE CLIENT TOUT JUSTE CRÉÉ.
  const colonne = page.locator("aside").filter({
    hasText: titreSitesExistants(),
  });
  await expect(colonne).toContainText(fr["sites.existants.aucun"]);
});

test("adresse, consignes et « sous contrat » sont enregistrés dès la création", async ({
  page,
}) => {
  await page.goto("/sites/nouveau");
  await choisirResultatParTexte(
    page,
    "client_id",
    RAISON_HOMONYME,
    RAISON_HOMONYME,
  );
  await page.locator('select[name="agence_id"]').selectOption({ index: 1 });
  const libelle = `${PREFIXE}Site complet ${uuidv7().slice(0, 8)}`;
  await page.locator('input[name="libelle"]').fill(libelle);
  await page.locator('input[name="adresse"]').fill("12 rue des Palmiers");
  await page
    .locator('textarea[name="consignes_acces"]')
    .fill("Badge requis à l'entrée");
  await page.getByLabel(fr["site.sous_contrat"]).check();

  await page.getByRole("button", { name: libelleCreerSite() }).click();
  await expect(page).toHaveURL(/\/sites\/[0-9a-f-]{36}/);
  const id = new URL(page.url()).pathname.split("/").pop();

  const base = admin();
  try {
    const fiche = await base.site.findUniqueOrThrow({
      where: { id },
      select: { adresse: true, consignes_acces: true, sous_contrat: true },
    });
    expect(fiche.adresse).toEqual({ rue: "12 rue des Palmiers" });
    expect(fiche.consignes_acces).toBe("Badge requis à l'entrée");
    expect(fiche.sous_contrat).toBe(true);
  } finally {
    await base.$disconnect();
  }
});

test("un refus (libellé vidé) garde l'adresse et les consignes saisies", async ({
  page,
}) => {
  await page.goto("/sites/nouveau");
  await choisirResultatParTexte(
    page,
    "client_id",
    RAISON_HOMONYME,
    RAISON_HOMONYME,
  );
  await page.locator('select[name="agence_id"]').selectOption({ index: 1 });
  await page.locator('input[name="adresse"]').fill("14 rue des Cocotiers");
  await page.locator('textarea[name="consignes_acces"]').fill("Chien sur site");
  // LE LIBELLÉ RESTE VIDE, EXPRÈS — `required` est retiré pour atteindre le
  // refus SERVEUR (même recette que la saisie gardée de 9BR).
  await page
    .locator('form[action="/api/sites/creer"]')
    .evaluate((formulaire) => {
      formulaire.querySelector('[name="libelle"]')?.removeAttribute("required");
    });

  await page.getByRole("button", { name: libelleCreerSite() }).click();
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(/\/sites\/nouveau\?/);
  await expect(page.locator('input[name="adresse"]')).toHaveValue(
    "14 rue des Cocotiers",
  );
  await expect(page.locator('textarea[name="consignes_acces"]')).toHaveValue(
    "Chien sur site",
  );
});

test("« Sites existants de ce client » liste le site de la scène", async ({
  page,
}) => {
  await page.goto(`/sites/nouveau?client=${CLIENT_HOMONYME}`);
  const colonne = page.locator("aside").filter({
    hasText: titreSitesExistants(),
  });
  await expect(
    colonne.getByRole("link", { name: LIBELLE_SITE_HOMONYME }),
  ).toHaveAttribute("href", `/sites/${SITE_HOMONYME}`);
  await expect(valeurChamp(page, "client_id")).toHaveValue(CLIENT_HOMONYME);
});
