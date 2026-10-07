import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import {
  libelleAfficherClientsMasques,
  titreSansCode,
} from "@/app/(back-office)/clients/presentation";
import { libelleZone } from "@/app/(back-office)/sites/presentation";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EB-TP-UX3-2-LISTES-1 — LES PUCES DE VUE, LE TRI ET LES CARTES DE
 * `/clients` ET `/sites`, AU GABARIT DE LA MAQUETTE DU 28/09.
 *
 * ## Ce que ce fichier prouve, et que rien d'autre ne peut prouver
 *
 * Les épreuves d'isolation (`tests/isolation/resume-cartes-clients.test.ts`,
 * `resume-cartes-sites.test.ts`) prouvent que les fonctions de dépôt
 * GROUPÉES comptent juste. Elles ne prouvent pas qu'un ÉCRAN RÉEL pose les
 * quatre puces, qu'une puce cliquée ouvre bien la liste que son chiffre
 * annonce, que « Trier par » change réellement l'ordre dans le navigateur, ni
 * que la carte entière — et pas seulement son titre — ouvre la fiche.
 *
 * ## Scène dédiée, préfixée, créée et supprimée par ce fichier
 *
 * Jamais `SCENE.*` ni le semis (`prisma/seed*.ts`) : trois clients (un
 * inactif, un sans code de rapprochement, un avec donneur d'ordre), leurs
 * sites (un sans zone, un à trajet inconnu — qui RECOUVRE le premier, zone
 * nulle étant aussi un trajet inconnu —, un sous contrat sur le client
 * inactif), des machines (une sortie du parc) et deux interventions (une à
 * planifier, deux datées pour éprouver le tri).
 */

test.describe.configure({ mode: "serial" });

const PREFIXE = `9EB1E2E-${randomUUID().slice(0, 8)}`;
const NOM_DONNEUR_ORDRE = `${PREFIXE} ${fr["listes1.e2e.donneur_ordre"]}`;

let admin: PrismaClient;
let clientActifId: string;
let clientInactifId: string;
let clientSansCodeId: string;
let siteSansZoneId: string;
let siteTrajetInconnuId: string;
let siteSousContratId: string;

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
  const modele = await admin.modeleMateriel.findFirstOrThrow({
    where: { societe_id: societe.id },
    select: { id: true },
  });

  const clientActif = await admin.client.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      raison_sociale: `${PREFIXE} Client actif`,
      code_externe: `${PREFIXE}-C1`,
      actif: true,
    },
  });
  clientActifId = clientActif.id;

  const clientInactif = await admin.client.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      raison_sociale: `${PREFIXE} Client inactif`,
      code_externe: `${PREFIXE}-C2`,
      actif: false,
    },
  });
  clientInactifId = clientInactif.id;

  const clientSansCode = await admin.client.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      raison_sociale: `${PREFIXE} Client sans code`,
      code_externe: null,
      actif: true,
    },
  });
  clientSansCodeId = clientSansCode.id;

  const siteSansZone = await admin.site.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      client_id: clientActifId,
      agence_id: agence.id,
      libelle: `${PREFIXE} Site sans zone`,
      zone_geo: null,
    },
  });
  siteSansZoneId = siteSansZone.id;

  const siteTrajetInconnu = await admin.site.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      client_id: clientSansCodeId,
      agence_id: agence.id,
      libelle: `${PREFIXE} Site Îles`,
      zone_geo: "iles",
    },
  });
  siteTrajetInconnuId = siteTrajetInconnu.id;

  const siteSousContrat = await admin.site.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      client_id: clientInactifId,
      agence_id: agence.id,
      libelle: `${PREFIXE} Site sous contrat`,
      zone_geo: "grand_noumea",
      sous_contrat: true,
    },
  });
  siteSousContratId = siteSousContrat.id;

  await admin.machine.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      modele_id: modele.id,
      client_id: clientActifId,
      site_id: siteSansZoneId,
      numero_serie: `${PREFIXE}-SN-ACTIVE`,
      qr_token: `${PREFIXE}-QR-ACTIVE`,
      statut: "en_service",
    },
  });
  await admin.machine.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      modele_id: modele.id,
      client_id: clientActifId,
      site_id: siteSansZoneId,
      numero_serie: `${PREFIXE}-SN-SORTIE`,
      qr_token: `${PREFIXE}-QR-SORTIE`,
      statut: "remplacee",
    },
  });

  await admin.contact.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      client_id: clientActifId,
      site_id: null,
      nom: NOM_DONNEUR_ORDRE,
      email: `${PREFIXE.toLowerCase()}@exemple.test`,
      roles: ["donneur_ordre"],
      actif: true,
    },
  });

  await admin.intervention.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      client_id: clientActifId,
      site_id: siteSansZoneId,
      agence_id: agence.id,
      type: "curatif",
      statut: "a_planifier",
    },
  });
  // DEUX interventions DATÉES, sur deux clients différents, pour que
  // « Trier par : Dernière intervention » ait un ordre à inverser par
  // rapport à l'alphabétique (« Client actif » < « Client sans code »).
  const hier = new Date();
  hier.setUTCDate(hier.getUTCDate() - 1);
  const avantHier = new Date();
  avantHier.setUTCDate(avantHier.getUTCDate() - 2);
  await admin.intervention.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      client_id: clientActifId,
      site_id: siteSansZoneId,
      agence_id: agence.id,
      type: "curatif",
      statut: "terminee",
      date_planifiee: avantHier,
    },
  });
  await admin.intervention.create({
    data: {
      id: randomUUID(),
      societe_id: societe.id,
      client_id: clientSansCodeId,
      site_id: siteTrajetInconnuId,
      agence_id: agence.id,
      type: "curatif",
      statut: "terminee",
      date_planifiee: hier,
    },
  });
});

