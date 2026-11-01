import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import { choisirMachine, choisirPriorite } from "./setup/formulaire-creation";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9I8F-STATUT-MACHINE-MODIFIABLE — bout en bout.
 *
 * Signalement d'Alexis (31/10/2026) : le statut de la machine ne change
 * jamais. Réponse à la question posée en passation : le bouton doit
 * apparaître au moment de saisir la demande ou l'intervention, ET depuis la
 * fiche machine.
 *
 * Fixture À SOI (préfixe `9I8F-`), jamais le jeu partagé — même discipline
 * que `tests/e2e/9edz-nouvelle-demande.spec.ts` : ce spec ÉCRIT le statut
 * d'une machine, et une machine du semis lue par d'autres specs en parallèle
 * ne doit jamais changer sous eux.
 */
test.describe.configure({ mode: "serial" });

const dictionnaire = fr as Record<string, string>;

const CLIENT_ID = "918face0-0000-7000-8000-000000000001";
const SITE_ID = "918face0-0000-7000-8000-000000000002";
const MACHINE_ID = "918face0-0000-7000-8000-000000000003";
const NUMERO_SERIE = dictionnaire["9i8f.e2e.numero_serie"];
const RAISON_SOCIALE = "Client 9I8F — statut machine modifiable";
const LIBELLE_SITE = "Lieu 9I8F — statut machine modifiable";

const idsDemandesCreees: string[] = [];
const idsInterventionsCreees: string[] = [];

