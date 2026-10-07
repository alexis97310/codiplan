import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { instantDuJour, jourDe, maintenant } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9EA-TP-UX3-1-REGISTRE-2 — COLONNES PAR ONGLET, ACTIONS DE LIGNE, SÉLECTION
 * (QE-8 (a)).
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `9EA2-` — jamais `tests/e2e/setup/scene.ts`
 *
 * Un client et un site à soi, huit interventions — une par onglet listant,
 * plus une seconde sur « Aujourd'hui » (affectée, pour la sélection mixte) et
 * une « sous garantie, ouverte » pour le Suivi. Créée en `beforeAll`,
 * supprimée en `afterAll` ; `q=9EA2-` isole ces lignes de toute autre scène
 * ou donnée de démonstration, sous `fullyParallel` (voir le PIÈGE CONNU du
 * ticket). Les dates viennent de `maintenant(fuseau)` de la société, jamais
 * d'une date figée ni d'« aujourd'hui » en UTC (9D2-TESTS-DATES-NOUMEA).
 */

test.describe.configure({ mode: "serial" });

const dictionnaire = fr as Record<string, string>;

const CLIENT_9EA2 = "9ea20000-0000-7000-8000-0000000000c1";
const SITE_9EA2 = "9ea20000-0000-7000-8000-0000000000c2";

const INTERVENTION_A_PLANIFIER = "9ea20000-0000-7000-8000-000000000001";
const INTERVENTION_AUJOURDHUI_PLANIFIEE =
  "9ea20000-0000-7000-8000-000000000002";
const INTERVENTION_AUJOURDHUI_AFFECTEE = "9ea20000-0000-7000-8000-000000000003";
const INTERVENTION_EN_RETARD = "9ea20000-0000-7000-8000-000000000004";
const INTERVENTION_EN_COURS = "9ea20000-0000-7000-8000-000000000005";
const INTERVENTION_SUSPENDUE = "9ea20000-0000-7000-8000-000000000006";
const INTERVENTION_A_CONTROLER = "9ea20000-0000-7000-8000-000000000007";
const INTERVENTION_GARANTIE_OUVERTE = "9ea20000-0000-7000-8000-000000000008";

const TOUTES_LES_INTERVENTIONS = [
  INTERVENTION_A_PLANIFIER,
  INTERVENTION_AUJOURDHUI_PLANIFIEE,
  INTERVENTION_AUJOURDHUI_AFFECTEE,
  INTERVENTION_EN_RETARD,
  INTERVENTION_EN_COURS,
  INTERVENTION_SUSPENDUE,
  INTERVENTION_A_CONTROLER,
  INTERVENTION_GARANTIE_OUVERTE,
];

let technicienId: string;

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
    const technicien = await client.technicien.findFirstOrThrow({
      where: { societe_id: societe.id, actif: true },
      select: { utilisateur_id: true },
      orderBy: { utilisateur_id: "asc" },
    });
    technicienId = technicien.utilisateur_id;

    await client.intervention.deleteMany({
      where: { id: { in: TOUTES_LES_INTERVENTIONS } },
    });
    await client.site.deleteMany({ where: { id: SITE_9EA2 } });
    await client.client.deleteMany({ where: { id: CLIENT_9EA2 } });

    await client.client.create({
      data: {
        id: CLIENT_9EA2,
        societe_id: societe.id,
        raison_sociale: "Client 9EA2- (épreuve TP-UX3-1-REGISTRE-2)",
      },
    });
    await client.site.create({
      data: {
        id: SITE_9EA2,
        societe_id: societe.id,
        client_id: CLIENT_9EA2,
        agence_id: agence.id,
        libelle: "Lieu 9EA2- (épreuve TP-UX3-1-REGISTRE-2)",
        commune: "Nouméa",
        temps_trajet_min: 10,
      },
    });

    const fuseau = societe.fuseau_horaire;
    const aujourdhui = instantDuJour(jourDe(maintenant(fuseau).local));
    const hier = instantDuJour(jourDe(maintenant(fuseau).local), -1);
    // NI AUJOURD'HUI NI HIER — la fiche « sous garantie, ouverte » ne doit
    // tomber dans AUCUN des onglets comptés ci-dessous (elle ne doit gonfler
    // ni « À planifier », ni « Aujourd'hui », ni « En retard ») : seul le
    // Suivi doit la retrouver.
    const dansDixJours = instantDuJour(jourDe(maintenant(fuseau).local), 10);
    const creneauDebutAujourdhui = new Date(
      aujourdhui.getTime() + 8 * 60 * 60 * 1000,
    );
    const creneauFinAujourdhui = new Date(
      aujourdhui.getTime() + 9 * 60 * 60 * 1000,
    );

    const base = {
      societe_id: societe.id,
      agence_id: agence.id,
      client_id: CLIENT_9EA2,
      site_id: SITE_9EA2,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
    };

    await client.intervention.create({
      data: {
        id: INTERVENTION_A_PLANIFIER,
        ...base,
        type: "curatif",
        priorite: "p1",
        statut: "a_planifier",
        date_planifiee: null,
        description: "Panne 9EA2- — à planifier",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_AUJOURDHUI_PLANIFIEE,
        ...base,
        type: "curatif",
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: aujourdhui,
        creneau_debut: creneauDebutAujourdhui,
        creneau_fin: creneauFinAujourdhui,
        duree_estimee_min: 60,
        technicien_id: technicienId,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_AUJOURDHUI_AFFECTEE,
        ...base,
        type: "curatif",
        priorite: "p3",
        statut: "affectee",
        date_planifiee: aujourdhui,
        creneau_debut: creneauDebutAujourdhui,
        creneau_fin: creneauFinAujourdhui,
        duree_estimee_min: 60,
        technicien_id: technicienId,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_EN_RETARD,
        ...base,
        type: "curatif",
        priorite: "p3",
        statut: "planifiee",
        date_planifiee: hier,
        duree_estimee_min: 60,
        technicien_id: technicienId,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_EN_COURS,
        ...base,
        type: "curatif",
        priorite: "p3",
        statut: "en_cours",
        date_planifiee: hier,
        technicien_id: technicienId,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_SUSPENDUE,
        ...base,
        type: "curatif",
        priorite: "p3",
        statut: "suspendue",
        date_planifiee: hier,
        motif_suspension: "Attente de pièce (épreuve TP-UX3-1-REGISTRE-2)",
        piece_attendue_ref: "REF-9EA2",
        date_dispo_prevue: aujourdhui,
        suspendue_le: new Date(),
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_A_CONTROLER,
        ...base,
        type: "curatif",
        priorite: "p3",
        statut: "terminee",
        date_planifiee: hier,
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_GARANTIE_OUVERTE,
        ...base,
        type: "garantie",
        priorite: "p3",
        statut: "affectee",
        date_planifiee: dansDixJours,
        duree_estimee_min: 60,
        technicien_id: technicienId,
      },
    });

    const enBase = await client.intervention.count({
      where: { client_id: CLIENT_9EA2 },
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
    await client.site.deleteMany({ where: { id: SITE_9EA2 } });
    await client.client.deleteMany({ where: { id: CLIENT_9EA2 } });
  } finally {
    await client.$disconnect();
  }
}

