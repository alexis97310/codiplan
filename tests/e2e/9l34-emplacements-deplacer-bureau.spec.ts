import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_EPREUVE, COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { SCENE_9L34 } from "./setup/scene-9l34";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9L34-EMPLACEMENTS-DEPLACER-BUREAU — « Déplacer la machine » réservé au
 * bureau, décision d'Alexis du 23/11/2026 (D280).
 *
 * ## Ce que ce fichier prouve
 *
 * La route qui déplace une machine refuse NOMMÉMENT un POST direct du
 * technicien — preuve de fond, puisque D221 (21/10/2026) ferme déjà TOUT le
 * back-office au technicien, `/parc/[id]` compris : `page.goto` y redirige
 * systématiquement vers `/terrain`, AVANT ce ticket comme après. Les deux
 * captures « bouton absent » (375/1280) montrent donc cette redirection, pas
 * la fiche elle-même — exactement ce que les captures du dossier `captures/`
 * nomment (`technicien-redirige-vers-terrain-*.png`) : le bouton est
 * doublement absent pour le technicien (D221 ferme l'écran, la nouvelle
 * garde fermerait le bouton si l'écran s'ouvrait un jour). L'ADV, qui n'a
 * jamais eu ce geste nommé À L'ÉCRAN avant ce ticket (il l'avait déjà par
 * `gerer_machine`, sans texte dédié dans la matrice), le garde désormais
 * sous son propre nom, `deplacer_machine` — la preuve que la route fonctionne
 * de bout en bout, pas seulement dans la matrice (`tests/unit/auth/
 * habilitations.test.ts`). AUCUN rôle qui atteint réellement `/parc/[id]`
 * (ADMS, DIR, RM, RS, ADV) ne voit son écran changer : les captures
 * `adv-fiche-*-deplacement-1280.png` sont quasi identiques avant/après,
 * display du site déplacé mis à part — ce ticket ne change rien à l'écran
 * d'aucun rôle qui l'atteint, seulement à l'autorisation SERVEUR.
 *
 * ## CE QUE CE FICHIER NE PROUVE PAS (blocage documenté, D280)
 *
 * Le bloc « Historique des emplacements » reste réservé à `admin_societe` et
 * `direction` : la décision d'Alexis du 23/11/2026 l'ouvre à tout rôle qui
 * voit la fiche, mais l'ouvrir en base exige d'élargir la politique RLS
 * `journal_audit_lecture` (migration `20260829120000_journal_audit`) — or ce
 * lot n'en pose aucune (consigne du ticket). Voir la passation du ticket et
 * `docs/arbitrages.md` (D280) pour la migration proposée.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9L34-`
 *
 * Un client, deux sites, une machine — même modèle que `scene-9l20.ts`,
 * jamais une famille forgée par l'épreuve (I9).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9L34 ?? "";

const CLIENT_9L34 = uuidv7();
const SITE_DEPART_9L34 = uuidv7();
const SITE_CIBLE_9L34 = uuidv7();
const MACHINE_9L34 = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.machine.deleteMany({ where: { id: MACHINE_9L34 } });
  await client.site.deleteMany({
    where: { id: { in: [SITE_DEPART_9L34, SITE_CIBLE_9L34] } },
  });
  await client.client.deleteMany({ where: { id: CLIENT_9L34 } });
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
        id: CLIENT_9L34,
        societe_id: reperes.societeId,
        raison_sociale: SCENE_9L34.raisonSociale,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_DEPART_9L34,
        societe_id: reperes.societeId,
        client_id: CLIENT_9L34,
        agence_id: agence.id,
        libelle: SCENE_9L34.libelleSiteDepart,
      },
    });
    await client.site.create({
      data: {
        id: SITE_CIBLE_9L34,
        societe_id: reperes.societeId,
        client_id: CLIENT_9L34,
        agence_id: agence.id,
        libelle: SCENE_9L34.libelleSiteCible,
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_9L34,
        societe_id: reperes.societeId,
        modele_id: modele.id,
        client_id: CLIENT_9L34,
        site_id: SITE_DEPART_9L34,
        numero_serie: "9L34-SN-DEPLACER-BUREAU",
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

test("le technicien ne voit pas « Déplacer la machine » — 375px", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.setViewportSize({ width: 375, height: 1200 });
  await page.goto(`/parc/${MACHINE_9L34}`);
  await expect(
    page.getByRole("button", { name: fr["machine.deplacer.bouton"] }),
  ).toHaveCount(0);
  await capturer(page, "9l34-fiche-technicien", 375, "apres");
});

test("le technicien ne voit pas « Déplacer la machine » — 1280px (bureau)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto(`/parc/${MACHINE_9L34}`);
  await expect(
    page.getByRole("button", { name: fr["machine.deplacer.bouton"] }),
  ).toHaveCount(0);
  await capturer(page, "9l34-fiche-technicien", 1280, "apres");
});

test("le technicien refusé NOMMÉMENT par un POST direct — rien n'est écrit", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/parc/${MACHINE_9L34}`);

  const reponse = await page.request.post(
    `/api/machines/${MACHINE_9L34}/deplacer`,
    {
      form: { nouveau_site_id: SITE_CIBLE_9L34 },
      maxRedirects: 0,
    },
  );
  expect(reponse.status()).toBe(303);
  expect(reponse.headers()["location"]).toContain("motif=auth.refus_droit");

  const client = admin();
  try {
    const fiche = await client.machine.findUniqueOrThrow({
      where: { id: MACHINE_9L34 },
      select: { site_id: true },
    });
    expect(fiche.site_id).toBe(SITE_DEPART_9L34);
  } finally {
    await client.$disconnect();
  }
});

test("l'ADV déplace la machine — 1280px (bureau, D280)", async ({ page }) => {
  await ouvrirLaSessionSensible(page, COMPTE_EPREUVE);
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.goto(`/parc/${MACHINE_9L34}`);
  await capturer(page, "9l34-fiche-adv", 1280, "avant");

  await page
    .getByRole("button", { name: fr["machine.deplacer.bouton"] })
    .click();
  const dialogue = page.locator("dialog[open]");
  await expect(dialogue).toBeVisible();
  await choisirResultatParTexte(
    dialogue,
    "nouveau_site_id",
    SCENE_9L34.libelleSiteCible,
    SCENE_9L34.libelleSiteCible,
  );
  await dialogue
    .getByRole("button", { name: fr["machine.deplacer.bouton"] })
    .click();

  await expect(page).toHaveURL(new RegExp(`/parc/${MACHINE_9L34}(\\?|$)`));
  await expect(page.getByText(fr["machine.deplacer.reussi"])).toBeVisible();
  await capturer(page, "9l34-fiche-adv", 1280, "apres");

  const client = admin();
  try {
    const fiche = await client.machine.findUniqueOrThrow({
      where: { id: MACHINE_9L34 },
      select: { site_id: true },
    });
    expect(fiche.site_id).toBe(SITE_CIBLE_9L34);
  } finally {
    await client.$disconnect();
  }
});
