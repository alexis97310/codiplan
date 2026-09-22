import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LA FICHE CLIENT MONTRE SES INTERLOCUTEURS, LA FICHE SITE LES SIENS
 * (CONTACTS-1).
 *
 * ## Le constat, mesuré sur `main` le 22/09/2026
 *
 * Zéro chemin d'écriture vers `contact` dans tout le dépôt — ni route, ni
 * écran. La fiche client se contentait de dire que « aucun écran ne permet
 * encore d'en saisir un » (`clients.fiche.contacts_sans_ecran`).
 *
 * ## Ce que ce scénario prouve, et ce qu'il ne prouve pas
 *
 * Il prouve que le bloc de la fiche client RENDU sait créer un interlocuteur
 * « du client » (sans site) et l'afficher, avec son rôle ; et que le bloc de
 * la fiche site sait faire de même pour un interlocuteur rattaché à CE site,
 * lequel apparaît AUSSI sur la fiche client (qui montre tout), mais jamais
 * sous un AUTRE site du même client. Il ne prouve pas le cloisonnement entre
 * sociétés — c'est `tests/isolation/contacts-ecriture.test.ts` qui le fait,
 * par le chemin applicatif.
 *
 * **Sur `main` avant le lot, il rougit** : ni `[data-bloc="contacts-client"]`
 * ni `[data-bloc="contacts-site"]` n'existent, et la capture AVANT est prise
 * avant cette assertion.
 *
 * Les clés neuves sont lues PAR NOM — `(fr as Record<string, string>)[cle]` —
 * pour que ce spec reste rejouable tel quel sur le code d'avant, où elles
 * n'existent pas encore (`next build` type-vérifie `tests/`).
 *
 * `CAPTURES_CONTACTS_1=<dossier>` fait écrire les captures à 1280 px et
 * `mesure.json`.
 */

test.describe.configure({ mode: "serial" });

const FENETRE = { width: 1280, height: 900 };
const DOSSIER_CAPTURES = process.env.CAPTURES_CONTACTS_1 ?? "";

const dictionnaire = fr as Record<string, string>;

/** Fixtures de l'épreuve, au dictionnaire pour le gardien de L0-11. */
const NOM_CONTACT_DU_CLIENT = dictionnaire["contacts.e2e.nom_du_client"]!;
const NOM_CONTACT_DU_SITE = dictionnaire["contacts.e2e.nom_du_site"]!;

// Un client et deux sites À SOI, posés par la scène — jamais empruntés au
// semis partagé, qu'un autre spec écrit sous `fullyParallel` (mémoire du
// poste : « un spec qui compte pose SON site »).
const CLIENT_SANS_CONTACT = "e2e00000-0000-7000-8000-0000000c17a0";
const SITE_AVEC_CONTACT = "e2e00000-0000-7000-8000-00000000c17a";
const SITE_SANS_CONTACT = "e2e00000-0000-7000-8000-00000000c17b";

