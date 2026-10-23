import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * 9G10-SCANNER-QR-APPLI (D144 d'Alexis) — LE LECTEUR DE QR, DE BOUT EN BOUT.
 *
 * ## PAR LE CHAMP « SAISIR LE CODE », JAMAIS UNE CAMÉRA SIMULÉE
 *
 * Le ticket admet ce repli quand monter `--use-fake-device-for-media-stream`
 * + `--use-file-for-fake-video-capture` ne se fait pas proprement : il
 * aurait fallu fabriquer une VIDÉO d'un QR (le jeton lui-même, tiré au sort à
 * chaque exécution du semis, `prisma/seed.ts`) et la rejouer devant une
 * caméra simulée de Chromium — fragile et long à régler pour ce que ça
 * prouverait DE PLUS que le champ : `components/machines/scanner-qr.tsx`
 * (épreuve unitaire) couvre déjà que le décodage, lui, fonctionne. Ce qu'une
 * épreuve de bout en bout doit prouver ici, et que rien d'autre ne prouve,
 * c'est la CHAÎNE : l'écran réel, l'action serveur réelle, la vraie session,
 * la vraie redirection.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9G10-`
 *
 * Trois machines forgées en `beforeAll`, supprimées en `afterAll` — aucune
 * ligne au semis (I9). Le client, le site et le technicien sont empruntés
 * (le technicien en LECTURE SEULE, même identité que les scénarios voisins
 * de sa famille) ; machines et intervention sont POSÉES ici, jamais
 * partagées avec un autre fichier.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function ouvrirLeScannerBureau(page: Page): Promise<void> {
  await ouvrirUneSession(page);
  await page.goto("/parc/scanner");
}

async function ouvrirLeScannerTerrain(page: Page): Promise<void> {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto("/scanner");
}

async function saisirEtValider(page: Page, jeton: string): Promise<void> {
  await page.getByLabel(fr["machine.scanner.saisie_label"]).fill(jeton);
  await page
    .getByRole("button", { name: fr["machine.scanner.saisie_bouton"] })
    .click();
}

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const MACHINE_BUREAU_ID = uuidv7();
const MACHINE_DANS_LE_PERIMETRE_ID = uuidv7();
const MACHINE_HORS_PERIMETRE_ID = uuidv7();
const INTERVENTION_ID = uuidv7();

const JETON_BUREAU = engendrerJetonQr();
const JETON_DANS_LE_PERIMETRE = engendrerJetonQr();
const JETON_HORS_PERIMETRE = engendrerJetonQr();
const JETON_INCONNU = engendrerJetonQr();

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: reperes.societeId },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: "9G10 — Client de l'épreuve",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "9G10 — Site de l'épreuve",
      },
    });
    await client.machine.createMany({
      data: [
        {
          id: MACHINE_BUREAU_ID,
          societe_id: reperes.societeId,
          modele_id: modele.id,
          client_id: CLIENT_ID,
          site_id: SITE_ID,
          numero_serie: "9G10-BUREAU",
          qr_token: JETON_BUREAU,
        },
        {
          id: MACHINE_DANS_LE_PERIMETRE_ID,
          societe_id: reperes.societeId,
          modele_id: modele.id,
          client_id: CLIENT_ID,
          site_id: SITE_ID,
          numero_serie: "9G10-DANS",
          qr_token: JETON_DANS_LE_PERIMETRE,
        },
        {
          id: MACHINE_HORS_PERIMETRE_ID,
          societe_id: reperes.societeId,
          modele_id: modele.id,
          client_id: CLIENT_ID,
          site_id: SITE_ID,
          numero_serie: "9G10-HORS",
          qr_token: JETON_HORS_PERIMETRE,
        },
      ],
    });
    // L'INTERVENTION EN COURS, affectée au technicien du semis, SUR LA
    // MACHINE « DANS LE PÉRIMÈTRE » seulement — l'autre machine n'en a
    // aucune : c'est exactement ce qui doit rendre « hors de son périmètre ».
    await client.intervention.create({
      data: {
        id: INTERVENTION_ID,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        priorite: "p3",
        statut: "affectee",
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9G10 — intervention forgée par l'épreuve",
      },
    });
    await client.interventionMachine.create({
      data: {
        id: uuidv7(),
        societe_id: reperes.societeId,
        intervention_id: INTERVENTION_ID,
        machine_id: MACHINE_DANS_LE_PERIMETRE_ID,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.intervention.deleteMany({ where: { id: INTERVENTION_ID } });
    await client.machine.deleteMany({
      where: {
        id: {
          in: [
            MACHINE_BUREAU_ID,
            MACHINE_DANS_LE_PERIMETRE_ID,
            MACHINE_HORS_PERIMETRE_ID,
          ],
        },
      },
    });
    await client.site.deleteMany({ where: { id: SITE_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

test("bureau — le code saisi ouvre directement la fiche machine", async ({
  page,
}) => {
  await ouvrirLeScannerBureau(page);
  await saisirEtValider(page, JETON_BUREAU);
  await expect(page).toHaveURL(new RegExp(`/parc/${MACHINE_BUREAU_ID}$`));
});

test("terrain — technicien DANS le périmètre, la fiche de l'intervention en cours s'ouvre", async ({
  page,
}) => {
  await ouvrirLeScannerTerrain(page);
  await saisirEtValider(page, JETON_DANS_LE_PERIMETRE);
  await expect(page).toHaveURL(new RegExp(`/terrain/${INTERVENTION_ID}$`));
});

test("terrain — technicien HORS périmètre, un message, aucune donnée", async ({
  page,
}) => {
  await ouvrirLeScannerTerrain(page);
  await saisirEtValider(page, JETON_HORS_PERIMETRE);
  await expect(page).toHaveURL(/\/scanner$/);
  await expect(
    page.getByText(fr["machine.scanner.hors_perimetre"]),
  ).toBeVisible();
});

test("jeton inconnu — « QR non reconnu », côté bureau comme côté terrain", async ({
  page,
}) => {
  await ouvrirLeScannerBureau(page);
  await saisirEtValider(page, JETON_INCONNU);
  await expect(page).toHaveURL(/\/parc\/scanner$/);
  await expect(page.getByText(fr["machine.scanner.non_reconnu"])).toBeVisible();

  // Changement d'identité sur la même page : `/connexion` redirige un compte
  // DÉJÀ connecté (voir `app/(sans-session)/connexion/page.tsx`) plutôt que
  // de lui redemander ses identifiants — sans ce nettoyage, le champ
  // « Adresse électronique » n'apparaît jamais.
  await page.context().clearCookies();

  await ouvrirLeScannerTerrain(page);
  await saisirEtValider(page, JETON_INCONNU);
  await expect(page).toHaveURL(/\/scanner$/);
  await expect(page.getByText(fr["machine.scanner.non_reconnu"])).toBeVisible();
});
