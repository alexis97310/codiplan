import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { decompte } from "@/app/(back-office)/presentation";
import { ajouterMois } from "@/lib/vgp/information";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9DP-TP-VGP2-REGISTRE — PV-32, PV-37, QE-13d, D122, MO-12, ÉPROUVÉS SUR LA
 * VRAIE SUITE.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `VGP2REG-`
 *
 * Créée en `beforeAll`, supprimée en `afterAll` — aucune ligne n'est ajoutée
 * au semis (même discipline que `vgp-4.spec.ts`). DEUX clients : `CLIENT_X`
 * (deux sites, pour le filtre Site et la recherche par commune) et
 * `CLIENT_Y` (un site), nécessaire pour éprouver que le regroupement « par
 * client » et l'impression isolent bien UN SEUL groupe parmi plusieurs.
 *
 * Toutes les épreuves qui comptent passent par `q=VGP2REG-` : jamais un
 * compte global, qui romprait sous `fullyParallel` (piège nommé par le
 * ticket).
 */

test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_X = uuidv7();
const SITE_X1 = uuidv7();
const SITE_X2 = uuidv7();
const CLIENT_Y = uuidv7();
const SITE_Y1 = uuidv7();
const FAMILLE = uuidv7();
const MODELE = uuidv7();
const MACHINE_X1 = uuidv7();
const MACHINE_X2 = uuidv7();
const MACHINE_Y1 = uuidv7();
// V2 (addendum 9DX-RETOUCHES-11 → relecture du 05/10, QE-13b) — la seule
// machine de la scène dont l'échéance est DÉPASSÉE : sans elle, la tuile
// « Échéances dépassées » n'ouvre jamais de liste sur cette fixture.
const MACHINE_X3 = uuidv7();
const VERIFICATION_X2 = uuidv7();
const VERIFICATION_X3 = uuidv7();

const SN_X1 = fr["vgp2registre.e2e.numero_serie_x1"];
const SN_X2 = fr["vgp2registre.e2e.numero_serie_x2"];
const SN_Y1 = fr["vgp2registre.e2e.numero_serie_y1"];
const SN_X3 = fr["vgp2registre.e2e.numero_serie_x3"];

const PERIODICITE_MOIS = 12;
/** Vérifiée il y a un mois, périodicité douze mois : échéance dans onze mois — « à venir », loin au-delà de 30 jours. */
const DATE_VERIFICATION_X2 = ajouterMois(new Date(), -1);
/** Vérifiée il y a quatorze mois, périodicité douze mois : échéance dépassée depuis deux mois. */
const DATE_VERIFICATION_X3 = ajouterMois(new Date(), -14);

