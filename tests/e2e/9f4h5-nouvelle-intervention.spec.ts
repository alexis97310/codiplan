import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { cleJour, jourDe, maintenant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9F4H5-TERRAIN-VIVANT, point 3 — « NOUVELLE INTERVENTION », À TRAVERS
 * L'ÉCRAN.
 *
 * Les scénarios unitaires (`tests/unit/terrain/vues-locales.test.ts`)
 * éprouvent la mémoire locale, pure. Ils ne peuvent pas prouver que Ma
 * journée, SANS rechargement, affiche la pastille au bon moment ni qu'elle
 * s'efface à l'ouverture de la fiche — c'est ce que ce fichier joue.
 *
 * ## LE RETOUR DU RÉSEAU, PLUTÔT QUE 60 SECONDES RÉELLES
 *
 * `RafraichissementAutomatique` rafraîchit à la visibilité retrouvée, au
 * retour du réseau, ET toutes les 60 s — attendre la minuterie en vrai
 * ralentirait l'épreuve sans rien prouver de plus. L'événement `online` est
 * déclenché directement : c'est l'un des TROIS déclencheurs réels, pas un
 * raccourci qui contournerait le mécanisme.
 *
 * ## MÊME SCÈNE QUE 9DD-PG-G14C-TERRAIN-TRANSMISES
 *
 * Une `PLANIFIEE` forgée, transmise par l'écran du bureau — le même chemin
 * déjà éprouvé pour « le terrain ne voit que le transmis ». Ce fichier pose sa
 * PROPRE ligne, avec son propre site, pour ne compter que ce qu'il a forgé.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTION_ID = uuidv7();
const SITE_LIBELLE = fr["terrain9f4h5.e2e.site_nouvelle"];

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const aujourdHui = jourDe(maintenant(reperes.fuseau).local);
    const cle = cleJour(aujourdHui);
    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: fr["terrain9f4h5.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: SITE_LIBELLE,
      },
    });
    // PLANIFIEE — le terrain ne la voit pas encore (D141 14C), exactement
    // comme 9DD-PG-G14C-TERRAIN-TRANSMISES : « Transmettre » la fait
    // apparaître.
    await client.intervention.create({
      data: {
        id: INTERVENTION_ID,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        statut: "planifiee",
        type: "curatif",
        priorite: "p3",
        date_planifiee: new Date(`${cle}T00:00:00.000Z`),
        creneau_debut: new Date(`${cle}T20:00:00.000Z`),
        creneau_fin: new Date(`${cle}T21:00:00.000Z`),
        duree_estimee_min: 60,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "9F4H5 — intervention forgée par l'épreuve",
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
    await client.site.deleteMany({ where: { id: SITE_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

test("transmise par le bureau, elle apparaît sur Ma journée avec « Nouvelle », sans recharger — et l'ouvrir l'efface", async ({
  page,
  browser,
}) => {
  // ── LE PREMIER AFFICHAGE, AVANT TRANSMISSION — établit la mémoire locale
  // de cet appareil : rien n'est encore « nouveau » (la ligne n'existe pas
  // encore sur cette journée).
  await ouvrirLaSessionDuTerrain(page);
  await expect(page.locator("li", { hasText: SITE_LIBELLE })).toHaveCount(0);

  // ── LE GESTE, PAR L'ÉCRAN DU BUREAU (D141) — sa propre page, comme
  // 9DD-PG-G14C-TERRAIN-TRANSMISES : une session « adv » sur la MÊME page
  // que la session technicien écraserait le cookie de l'une par l'autre.
  const pageBureau = await browser.newPage();
  await ouvrirUneSession(pageBureau);
  await pageBureau.goto(`/interventions/${INTERVENTION_ID}`);
  await pageBureau
    .getByRole("button", { name: fr["intervention.action.transmettre"] })
    .click();
  await pageBureau
    .locator("dialog[open]")
    .getByRole("button", { name: fr["intervention.action.transmettre"] })
    .click();
  await pageBureau.waitForLoadState("networkidle");
  await expect(
    pageBureau
      .getByRole("heading", { level: 1 })
      .getByText(fr["statut.affectee"]),
  ).toBeVisible();
  await pageBureau.close();

  // ── SANS RECHARGER : le retour du réseau déclenche le rafraîchissement
  // automatique (point 2), qui révèle la ligne transmise entre-temps.
  //
  // L'ANNONCE compte TOUTES les pastilles en attente sur cette identité, pas
  // seulement celle forgée ici — sous exécution parallèle (`fullyParallel`),
  // une autre épreuve peut transmettre sa PROPRE ligne au même technicien
  // dans la même fenêtre. Ce scénario vérifie donc la pastille SUR SA CARTE,
  // jamais un compte global (même discipline que
  // `9dd-pg-g14c-terrain-transmises.spec.ts`, qui ne compte jamais non plus).
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  const carte = page.locator("li", { hasText: SITE_LIBELLE });
  await expect(carte).toBeVisible();
  await expect(
    carte.getByText(fr["terrain.badge_nouvelle"], { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      new RegExp(
        `\\d+ (${fr["terrain.nouvelles.singulier"]}|${fr["terrain.nouvelles.pluriel"]})`,
      ),
    ),
  ).toBeVisible();

  // ── OUVRIR LA FICHE EFFACE LA PASTILLE, DE FAÇON PERSISTANTE ────────────
  await carte.click();
  await expect(page).toHaveURL(new RegExp(`/terrain/${INTERVENTION_ID}$`));

  await page.goto("/terrain");
  const carteApres = page.locator("li", { hasText: SITE_LIBELLE });
  await expect(carteApres).toBeVisible();
  await expect(
    carteApres.getByText(fr["terrain.badge_nouvelle"], { exact: true }),
  ).toHaveCount(0);
});