test.afterAll(async () => {
  try {
    await admin.intervention.deleteMany({
      where: { client_id: { in: [clientActifId, clientSansCodeId] } },
    });
    await admin.machine.deleteMany({ where: { client_id: clientActifId } });
    await admin.contact.deleteMany({ where: { client_id: clientActifId } });
    await admin.site.deleteMany({
      where: {
        id: { in: [siteSansZoneId, siteTrajetInconnuId, siteSousContratId] },
      },
    });
    await admin.client.deleteMany({
      where: { id: { in: [clientActifId, clientInactifId, clientSansCodeId] } },
    });
  } finally {
    await admin.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("/clients — vue par défaut « Actifs », chaque puce ouvre la liste de son propre chiffre, le tri change l'ordre, et la carte montre le donneur d'ordre", async ({
  page,
}) => {
  await page.goto(
    `/clients?q=${encodeURIComponent(PREFIXE)}&sans_equipement=1`,
  );

  // VUE PAR DÉFAUT « Actifs » (D179) : le client inactif est HORS liste.
  await expect(
    page.locator(`article:has(a[href="/clients/${clientActifId}"])`),
  ).toBeVisible();
  await expect(
    page.locator(`article:has(a[href="/clients/${clientSansCodeId}"])`),
  ).toBeVisible();
  await expect(
    page.locator(`article:has(a[href="/clients/${clientInactifId}"])`),
  ).toHaveCount(0);

  // CHAQUE PUCE PORTE LE CHIFFRE DE SA PROPRE LISTE — vérifié en l'ouvrant.
  const puceInactifs = page.getByRole("link", {
    name: new RegExp(`^${fr["clients.filtre.inactifs"]}`),
  });
  await expect(puceInactifs).toContainText(String(1));
  await puceInactifs.click();
  await expect(page).toHaveURL(/etat=inactifs/);
  await expect(
    page.locator(`article:has(a[href="/clients/${clientInactifId}"])`),
  ).toBeVisible();
  await expect(
    page.locator(`article:has(a[href="/clients/${clientActifId}"])`),
  ).toHaveCount(0);

  await page.goto(
    `/clients?q=${encodeURIComponent(PREFIXE)}&sans_equipement=1`,
  );
  const puceSansCode = page.getByRole("link", {
    // CODIMA-NC nomme son ERP « Code Winpro » (prisma/seed-data.ts, D29) :
    // le libellé de la puce n'est jamais le générique de `libelleCodeExterne(null)`.
    name: new RegExp(`^${titreSansCode("Code Winpro")}`),
  });
  await puceSansCode.click();
  await expect(page).toHaveURL(/sans_code_externe=1/);
  await expect(
    page.locator(`article:has(a[href="/clients/${clientSansCodeId}"])`),
  ).toBeVisible();
  await expect(
    page.locator(`article:has(a[href="/clients/${clientActifId}"])`),
  ).toHaveCount(0);

  // « TOUS » REND LES TROIS, le client inactif compris.
  const puceTous = page.getByRole("link", {
    name: new RegExp(`^${fr["clients.vue_tous"]}`),
  });
  await puceTous.click();
  await expect(page).toHaveURL(/etat=tous/);
  for (const id of [clientActifId, clientInactifId, clientSansCodeId]) {
    await expect(
      page.locator(`article:has(a[href="/clients/${id}"])`),
    ).toBeVisible();
  }

  // « TRIER PAR : DERNIÈRE INTERVENTION » — « Client sans code » (hier) passe
  // DEVANT « Client actif » (avant-hier), l'inverse de l'alphabétique.
  await page
    .locator('select[name="tri"]')
    .selectOption("derniere_intervention");
  await page.getByRole("button", { name: fr["clients.rechercher"] }).click();
  await expect(page).toHaveURL(/tri=derniere_intervention/);
  const cartesTriees = page.locator("article");
  const premiereCarte = cartesTriees.first();
  await expect(
    premiereCarte.locator(`a[href="/clients/${clientSansCodeId}"]`),
  ).toBeVisible();

  // LA CARTE DU CLIENT ACTIF MONTRE SON DONNEUR D'ORDRE, ET LA CARTE ENTIÈRE
  // OUVRE LA FICHE (un seul <a>, étendu à toute la carte).
  await page.goto(
    `/clients?q=${encodeURIComponent(PREFIXE)}&etat=actifs&sans_equipement=1`,
  );
  const carteActif = page
    .locator("article")
    .filter({ hasText: `${PREFIXE} Client actif` });
  await expect(
    carteActif.getByText(fr["listes1.e2e.donneur_ordre"]),
  ).toBeVisible();
  await expect(carteActif.locator("a")).toHaveCount(1);
  await carteActif.click();
  await expect(page).toHaveURL(`/clients/${clientActifId}`);
});

test("/clients — le masquage LISTES-1 garde son critère : un client sans aucune machine n'est pas masqué, la case n'affiche sa phrase que pour ceux qui le sont", async ({
  page,
}) => {
  // « Client sans code » n'a AUCUNE machine enregistrée : sans la case, il
  // serait masqué par LISTES-1 — mais ce scénario le trouve déjà (tests
  // ci-dessus, vue « Sans <code> », sans la case). Ce test-ci vérifie
  // l'INVERSE : un client qui A une machine (« Client actif ») n'est jamais
  // compté dans la phrase de masquage, quelle que soit la vue.
  await page.goto(
    `/clients?q=${encodeURIComponent(PREFIXE)}&sans_code_externe=1`,
  );
  await expect(
    page.getByRole("link", { name: libelleAfficherClientsMasques() }),
  ).toBeVisible();
});

test("/sites — vue par défaut « Sites des clients actifs », « Sans zone », « Trajet inconnu » (qui la recouvre), « Clients inactifs », et la pastille Sous contrat", async ({
  page,
}) => {
  await page.goto(`/sites?q=${encodeURIComponent(PREFIXE)}&sans_equipement=1`);

  // VUE PAR DÉFAUT : seuls les sites des clients ACTIFS — le site sous
  // contrat (client inactif) en est hors.
  await expect(
    page.locator(`article:has(a[href="/sites/${siteSansZoneId}"])`),
  ).toBeVisible();
  await expect(
    page.locator(`article:has(a[href="/sites/${siteTrajetInconnuId}"])`),
  ).toBeVisible();
  await expect(
    page.locator(`article:has(a[href="/sites/${siteSousContratId}"])`),
  ).toHaveCount(0);

  // « SANS ZONE » — seul le site sans `zone_geo`.
  await page.goto(
    `/sites?q=${encodeURIComponent(PREFIXE)}&vue=sans_zone&sans_equipement=1`,
  );
  await expect(
    page.locator(`article:has(a[href="/sites/${siteSansZoneId}"])`),
  ).toBeVisible();
  await expect(
    page.locator(`article:has(a[href="/sites/${siteTrajetInconnuId}"])`),
  ).toHaveCount(0);
  await expect(page.getByText(libelleZone(null)).first()).toBeVisible();

  // « TRAJET INCONNU » RECOUVRE « SANS ZONE » — zone nulle N'A pas non plus
  // de trajet déductible, donc les DEUX sites s'y retrouvent.
  await page.goto(
    `/sites?q=${encodeURIComponent(PREFIXE)}&vue=trajet_inconnu&sans_equipement=1`,
  );
  await expect(
    page.locator(`article:has(a[href="/sites/${siteSansZoneId}"])`),
  ).toBeVisible();
  await expect(
    page.locator(`article:has(a[href="/sites/${siteTrajetInconnuId}"])`),
  ).toBeVisible();

  // « CLIENTS INACTIFS » — seul le site sous contrat, AVEC sa pastille.
  await page.goto(
    `/sites?q=${encodeURIComponent(PREFIXE)}&vue=inactifs&sans_equipement=1`,
  );
  const carteSousContrat = page
    .locator("article")
    .filter({ hasText: `${PREFIXE} Site sous contrat` });
  await expect(carteSousContrat).toBeVisible();
  await expect(
    carteSousContrat.getByText(fr["sites.badge_sous_contrat"], {
      exact: true,
    }),
  ).toBeVisible();
  await expect(carteSousContrat.locator("a")).toHaveCount(1);
  await carteSousContrat.click();
  await expect(page).toHaveURL(`/sites/${siteSousContratId}`);
});
