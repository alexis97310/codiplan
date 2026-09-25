import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { ajouterMois } from "@/lib/vgp/information";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 91-VGP-4-REPRISE — LE REGISTRE COMMENCE PAR CE QUI EST EN RETARD.
 *
 * ## L'ARBITRAGE ÉPROUVÉ ICI (25/09/2026)
 *
 * `87-VGP-4` s'était arrêté sur une question : la maquette écrit « à faire
 * sous 30 jours », et rien — ni le chapitre 10, ni `docs/arbitrages.md` — n'a
 * jamais réglé ce délai (§8 du CLAUDE.md). L'arbitrage retient un ORDRE
 * plutôt qu'une fenêtre : le registre classe ses lignes par urgence
 * (dépassées les plus anciennes d'abord, puis à venir les plus proches), et
 * les KPI datés deviennent des liens vers `?etat=depassees` et `?etat=a_venir`
 * — le même critère non borné que chaque KPI compte déjà
 * (`trierParUrgence`, `echeanceEstAVenir`, `lib/vgp/registre.ts`).
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `VGP4-`
 *
 * Créée en `beforeAll`, supprimée en `afterAll` — AUCUNE ligne n'est ajoutée
 * au semis, même discipline que `tests/e2e/registre-3.spec.ts`. Une famille et
 * un modèle DÉDIÉS (assujettis, périodicité douze mois) plutôt que ceux du
 * semis, pour que les dates de vérification restent les SEULES variables : un
 * client, un site, quatre machines — une dépassée depuis PRÈS DE QUINZE ANS
 * (`derniereInformation` fixée à une date absolue, bien plus ancienne que
 * n'importe quelle donnée de démonstration ou d'une autre épreuve : c'est ce
 * qui garantit qu'elle reste la PLUS ancienne, quoi que le semis ou une
 * épreuve voisine écrivent), une dépassée depuis peu, une à échéance proche,
 * et une sans aucune information reçue.
 *
 * Les dates RELATIVES (`depasseeRecente`, `aVenir`) sont calculées depuis
 * `ajouterMois(new Date(), …)`, la même fonction que `lib/vgp/information.ts`
 * — jamais une durée réécrite ici (L9-05 ne porte que sur `lib/vgp/`, mais la
 * discipline vaut partout : une seule écriture du calcul).
 */

test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_VGP4 = uuidv7();
const SITE_VGP4 = uuidv7();
const FAMILLE_VGP4 = uuidv7();
const MODELE_VGP4 = uuidv7();
const MACHINE_DEPASSEE_ANCIENNE = uuidv7();
const MACHINE_DEPASSEE_RECENTE = uuidv7();
const MACHINE_A_VENIR = uuidv7();
const MACHINE_SANS_INFORMATION = uuidv7();
const VERIFICATION_DEPASSEE_ANCIENNE = uuidv7();
const VERIFICATION_DEPASSEE_RECENTE = uuidv7();
const VERIFICATION_A_VENIR = uuidv7();

const SN_DEPASSEE_ANCIENNE = fr["vgp4.e2e.numero_serie_depassee_ancienne"];
const SN_DEPASSEE_RECENTE = fr["vgp4.e2e.numero_serie_depassee_recente"];
const SN_A_VENIR = fr["vgp4.e2e.numero_serie_a_venir"];
const SN_SANS_INFORMATION = fr["vgp4.e2e.numero_serie_sans_information"];

const PERIODICITE_MOIS = 12;
// Absolue, et délibérément ANCIENNE (voir l'en-tête) : garantit la place de
// tête quelle que soit la date d'exécution de l'épreuve.
const DATE_VERIFICATION_ANCIENNE = new Date("2010-01-15T00:00:00Z");
// Relatives à AUJOURD'HUI, comme `prisma/seed.ts` le fait pour ses propres
// vérifications de démonstration.
const DATE_VERIFICATION_RECENTE = ajouterMois(new Date(), -13);
const DATE_VERIFICATION_A_VENIR = ajouterMois(new Date(), -11);

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const societeId = reperes.societeId;

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_VGP4,
        societe_id: societeId,
        raison_sociale: fr["vgp4.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_VGP4,
        societe_id: societeId,
        client_id: CLIENT_VGP4,
        agence_id: agence.id,
        libelle: fr["vgp4.e2e.site"],
      },
    });
    await client.familleMateriel.create({
      data: {
        id: FAMILLE_VGP4,
        societe_id: societeId,
        code: "VGP4-EPR",
        libelle: fr["vgp4.e2e.famille"],
        assujettissement_vgp: "soumis",
        vgp_periodicite_mois: PERIODICITE_MOIS,
        vgp_reference_texte: fr["vgp4.e2e.reference_texte"],
      },
    });
    await client.modeleMateriel.create({
      data: {
        id: MODELE_VGP4,
        societe_id: societeId,
        famille_id: FAMILLE_VGP4,
        marque: "VGP4",
        reference: fr["vgp4.e2e.modele"],
      },
    });

    for (const [machineId, serie] of [
      [MACHINE_DEPASSEE_ANCIENNE, SN_DEPASSEE_ANCIENNE],
      [MACHINE_DEPASSEE_RECENTE, SN_DEPASSEE_RECENTE],
      [MACHINE_A_VENIR, SN_A_VENIR],
      [MACHINE_SANS_INFORMATION, SN_SANS_INFORMATION],
    ] as const) {
      await client.machine.create({
        data: {
          id: machineId,
          societe_id: societeId,
          modele_id: MODELE_VGP4,
          client_id: CLIENT_VGP4,
          site_id: SITE_VGP4,
          numero_serie: serie,
          qr_token: engendrerJetonQr(),
        },
      });
    }

    for (const [verificationId, machineId, date] of [
      [
        VERIFICATION_DEPASSEE_ANCIENNE,
        MACHINE_DEPASSEE_ANCIENNE,
        DATE_VERIFICATION_ANCIENNE,
      ],
      [
        VERIFICATION_DEPASSEE_RECENTE,
        MACHINE_DEPASSEE_RECENTE,
        DATE_VERIFICATION_RECENTE,
      ],
      [VERIFICATION_A_VENIR, MACHINE_A_VENIR, DATE_VERIFICATION_A_VENIR],
    ] as const) {
      await client.vgpVerification.create({
        data: {
          id: verificationId,
          societe_id: societeId,
          machine_id: machineId,
          date_verification: date,
          organisme: "Organisme d'épreuve VGP-4",
          origine: "rapport_organisme",
        },
      });
    }
    // MACHINE_SANS_INFORMATION n'a AUCUNE ligne `vgpVerification` : c'est
    // exactement le cas `sans_information` que le registre doit dire.
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.vgpVerification.deleteMany({
      where: {
        id: {
          in: [
            VERIFICATION_DEPASSEE_ANCIENNE,
            VERIFICATION_DEPASSEE_RECENTE,
            VERIFICATION_A_VENIR,
          ],
        },
      },
    });
    await client.machine.deleteMany({
      where: {
        id: {
          in: [
            MACHINE_DEPASSEE_ANCIENNE,
            MACHINE_DEPASSEE_RECENTE,
            MACHINE_A_VENIR,
            MACHINE_SANS_INFORMATION,
          ],
        },
      },
    });
    await client.modeleMateriel.deleteMany({ where: { id: MODELE_VGP4 } });
    await client.familleMateriel.deleteMany({ where: { id: FAMILLE_VGP4 } });
    await client.site.deleteMany({ where: { client_id: CLIENT_VGP4 } });
    await client.client.deleteMany({ where: { id: CLIENT_VGP4 } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/91-VGP-4-REPRISE/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-1280.png`),
    fullPage: true,
  });
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("le KPI « Échéances dépassées » filtre le registre, et la plus ancienne dépassée vient en tête", async ({
  page,
}) => {
  await page.goto("/vgp");
  await page.getByRole("link", { name: fr["vgp.lien_kpi_en_retard"] }).click();
  await expect(page).toHaveURL(/\/vgp\?etat=depassees/);

  await expect(
    page.getByText(fr["vgp.filtre_depassees_actif"], { exact: true }),
  ).toBeVisible();

  // SEULES DES DÉPASSÉES : chaque ligne visible porte le libellé « Échéance
  // dépassée » — jamais « Information reçue » ni « Sans information ».
  const lignes = page.locator("table tbody tr");
  await expect(lignes.first()).toBeVisible();
  const libelles = await lignes
    .locator("span.rounded-\\[20px\\]")
    .allInnerTexts();
  expect(libelles.length).toBeGreaterThan(0);
  for (const libelle of libelles) {
    expect(libelle.trim()).toBe(fr["vgp.information.recue_echeance_depassee"]);
  }

  // Les deux machines dépassées de la scène sont dans la liste ; les deux
  // autres — à venir, sans information — n'y sont PAS.
  await expect(page.getByText(SN_DEPASSEE_ANCIENNE)).toBeVisible();
  await expect(page.getByText(SN_DEPASSEE_RECENTE)).toBeVisible();
  await expect(page.getByText(SN_A_VENIR)).toHaveCount(0);
  await expect(page.getByText(SN_SANS_INFORMATION)).toHaveCount(0);

  // LA PLUS ANCIENNE DÉPASSÉE EN TÊTE (l'arbitrage du 25/09/2026) : la
  // machine vérifiée en 2010 est, de très loin, la plus ancienne dépassée de
  // toute la base — semis et autres épreuves compris.
  await expect(lignes.first()).toContainText(SN_DEPASSEE_ANCIENNE);

  await capturer(page, "registre-filtre-depassees");
});

test("la recherche « q » filtre le registre par numéro de série, désignation ou client", async ({
  page,
}) => {
  // PAR NUMÉRO DE SÉRIE — une seule ligne, celle de la machine « à venir ».
  await page.goto(`/vgp?q=${encodeURIComponent(SN_A_VENIR)}`);
  await expect(page.getByText(SN_A_VENIR)).toBeVisible();
  await expect(page.getByText(SN_DEPASSEE_ANCIENNE)).toHaveCount(0);
  await expect(page.getByText(SN_SANS_INFORMATION)).toHaveCount(0);
  await capturer(page, "recherche-numero-serie");

  // PAR CLIENT — les QUATRE machines de la scène, aucune autre.
  await page.goto(`/vgp?q=${encodeURIComponent(fr["vgp4.e2e.client"])}`);
  for (const serie of [
    SN_DEPASSEE_ANCIENNE,
    SN_DEPASSEE_RECENTE,
    SN_A_VENIR,
    SN_SANS_INFORMATION,
  ]) {
    await expect(page.getByText(serie)).toBeVisible();
  }
  await expect(page.locator("table tbody tr")).toHaveCount(4);

  // PAR DÉSIGNATION (le modèle) — le même jeu de quatre machines.
  await page.goto(`/vgp?q=${encodeURIComponent(fr["vgp4.e2e.modele"])}`);
  await expect(page.locator("table tbody tr")).toHaveCount(4);
});
