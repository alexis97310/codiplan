import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import {
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_TECHNICIEN_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * 9DT-TP-MOD2-INDICATEURS-DONNEES (QT-20, QE-19, MO-7, D170) — « Indicateurs
 * du mois » et « Données à compléter ».
 *
 * ## LA SCÈNE — préfixée `IND9DT`, créée et supprimée par l'épreuve
 *
 * Jamais `SCENE.*` : chaque tuile de ces deux pages compte une population qui
 * couvre TOUTE la société (le mois en cours, ou l'absence de code externe,
 * n'ont pas de filtre « cette épreuve seulement ») — un total ABSOLU serait
 * donc pollué par les scènes d'autres fichiers joués en parallèle
 * (`fullyParallel`), exactement le piège mesuré sur `porte-capacites.spec.ts`.
 * Chaque test ci-dessous se contente donc de vérifier que LA LIGNE CRÉÉE PAR
 * CETTE ÉPREUVE apparaît dans la liste que la tuile ouvre, jamais que la
 * tuile affiche un nombre absolu précis.
 *
 * `type: "expertise"` pour l'intervention — une nature rarement posée par les
 * autres scènes du dépôt, pour réduire (sans l'annuler) le risque qu'une
 * tuile « par nature » soit elle aussi polluée en même temps que ce test lit
 * sa valeur affichée (jamais utilisée ici de toute façon, voir ci-dessus).
 */

test.describe.configure({ mode: "serial" });

const SOCIETE_CODE = "CODIMA-NC";

let admin: PrismaClient;
let clientId: string;
let siteId: string;
let clientSansCodeId: string;
let interventionId: string;
let machineCompleteId: string;
let machineIncompleteId: string;
let familleId: string;
let modeleId: string;

test.beforeAll(async () => {
  admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });

  const societe = await admin.societe.findFirstOrThrow({
    where: { code: SOCIETE_CODE },
    select: { id: true, fuseau_horaire: true },
  });
  const agence = await admin.agence.findFirstOrThrow({
    where: { societe_id: societe.id },
    select: { id: true },
  });
  const fuseau = schemaFuseau.parse(societe.fuseau_horaire);
  // AUJOURD'HUI, DANS LE FUSEAU DE LA SOCIÉTÉ (L0-08) — `date_planifiee`
  // est une `@db.Date` : `instantDuJour` pose le jour CIVIL local à minuit
  // UTC, jamais `new Date()` nu, qui porterait le jour UTC de l'appareil et
  // pourrait désigner un AUTRE mois civil à Nouméa (UTC+11) tôt le matin.
  const aujourdHui = instantDuJour(jourDe(maintenant(fuseau).local));

  const client = await admin.client.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      raison_sociale: fr["ind9dt.e2e.client"],
      actif: true,
    },
  });
  clientId = client.id;

  const site = await admin.site.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      client_id: clientId,
      agence_id: agence.id,
      libelle: fr["ind9dt.e2e.site"],
    },
  });
  siteId = site.id;

  const clientSansCode = await admin.client.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      raison_sociale: fr["ind9dt.e2e.client_sans_code"],
      actif: true,
      code_externe: null,
    },
  });
  clientSansCodeId = clientSansCode.id;

  const famille = await admin.familleMateriel.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      code: `IND9DTFAM${randomUUID().slice(0, 6)}`,
      libelle: "IND9DT-Famille",
    },
  });
  familleId = famille.id;

  const modele = await admin.modeleMateriel.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      famille_id: familleId,
      marque: "IND9DTMARQUE",
      reference: "IND9DTREF",
    },
  });
  modeleId = modele.id;

  const intervention = await admin.intervention.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      client_id: clientId,
      site_id: siteId,
      agence_id: agence.id,
      type: "expertise",
      statut: "a_planifier",
      date_planifiee: aujourdHui,
    },
  });
  interventionId = intervention.id;

  const [machineComplete, machineIncomplete] = await Promise.all([
    admin.machine.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        modele_id: modeleId,
        client_id: clientId,
        site_id: siteId,
        qr_token: `IND9DTQR${randomUUID().slice(0, 20)}`,
        numero_serie: "IND9DT-SN-COMPLETE",
        source_creation: "terrain",
        complet: true,
      },
    }),
    admin.machine.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        modele_id: modeleId,
        client_id: clientId,
        site_id: siteId,
        qr_token: `IND9DTQR${randomUUID().slice(0, 20)}`,
        numero_serie: "IND9DT-SN-INCOMPLETE",
        source_creation: "back_office",
        complet: false,
      },
    }),
  ]);
  machineCompleteId = machineComplete.id;
  machineIncompleteId = machineIncomplete.id;
});