test.beforeAll(ecrireLaScene);
test.afterAll(effacerLaScene);

test.describe("1280 px — colonnes, compteur et actions, par onglet", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await ouvrirUneSession(page);
  });

  const ONGLETS = [
    {
      vue: "a_planifier",
      id: INTERVENTION_A_PLANIFIER,
      entetes: [
        "interventions.colonne.prio",
        "interventions.colonne.intervention",
        "interventions.colonne.demande",
        "interventions.colonne.anciennete",
        "interventions.colonne.duree",
      ],
    },
    {
      vue: "en_retard",
      id: INTERVENTION_EN_RETARD,
      entetes: [
        "interventions.colonne.prevue",
        "intervention.technicien",
        "intervention.statut",
      ],
    },
    {
      vue: "en_cours",
      id: INTERVENTION_EN_COURS,
      entetes: [
        "interventions.colonne.debut",
        "interventions.colonne.compteur",
      ],
    },
    {
      vue: "bloquees",
      id: INTERVENTION_SUSPENDUE,
      entetes: [
        "interventions.colonne.depuis",
        "interventions.colonne.motif",
        "interventions.colonne.piece_attendue",
      ],
    },
    {
      vue: "a_controler",
      id: INTERVENTION_A_CONTROLER,
      entetes: [
        "interventions.colonne.terminee",
        "interventions.colonne.rapport",
      ],
    },
  ] as const;

  for (const { vue, id, entetes } of ONGLETS) {
    test(`« ${vue} » — ses colonnes, un compteur à 1, la ligne attendue`, async ({
      page,
    }) => {
      await page.goto(`/interventions?q=9EA2-&vue=${vue}`);
      for (const cle of entetes) {
        await expect(
          page.locator("thead th", { hasText: dictionnaire[cle]! }),
        ).toHaveCount(1);
      }
      // Aucune colonne de montant, sur aucun onglet.
      const entetesTexte = await page.locator("thead th").allTextContents();
      for (const texte of entetesTexte) {
        expect(texte.toLowerCase()).not.toMatch(/montant/);
      }

      const ongletActif = page.locator(
        'nav[data-nav="onglets-registre"] a[aria-current="page"]',
      );
      const compte = await ongletActif
        .locator("[data-compte]")
        .getAttribute("data-compte");
      expect(Number(compte), vue).toBe(1);

      const lignes = page.locator("tbody tr");
      await expect(lignes).toHaveCount(1);
      // NOMBRE EXACT — « À contrôler » porte DEUX liens vers la même fiche
      // (la référence et « Contrôler », ActionDeLigne dans `page.tsx`), les
      // quatre autres onglets de cette boucle n'en portent qu'UN.
      await expect(
        lignes.locator(`a[href^="/interventions/${id}"]`),
      ).toHaveCount(vue === "a_controler" ? 2 : 1);
    });
  }

  test("« aujourd'hui » — un compteur à 2, les deux lignes attendues", async ({
    page,
  }) => {
    await page.goto("/interventions?q=9EA2-&vue=aujourdhui");
    const ongletActif = page.locator(
      'nav[data-nav="onglets-registre"] a[aria-current="page"]',
    );
    const compte = await ongletActif
      .locator("[data-compte]")
      .getAttribute("data-compte");
    expect(Number(compte)).toBe(2);
    await expect(page.locator("tbody tr")).toHaveCount(2);
  });

  test("« Poser » (À planifier) ouvre la fenêtre de pose", async ({ page }) => {
    await page.goto("/interventions?q=9EA2-&vue=a_planifier");
    await page
      .getByRole("button", {
        name: dictionnaire["interventions.colonne.poser"]!,
      })
      .click();
    await expect(
      page.locator(`[data-fenetre-pose="${INTERVENTION_A_PLANIFIER}"]`),
    ).toBeVisible();
  });

  test("la sélection (Aujourd'hui) : « Transmettre… » ne porte que la PLANIFIÉE cochée", async ({
    page,
  }) => {
    await page.goto("/interventions?q=9EA2-&vue=aujourdhui");
    // SCOPÉ AU CORPS DU TABLEAU — le formulaire de filtres porte sa PROPRE
    // case (« Inclure les clients inactifs »), qui déciderait du mauvais
    // index si la requête portait sur toute la page.
    const casesDeLigne = page.locator('tbody input[type="checkbox"]');
    await expect(casesDeLigne).toHaveCount(2);
    const urlAvantCoche = page.url();
    await casesDeLigne.nth(0).check();
    await casesDeLigne.nth(1).check();
    // COCHER UNE CASE NE NAVIGUE PAS (`LigneCliquable` absorbe le clic sur
    // `input` plutôt que de le reconduire vers la fiche) — l'URL reste EXACTEMENT
    // celle d'avant les deux cases cochées.
    expect(page.url()).toBe(urlAvantCoche);

    const barre = page.getByRole("status");
    await expect(barre).toBeVisible();

    const formulaireTransmettre = page.locator(
      'form[action="/api/interventions/transmettre"]',
    );
    const idsTransmis = await formulaireTransmettre
      .locator('input[name="id"]')
      .evaluateAll((noeuds) =>
        noeuds.map((noeud) => (noeud as HTMLInputElement).value),
      );
    expect(idsTransmis).toEqual([INTERVENTION_AUJOURDHUI_PLANIFIEE]);

    const formulaireExport = page.locator(
      'form[action="/api/interventions/exporter"]',
    );
    const idsExportes = await formulaireExport
      .locator('input[name="id"]')
      .evaluateAll((noeuds) =>
        noeuds.map((noeud) => (noeud as HTMLInputElement).value),
      );
    expect([...idsExportes].sort()).toEqual(
      [
        INTERVENTION_AUJOURDHUI_AFFECTEE,
        INTERVENTION_AUJOURDHUI_PLANIFIEE,
      ].sort(),
    );
  });

  test("Suivi « Sous garantie, ouvertes » retrouve la seule fiche garantie OUVERTE", async ({
    page,
  }) => {
    await page.goto(
      "/interventions?q=9EA2-&vue=toutes&suivi=garantie_ouvertes",
    );
    const lignes = page.locator("tbody tr");
    await expect(lignes).toHaveCount(1);
    // NOMBRE EXACT — « Toutes » (ici via `vue=toutes&suivi=`) ne porte pas de
    // colonne « action » (`colonnesDuRegistre`) : jamais de second lien
    // « Contrôler », quel que soit le statut de la ligne.
    await expect(
      lignes.locator(
        `a[href^="/interventions/${INTERVENTION_GARANTIE_OUVERTE}"]`,
      ),
    ).toHaveCount(1);
  });
});

