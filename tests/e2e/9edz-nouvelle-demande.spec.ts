import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EDZ-DEMANDES-CONNEXION-MAQUETTE, partie 2 (D188) — « + DEMANDE » : LE
 * VOLET DÉPOSE DIRECTEMENT, SANS MIGRATION.
 *
 * `COMPTE_EPREUVE` (rôle `adv`) porte `creer_demande` (§5.2) — le refus de
 * droit d'un rôle qui ne la porte pas est prouvé À PART, par
 * `tests/isolation/9edz-demandes-creer.test.ts` (verdict RÉEL de la
 * matrice) : AUCUN rôle ordinaire de CODIMA-NC n'en est privé, seuls les
 * trois rôles de plateforme le sont, et aucun d'eux n'ouvre de session
 * utilisable sur cette société pour le démontrer à l'écran.
 *
 * Fixture À SOI (préfixe `9EDZ2-`), jamais le jeu partagé.
 */
test.describe.configure({ mode: "serial" });

const dictionnaire = fr as Record<string, string>;

const CLIENT_9EDZ2 = "9edace00-0000-7000-8000-00000000d200";
const SITE_VALIDE = "9edace00-0000-7000-8000-00000000d201";
const SITE_AUTRE_LIEU = "9edace00-0000-7000-8000-00000000d202";
const MACHINE_VALIDE = "9edace00-0000-7000-8000-00000000d203";
const MACHINE_AUTRE_LIEU = "9edace00-0000-7000-8000-00000000d204";

const RAISON_SOCIALE = "Client 9EDZ2 — volet Nouvelle demande";
const DESCRIPTION_VALIDE = dictionnaire["9edz2.e2e.description"];

const idsDemandesCreees: string[] = [];

async function nettoyer(client: PrismaClient): Promise<void> {
  if (idsDemandesCreees.length > 0) {
    await client.demande.deleteMany({
      where: { id: { in: idsDemandesCreees } },
    });
    idsDemandesCreees.length = 0;
  }
  await client.machine.deleteMany({
    where: { id: { in: [MACHINE_VALIDE, MACHINE_AUTRE_LIEU] } },
  });
  await client.site.deleteMany({
    where: { id: { in: [SITE_VALIDE, SITE_AUTRE_LIEU] } },
  });
  await client.client.deleteMany({ where: { id: CLIENT_9EDZ2 } });
}

test.beforeAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_9EDZ2,
        societe_id: societe.id,
        raison_sociale: RAISON_SOCIALE,
      },
    });
    await client.site.create({
      data: {
        id: SITE_VALIDE,
        societe_id: societe.id,
        client_id: CLIENT_9EDZ2,
        agence_id: agence.id,
        libelle: "Lieu A (épreuve 9EDZ2)",
      },
    });
    await client.site.create({
      data: {
        id: SITE_AUTRE_LIEU,
        societe_id: societe.id,
        client_id: CLIENT_9EDZ2,
        agence_id: agence.id,
        libelle: "Lieu B, un AUTRE lieu (épreuve 9EDZ2)",
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_VALIDE,
        societe_id: societe.id,
        modele_id: modele.id,
        client_id: CLIENT_9EDZ2,
        site_id: SITE_VALIDE,
        numero_serie: "9EDZ2-SERIE-A",
        qr_token: engendrerJetonQr(),
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_AUTRE_LIEU,
        societe_id: societe.id,
        modele_id: modele.id,
        client_id: CLIENT_9EDZ2,
        site_id: SITE_AUTRE_LIEU,
        numero_serie: "9EDZ2-SERIE-B",
        qr_token: engendrerJetonQr(),
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirUneSession(page);
});

/** L'`id` de la demande créée, lu dans la redirection `?creee=<id>`. */
function idDepuisUrl(url: string): string | null {
  return new URL(url).searchParams.get("creee");
}

test("ouvrir le volet (?nouvelle=1) ne crée rien", async ({ page }) => {
  await page.goto("/demandes");
  const bouton = page.getByRole("link", {
    name: dictionnaire["demandes.nouvelle"],
    exact: true,
  });
  await expect(bouton).toBeVisible();
  await bouton.click();

  const volet = page.getByRole("dialog");
  await expect(volet).toBeVisible();
  await expect(volet).toContainText(dictionnaire["demandes.volet.titre"]);
  await expect(page).toHaveURL(/\?nouvelle=1/);

  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    expect(
      await client.demande.count({ where: { client_id: CLIENT_9EDZ2 } }),
    ).toBe(0);
  } finally {
    await client.$disconnect();
  }
});