test.afterAll(async () => {
  try {
    await admin.intervention.deleteMany({ where: { id: interventionId } });
    await admin.machine.deleteMany({ where: { modele_id: modeleId } });
    await admin.modeleMateriel.delete({ where: { id: modeleId } });
    await admin.familleMateriel.delete({ where: { id: familleId } });
    await admin.site.deleteMany({ where: { id: siteId } });
    await admin.client.deleteMany({
      where: { id: { in: [clientId, clientSansCodeId] } },
    });
  } finally {
    await admin.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
});

test("Indicateurs du mois — la tuile « Expertise » planifiée mène au registre, qui contient l'intervention de l'épreuve", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/indicateurs");

  const tuile = page.locator('[data-bloc="kpi-planifiees-expertise"]');
  await expect(tuile).toBeVisible();
  const lien = tuile.locator("a");
  await expect(lien).toHaveAttribute("href", /^\/interventions\?/);
  await expect(lien).toHaveAttribute("href", /type=expertise/);

  await lien.click();
  // SCOPÉ AU TABLEAU (TP-UX3-1-REGISTRE-2) — la carte du téléphone
  // (`components/ui/liste-cartes.tsx`) porte, dans le DOM, le MÊME `href`
  // que la ligne du tableau (CSS la masque sous 900 px, jamais retirée du
  // DOM) ; une requête non scopée au tableau résout donc à DEUX éléments.
  await expect(
    page.locator(`tbody a[href^="/interventions/${interventionId}"]`),
  ).toBeVisible();
});

test("Indicateurs du mois — la tuile « Terrain » des machines ajoutées mène au parc, qui contient la machine de l'épreuve", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/indicateurs");

  const tuile = page.locator('[data-bloc="kpi-machines-terrain"]');
  await expect(tuile).toBeVisible();
  const lien = tuile.locator("a");
  await expect(lien).toHaveAttribute("href", /^\/parc\?/);
  await expect(lien).toHaveAttribute("href", /origine=terrain/);

  await lien.click();
  await expect(
    page.locator(
      `[data-bloc="liste-machines"] a[href*="${machineCompleteId}"]`,
    ),
  ).toBeVisible();
});

test("Données à compléter — les quatre tuiles mènent chacune à la bonne liste", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/parametres/donnees");

  await expect(
    page.locator('[data-bloc="kpi-interventions-sans-duree"] a'),
  ).toHaveAttribute("href", "/interventions?sans_duree_a_venir=1&vue=toutes");
  await expect(
    page.locator('[data-bloc="kpi-vgp-a-determiner"] a'),
  ).toHaveAttribute("href", "/vgp/a-determiner");
  await expect(
    page.locator('[data-bloc="kpi-clients-sans-code"] a'),
  ).toHaveAttribute("href", "/clients?sans_code_externe=1&sans_equipement=1");
  await expect(
    page.locator('[data-bloc="kpi-machines-incompletes"] a'),
  ).toHaveAttribute("href", "/parc?incompletes=1");
});

test("Données à compléter — « Clients sans code externe » mène à la bonne URL ; une recherche par la raison sociale de l'épreuve y retrouve le client", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/parametres/donnees");
  await page.locator('[data-bloc="kpi-clients-sans-code"] a').click();
  await expect(page).toHaveURL(
    "/clients?sans_code_externe=1&sans_equipement=1",
  );
  // ADDENDUM 2 (I1, 06/10/2026) — SANS FILTRE DE TEXTE, ce client n'apparaît
  // que s'il tombe sur la PREMIÈRE PAGE (50 lignes) de TOUS les clients sans
  // code de la société : un rang qui dépend de la scène des AUTRES fichiers
  // joués en parallèle (`fullyParallel`). Un filtre propre à l'épreuve (sa
  // propre raison sociale) rend l'assertion indépendante du rang, sans
  // changer l'attente ci-dessus (l'URL du lien du KPI, SANS filtre).
  await page.goto(
    `/clients?sans_code_externe=1&sans_equipement=1&q=${encodeURIComponent(fr["ind9dt.e2e.client_sans_code"])}`,
  );
  await expect(
    page.locator(`a[href="/clients/${clientSansCodeId}"]`),
  ).toBeVisible();
});

test("Données à compléter — « Machines incomplètes » mène à la liste, qui contient la machine de l'épreuve", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/parametres/donnees");
  await page.locator('[data-bloc="kpi-machines-incompletes"] a').click();
  await expect(page).toHaveURL("/parc?incompletes=1");
  await expect(
    page.locator(
      `[data-bloc="liste-machines"] a[href*="${machineIncompleteId}"]`,
    ),
  ).toBeVisible();
});

test("le technicien n'accède ni aux Indicateurs du mois ni aux Données à compléter", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);

  await page.goto("/indicateurs");
  await expect(page.getByRole("status")).toContainText(fr["auth.refus_droit"]);

  await page.goto("/parametres/donnees");
  await expect(page.getByRole("status")).toContainText(fr["auth.refus_droit"]);
});

test("l'ADV accède à « Données à compléter »", async ({ page }) => {
  await ouvrirUneSession(page);
  await page.goto("/parametres/donnees");
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(
    page.locator('[data-bloc="kpi-clients-sans-code"]'),
  ).toBeVisible();
});
