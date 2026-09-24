import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { ouTiret } from "@/app/(back-office)/presentation";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import { valeurChamp } from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * FICHE-360-1 — LES FICHES CLIENT ET SITE SERVENT À TRAVAILLER, DE BOUT EN
 * BOUT.
 *
 * ## Ce que les gardiens unitaires ne peuvent pas prouver
 *
 * Les fonctions de dépôt sont éprouvées par `tests/isolation/fiche-360-1.test.ts`
 * (le cloisonnement des compteurs et du bloc équipements). Ce fichier prouve ce
 * qu'aucun des deux ne peut : qu'un écran RÉEL rend le fil d'Ariane comme un
 * vrai lien cliquable, que le bloc « Équipements du site » ne montre QUE les
 * machines de CE site, que « + Intervention » et « + Site » arrivent RÉELLEMENT
 * préremplis après une navigation par l'adresse, et qu'un compteur inconnu
 * s'affiche « — » à l'écran et non « 0 ».
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `F360-`
 *
 * Créée en `beforeAll`, supprimée en `afterAll` — AUCUNE ligne n'est ajoutée au
 * semis (`prisma/seed.ts`), même discipline que `tests/e2e/avertissements-1.spec.ts`.
 * Un client, DEUX sites — l'un porte les TROIS machines de la scène, l'autre
 * n'en porte AUCUNE — pour que « les machines de CE site, pas de l'autre » ait
 * quelque chose à réfuter, et que le second site montre un compteur « dernière
 * intervention »/« prochaine VGP » réellement INCONNU (D88 : jamais 0).
 */
test.describe.configure({ mode: "serial" });

const CLIENT_F360 = uuidv7();
const SITE_UN = uuidv7();
const SITE_DEUX = uuidv7();
const MACHINE_1 = uuidv7();
const MACHINE_2 = uuidv7();
const MACHINE_3 = uuidv7();

