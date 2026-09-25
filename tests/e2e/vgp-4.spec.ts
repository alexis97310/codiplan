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
 * 96-VGP-4-REPRISE-2 — LE REGISTRE COMMENCE PAR CE QUI EST EN RETARD.
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
 * ## LA LEÇON DE `91-VGP-4-REPRISE` — RECALÉE DEUX FOIS
 *
 * La première version de cette épreuve forgeait DEUX échéances dépassées
 * dans la société PARTAGÉE (`CODIMA-NC`) pour prouver « la plus ancienne en
 * tête ». `fullyParallel` fait tourner `tests/e2e/vgp-retard-visible.spec.ts`
 * en même temps : sa tuile « VGP à prévoir » attend « 1 échéance dépassée »
 * (le semis n'en porte qu'UNE, `NUS-SPL-2022-0007`) et en lisait TROIS.
 *
 * **Cette version ne forge donc AUCUNE échéance dépassée.** La preuve
 * « la plus ancienne dépassée en tête » s'appuie sur la dépassée que le
 * semis porte déjà — lue ici, jamais modifiée. Ce que cette épreuve forge —
 * une échéance à venir, une recherche `q` — porte une échéance à PLUS de
 * trente jours, hors de l'horizon de la tuile (`HORIZON_VGP_JOURS`,
 * `app/(back-office)/tableau-de-bord/page.tsx`), pour ne changer AUCUN
 * compte lu par une autre épreuve dans la société partagée.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `VGP4-`
 *
 * Créée en `beforeAll`, supprimée en `afterAll` — AUCUNE ligne n'est ajoutée
 * au semis, même discipline que `tests/e2e/registre-3.spec.ts`. Une famille
 * et un modèle DÉDIÉS (assujettis, périodicité douze mois) plutôt que ceux
 * du semis : un client, un site, deux machines — une à échéance lointaine
 * (bien au-delà de trente jours), et une sans aucune information reçue.
 *
 * La date RELATIVE de l'échéance à venir est calculée depuis
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
const MACHINE_A_VENIR = uuidv7();
const MACHINE_SANS_INFORMATION = uuidv7();
const VERIFICATION_A_VENIR = uuidv7();

const SN_A_VENIR = fr["vgp4.e2e.numero_serie_a_venir"];
const SN_SANS_INFORMATION = fr["vgp4.e2e.numero_serie_sans_information"];

/**
 * La dépassée que le SEMIS porte déjà (`prisma/seed-data.ts`,
 * `VERIFICATIONS_VGP_DEMONSTRATION`, rang 2) — lue ici, jamais modifiée, et
 * jamais créée ni supprimée par cette épreuve. C'est la SEULE échéance
 * dépassée de la société `CODIMA-NC` : `tests/e2e/vgp-retard-visible.spec.ts`
 * en attend exactement une à l'accueil.
 */
const MACHINE_DEPASSEE_DU_SEMIS = "NUS-SPL-2022-0007";

const PERIODICITE_MOIS = 12;
// Relative à AUJOURD'HUI, comme `prisma/seed.ts` le fait pour ses propres
// vérifications de démonstration. Vérifiée il y a six mois, avec une
// périodicité de douze mois, l'échéance tombe dans six mois — bien au-delà
// des trente jours de `HORIZON_VGP_JOURS` : elle n'entre ni dans la tuile
// « dépassées », ni dans la tuile « à venir sous 30 jours » du tableau de
// bord.
const DATE_VERIFICATION_A_VENIR = ajouterMois(new Date(), -6);

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

    await client.vgpVerification.create({
      data: {
        id: VERIFICATION_A_VENIR,
        societe_id: societeId,
        machine_id: MACHINE_A_VENIR,
        date_verification: DATE_VERIFICATION_A_VENIR,
        organisme: "Organisme d'épreuve VGP-4",
        origine: "rapport_organisme",
      },
    });
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
      where: { id: VERIFICATION_A_VENIR },
    });
    await client.machine.deleteMany({
      where: { id: { in: [MACHINE_A_VENIR, MACHINE_SANS_INFORMATION] } },
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
  "docs/propositions/96-VGP-4-REPRISE-2/captures",
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

test("le KPI « Échéances dépassées » filtre le registre sur la seule dépassée du semis, en tête", async ({
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

  // Les deux machines de cette scène n'ont AUCUNE échéance dépassée — ni
  // l'une ni l'autre n'apparaît dans ce filtre.
  await expect(page.getByText(SN_A_VENIR)).toHaveCount(0);
  await expect(page.getByText(SN_SANS_INFORMATION)).toHaveCount(0);

  // LA SEULE DÉPASSÉE DE LA SOCIÉTÉ EST CELLE DU SEMIS (lue, jamais
  // modifiée) : elle est donc, nécessairement, en tête — l'arbitrage du
  // 25/09/2026 sur le tri par urgence.
  await expect(
    lignes.filter({ hasText: MACHINE_DEPASSEE_DU_SEMIS }),
  ).toHaveCount(1);
  await expect(lignes).toHaveCount(1);
  await expect(lignes.first()).toContainText(MACHINE_DEPASSEE_DU_SEMIS);

  await capturer(page, "registre-filtre-depassees");
});

test("la recherche « q » filtre le registre par numéro de série, désignation ou client", async ({
  page,
}) => {
  // PAR NUMÉRO DE SÉRIE — une seule ligne, celle de la machine « à venir ».
  await page.goto(`/vgp?q=${encodeURIComponent(SN_A_VENIR)}`);
  await expect(page.getByText(SN_A_VENIR)).toBeVisible();
  await expect(page.getByText(SN_SANS_INFORMATION)).toHaveCount(0);
  await capturer(page, "recherche-numero-serie");

  // PAR CLIENT — les DEUX machines de la scène, aucune autre.
  await page.goto(`/vgp?q=${encodeURIComponent(fr["vgp4.e2e.client"])}`);
  for (const serie of [SN_A_VENIR, SN_SANS_INFORMATION]) {
    await expect(page.getByText(serie)).toBeVisible();
  }
  await expect(page.locator("table tbody tr")).toHaveCount(2);

  // PAR DÉSIGNATION (le modèle) — le même jeu de deux machines.
  await page.goto(`/vgp?q=${encodeURIComponent(fr["vgp4.e2e.modele"])}`);
  await expect(page.locator("table tbody tr")).toHaveCount(2);
});
