import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { engendrerJetonQr } from "@/lib/machines/qr";
import { CLASSES_TON } from "@/lib/theme/statuts";

import { urlAdministration } from "./setup/base";
import {
  choisirResultatParTexte,
  valeurChamp,
} from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9BR-TP-A4b-MESSAGES — LES RÉUSSITES EN VERT, ET LA SAISIE GARDÉE APRÈS UN
 * REFUS, À TRAVERS L'ÉCRAN (CS17, PA-05, CS23, CS42).
 *
 * ## Ce que les tests unitaires ne peuvent pas prouver
 *
 * `tonDuMotifDeFiche` et les `versLeFormulaire`/`versLeRetour` des routes
 * sont éprouvés purs ailleurs (`tests/unit/`). Ce fichier prouve qu'un ÉCRAN
 * RÉEL rend le bon TON — classes du bandeau, pas seulement son texte — et
 * qu'un formulaire refusé relit réellement ce que la route a reporté dans
 * l'URL.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `TPA4-`
 *
 * Un client et une machine, créés en `beforeAll`, supprimés en `afterAll` —
 * aucune ligne ajoutée au semis. Les DEUX refus de ce fichier (client, site)
 * N'ÉCRIVENT RIEN : c'est tout le sens du constat CS23/CS42. Si l'un d'eux
 * écrivait par accident, la ligne créée est supprimée par son id, comme
 * l'exigent les gardes du lot.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_TPA4 = uuidv7();