const PREFIXE_RECHERCHE = "VGP2REG-";

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
        id: CLIENT_X,
        societe_id: societeId,
        raison_sociale: fr["vgp2registre.e2e.client_x"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_X1,
        societe_id: societeId,
        client_id: CLIENT_X,
        agence_id: agence.id,
        libelle: fr["vgp2registre.e2e.lieu_x1"],
      },
    });
    await client.site.create({
      data: {
        id: SITE_X2,
        societe_id: societeId,
        client_id: CLIENT_X,
        agence_id: agence.id,
        libelle: fr["vgp2registre.e2e.lieu_x2"],
        commune: fr["vgp2registre.e2e.commune_x2"],
      },
    });
    await client.client.create({
      data: {
        id: CLIENT_Y,
        societe_id: societeId,
        raison_sociale: fr["vgp2registre.e2e.client_y"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_Y1,
        societe_id: societeId,
        client_id: CLIENT_Y,
        agence_id: agence.id,
        libelle: fr["vgp2registre.e2e.lieu_y1"],
      },
    });
    await client.familleMateriel.create({
      data: {
        id: FAMILLE,
        societe_id: societeId,
        code: "VGP2REG-EPR",
        libelle: fr["vgp2registre.e2e.famille"],
        assujettissement_vgp: "soumis",
        vgp_periodicite_mois: PERIODICITE_MOIS,
        vgp_reference_texte: fr["vgp2registre.e2e.reference_texte"],
      },
    });
    await client.modeleMateriel.create({
      data: {
        id: MODELE,
        societe_id: societeId,
        famille_id: FAMILLE,
        marque: fr["vgp2registre.e2e.marque"],
        reference: fr["vgp2registre.e2e.reference"],
      },
    });

    await client.machine.create({
      data: {
        id: MACHINE_X1,
        societe_id: societeId,
        modele_id: MODELE,
        client_id: CLIENT_X,
        site_id: SITE_X1,
        numero_serie: SN_X1,
        qr_token: engendrerJetonQr(),
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_X2,
        societe_id: societeId,
        modele_id: MODELE,
        client_id: CLIENT_X,
        site_id: SITE_X2,
        numero_serie: SN_X2,
        qr_token: engendrerJetonQr(),
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_Y1,
        societe_id: societeId,
        modele_id: MODELE,
        client_id: CLIENT_Y,
        site_id: SITE_Y1,
        numero_serie: SN_Y1,
        qr_token: engendrerJetonQr(),
      },
    });
    // V2 — MACHINE_X3 (CLIENT_X, SITE_X1), la seule « échéance dépassée ».
    await client.machine.create({
      data: {
        id: MACHINE_X3,
        societe_id: societeId,
        modele_id: MODELE,
        client_id: CLIENT_X,
        site_id: SITE_X1,
        numero_serie: SN_X3,
        qr_token: engendrerJetonQr(),
      },
    });

    await client.vgpVerification.create({
      data: {
        id: VERIFICATION_X2,
        societe_id: societeId,
        machine_id: MACHINE_X2,
        date_verification: DATE_VERIFICATION_X2,
        organisme: "Organisme d'épreuve VGP2REG",
        origine: "rapport_organisme",
      },
    });
    await client.vgpVerification.create({
      data: {
        id: VERIFICATION_X3,
        societe_id: societeId,
        machine_id: MACHINE_X3,
        date_verification: DATE_VERIFICATION_X3,
        organisme: "Organisme d'épreuve VGP2REG",
        origine: "rapport_organisme",
      },
    });
    // MACHINE_X1 et MACHINE_Y1 n'ont AUCUNE ligne `vgpVerification` :
    // « sans information », le cas ordinaire du registre.
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.vgpVerification.deleteMany({
      where: { id: { in: [VERIFICATION_X2, VERIFICATION_X3] } },
    });
    await client.machine.deleteMany({
      where: { id: { in: [MACHINE_X1, MACHINE_X2, MACHINE_Y1, MACHINE_X3] } },
    });
    await client.modeleMateriel.deleteMany({ where: { id: MODELE } });
    await client.familleMateriel.deleteMany({ where: { id: FAMILLE } });
    await client.site.deleteMany({
      where: { id: { in: [SITE_X1, SITE_X2, SITE_Y1] } },
    });
    await client.client.deleteMany({
      where: { id: { in: [CLIENT_X, CLIENT_Y] } },
    });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("le titre et les deux onglets (QE-13d) — « Familles à déterminer » mène à /vgp/a-determiner", async ({
  page,
}) => {
  await page.goto("/vgp");
  await expect(
    page.getByRole("heading", { name: fr["vgp.titre"], exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: fr["vgp.onglet.registre"], exact: true }),
  ).toHaveAttribute("aria-current", "page");
  // SANS `exact` : cet onglet porte aussi le compte des familles (badge),
  // concaténé au nom accessible du lien.
  await page.getByRole("link", { name: fr["vgp.indetermines.titre"] }).click();
  await expect(page).toHaveURL(/\/vgp\/a-determiner/);
});

test("la ligne du registre affiche marque et référence du modèle (PV-37)", async ({
  page,
}) => {
  await page.goto(`/vgp?q=${encodeURIComponent(PREFIXE_RECHERCHE)}`);
  // LES TROIS MACHINES DE LA SCÈNE PARTAGENT LE MÊME MODÈLE : la preuve
  // n'a besoin que d'UNE occurrence visible, jamais de leur compte.
  await expect(
    page
      .getByText(
        `${fr["vgp2registre.e2e.marque"]} ${fr["vgp2registre.e2e.reference"]}`,
        { exact: false },
      )
      .first(),
  ).toBeVisible();
});

test("la recherche correspond par marque, et par commune du site (PV-37)", async ({
  page,
}) => {
  await page.goto(
    `/vgp?q=${encodeURIComponent(fr["vgp2registre.e2e.marque"])}`,
  );
  await expect(page.getByText(SN_X1)).toBeVisible();
  await expect(page.getByText(SN_X2)).toBeVisible();
  await expect(page.getByText(SN_Y1)).toBeVisible();

  await page.goto(
    `/vgp?q=${encodeURIComponent(fr["vgp2registre.e2e.commune_x2"])}`,
  );
  await expect(page.getByText(SN_X2)).toBeVisible();
  await expect(page.getByText(SN_X1)).toHaveCount(0);
  await expect(page.getByText(SN_Y1)).toHaveCount(0);
});

test("la tuile « Échéances à venir » mène au même filtre, et le compte scopé à la recherche correspond (D140)", async ({
  page,
}) => {
  await page.goto(
    `/vgp?q=${encodeURIComponent(fr["vgp2registre.e2e.marque"])}`,
  );
  const tuile = page.locator('[data-bloc="kpi-sous-30-jours"]');
  await expect(tuile).toBeVisible();
  await tuile.getByRole("link").click();
  await expect(page).toHaveURL(/etat=a_venir/);
  // LE PARAMÈTRE `q` N'EST PAS PORTÉ PAR LA TUILE (comportement déjà en
  // place avant ce lot, inchangé) : on le repose pour scoper le compte.
  await page.goto(
    `/vgp?etat=a_venir&q=${encodeURIComponent(fr["vgp2registre.e2e.marque"])}`,
  );
  await expect(page.getByText(SN_X2)).toBeVisible();
  // Seule MACHINE_X2 porte une échéance à venir parmi les quatre de la scène.
  await expect(page.getByText(SN_X1)).toHaveCount(0);
  await expect(page.getByText(SN_Y1)).toHaveCount(0);
  await expect(page.getByText(SN_X3)).toHaveCount(0);
  await expect(
    page.getByText(decompte(1, fr["parc.total_un"], fr["parc.total"]), {
      exact: true,
    }),
  ).toBeVisible();
});

/**
 * V2 (addendum 9DX-RETOUCHES-11 → relecture du 05/10, QE-13b) — LES DEUX
 * AUTRES TUILES CLIQUABLES, MÊME ÉGALITÉ : le chiffre que la tuile promet
 * (ici, le nombre de machines que la fixture pose dans cet état) est
 * exactement celui que la liste ouverte, scopée à la fixture, affiche.
 * Jamais un compte sur la base partagée entière — `q=marque`/`q=PREFIXE_RECHERCHE`
 * restent le seul filtre qui compte ici, comme la tuile « à venir » ci-dessus.
 */
test("la tuile « Échéances dépassées » mène au même filtre, et le compte scopé à la recherche correspond (D140, QE-13b)", async ({
  page,
}) => {
  await page.goto(
    `/vgp?q=${encodeURIComponent(fr["vgp2registre.e2e.marque"])}`,
  );
  const tuile = page.locator('[data-bloc="kpi-en-retard"]');
  await expect(tuile).toBeVisible();
  await tuile.getByRole("link").click();
  await expect(page).toHaveURL(/etat=depassees/);
  await page.goto(
    `/vgp?etat=depassees&q=${encodeURIComponent(fr["vgp2registre.e2e.marque"])}`,
  );
  // Seule MACHINE_X3 porte une échéance dépassée parmi les quatre de la scène.
  await expect(page.getByText(SN_X3)).toBeVisible();
  await expect(page.getByText(SN_X1)).toHaveCount(0);
  await expect(page.getByText(SN_X2)).toHaveCount(0);
  await expect(page.getByText(SN_Y1)).toHaveCount(0);
  await expect(
    page.getByText(decompte(1, fr["parc.total_un"], fr["parc.total"]), {
      exact: true,
    }),
  ).toBeVisible();
});

test("la tuile « Sans information » mène au même filtre, et le compte scopé à la recherche correspond (D140, QE-13b)", async ({
  page,
}) => {
  await page.goto(
    `/vgp?q=${encodeURIComponent(fr["vgp2registre.e2e.marque"])}`,
  );
  const tuile = page.locator('[data-bloc="kpi-sans-information"]');
  await expect(tuile).toBeVisible();
  await tuile.getByRole("link").click();
  await expect(page).toHaveURL(/etat=sans_information/);
  await page.goto(
    `/vgp?etat=sans_information&q=${encodeURIComponent(fr["vgp2registre.e2e.marque"])}`,
  );
  // MACHINE_X1 et MACHINE_Y1 n'ont jamais reçu d'information — les deux
  // seules, parmi les quatre de la scène, dans cet état.
  await expect(page.getByText(SN_X1)).toBeVisible();
  await expect(page.getByText(SN_Y1)).toBeVisible();
  await expect(page.getByText(SN_X2)).toHaveCount(0);
  await expect(page.getByText(SN_X3)).toHaveCount(0);
  await expect(
    page.getByText(decompte(2, fr["parc.total_un"], fr["parc.total"]), {
      exact: true,
    }),
  ).toBeVisible();
});

test("le filtre Client (D122) ne retrouve que les machines du client choisi, le filtre Site les affine encore", async ({
  page,
}) => {
  await page.goto(
    `/vgp?q=${encodeURIComponent(PREFIXE_RECHERCHE)}&client=${CLIENT_X}`,
  );
  await expect(page.getByText(SN_X1)).toBeVisible();
  await expect(page.getByText(SN_X2)).toBeVisible();
  await expect(page.getByText(SN_Y1)).toHaveCount(0);

  await page.goto(
    `/vgp?q=${encodeURIComponent(PREFIXE_RECHERCHE)}&client=${CLIENT_X}&site=${SITE_X2}`,
  );
  await expect(page.getByText(SN_X2)).toBeVisible();
  await expect(page.getByText(SN_X1)).toHaveCount(0);

  // LE SITE DÉPEND DU CLIENT CHOISI : le site de CLIENT_Y n'apparaît pas
  // dans le menu déroulant une fois CLIENT_X sélectionné.
  const options = await page
    .locator('select[name="site"] option')
    .allTextContents();
  expect(options.join(" ")).not.toContain(fr["vgp2registre.e2e.lieu_y1"]);
});

test("« Grouper par client » (MO-12) isole un groupe par client, et l'aperçu d'impression n'affiche qu'un seul groupe à la fois (UX9-c)", async ({
  page,
}) => {
  await page.addInitScript(() => {
    // `window.print()` ouvrirait une vraie boîte de dialogue native dans un
    // navigateur piloté — stub, comme la suite e2e le fait déjà ailleurs
    // pour `ActionsBonIntervention`/`ActionsQrMachine`.
    window.print = () => {
      document.title = document.title; // no-op délibéré, juste pour éviter le natif
    };
  });
  await page.goto(
    `/vgp?q=${encodeURIComponent(PREFIXE_RECHERCHE)}&groupe=client`,
  );
  await expect(
    page.getByRole("heading", {
      name: fr["vgp2registre.e2e.client_x"],
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: fr["vgp2registre.e2e.client_y"],
      exact: true,
    }),
  ).toBeVisible();

  const zoneX = page.locator(`[data-zone-impression-vgp="${CLIENT_X}"]`);
  const zoneY = page.locator(`[data-zone-impression-vgp="${CLIENT_Y}"]`);
  await expect(zoneX).not.toHaveClass(/hidden/);
  await expect(zoneY).not.toHaveClass(/hidden/);

  await zoneX
    .getByRole("button", {
      name: fr["vgp.impression.imprimer_client"],
    })
    .click();

  await expect(page.locator("body")).toHaveClass(/print-vgp/);
  await expect(zoneX).not.toHaveClass(/hidden/);
  // LA ZONE DE L'AUTRE CLIENT EST MASQUÉE, IMPÉRATIVEMENT (jamais par
  // `:has()`) : la seule façon d'isoler UN groupe parmi plusieurs sur le
  // MÊME écran.
  await expect(zoneY).toHaveClass(/hidden/);

  // `afterprint` NETTOIE (aucun vrai dialogue n'a été ouvert, donc
  // l'événement ne se déclenche jamais seul ; on le rejoue nous-mêmes).
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator("body")).not.toHaveClass(/print-vgp/);
  await expect(zoneY).not.toHaveClass(/hidden/);
});

test("« Revenir à la liste » retire le regroupement", async ({ page }) => {
  await page.goto(
    `/vgp?q=${encodeURIComponent(PREFIXE_RECHERCHE)}&groupe=client`,
  );
  await page
    .getByRole("link", { name: fr["vgp.groupe.desactiver"], exact: true })
    .click();
  await expect(page).not.toHaveURL(/groupe=client/);
  await expect(page.locator('[data-bloc="tableau-registre"]')).toBeVisible();
});
