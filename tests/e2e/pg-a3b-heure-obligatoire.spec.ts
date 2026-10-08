import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { heureDuCreneau } from "@/app/(back-office)/interventions/presentation";
import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirSaisieManuelle } from "./setup/saisie-manuelle";
import { ouvrirUneSession } from "./setup/session";

/**
 * PG-A3b-HEURE-OBLIGATOIRE (28/09/2026) — DÉCISION QG-4 D'ALEXIS DU 27/09/2026.
 *
 * Une intervention déjà `planifiee` ne peut plus perdre son heure et sa durée
 * en la déplaçant tout en gardant sa date — l'ancienne « journée sans heure »
 * (`intervention.deplacement.heure` portait avant ce lot « laisser vide pour
 * une journée sans heure »). Tout vider (date, heure, durée) reste permis :
 * c'est la remettre dans la file (`a_planifier`).
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `PGA3B-` — un client, un site, deux interventions
 * (`a_planifier` pour le bloc « Planifier », `planifiee` avec heure et durée
 * pour le bloc « Déplacer »), créés en `beforeAll`, supprimés en `afterAll`
 * (même discipline que 99S-GR4-DEPLACER et PG-A3a-MESSAGES-POSE).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PGA3B ?? "";

const CLIENT_PGA3B = uuidv7();
const SITE_PGA3B = uuidv7();
const INTERVENTION_A_PLANIFIER = uuidv7();
const INTERVENTION_PLANIFIEE = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

/** Six semaines après aujourd'hui, en jour civil — loin de toute fenêtre
 * qu'un autre scénario borne (§9, 22/09). */
function dansSixSemaines(): Date {
  const aujourdhui = new Date();
  return new Date(
    Date.UTC(
      aujourdhui.getUTCFullYear(),
      aujourdhui.getUTCMonth(),
      aujourdhui.getUTCDate() + 42,
    ),
  );
}

let fuseau: string;
let jour: Date;
let creneauDebut: Date;
let heureAttendue: string;
let dateAttendue: string;

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  fuseau = reperes.fuseau;
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_PGA3B,
        societe_id: reperes.societeId,
        raison_sociale: "PGA3B",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PGA3B,
        societe_id: reperes.societeId,
        client_id: CLIENT_PGA3B,
        agence_id: agence.id,
        libelle: "PGA3B",
      },
    });

    jour = dansSixSemaines();
    dateAttendue = jour.toISOString().slice(0, 10);
    creneauDebut = new Date(jour.getTime() + (9 - 11) * 3_600_000);
    const heure = heureDuCreneau({ creneau_debut: creneauDebut }, fuseau);
    if (heure === null) {
      throw new Error("le créneau posé devrait produire une heure lisible");
    }
    heureAttendue = heure;

    // À PLANIFIER — pour capturer le bloc « Planifier ».
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "type", "priorite", "statut", "description", "mode_valorisation",
         "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'p3',
               'a_planifier', 'PGA3B-scenario', 'temps_passe', 'XPF', now())`,
      INTERVENTION_A_PLANIFIER,
      reperes.societeId,
      agence.id,
      CLIENT_PGA3B,
      SITE_PGA3B,
    );

    // PLANIFIÉE, avec heure et durée — pour capturer le bloc « Déplacer » et
    // éprouver QG-4.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "type", "priorite", "statut", "date_planifiee", "creneau_debut",
         "duree_estimee_min", "description", "mode_valorisation", "devise_code",
         "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'p3',
               'planifiee', $6::date, $7::timestamp, 90, 'PGA3B-scenario',
               'temps_passe', 'XPF', now())`,
      INTERVENTION_PLANIFIEE,
      reperes.societeId,
      agence.id,
      CLIENT_PGA3B,
      SITE_PGA3B,
      jour,
      creneauDebut,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_PGA3B,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_PGA3B } });
    await client.client.deleteMany({ where: { id: CLIENT_PGA3B } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
    });

    test(`« Planifier » — l'heure de début n'est plus « laisser vide pour une journée sans heure », à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto(`/interventions/${INTERVENTION_A_PLANIFIER}`);
      // « Saisir à la main » — repli ajouté par PG-B3-TROUVER-CRENEAU-FICHE
      // devant « Trouver un créneau ».
      await ouvrirSaisieManuelle(page);
      await expect(
        page.getByText(fr["intervention.deplacement.heure"], {
          exact: true,
        }),
      ).toBeVisible();
      await capturer(page, "planifier", largeur);
    });

    test(`« Déplacer » — la note dit l'unique façon de remettre dans la file, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto(`/interventions/${INTERVENTION_PLANIFIEE}`);
      const deplacerDetails = page.locator("details", {
        has: page.locator("summary", {
          hasText: fr["intervention.action.deplacer"],
        }),
      });
      await deplacerDetails.locator("summary").first().click();
      await ouvrirSaisieManuelle(deplacerDetails);
      await expect(
        deplacerDetails.getByText(
          fr["intervention.deplacement.vider_pour_la_file"],
        ),
      ).toBeVisible();
      await capturer(page, "deplacer", largeur);
    });
  });
}

test("DATE GARDÉE, HEURE ET DURÉE VIDÉES — refusée, nommée (QG-4)", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_PLANIFIEE}`);
  const deplacerDetails = page.locator("details", {
    has: page.locator("summary", {
      hasText: fr["intervention.action.deplacer"],
    }),
  });
  await deplacerDetails.locator("summary").first().click();
  const form = deplacerDetails.locator("form");
  await ouvrirSaisieManuelle(form);
  await expect(form.locator('input[name="date_planifiee"]')).toHaveValue(
    dateAttendue,
  );
  await expect(form.locator('input[name="heure_debut"]')).toHaveValue(
    heureAttendue,
  );
  await form.locator('input[name="heure_debut"]').fill("");
  await form.locator('input[name="duree_min"]').fill("");
  await form
    .getByRole("button", { name: fr["intervention.action.deplacer"] })
    .click();
  // SCOPÉ AU TEXTE DU REFUS (9EE-TP-UX4-1-FICHE-INTERVENTION-1) — une fiche
  // « planifiée » porte désormais AUSSI un bandeau d'état, `role="status"`
  // lui aussi.
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: fr["intervention.refus.heure_obligatoire"] }),
  ).toContainText(fr["intervention.refus.heure_obligatoire"]);
});

test("TOUT VIDÉ (date, heure, durée) — remise dans la file, permise (QG-4)", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_PLANIFIEE}`);
  const deplacerDetails = page.locator("details", {
    has: page.locator("summary", {
      hasText: fr["intervention.action.deplacer"],
    }),
  });
  await deplacerDetails.locator("summary").first().click();
  const form = deplacerDetails.locator("form");
  await ouvrirSaisieManuelle(form);
  await form.locator('input[name="date_planifiee"]').fill("");
  await form.locator('input[name="heure_debut"]').fill("");
  await form.locator('input[name="duree_min"]').fill("");
  await form
    .getByRole("button", { name: fr["intervention.action.deplacer"] })
    .click();
  // Remise dans la file : le bloc « Planifier », absent tant que
  // l'intervention était planifiée, réapparaît — même critère que l'écran
  // lui-même (`statut === "a_planifier"`). Nouvelle page, repli refermé.
  await ouvrirSaisieManuelle(page);
  await expect(
    page.getByRole("button", { name: fr["intervention.action.planifier"] }),
  ).toBeVisible();
});