const MACHINE_TPA4 = uuidv7();
const CODE_EXTERNE_DOUBLON = "TPA4-CODE-DOUBLON";
const RAISON_SOCIALE_SCENE = "TPA4-Client-scène (9BR)";

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
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
    });
    const cliente = await client.client.create({
      data: {
        id: CLIENT_TPA4,
        societe_id: societe.id,
        raison_sociale: RAISON_SOCIALE_SCENE,
        code_externe: CODE_EXTERNE_DOUBLON,
        actif: true,
      },
    });
    const site = await client.site.create({
      data: {
        id: uuidv7(),
        societe_id: societe.id,
        client_id: cliente.id,
        agence_id: agence.id,
        libelle: "TPA4-Site-scène (9BR)",
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_TPA4,
        societe_id: societe.id,
        modele_id: modele.id,
        client_id: cliente.id,
        site_id: site.id,
        numero_serie: "TPA4-SERIE-9BR",
        qr_token: engendrerJetonQr(),
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.machine.deleteMany({ where: { id: MACHINE_TPA4 } });
    await client.site.deleteMany({ where: { client_id: CLIENT_TPA4 } });
    await client.client.deleteMany({ where: { id: CLIENT_TPA4 } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

/* ── (d) LECTURE SEULE — LE TON DU BANDEAU ───────────────────────────────── */

test("une fiche client réussie se rend en vert, un refus reste en rouge", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT_TPA4}?motif=clients.modifie`);
  const bandeauSucces = page.locator('[data-motif="clients.modifie"]');
  await expect(bandeauSucces).toBeVisible();
  for (const classe of CLASSES_TON.succes.split(" ")) {
    await expect(bandeauSucces).toHaveClass(new RegExp(classe));
  }

  await page.goto(`/clients/${CLIENT_TPA4}?motif=client.refus.saisie`);
  const bandeauRefus = page.locator('[data-motif="client.refus.saisie"]');
  await expect(bandeauRefus).toBeVisible();
  for (const classe of CLASSES_TON.refus.split(" ")) {
    await expect(bandeauRefus).toHaveClass(new RegExp(classe));
  }
});

test("la fiche machine rend en vert le motif que la route émet après une création", async ({
  page,
}) => {
  await page.goto(`/parc/${MACHINE_TPA4}?motif=machine.creee`);
  const bandeau = page.locator('[data-motif="machine.creee"]');
  await expect(bandeau).toBeVisible();
  for (const classe of CLASSES_TON.succes.split(" ")) {
    await expect(bandeau).toHaveClass(new RegExp(classe));
  }
});

/* ── (c) LA SAISIE GARDÉE APRÈS UN REFUS ─────────────────────────────────── */

test("un client refusé (code externe en double) revient au formulaire, saisie gardée", async ({
  page,
}) => {
  const client = admin();
  const compteAvant = await client.client.count({
    where: { societe_id: (await sousLaSociete(client)).id },
  });

  await page.goto("/clients/nouveau");
  await page.locator('input[name="raison_sociale"]').fill("TPA4-Refus-Client");
  // LE DOUBLON EST LU DEPUIS LA SCÈNE, JAMAIS ÉCRIT EN DUR UNE SECONDE FOIS —
  // c'est le même `client.code_externe` posé en `beforeAll`.
  await page.locator('input[name="code_externe"]').fill(CODE_EXTERNE_DOUBLON);
  await page.locator('input[name="ridet"]').fill("TPA4-RIDET");
  await page.locator('input[name="categorie"]').fill("TPA4-Categorie");

  await page.getByRole("button", { name: fr["clients.action.creer"] }).click();
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(/\/clients\/nouveau\?/);
  await expect(page.getByRole("status")).toHaveAttribute(
    "data-motif",
    "client.refus.code_externe_en_double",
  );

  await expect(page.locator('input[name="raison_sociale"]')).toHaveValue(
    "TPA4-Refus-Client",
  );
  await expect(page.locator('input[name="code_externe"]')).toHaveValue(
    CODE_EXTERNE_DOUBLON,
  );
  await expect(page.locator('input[name="ridet"]')).toHaveValue("TPA4-RIDET");
  await expect(page.locator('input[name="categorie"]')).toHaveValue(
    "TPA4-Categorie",
  );

  try {
    const compteApres = await client.client.count({
      where: { societe_id: (await sousLaSociete(client)).id },
    });
    expect(compteApres).toBe(compteAvant);
    // GARDE-FOU — si le refus avait malgré tout écrit, la ligne forgée par ce
    // scénario (préfixe TPA4-Refus-) est retirée par son identité, jamais par
    // un décompte seul.
    await client.client.deleteMany({
      where: { raison_sociale: "TPA4-Refus-Client" },
    });
  } finally {
    await client.$disconnect();
  }
});

test("un site refusé (sans rattachement) revient au formulaire, client et libellé gardés", async ({
  page,
}) => {
  const client = admin();
  const compteAvant = await client.site.count({
    where: { client_id: CLIENT_TPA4 },
  });

  await page.goto("/sites/nouveau");
  await choisirResultatParTexte(
    page,
    "client_id",
    RAISON_SOCIALE_SCENE,
    RAISON_SOCIALE_SCENE,
  );
  await page.locator('input[name="libelle"]').fill("TPA4-Site-Refus");
  // AUCUN RATTACHEMENT CHOISI, EXPRÈS — c'est le refus qu'on éprouve
  // (D56) ; `required` est retiré pour atteindre le refus SERVEUR.
  await page
    .locator('form[action="/api/sites/creer"]')
    .evaluate((formulaire) => {
      formulaire
        .querySelector('[name="agence_id"]')
        ?.removeAttribute("required");
    });

  await page
    .locator("#contenu")
    .getByRole("button", { name: fr["sites.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(/\/sites\/nouveau\?/);
  await expect(page.getByRole("status")).toHaveAttribute(
    "data-motif",
    "site.refus.saisie",
  );

  await expect(valeurChamp(page, "client_id")).toHaveValue(CLIENT_TPA4);
  await expect(page.locator('input[name="libelle"]')).toHaveValue(
    "TPA4-Site-Refus",
  );

  try {
    const compteApres = await client.site.count({
      where: { client_id: CLIENT_TPA4 },
    });
    expect(compteApres).toBe(compteAvant);
    await client.site.deleteMany({
      where: { libelle: "TPA4-Site-Refus" },
    });
  } finally {
    await client.$disconnect();
  }
});

async function sousLaSociete(client: PrismaClient): Promise<{ id: string }> {
  return client.societe.findFirstOrThrow({
    where: { code: "CODIMA-NC" },
    select: { id: true },
  });
}
