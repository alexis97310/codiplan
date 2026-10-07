import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES AVANT/APRÈS DE 9EB-TP-UX3-2-LISTES-1 — même recette que
 * `zz-captures-9dn.spec.ts` (mémoire de session « captures-avant-apres-e2e »)
 * : ce fichier tourne une fois dans un worktree sur le dernier commit AVANT
 * ce ticket (`CAPTURES_9EB1_ETAPE=avant`), une fois ici, sur le code livré
 * (APRÈS — `CAPTURES_9EB1_ETAPE=apres`). Rien n'est écrit sans `CAPTURES_9EB1`
 * (le dossier), pour que `pnpm test:e2e` ordinaire n'écrive jamais de
 * fichier.
 *
 * **Les assertions restent minimales** — `page.locator("main")` visible,
 * rien de plus : ce fichier doit passer SANS MODIFICATION sur le code
 * d'AVANT ce ticket, qui ne connaît ni les puces de vue, ni la bande de
 * chiffres, ni la carte entière cliquable. Seule la navigation et la
 * capture comptent ; le RENDU peut différer d'une étape à l'autre, et c'est
 * tout le sens de la paire.
 *
 * **SA PROPRE SCÈNE, préfixée `9EB1-CAPT-`** — trois clients, trois sites,
 * créés en `beforeAll`, supprimés en `afterAll`. Jamais `SCENE.*` ni le
 * semis.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9EB1 ?? "";
const ETAPE = process.env.CAPTURES_9EB1_ETAPE ?? "avant";

// SANS CAPTURES_9EB1, CE FICHIER NE CRÉE RIEN — même garde que les autres
// specs `zz-captures-*` : `pnpm test:e2e` ordinaire ne doit jamais forger
// cette scène pour ne rien en faire.
test.skip(DOSSIER === "", "capture inerte sans CAPTURES_9EB1");

const CLIENT_ACTIF = randomUUID();
const SITE_ACTIF = randomUUID();
const CLIENT_SANS_CODE = randomUUID();
const SITE_TRAJET_INCONNU = randomUUID();
const CLIENT_INACTIF = randomUUID();
const SITE_SOUS_CONTRAT = randomUUID();
const INTERVENTION_RECENTE = randomUUID();
const INTERVENTION_ANCIENNE = randomUUID();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.intervention.deleteMany({
    where: { id: { in: [INTERVENTION_RECENTE, INTERVENTION_ANCIENNE] } },
  });
  await client.contact.deleteMany({
    where: {
      client_id: { in: [CLIENT_ACTIF, CLIENT_SANS_CODE, CLIENT_INACTIF] },
    },
  });
  await client.site.deleteMany({
    where: { id: { in: [SITE_ACTIF, SITE_TRAJET_INCONNU, SITE_SOUS_CONTRAT] } },
  });
  await client.client.deleteMany({
    where: { id: { in: [CLIENT_ACTIF, CLIENT_SANS_CODE, CLIENT_INACTIF] } },
  });
}

test.beforeAll(async () => {
  const client = admin();
  try {
    await nettoyer(client);
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_ACTIF,
        societe_id: societe.id,
        raison_sociale: "9EB1-CAPT-Garage de la Baie",
        code_externe: "9EB1-CAPT-001",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ACTIF,
        societe_id: societe.id,
        client_id: CLIENT_ACTIF,
        agence_id: agence.id,
        libelle: "9EB1-CAPT-Atelier",
        commune: "Nouméa",
        zone_geo: "grand_noumea",
      },
    });
    await client.contact.create({
      data: {
        id: randomUUID(),
        societe_id: societe.id,
        client_id: CLIENT_ACTIF,
        site_id: null,
        nom: "9EB1-CAPT- Jeanne Wamytan",
        email: "9eb1-capt-jwamytan@exemple.test",
        roles: ["donneur_ordre"],
        actif: true,
      },
    });
    const hier = new Date();
    hier.setUTCDate(hier.getUTCDate() - 1);
    const ilYA400Jours = new Date();
    ilYA400Jours.setUTCDate(ilYA400Jours.getUTCDate() - 400);
    await client.intervention.create({
      data: {
        id: INTERVENTION_RECENTE,
        societe_id: societe.id,
        client_id: CLIENT_ACTIF,
        site_id: SITE_ACTIF,
        agence_id: agence.id,
        type: "curatif",
        statut: "terminee",
        date_planifiee: hier,
      },
    });

    await client.client.create({
      data: {
        id: CLIENT_SANS_CODE,
        societe_id: societe.id,
        raison_sociale: "9EB1-CAPT-Dépôt de Païta",
        code_externe: null,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_TRAJET_INCONNU,
        societe_id: societe.id,
        client_id: CLIENT_SANS_CODE,
        agence_id: agence.id,
        libelle: "9EB1-CAPT-Entrepôt",
        commune: "Lifou",
        zone_geo: "iles",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_ANCIENNE,
        societe_id: societe.id,
        client_id: CLIENT_SANS_CODE,
        site_id: SITE_TRAJET_INCONNU,
        agence_id: agence.id,
        type: "curatif",
        statut: "terminee",
        date_planifiee: ilYA400Jours,
      },
    });

    await client.client.create({
      data: {
        id: CLIENT_INACTIF,
        societe_id: societe.id,
        raison_sociale: "9EB1-CAPT-Transport du Nord",
        actif: false,
      },
    });
    await client.site.create({
      data: {
        id: SITE_SOUS_CONTRAT,
        societe_id: societe.id,
        client_id: CLIENT_INACTIF,
        agence_id: agence.id,
        libelle: "9EB1-CAPT-Dépôt",
        commune: "Koné",
        sous_contrat: true,
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
});

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${ETAPE}-${largeur}.png`),
    fullPage: true,
  });
}

const PREFIXE_RECHERCHE = "9EB1-CAPT-";

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirUneSession(page);
    });

    test(`capture — /clients, vue par défaut, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto(
        `/clients?q=${encodeURIComponent(PREFIXE_RECHERCHE)}&sans_equipement=1`,
      );
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, "clients-defaut", largeur);
    });

    test(`capture — /clients, « Sans code », à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto(
        `/clients?q=${encodeURIComponent(PREFIXE_RECHERCHE)}&sans_equipement=1&sans_code_externe=1`,
      );
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, "clients-sans-code", largeur);
    });

    test(`capture — /clients, tri « Dernière intervention », à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto(
        `/clients?q=${encodeURIComponent(PREFIXE_RECHERCHE)}&sans_equipement=1&etat=tous&tri=derniere_intervention`,
      );
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, "clients-tri-derniere-intervention", largeur);
    });

    test(`capture — /sites, vue par défaut, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto(
        `/sites?q=${encodeURIComponent(PREFIXE_RECHERCHE)}&sans_equipement=1`,
      );
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, "sites-defaut", largeur);
    });

    test(`capture — /sites, « Trajet inconnu », à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto(
        `/sites?q=${encodeURIComponent(PREFIXE_RECHERCHE)}&sans_equipement=1&vue=trajet_inconnu`,
      );
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, "sites-trajet-inconnu", largeur);
    });

    test(`capture — /sites, filtré par client, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto(`/sites?client=${CLIENT_INACTIF}&sans_equipement=1`);
      await expect(page.locator("main")).toBeVisible();
      await capturer(page, "sites-client", largeur);
    });
  });
}
