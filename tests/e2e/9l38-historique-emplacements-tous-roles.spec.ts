import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { COMPTE_EPREUVE, COMPTE_RM_EPREUVE } from "./setup/scene";
import { SCENE_9L38 } from "./setup/scene-9l38";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9L38-HISTORIQUE-EMPLACEMENTS-TOUS-ROLES — seconde moitié de D280, livrée
 * par D283 : « Historique des emplacements » s'ouvre à tout rôle qui voit la
 * fiche machine, sans élargir le journal d'audit entier.
 *
 * ## Ce que `tests/isolation/9l20-deplacer-machine.test.ts` ne peut pas prouver
 *
 * L'isolation prouve que le DÉPÔT (`historiqueDesEmplacements`) rend les
 * bonnes lignes au rôle RM/RS/ADV. Elle ne prouve pas que l'ÉCRAN affiche
 * réellement le bloc à ce rôle, aux deux largeurs — c'est ce fichier qui le
 * fait, avec RM : un rôle qui n'avait JAMAIS vu ce bloc avant ce lot, et qui
 * n'a posé AUCUN déplacement lui-même (ADV le fait, RM se contente de lire).
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9L38-`
 *
 * Un client, deux sites, une machine — même modèle que `scene-9l34.ts`.
 * SÉRIEL : le second test lit l'historique que le premier vient d'écrire.
 *
 * ## CAPTURES (consigne permanente d'Alexis)
 *
 * `CAPTURES_9L38` pose le dossier de sortie — absent, aucune capture n'est
 * prise.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9L38 ?? "";

const CLIENT_9L38 = uuidv7();
const SITE_DEPART_9L38 = uuidv7();
const SITE_CIBLE_9L38 = uuidv7();
const MACHINE_9L38 = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.machine.deleteMany({ where: { id: MACHINE_9L38 } });
  await client.site.deleteMany({
    where: { id: { in: [SITE_DEPART_9L38, SITE_CIBLE_9L38] } },
  });
  await client.client.deleteMany({ where: { id: CLIENT_9L38 } });
}

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
  periode: "avant" | "apres",
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${periode}-${largeur}.png`),
    fullPage: true,
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    await nettoyer(client);
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: reperes.societeId, famille: { code: "PONT-ELEV" } },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9L38,
        societe_id: reperes.societeId,
        raison_sociale: SCENE_9L38.raisonSociale,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_DEPART_9L38,
        societe_id: reperes.societeId,
        client_id: CLIENT_9L38,
        agence_id: agence.id,
        libelle: SCENE_9L38.libelleSiteDepart,
      },
    });
    await client.site.create({
      data: {
        id: SITE_CIBLE_9L38,
        societe_id: reperes.societeId,
        client_id: CLIENT_9L38,
        agence_id: agence.id,
        libelle: SCENE_9L38.libelleSiteCible,
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_9L38,
        societe_id: reperes.societeId,
        modele_id: modele.id,
        client_id: CLIENT_9L38,
        site_id: SITE_DEPART_9L38,
        numero_serie: "9L38-SN-HISTORIQUE-EMPLACEMENTS",
        qr_token: uuidv7(),
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

test("l'ADV déplace la machine, puis voit l'historique sur sa propre fiche — 1280px", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_EPREUVE);
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto(`/parc/${MACHINE_9L38}`);
  await capturer(page, "9l38-fiche-adv", 1280, "avant");

  await page
    .getByRole("button", { name: fr["machine.deplacer.bouton"] })
    .click();
  const dialogue = page.locator("dialog[open]");
  await choisirResultatParTexte(
    dialogue,
    "nouveau_site_id",
    SCENE_9L38.libelleSiteCible,
    SCENE_9L38.libelleSiteCible,
  );
  await dialogue
    .getByRole("button", { name: fr["machine.deplacer.bouton"] })
    .click();

  await expect(page).toHaveURL(new RegExp(`/parc/${MACHINE_9L38}(\\?|$)`));
  await expect(
    page.getByText(fr["machine.fiche.emplacements_titre"]),
  ).toBeVisible();
  await expect(
    page
      .getByText(SCENE_9L38.libelleSiteDepart)
      .and(page.locator(":visible"))
      .first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(SCENE_9L38.libelleSiteCible)
      .and(page.locator(":visible"))
      .first(),
  ).toBeVisible();
  await capturer(page, "9l38-fiche-adv", 1280, "apres");
});

for (const largeur of [1280, 375]) {
  test(`responsable matériel (D283) : lit l'historique sans l'avoir posé — ${largeur}px`, async ({
    page,
  }) => {
    await ouvrirLaSessionSensible(page, COMPTE_RM_EPREUVE);
    await page.setViewportSize({ width: largeur, height: 1200 });
    await capturer(page, "9l38-fiche-rm", largeur, "avant");
    await page.goto(`/parc/${MACHINE_9L38}`);

    // AVANT D283, ce bloc était ABSENT pour `responsable_materiel` — il n'a
    // pas `consulter_journal_audit`. Il est désormais VISIBLE, et montre le
    // déplacement que l'ADV a posé ci-dessus, sans que RM n'ait rien écrit.
    await expect(
      page.getByText(fr["machine.fiche.emplacements_titre"]),
    ).toBeVisible();
    await expect(
      page
        .getByText(SCENE_9L38.libelleSiteDepart)
        .and(page.locator(":visible"))
        .first(),
    ).toBeVisible();
    await expect(
      page
        .getByText(SCENE_9L38.libelleSiteCible)
        .and(page.locator(":visible"))
        .first(),
    ).toBeVisible();
    await capturer(page, "9l38-fiche-rm", largeur, "apres");
  });
}