async function nettoyer(client: PrismaClient): Promise<void> {
  if (idsInterventionsCreees.length > 0) {
    await client.intervention.deleteMany({
      where: { id: { in: idsInterventionsCreees } },
    });
    idsInterventionsCreees.length = 0;
  }
  if (idsDemandesCreees.length > 0) {
    await client.demande.deleteMany({
      where: { id: { in: idsDemandesCreees } },
    });
    idsDemandesCreees.length = 0;
  }
  await client.intervention.deleteMany({ where: { site_id: SITE_ID } });
  await client.demande.deleteMany({ where: { site_id: SITE_ID } });
  await client.machine.deleteMany({ where: { id: MACHINE_ID } });
  await client.site.deleteMany({ where: { id: SITE_ID } });
  await client.client.deleteMany({ where: { id: CLIENT_ID } });
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
        id: CLIENT_ID,
        societe_id: societe.id,
        raison_sociale: RAISON_SOCIALE,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: societe.id,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: LIBELLE_SITE,
      },
    });
    // STATUT NAÎT « en service » PAR DÉFAUT (`@default(en_service)`) — jamais
    // posé ici : c'est précisément ce que ce spec fait CHANGER.
    await client.machine.create({
      data: {
        id: MACHINE_ID,
        societe_id: societe.id,
        modele_id: modele.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        numero_serie: NUMERO_SERIE,
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
  await ouvrirUneSession(page);
});

test("une demande créée « en panne » le montre sur la fiche machine ; le bouton de la fiche machine, celui de la tuile Machine, et le filtre du parc le confirment", async ({
  page,
}) => {
  // ── 1. LE VOLET « NOUVELLE DEMANDE » PORTE « ÉTAT DE LA MACHINE » ───────
  await page.goto("/demandes?nouvelle=1");
  const volet = page.getByRole("dialog");
  await expect(volet).toBeVisible();

  await volet.locator('label:has(input[name="source"][value="appel"])').click();
  await choisirResultatParTexte(
    volet,
    "client_id",
    RAISON_SOCIALE,
    RAISON_SOCIALE,
  );
  await choisirResultatParTexte(volet, "site_id", LIBELLE_SITE, LIBELLE_SITE);

  const selectMachine = volet.locator('select[name="machine_id"]');
  await expect(selectMachine).toBeEnabled();
  await selectMachine.selectOption(MACHINE_ID);

  const etatDemande = volet.locator('select[name="etat_machine"]');
  await expect(etatDemande).toBeVisible();
  // PRÉREMPLI AVEC L'ÉTAT ACTUEL (9I8F) — « en service », l'état de
  // naissance de la fixture.
  await expect(etatDemande).toHaveValue("en_service");
  await etatDemande.selectOption("en_panne");

  await volet
    .locator('textarea[name="description"]')
    .fill("9I8F — demande déposée machine en panne");
  await volet
    .getByRole("button", { name: dictionnaire["demandes.volet.valider"] })
    .click();
  await page.waitForURL((url) => url.pathname === "/demandes");
  const idDemande = new URL(page.url()).searchParams.get("creee");
  expect(idDemande).not.toBeNull();
  if (idDemande !== null) idsDemandesCreees.push(idDemande);

  // ── 2. LA FICHE MACHINE AFFICHE « EN PANNE » ────────────────────────────
  await page.goto(`/parc/${MACHINE_ID}`);
  await expect(page.locator('[data-bloc="machine-page"]')).toBeVisible();
  // SCOPÉ AU `<h1>` DE LA FICHE — `components/navigation/bandeau-mobile.tsx`
  // porte le MÊME texte (titre + pastille), masqué à ce viewport mais
  // présent dans le DOM : `getByText` seul le trouverait en premier.
  await expect(
    page.locator("h1").getByText(dictionnaire["statut_machine.en_panne"]),
  ).toBeVisible();

  // ── 3. LE BOUTON « CHANGER L'ÉTAT » DE LA FICHE MACHINE ─────────────────
  const formulaireMachine = page.locator(
    `form[action="/api/machines/${MACHINE_ID}/changer-statut"]`,
  );
  await formulaireMachine
    .locator('select[name="statut"]')
    .selectOption("en_service");
  await formulaireMachine
    .getByRole("button", { name: dictionnaire["machine.changer_etat.bouton"] })
    .click();
  await page.waitForURL((url) => url.pathname === `/parc/${MACHINE_ID}`);
  await expect(
    page.locator("h1").getByText(dictionnaire["statut_machine.en_service"]),
  ).toBeVisible();

  // ── 4. L'ÉTAT DE LA MACHINE À LA CRÉATION D'UNE INTERVENTION ────────────
  await page.goto("/interventions/nouvelle");
  await choisirResultatParTexte(page, "site", LIBELLE_SITE, LIBELLE_SITE);
  await choisirMachine(page, MACHINE_ID);
  await page.locator('select[name="type"]').selectOption("curatif");
  await choisirPriorite(page, "p2");

  const etatIntervention = page.locator('select[name="etat_machine"]');
  await expect(etatIntervention).toBeVisible();
  await expect(etatIntervention).toHaveValue("en_service");
  await etatIntervention.selectOption("en_panne");

  await page
    .locator('textarea[name="description"]')
    .fill("9I8F — intervention créée machine en panne");
  await page
    .locator("#contenu")
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+(\?cree=1)?$/);
  const idIntervention = new URL(page.url()).pathname.split("/").pop();
  if (idIntervention !== undefined) idsInterventionsCreees.push(idIntervention);

  // ── 5. LA TUILE MACHINE PORTE L'ÉTAT ET LE BOUTON ───────────────────────
  await expect(
    page.getByText(dictionnaire["statut_machine.en_panne"]).first(),
  ).toBeVisible();
  const formulaireTuile = page.locator(
    `form[action="/api/machines/${MACHINE_ID}/changer-statut"]`,
  );
  await formulaireTuile
    .locator('select[name="statut"]')
    .selectOption("arretee");
  await formulaireTuile
    .getByRole("button", { name: dictionnaire["machine.changer_etat.bouton"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByText(dictionnaire["statut_machine.arretee"]).first(),
  ).toBeVisible();

  // ── 6. LE PARC, FILTRÉ « EN PANNE », MONTRE LA MACHINE ──────────────────
  const formulaireTuile2 = page.locator(
    `form[action="/api/machines/${MACHINE_ID}/changer-statut"]`,
  );
  await formulaireTuile2
    .locator('select[name="statut"]')
    .selectOption("en_panne");
  await formulaireTuile2
    .getByRole("button", { name: dictionnaire["machine.changer_etat.bouton"] })
    .click();
  await page.waitForLoadState("networkidle");

  await page.goto("/parc?statut=en_panne");
  await expect(page.getByText(NUMERO_SERIE).first()).toBeVisible();
});