// LES NUMÉROS DE SÉRIE VIENNENT DU DICTIONNAIRE (L0-11) — le gardien
// `sans-chaine-visible-en-dur.test.ts` résout un identifiant local vers SA
// constante littérale (« le deux-temps ne protège pas », forme 3 du §9) :
// seule une lecture RÉELLE de `fr["…"]` passe, ici comme pour toute autre
// fixture `*.e2e.*`.
const NUMERO_SERIE_1 = fr["fiche360.e2e.numero_serie_1"];
const NUMERO_SERIE_2 = fr["fiche360.e2e.numero_serie_2"];
const NUMERO_SERIE_3 = fr["fiche360.e2e.numero_serie_3"];

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

    await client.client.create({
      data: {
        id: CLIENT_F360,
        societe_id: societe.id,
        raison_sociale: fr["fiche360.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_UN,
        societe_id: societe.id,
        client_id: CLIENT_F360,
        agence_id: agence.id,
        libelle: fr["fiche360.e2e.site_un"],
      },
    });
    await client.site.create({
      data: {
        id: SITE_DEUX,
        societe_id: societe.id,
        client_id: CLIENT_F360,
        agence_id: agence.id,
        libelle: fr["fiche360.e2e.site_deux"],
      },
    });
    for (const [id, serie] of [
      [MACHINE_1, NUMERO_SERIE_1],
      [MACHINE_2, NUMERO_SERIE_2],
      [MACHINE_3, NUMERO_SERIE_3],
    ] as const) {
      await client.machine.create({
        data: {
          id,
          societe_id: societe.id,
          modele_id: modele.id,
          client_id: CLIENT_F360,
          site_id: SITE_UN,
          numero_serie: serie,
          qr_token: engendrerJetonQr(),
        },
      });
    }
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.machine.deleteMany({
      where: { id: { in: [MACHINE_1, MACHINE_2, MACHINE_3] } },
    });
    await client.site.deleteMany({
      where: { id: { in: [SITE_UN, SITE_DEUX] } },
    });
    await client.client.deleteMany({ where: { id: CLIENT_F360 } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("le bloc « Équipements du site » ne montre QUE les trois machines de CE site, jamais celles de l'autre", async ({
  page,
}) => {
  await page.goto(`/sites/${SITE_UN}`);
  const bloc = page.locator('[data-bloc="equipements-site"]');
  await expect(bloc).toBeVisible();
  const lignes = bloc.locator("tbody tr");
  await expect(lignes).toHaveCount(3);
  await expect(bloc.getByText(NUMERO_SERIE_1)).toBeVisible();
  await expect(bloc.getByText(NUMERO_SERIE_2)).toBeVisible();
  await expect(bloc.getByText(NUMERO_SERIE_3)).toBeVisible();

  await page.goto(`/sites/${SITE_DEUX}`);
  const blocVide = page.locator('[data-bloc="equipements-site"]');
  await expect(blocVide).toBeVisible();
  await expect(blocVide.locator("tbody tr")).toHaveCount(0);
  await expect(
    blocVide.getByText(fr["sites.fiche.equipements_vide"]),
  ).toBeVisible();
});

test("« + Intervention » d'une machine du bloc équipements arrive PRÉREMPLI, site ET machine", async ({
  page,
}) => {
  await page.goto(`/sites/${SITE_UN}`);
  const bloc = page.locator('[data-bloc="equipements-site"]');
  const ligne = bloc.locator("tr", { hasText: NUMERO_SERIE_1 });
  await ligne
    .getByRole("link", { name: fr["sites.action.ajouter_intervention"] })
    .click();
  await page.waitForURL(/\/interventions\/nouvelle\?/);

  const url = new URL(page.url());
  expect(url.searchParams.get("site")).toBe(SITE_UN);
  expect(url.searchParams.get("machine")).toBe(MACHINE_1);

  // LE SITE CHERCHE SUR LE SERVEUR (SELECTEURS-1) — la valeur soumise vit
  // dans le champ CACHÉ posé par `SelecteurRecherche`, plus dans un `<select>`.
  await expect(valeurChamp(page, "site")).toHaveValue(
    new RegExp(`:${SITE_UN}$`),
  );
  const machineSelect = page.locator('select[name="machine_ids"]');
  const optionCochee = machineSelect.locator("option:checked");
  await expect(optionCochee).toHaveCount(1);
  await expect(optionCochee).toHaveAttribute("value", MACHINE_1);
});

test("le fil d'Ariane de la fiche site ramène au client", async ({ page }) => {
  await page.goto(`/sites/${SITE_UN}`);
  const filAriane = page.getByRole("navigation", {
    name: fr["navigation.fil_ariane"],
  });
  await expect(filAriane).toBeVisible();
  const lienClient = filAriane.getByRole("link", {
    name: fr["fiche360.e2e.client"],
  });
  await expect(lienClient).toBeVisible();
  await lienClient.click();
  await expect(page).toHaveURL(`/clients/${CLIENT_F360}`);
});

test("« + Site » depuis la fiche client arrive PRÉREMPLI sur le client", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT_F360}`);
  const action = page.getByRole("link", {
    name: `${fr["action.ajouter"]} ${fr["vocabulaire.site"]}`,
  });
  await expect(action).toBeVisible();
  await action.click();
  await page.waitForURL(/\/sites\/nouveau\?/);

  const url = new URL(page.url());
  expect(url.searchParams.get("client")).toBe(CLIENT_F360);

  // LE CLIENT CHERCHE SUR LE SERVEUR (SELECTEURS-1) — la valeur soumise vit
  // dans le champ CACHÉ posé par `SelecteurRecherche`, plus dans un `<select>`.
  await expect(valeurChamp(page, "client_id")).toHaveValue(CLIENT_F360);
});

test("un compteur INCONNU s'affiche « — », jamais 0", async ({ page }) => {
  await page.goto(`/sites/${SITE_DEUX}`);
  const synthese = page.locator('[data-bloc="synthese-site"]');
  await expect(synthese).toBeVisible();

  // « Équipements » et « interventions ouvertes » sont des FAITS CONNUS —
  // zéro équipement, zéro intervention ouverte — et s'affichent bien un
  // ZÉRO NUMÉRIQUE (L0-11 : `String(AUCUN)` n'introduit aucun littéral de
  // chaîne dans une requête d'écran, à la différence de `"0"` écrit en dur).
  const AUCUN = 0;
  await expect(synthese.locator('[data-compteur="equipements"] b')).toHaveText(
    String(AUCUN),
  );
  await expect(
    synthese.locator('[data-compteur="interventions-ouvertes"] b'),
  ).toHaveText(String(AUCUN));

  // « Dernière intervention » et « prochaine VGP » sont INCONNUES — ce site
  // n'a JAMAIS eu d'intervention ni de VGP renseignée — et s'affichent
  // exactement ce que l'écran compose pour une absence (`ouTiret(null)`),
  // jamais le caractère recopié en dur ici (L0-11).
  await expect(
    synthese.locator('[data-compteur="derniere-intervention"] b'),
  ).toHaveText(ouTiret(null));
  await expect(
    synthese.locator('[data-compteur="vgp-prochaine"] b'),
  ).toHaveText(ouTiret(null));
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/48-FICHE-360-1/captures",
);

/** Les deux largeurs demandées par le ticket, mobile puis bureau. */
async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  for (const largeur of [375, 1280]) {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.screenshot({
      path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
      fullPage: true,
    });
  }
}

test("captures — la fiche site et la fiche client, 375 et 1280 px", async ({
  page,
}) => {
  await page.goto(`/sites/${SITE_UN}`);
  await capturer(page, "fiche-site");
  await page.goto(`/clients/${CLIENT_F360}`);
  await capturer(page, "fiche-client");
});
