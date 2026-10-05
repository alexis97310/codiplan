import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { SCENE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9DR-TP-NAV2-RETOURS-FIL (D168) — LE FIL D'ARIANE SUR LES FICHES, UN SEUL
 * RETOUR, `depuis` ÉTENDU.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9DR-`
 *
 * Créée en `beforeAll`, supprimée en `afterAll` — aucune ligne n'est ajoutée
 * au semis, même discipline que `tests/e2e/liens-3.spec.ts`. Un client, un
 * site, une machine et une demande, tous nommés `9DR-…` pour ne jamais se
 * confondre avec la scène d'un autre fichier joué en parallèle
 * (`fullyParallel`).
 *
 * `SCENE.deplacable` (intervention FIXE de `tests/e2e/setup/scene.ts`) est
 * lue en LECTURE SEULE pour le scénario `depuis=planning` : aucune écriture,
 * aucun statut touché.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9DR = uuidv7();
const SITE_9DR = uuidv7();
const MACHINE_9DR = uuidv7();
const DEMANDE_9DR = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const societeId = reperes.societeId;

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: societeId },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_9DR,
        societe_id: societeId,
        raison_sociale: fr["9dr.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9DR,
        societe_id: societeId,
        client_id: CLIENT_9DR,
        agence_id: agence.id,
        libelle: fr["9dr.e2e.site"],
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_9DR,
        societe_id: societeId,
        modele_id: modele.id,
        client_id: CLIENT_9DR,
        site_id: SITE_9DR,
        numero_serie: "9DR-SN-1",
        qr_token: engendrerJetonQr(),
      },
    });
    const maintenant = new Date();
    await client.demande.create({
      data: {
        id: DEMANDE_9DR,
        societe_id: societeId,
        source: "appel",
        client_id: CLIENT_9DR,
        site_id: SITE_9DR,
        agence_id: agence.id,
        description: fr["9dr.e2e.demande_description"],
        depose_le: maintenant,
        compteur_accuse_le: maintenant,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.demande.deleteMany({ where: { id: DEMANDE_9DR } });
    await client.machine.deleteMany({ where: { client_id: CLIENT_9DR } });
    await client.site.deleteMany({ where: { client_id: CLIENT_9DR } });
    await client.client.deleteMany({ where: { id: CLIENT_9DR } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("le fil d'Ariane de la fiche client est visible et cliquable, et le retour nu a disparu", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT_9DR}`);
  const fil = page.getByRole("navigation", {
    name: fr["navigation.fil_ariane"],
  });
  await expect(fil).toBeVisible();
  const lienClients = fil.getByRole("link", {
    name: fr["fil_ariane.clients"],
  });
  await expect(lienClients).toHaveAttribute("href", "/clients");
  // UN SEUL RETOUR (D168) — plus de doublon `clients.retour` sur CETTE
  // fiche (la clé reste vivante pour `clients/nouveau`, qui n'a pas de fil).
  await expect(
    page.getByRole("link", { name: fr["clients.retour"] }),
  ).toHaveCount(0);
  await lienClients.click();
  await expect(page).toHaveURL("/clients");
});

test("le fil d'Ariane de la fiche site part de « Sites », pas de « Clients », et nomme le client ensuite", async ({
  page,
}) => {
  await page.goto(`/sites/${SITE_9DR}`);
  const fil = page.getByRole("navigation", {
    name: fr["navigation.fil_ariane"],
  });
  await expect(fil).toBeVisible();
  await expect(
    fil.getByRole("link", { name: fr["vocabulaire.site.pluriel"] }),
  ).toHaveAttribute("href", "/sites");
  const lienClient = fil.getByRole("link", { name: fr["9dr.e2e.client"] });
  await expect(lienClient).toHaveAttribute("href", `/clients/${CLIENT_9DR}`);
});

test("le fil d'Ariane de la fiche machine part de « Parc machines »", async ({
  page,
}) => {
  await page.goto(`/parc/${MACHINE_9DR}`);
  const fil = page.getByRole("navigation", {
    name: fr["navigation.fil_ariane"],
  });
  await expect(fil).toBeVisible();
  await expect(
    fil.getByRole("link", { name: fr["nav.parc_machines"] }),
  ).toHaveAttribute("href", "/parc");
});

test("le fil d'Ariane de la fiche demande part de « Demandes »", async ({
  page,
}) => {
  await page.goto(`/demandes/${DEMANDE_9DR}`);
  const fil = page.getByRole("navigation", {
    name: fr["navigation.fil_ariane"],
  });
  await expect(fil).toBeVisible();
  await expect(
    fil.getByRole("link", { name: fr["nav.demandes"] }),
  ).toHaveAttribute("href", "/demandes");
});

test("à 375 px, le fil se réduit à « ‹ Parent » — ici le client", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`/sites/${SITE_9DR}`);
  // Scopé au `<nav>` du fil : le sous-titre de la fiche porte AUSSI un lien
  // vers le client (LIENS-1), de même libellé — un second lien, hors du fil,
  // que ce scénario ne doit pas confondre avec le sien.
  const fil = page.getByRole("navigation", {
    name: fr["navigation.fil_ariane"],
  });
  const lienReduit = fil.getByRole("link", { name: fr["9dr.e2e.client"] });
  await expect(lienReduit).toBeVisible();
  await expect(lienReduit).toHaveAttribute("href", `/clients/${CLIENT_9DR}`);
  // Le fil complet (le maillon « Sites ») ne doit pas être visible à ce
  // seuil, même s'il reste dans le DOM.
  await expect(
    fil.getByRole("link", { name: fr["vocabulaire.site.pluriel"] }),
  ).toBeHidden();
});

test("`depuis=planning` ramène la fiche intervention au planning", async ({
  page,
}) => {
  await page.goto(`/interventions/${SCENE.deplacable}?depuis=planning`);
  const retour = page.getByRole("link", {
    name: fr["planning.retour_fleche"],
  });
  await expect(retour).toBeVisible();
  await expect(retour).toHaveAttribute("href", /^\/planning/);
});