const mesure: {
  commit: string;
  horodatage: string;
  largeur: number;
  hauteur: number;
  fiches: Record<string, Record<string, unknown>>;
} = {
  commit: execFileSync("git", ["rev-parse", "HEAD"]).toString().trim(),
  horodatage: new Date().toISOString(),
  largeur: FENETRE.width,
  hauteur: FENETRE.height,
  fiches: {},
};

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER_CAPTURES === "") return;
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}--1280.png`),
    fullPage: true,
  });
  writeFileSync(
    join(DOSSIER_CAPTURES, "mesure.json"),
    `${JSON.stringify(mesure, null, 2)}\n`,
  );
}

test.beforeAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });

    await client.contact.deleteMany({
      where: { client_id: CLIENT_SANS_CONTACT },
    });
    await client.site.deleteMany({
      where: { id: { in: [SITE_AVEC_CONTACT, SITE_SANS_CONTACT] } },
    });
    await client.client.deleteMany({ where: { id: CLIENT_SANS_CONTACT } });

    await client.client.create({
      data: {
        id: CLIENT_SANS_CONTACT,
        societe_id: societe.id,
        raison_sociale: "Client sans interlocuteur (épreuve CONTACTS-1)",
      },
    });
    await client.site.create({
      data: {
        id: SITE_AVEC_CONTACT,
        societe_id: societe.id,
        client_id: CLIENT_SANS_CONTACT,
        agence_id: agence.id,
        libelle: "Lieu qui recevra un interlocuteur (épreuve CONTACTS-1)",
        temps_trajet_min: 10,
      },
    });
    await client.site.create({
      data: {
        id: SITE_SANS_CONTACT,
        societe_id: societe.id,
        client_id: CLIENT_SANS_CONTACT,
        agence_id: agence.id,
        libelle: "Autre lieu, sans interlocuteur (épreuve CONTACTS-1)",
        temps_trajet_min: 10,
      },
    });

    // TÉMOIN — zéro contact au départ, sur le client comme sur les deux sites.
    expect(
      await client.contact.count({ where: { client_id: CLIENT_SANS_CONTACT } }),
    ).toBe(0);
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.contact.deleteMany({
      where: { client_id: CLIENT_SANS_CONTACT },
    });
    await client.site.deleteMany({
      where: { id: { in: [SITE_AVEC_CONTACT, SITE_SANS_CONTACT] } },
    });
    await client.client.deleteMany({ where: { id: CLIENT_SANS_CONTACT } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FENETRE);
  await ouvrirUneSession(page);
});

test("LA FICHE CLIENT dit son absence, puis montre l'interlocuteur qu'on y crée", async ({
  page,
}) => {
  await page.goto(`/clients/${CLIENT_SANS_CONTACT}`);
  await expect(page.locator("main")).toBeVisible();
  mesure.fiches.client_avant = { url: `/clients/${CLIENT_SANS_CONTACT}` };
  await capturer(page, "client-sans-contact");

  const bloc = page.locator('[data-bloc="contacts-client"]');
  await expect(bloc).toBeVisible();
  await expect(
    bloc.getByText(dictionnaire["clients.fiche.contacts_vide"]!),
  ).toBeVisible();

  await capturer(page, "client-sans-contact");

  // LA CRÉATION — contact « du client », sans site.
  const forme = bloc.locator("form").last();
  await forme.locator('input[name="nom"]').fill(NOM_CONTACT_DU_CLIENT);
  await forme.locator('input[name="telephone"]').fill("687 00 00 01");
  await forme.locator('input[name="email"]').fill("donneuse@contacts-1.test");
  await forme.locator('input[name="roles"][value="donneur_ordre"]').check();
  await forme
    .getByRole("button", { name: dictionnaire["contacts.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(/\/clients\//);
  const blocApres = page.locator('[data-bloc="contacts-client"]');
  await expect(blocApres).toBeVisible();
  await expect(
    blocApres.getByText(dictionnaire["clients.fiche.contacts_vide"]!),
  ).toHaveCount(0);
  const ligne = blocApres.locator("li[data-contact]");
  await expect(ligne).toHaveCount(1);
  await expect(ligne).toContainText(NOM_CONTACT_DU_CLIENT);
  await expect(ligne).toContainText(
    dictionnaire["contact.role.donneur_ordre"]!,
  );
  await expect(ligne).toContainText(
    dictionnaire["contact.rattachement.client"]!,
  );

  mesure.fiches.client_apres = {
    url: `/clients/${CLIENT_SANS_CONTACT}`,
    lignes_rendues: await ligne.count(),
  };
  await capturer(page, "client-avec-contact");
});

test("LA FICHE SITE crée un interlocuteur rattaché À CE SITE, visible aussi sur la fiche client, jamais sous l'autre site", async ({
  page,
}) => {
  await page.goto(`/sites/${SITE_AVEC_CONTACT}`);
  await expect(page.locator("main")).toBeVisible();
  mesure.fiches.site_avant = { url: `/sites/${SITE_AVEC_CONTACT}` };
  await capturer(page, "site-sans-contact");

  const bloc = page.locator('[data-bloc="contacts-site"]');
  await expect(bloc).toBeVisible();
  await expect(
    bloc.getByText(dictionnaire["sites.fiche.contacts_vide"]!),
  ).toBeVisible();

  await capturer(page, "site-sans-contact");

  const forme = bloc.locator("form").last();
  await forme.locator('input[name="nom"]').fill(NOM_CONTACT_DU_SITE);
  await forme.locator('input[name="email"]').fill("site@contacts-1.test");
  await forme.locator('input[name="roles"][value="contact_technique"]').check();
  await forme
    .getByRole("button", { name: dictionnaire["contacts.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(page).toHaveURL(/\/sites\//);
  const blocApres = page.locator('[data-bloc="contacts-site"]');
  await expect(
    blocApres.getByText(dictionnaire["sites.fiche.contacts_vide"]!),
  ).toHaveCount(0);
  const ligne = blocApres.locator("li[data-contact]");
  await expect(ligne).toHaveCount(1);
  await expect(ligne).toContainText(NOM_CONTACT_DU_SITE);

  mesure.fiches.site_apres = {
    url: `/sites/${SITE_AVEC_CONTACT}`,
    lignes_rendues: await ligne.count(),
  };
  await capturer(page, "site-avec-contact");

  // VISIBLE AUSSI sur la fiche CLIENT, qui montre tous ses interlocuteurs.
  await page.goto(`/clients/${CLIENT_SANS_CONTACT}`);
  await expect(page.locator('[data-bloc="contacts-client"]')).toContainText(
    NOM_CONTACT_DU_SITE,
  );

  // JAMAIS sous L'AUTRE site du même client.
  await page.goto(`/sites/${SITE_SANS_CONTACT}`);
  const blocAutreSite = page.locator('[data-bloc="contacts-site"]');
  await expect(blocAutreSite).toContainText(
    dictionnaire["sites.fiche.contacts_vide"]!,
  );
  await expect(blocAutreSite.locator("li[data-contact]")).toHaveCount(0);
});