test("un conseiller crée une demande : client, lieu, machine du lieu, texte", async ({
  page,
}) => {
  await page.goto("/demandes?nouvelle=1");
  const volet = page.getByRole("dialog");
  await expect(volet).toBeVisible();

  await volet.locator('label:has(input[name="source"][value="appel"])').click();
  // LE LIBELLÉ ATTENDU EST EXIGÉ ICI (4e argument) — la recherche fixe
  // ouvre d'abord une liste NON FILTRÉE (`surFocus`), avant la liste
  // filtrée du débounce ; sans lui, le premier clic prendrait le premier
  // résultat venu du jeu partagé, pas le nôtre.
  await choisirResultatParTexte(
    volet,
    "client_id",
    RAISON_SOCIALE,
    RAISON_SOCIALE,
  );
  await choisirResultatParTexte(volet, "site_id", "Lieu A", "Lieu A");
  // LA MACHINE SE CHARGE APRÈS LE SITE (`/api/recherche/site/[id]`, un aller-
  // retour réseau) — le `<select>` reste DÉSACTIVÉ jusque-là.
  const selectMachine = volet.locator('select[name="machine_id"]');
  await expect(selectMachine).toBeEnabled();
  await expect(
    selectMachine.locator(`option[value="${MACHINE_VALIDE}"]`),
  ).toHaveCount(1);
  await selectMachine.selectOption(MACHINE_VALIDE);
  await volet.locator('textarea[name="description"]').fill(DESCRIPTION_VALIDE);

  await volet
    .getByRole("button", { name: dictionnaire["demandes.volet.valider"] })
    .click();

  await page.waitForURL((url) => url.pathname === "/demandes");
  const id = idDepuisUrl(page.url());
  expect(id).not.toBeNull();
  if (id !== null) idsDemandesCreees.push(id);

  await expect(page.getByText(dictionnaire["demandes.creee"])).toBeVisible();
  const ligne = page.locator(`tr[data-demande="${id}"]`);
  await expect(ligne).toBeVisible();
  await expect(ligne).toContainText(DESCRIPTION_VALIDE);
  await expect(ligne).toContainText(dictionnaire["demande.source.appel"]);
  await expect(ligne).toContainText(dictionnaire["demande.statut.nouvelle"]);
});

test("un POST rejoué (même id) ne crée pas une seconde demande", async ({
  page,
}) => {
  await page.goto("/demandes");
  const id = uuidv7();
  const champs = {
    id,
    source: "appel",
    client_id: CLIENT_9EDZ2,
    site_id: SITE_VALIDE,
    machine_id: "",
    description: "9EDZ2 — rejeu du même POST",
  };

  const premiere = await page.request.post("/api/demandes/creer", {
    form: champs,
    maxRedirects: 0,
  });
  expect(premiere.status()).toBe(303);
  idsDemandesCreees.push(id);

  const seconde = await page.request.post("/api/demandes/creer", {
    form: champs,
    maxRedirects: 0,
  });
  expect(seconde.status()).toBe(303);
  expect(seconde.headers()["location"]).toBe(premiere.headers()["location"]);

  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    expect(await client.demande.count({ where: { id } })).toBe(1);
  } finally {
    await client.$disconnect();
  }
});

test("une machine d'un AUTRE lieu, forgée, est refusée — aucune demande créée", async ({
  page,
}) => {
  await page.goto("/demandes");
  const id = uuidv7();
  const reponse = await page.request.post("/api/demandes/creer", {
    form: {
      id,
      source: "appel",
      client_id: CLIENT_9EDZ2,
      site_id: SITE_VALIDE,
      machine_id: MACHINE_AUTRE_LIEU,
      description: "9EDZ2 — machine forgée hors lieu",
    },
    maxRedirects: 0,
  });
  expect(reponse.status()).toBe(303);
  expect(reponse.headers()["location"] ?? "").toContain(
    "demande.refus.machine_hors_lieu",
  );

  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    expect(await client.demande.count({ where: { id } })).toBe(0);
  } finally {
    await client.$disconnect();
  }
});

test("une source hors de la liste du volet (portail), forgée, est refusée", async ({
  page,
}) => {
  await page.goto("/demandes");
  const id = uuidv7();
  const reponse = await page.request.post("/api/demandes/creer", {
    form: {
      id,
      source: "portail",
      client_id: CLIENT_9EDZ2,
      site_id: SITE_VALIDE,
      machine_id: "",
      description: "9EDZ2 — source portail forgée",
    },
    maxRedirects: 0,
  });
  expect(reponse.status()).toBe(303);
  expect(reponse.headers()["location"] ?? "").toContain(
    "demande.refus.saisie_invalide",
  );

  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    expect(await client.demande.count({ where: { id } })).toBe(0);
  } finally {
    await client.$disconnect();
  }
});

test("un texte de 4001 caractères est refusé, et conservé au retour", async ({
  page,
}) => {
  await page.goto("/demandes");
  const id = uuidv7();
  const texteTropLong = "x".repeat(4001);
  const reponse = await page.request.post("/api/demandes/creer", {
    form: {
      id,
      source: "appel",
      client_id: CLIENT_9EDZ2,
      site_id: SITE_VALIDE,
      machine_id: "",
      description: texteTropLong,
    },
    maxRedirects: 0,
  });
  expect(reponse.status()).toBe(303);
  const localisation = reponse.headers()["location"] ?? "";
  expect(localisation).toContain("demande.refus.saisie_invalide");

  await page.goto(localisation);
  await expect(page.locator('textarea[name="description"]')).toHaveValue(
    texteTropLong,
  );

  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    expect(await client.demande.count({ where: { id } })).toBe(0);
  } finally {
    await client.$disconnect();
  }
});