test.describe("375 px — des cartes, jamais de défilement horizontal de page", () => {
  test("aucune barre de défilement horizontal de page, et des cartes plutôt que le tableau", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await ouvrirUneSession(page);
    await page.goto("/interventions?q=9EA2-&vue=toutes");

    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(375);

    await expect(page.locator("table")).toBeHidden();
    // SCOPÉ SUR LA LISTE NOMMÉE DU REGISTRE (`ListeCartes`,
    // `components/ui/liste-cartes.tsx` — `libelle={t("interventions.titre")}`)
    // — un `ul li` nu résoudrait aussi bien n'importe quelle autre liste de
    // l'écran (la navigation, un menu).
    const listeCartes = page.getByRole("list", {
      name: fr["interventions.titre"],
    });
    const cartes = listeCartes.getByRole("listitem");
    await expect(cartes).toHaveCount(TOUTES_LES_INTERVENTIONS.length);
    await expect(cartes.first()).toBeVisible();
    // UNE CARTE EST UN SIMPLE LIEN PLEIN (choix du pilote C5, 07/10/2026) —
    // SANS action ni case : la sélection multiple reste au bureau seulement.
    await expect(
      cartes.locator("input, button, form, [role='checkbox']"),
    ).toHaveCount(0);
    await expect(cartes.getByRole("link")).toHaveCount(
      TOUTES_LES_INTERVENTIONS.length,
    );
    await expect(page.getByRole("status")).toHaveCount(0);
  });
});
