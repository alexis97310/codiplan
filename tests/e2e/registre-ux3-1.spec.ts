import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import {
  instantDuJour,
  jourDe,
  maintenant,
  schemaFuseau,
} from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_ADMIN_SOCIETE_EPREUVE, COMPTE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * 9EA-TP-UX3-1-REGISTRE-1 — ONGLETS À COMPTEUR, FILTRES COMPACTS, RÉSUMÉ ET
 * DENSITÉ (QE-8).
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9EA1-` — jamais `tests/e2e/setup/scene.ts`
 *
 * Un client et un site à soi, sept interventions — une par onglet principal,
 * dont deux « à planifier » (P1 et P2, P2 la plus ancienne) pour éprouver
 * l'ordre et le filtre priorité. Créée en `beforeAll`, supprimée en
 * `afterAll` ; la recherche `q=9EA1-` isole ces lignes de toute autre scène
 * ou donnée de démonstration, sous `fullyParallel` (voir le PIÈGE CONNU du
 * ticket).
 */

test.describe.configure({ mode: "serial" });

const dictionnaire = fr as Record<string, string>;

const CLIENT_9EA1 = "9ea10000-0000-7000-8000-0000000000c1";
const SITE_9EA1 = "9ea10000-0000-7000-8000-0000000000c2";

const INTERVENTION_P1 = "9ea10000-0000-7000-8000-000000000001";
const INTERVENTION_P2 = "9ea10000-0000-7000-8000-000000000002";
const INTERVENTION_AUJOURDHUI = "9ea10000-0000-7000-8000-000000000003";
const INTERVENTION_EN_COURS = "9ea10000-0000-7000-8000-000000000004";
const INTERVENTION_BLOQUEE = "9ea10000-0000-7000-8000-000000000005";
const INTERVENTION_A_CONTROLER = "9ea10000-0000-7000-8000-000000000006";
const INTERVENTION_HISTORIQUE = "9ea10000-0000-7000-8000-000000000007";

const TOUTES_LES_INTERVENTIONS = [
  INTERVENTION_P1,
  INTERVENTION_P2,
  INTERVENTION_AUJOURDHUI,
  INTERVENTION_EN_COURS,
  INTERVENTION_BLOQUEE,
  INTERVENTION_A_CONTROLER,
  INTERVENTION_HISTORIQUE,
];

const DATE_HORS_AUJOURDHUI = new Date("2024-01-15T00:00:00.000Z");
/** Antérieure à `INTERVENTION_P2` — pour que P1 soit créée APRÈS P2, et que
 * l'ordre (priorité, puis la plus ancienne) ne les départage que par la
 * priorité, jamais par accident de date de création. */
const CREE_IL_Y_A_DEUX_JOURS = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
const CREE_IL_Y_A_UN_JOUR = new Date(Date.now() - 24 * 60 * 60 * 1000);

async function ecrireLaScene(): Promise<void> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true, fuseau_horaire: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
      orderBy: { code: "asc" },
    });

    await client.intervention.deleteMany({
      where: { id: { in: TOUTES_LES_INTERVENTIONS } },
    });
    await client.site.deleteMany({ where: { id: SITE_9EA1 } });
    await client.client.deleteMany({ where: { id: CLIENT_9EA1 } });

    await client.client.create({
      data: {
        id: CLIENT_9EA1,
        societe_id: societe.id,
        raison_sociale: "Client 9EA1- (épreuve TP-UX3-1-REGISTRE-1)",
      },
    });
    await client.site.create({
      data: {
        id: SITE_9EA1,
        societe_id: societe.id,
        client_id: CLIENT_9EA1,
        agence_id: agence.id,
        libelle: "Lieu 9EA1- (épreuve TP-UX3-1-REGISTRE-1)",
        temps_trajet_min: 10,
      },
    });

    const fuseau = schemaFuseau.parse(societe.fuseau_horaire);
    const aujourdhui = instantDuJour(jourDe(maintenant(fuseau).local));

    const base = {
      societe_id: societe.id,
      agence_id: agence.id,
      client_id: CLIENT_9EA1,
      site_id: SITE_9EA1,
      type: "curatif" as const,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
    };

    await client.intervention.create({
      data: {
        id: INTERVENTION_P2,
        ...base,
        priorite: "p2",
        statut: "a_planifier",
        date_planifiee: null,
        cree_le: CREE_IL_Y_A_DEUX_JOURS,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_P1,
        ...base,
        priorite: "p1",
        statut: "a_planifier",
        date_planifiee: null,
        cree_le: CREE_IL_Y_A_UN_JOUR,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_AUJOURDHUI,
        ...base,
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: aujourdhui,
        duree_estimee_min: 60,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_EN_COURS,
        ...base,
        priorite: "p3",
        statut: "en_cours",
        date_planifiee: DATE_HORS_AUJOURDHUI,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_BLOQUEE,
        ...base,
        priorite: "p3",
        statut: "suspendue",
        date_planifiee: DATE_HORS_AUJOURDHUI,
        motif_suspension: "Attente de pièce (épreuve TP-UX3-1-REGISTRE-1)",
        suspendue_le: new Date(),
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_A_CONTROLER,
        ...base,
        priorite: "p3",
        statut: "terminee",
        date_planifiee: DATE_HORS_AUJOURDHUI,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_HISTORIQUE,
        ...base,
        priorite: "p3",
        statut: "cloturee",
        date_planifiee: DATE_HORS_AUJOURDHUI,
      },
    });

    const enBase = await client.intervention.count({
      where: { client_id: CLIENT_9EA1 },
    });
    expect(enBase).toBe(TOUTES_LES_INTERVENTIONS.length);
  } finally {
    await client.$disconnect();
  }
}

async function effacerLaScene(): Promise<void> {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await client.intervention.deleteMany({
      where: { id: { in: TOUTES_LES_INTERVENTIONS } },
    });
    await client.site.deleteMany({ where: { id: SITE_9EA1 } });
    await client.client.deleteMany({ where: { id: CLIENT_9EA1 } });
  } finally {
    await client.$disconnect();
  }
}

test.beforeAll(ecrireLaScene);
test.afterAll(effacerLaScene);

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirUneSession(page);
});

test("l'adresse nue ouvre « À planifier » ; la P1 précède la P2, et l'onglet est rouge (décision 13 d'Alexis)", async ({
  page,
}) => {
  await page.goto("/interventions?q=9EA1-");
  const ongletActif = page.locator(
    'nav[data-nav="onglets-registre"] a[aria-current="page"]',
  );
  await expect(ongletActif).toContainText(
    dictionnaire["interventions.vue.a_planifier"]!,
  );
  const compte = await ongletActif
    .locator("[data-compte]")
    .getAttribute("data-compte");
  expect(Number(compte)).toBe(2);
  // L'ALERTE ROUGE — une P1 attend.
  await expect(ongletActif.locator("[data-compte]")).toHaveClass(
    /bg-app-rouge-fond/,
  );

  const lignes = page.locator("tbody tr");
  await expect(lignes).toHaveCount(2);
  // LA P1 PRÉCÈDE LA P2 (ordre : priorité, puis la plus ancienne).
  await expect(
    lignes.nth(0).locator(`a[href^="/interventions/${INTERVENTION_P1}"]`),
  ).toHaveCount(1);
  await expect(
    lignes.nth(1).locator(`a[href^="/interventions/${INTERVENTION_P2}"]`),
  ).toHaveCount(1);
});

test("`?vue=toutes` ouvre « Toutes », actif, sans compteur sur cet onglet", async ({
  page,
}) => {
  await page.goto("/interventions?q=9EA1-&vue=toutes");
  const ongletActif = page.locator(
    'nav[data-nav="onglets-registre"] a[aria-current="page"]',
  );
  await expect(ongletActif).toContainText(
    dictionnaire["interventions.vue.toutes"]!,
  );
  await expect(ongletActif.locator("[data-compte]")).toHaveCount(0);
  await expect(page.locator("tbody tr")).toHaveCount(7);
});

test("le filtre Priorité restreint « À planifier » à la seule P2", async ({
  page,
}) => {
  await page.goto("/interventions?q=9EA1-&priorite=p2");
  const lignes = page.locator("tbody tr");
  await expect(lignes).toHaveCount(1);
  // SCOPÉ AU TABLEAU (TP-UX3-1-REGISTRE-2) — la carte du téléphone
  // (`components/ui/liste-cartes.tsx`) porte, dans le DOM, le MÊME `href`
  // que la ligne du tableau (CSS la masque sous 900 px, jamais retirée du
  // DOM) ; une requête non scopée au tableau résout donc à DEUX éléments.
  await expect(
    lignes.locator(`a[href^="/interventions/${INTERVENTION_P2}"]`),
  ).toHaveCount(1);
});

test("Suivi « Sans durée prévue » retrouve EXACTEMENT P1 et P2, les mêmes lignes que `sans_duree_a_venir=1` (AUJOURD'HUI a une durée, elle n'est pas du lot)", async ({
  page,
}) => {
  await page.goto("/interventions?q=9EA1-&vue=toutes&suivi=sans_duree_a_venir");
  const lignesParSuivi = page.locator("tbody tr");
  await expect(lignesParSuivi).toHaveCount(2);
  await expect(
    lignesParSuivi.locator(`a[href^="/interventions/${INTERVENTION_P1}"]`),
  ).toHaveCount(1);
  await expect(
    lignesParSuivi.locator(`a[href^="/interventions/${INTERVENTION_P2}"]`),
  ).toHaveCount(1);
  await expect(
    lignesParSuivi.locator(
      `a[href^="/interventions/${INTERVENTION_AUJOURDHUI}"]`,
    ),
  ).toHaveCount(0);

  await page.goto("/interventions?q=9EA1-&vue=toutes&sans_duree_a_venir=1");
  const lignesParAncienLien = page.locator("tbody tr");
  await expect(lignesParAncienLien).toHaveCount(2);
  await expect(
    lignesParAncienLien.locator(`a[href^="/interventions/${INTERVENTION_P1}"]`),
  ).toHaveCount(1);
  await expect(
    lignesParAncienLien.locator(`a[href^="/interventions/${INTERVENTION_P2}"]`),
  ).toHaveCount(1);
});

test("chaque onglet principal, filtré par q=9EA1- : un compteur à 1, une ligne, celle attendue", async ({
  page,
}) => {
  const ONGLETS = [
    { vue: "aujourdhui", id: INTERVENTION_AUJOURDHUI },
    { vue: "en_cours", id: INTERVENTION_EN_COURS },
    { vue: "bloquees", id: INTERVENTION_BLOQUEE },
    { vue: "a_controler", id: INTERVENTION_A_CONTROLER },
  ] as const;
  for (const { vue, id } of ONGLETS) {
    await page.goto(`/interventions?q=9EA1-&vue=${vue}`);
    const ongletActif = page.locator(
      'nav[data-nav="onglets-registre"] a[aria-current="page"]',
    );
    const compte = await ongletActif
      .locator("[data-compte]")
      .getAttribute("data-compte");
    expect(Number(compte), vue).toBe(1);
    const lignes = page.locator("tbody tr");
    await expect(lignes).toHaveCount(1);
    // `>= 1`, jamais `=== 1` (TP-UX3-1-REGISTRE-2) : « Contrôler » (À
    // contrôler) est un second lien qui porte le MÊME `href` que la
    // référence.
    expect(
      await lignes.locator(`a[href^="/interventions/${id}"]`).count(),
    ).toBeGreaterThanOrEqual(1);
  }
});

test("« Compact » garde l'onglet et les filtres actifs, dans son propre lien", async ({
  page,
}) => {
  await page.goto("/interventions?q=9EA1-&vue=en_cours");
  const lienCompact = page.getByRole("link", {
    name: dictionnaire["densite.compact"]!,
  });
  const href = await lienCompact.getAttribute("href");
  expect(href).toContain("vue=en_cours");
  expect(href).toContain("q=9EA1-");
  expect(href).toContain("densite=compact");

  await lienCompact.click();
  await expect(page).toHaveURL(/densite=compact/);
  const ongletActif = page.locator(
    'nav[data-nav="onglets-registre"] a[aria-current="page"]',
  );
  await expect(ongletActif).toContainText(
    dictionnaire["interventions.vue.en_cours"]!,
  );
});

test("le retour depuis la fiche rejoint le MÊME onglet, les MÊMES filtres, la MÊME densité", async ({
  page,
}) => {
  await page.goto("/interventions?q=9EA1-&vue=en_cours&densite=compact");
  await page
    .locator(`a[href^="/interventions/${INTERVENTION_EN_COURS}"]`)
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(INTERVENTION_EN_COURS));
  await page
    .getByRole("link", { name: fr["intervention.retour.interventions"] })
    .click();
  await expect(page).toHaveURL(/vue=en_cours/);
  await expect(page).toHaveURL(/q=9EA1-/);
  await expect(page).toHaveURL(/densite=compact/);
});

test("« À facturer » — un rôle qui PORTE `preparer_facturation` (ADV) voit l'emplacement, pas une liste inventée", async ({
  page,
}) => {
  await page.goto("/interventions/a-facturer");
  await expect(
    page.getByText(fr["interventions.a_facturer.vide"]),
  ).toBeVisible();
});

/** Les deux largeurs demandées par le ticket, bureau puis mobile. */
const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9EA-TP-UX3-1-REGISTRE-1/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  for (const largeur of [1280, 375]) {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.screenshot({
      path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
      fullPage: true,
    });
  }
}

test("capture — « À planifier », « Aujourd'hui », « Toutes », « Plus de filtres » ouvert, Compact, et À facturer", async ({
  page,
}) => {
  await page.goto("/interventions?q=9EA1-");
  await capturer(page, "a-planifier");

  await page.goto("/interventions?q=9EA1-&vue=aujourdhui");
  await capturer(page, "aujourdhui");

  await page.goto("/interventions?q=9EA1-&vue=toutes");
  await capturer(page, "toutes");

  await page.goto("/interventions?q=9EA1-&du=2024-01-01");
  await capturer(page, "plus-de-filtres-ouvert");

  await page.goto("/interventions?q=9EA1-&densite=compact");
  await capturer(page, "compact");

  await page.goto("/interventions/a-facturer");
  await capturer(page, "a-facturer");
});

/**
 * « À FACTURER » — `admin_societe` NE PORTE PAS `preparer_facturation`
 * (lib/auth/habilitations.ts:185 : `{ complet: [DIR, RM, ADV] }`) : la rangée
 * ne doit donc lui montrer ni l'onglet, ni son lien. Dans son propre
 * `describe` : la session du `beforeEach` de fichier (ADV, via
 * `ouvrirUneSession`) ne convient pas — `clearCookies` d'abord, même motif
 * qu'`ecrans-largeur-utile.spec.ts`.
 */
test.describe("« À facturer » — absente pour un rôle sans preparer_facturation", () => {
  test("admin_societe ne voit ni l'onglet ni le lien ; l'ADV voit les deux", async ({
    page,
  }) => {
    await page.context().clearCookies();
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto("/interventions?q=9EA1-");
    const nav = page.locator('nav[data-nav="onglets-registre"]');
    await expect(
      nav.getByRole("link", { name: fr["interventions.vue.a_facturer"] }),
    ).toHaveCount(0);
    await expect(
      nav.locator('a[href="/interventions/a-facturer"]'),
    ).toHaveCount(0);
    await expect(nav.getByRole("link")).toHaveCount(7);

    await page.context().clearCookies();
    await ouvrirLaSessionSensible(page, COMPTE_EPREUVE);
    await page.goto("/interventions?q=9EA1-");
    const navAdv = page.locator('nav[data-nav="onglets-registre"]');
    await expect(
      navAdv.getByRole("link", { name: fr["interventions.vue.a_facturer"] }),
    ).toHaveCount(1);
    await expect(
      navAdv.locator('a[href="/interventions/a-facturer"]'),
    ).toHaveCount(1);
    await expect(navAdv.getByRole("link")).toHaveCount(8);
  });
});
