import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import {
  agenceDeduiteDuSite,
  aideRechercheSite,
  libelleChampObligatoire,
  libelleChoisirLeLieuDabord,
} from "@/app/(back-office)/interventions/presentation";
import { fr, mot } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 92-CREATION-2 (25/09/2026) — l'audit d'ergonomie du même jour, constats 7
 * et 8, mesurés sur `/interventions/nouvelle` :
 *
 * - aucun champ obligatoire n'était signalé (Site, Type, panne signalée) ;
 * - Machine et Contact affichaient « Aucune machine » / « Aucun contact »
 *   avant même qu'un lieu soit choisi, sans dire pourquoi ;
 * - un lieu qui porte le nom de son client s'affichait deux fois de suite
 *   (« AUTOPOINT DUCOS — AUTOPOINT DUCOS », mesuré en production).
 *
 * ## Ce que ce scénario prouve, et que rien d'autre ne peut prouver
 *
 * `tests/unit/presentation/libelle-client-site.test.ts` prouve que
 * `libelleClientSite` compose juste, en isolation. Il ne prouve pas qu'un
 * lieu RÉEL, dont le libellé est identique à celui de son client, ressort
 * bien SANS doublon — ni dans la suggestion du sélecteur, ni dans la valeur
 * retenue par `?site=` — c'est l'objet de ce fichier.
 *
 * ## Scène propre, préfixée `CREA2-`, créée et supprimée par l'épreuve
 *
 * Un client et son lieu, au MÊME libellé, plus une machine attachée — sans
 * elle, rien ne prouverait que la liste des machines se peuple bien une fois
 * le lieu choisi. Aucune ligne ajoutée au semis (`prisma/seed*.ts`).
 */

test.describe.configure({ mode: "serial" });

const CLIENT_ET_LIEU = fr["creation2.e2e.client_et_lieu"];

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/92-CREATION-2/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-1280.png`),
    fullPage: true,
  });
}

let admin: PrismaClient;
let clientId: string;
let siteId: string;
let familleId: string;
let modeleId: string;
let machineId: string;

test.beforeAll(async () => {
  admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });

  const societe = await admin.societe.findFirstOrThrow({
    where: { code: "CODIMA-NC" },
    select: { id: true },
  });
  const agence = await admin.agence.findFirstOrThrow({
    where: { societe_id: societe.id },
    select: { id: true },
  });

  const client = await admin.client.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      raison_sociale: CLIENT_ET_LIEU,
      actif: true,
    },
  });
  clientId = client.id;

  // LE LIEU PORTE LE MÊME NOM QUE SON CLIENT (constat 7) — la seule scène qui
  // prouve que le libellé composé ne se répète pas.
  const site = await admin.site.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      client_id: clientId,
      agence_id: agence.id,
      libelle: CLIENT_ET_LIEU,
    },
  });
  siteId = site.id;

  const famille = await admin.familleMateriel.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      code: `CREA2FAM${randomUUID().slice(0, 6)}`,
      libelle: "CREA2 — Famille de l'épreuve",
    },
  });
  familleId = famille.id;
  const modele = await admin.modeleMateriel.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      famille_id: familleId,
      marque: "CREA2MARQUE",
      reference: "CREA2REF",
    },
  });
  modeleId = modele.id;

  const machine = await admin.machine.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      modele_id: modeleId,
      client_id: clientId,
      site_id: siteId,
      qr_token: `CREA2QR${randomUUID().slice(0, 20)}`,
      numero_serie: "CREA2-SN-1",
    },
  });
  machineId = machine.id;
});

test.afterAll(async () => {
  try {
    await admin.machine.deleteMany({ where: { id: machineId } });
    await admin.modeleMateriel.delete({ where: { id: modeleId } });
    await admin.familleMateriel.delete({ where: { id: familleId } });
    await admin.site.deleteMany({ where: { id: siteId } });
    await admin.client.deleteMany({ where: { id: clientId } });
  } finally {
    await admin.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirUneSession(page);
});

test("Machine et Contact restent désactivés tant qu'aucun lieu n'est choisi, puis se peuplent sans doubler un lieu nommé comme son client", async ({
  page,
}) => {
  await page.goto("/interventions/nouvelle");

  const champSite = page.locator('[data-selecteur="site"]');
  const saisieSite = champSite.locator('input[type="text"]');
  const selectMachine = page.locator('select[name="machine_ids"]');
  const selectContact = page.locator('select[name="contact_id"]');
  const mentionChoisirDabord = libelleChoisirLeLieuDabord();

  // ── AVANT LE CHOIX DU LIEU (constat 7) ──────────────────────────────────
  await expect(champSite).toContainText(libelleChampObligatoire(mot("site")));
  await expect(champSite).toContainText(aideRechercheSite());
  await expect(
    page.locator('form[action="/api/interventions/creer"]'),
  ).toContainText(agenceDeduiteDuSite());

  await expect(selectMachine).toBeDisabled();
  await expect(selectMachine.locator("option")).toHaveText([
    mentionChoisirDabord,
  ]);
  await expect(selectContact).toBeDisabled();
  await expect(selectContact.locator("option")).toHaveText([
    mentionChoisirDabord,
  ]);

  await capturer(page, "avant-choix-du-lieu");

  // ── LA RECHERCHE NE DOUBLE PAS UN LIEU NOMMÉ COMME SON CLIENT ───────────
  await saisieSite.click();
  await saisieSite.fill(CLIENT_ET_LIEU);
  const resultat = champSite
    .locator('ul[role="listbox"] li[role="option"]')
    .first();
  await expect(resultat).toBeVisible();
  await expect(resultat).toHaveText(CLIENT_ET_LIEU);
  await resultat.click();
  await expect(saisieSite).toHaveValue(CLIENT_ET_LIEU);

  // ── APRÈS LE CHOIX, LA LISTE SE REMPLIT ─────────────────────────────────
  await expect(selectMachine).toBeEnabled();
  await expect(selectMachine.locator("option").first()).toHaveText(
    fr["intervention.machine.aucune_choisie"],
  );
  await expect(
    selectMachine.locator(`option[value="${machineId}"]`),
  ).toBeAttached();

  await expect(selectContact).toBeEnabled();
  await expect(selectContact.locator("option").first()).toHaveText(
    fr["intervention.aucun_contact"],
  );

  await capturer(page, "apres-choix-du-lieu");
});

test("?site= ne double pas non plus un lieu nommé comme son client", async ({
  page,
}) => {
  await page.goto(`/interventions/nouvelle?site=${siteId}`);
  await expect(
    page.locator('[data-selecteur="site"] input[type="text"]'),
  ).toHaveValue(CLIENT_ET_LIEU);
});
