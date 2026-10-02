import { existsSync, readFileSync } from "node:fs";

import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { cleJour, jourSuivant } from "@/lib/calendar/fuseau";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { FICHIER_COURRIELS_CAPTURES } from "./setup/courriel-captures";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirSaisieManuelle } from "./setup/saisie-manuelle";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9CO-PG-G14A-TRANSMETTRE (02/10/2026) — « TRANSMETTRE » FAIT PASSER UNE
 * PLANIFIÉE EN AFFECTÉE, DE BOUT EN BOUT.
 *
 * ## Ce que les tests unitaires et d'isolation ne peuvent pas prouver
 *
 * `tests/unit/interventions/cycle-de-vie.test.ts` éprouve `peutTransmettre`,
 * pur ; `tests/isolation/avertissements-transmission.test.ts` éprouve qui
 * reçoit quoi, par appel direct. Ni l'un ni l'autre ne prouve qu'un geste
 * RÉEL sur l'écran — cliquer « Transmettre au technicien » — fait
 * effectivement passer le statut et partir le courriel. C'est ce que ce
 * fichier joue, à travers l'écran.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `PGG14A-`
 *
 * Créée en `beforeAll`, supprimée en `afterAll` — AUCUNE ligne au semis. Le
 * technicien, lui, est une identité DU SEMIS (`garnier@codima.test`,
 * Ducos) en LECTURE SEULE : ce scénario ne touche à rien qui lui appartient,
 * il se contente de le nommer.
 *
 * ## LA DATE — AU MOINS +8 SEMAINES, COMME LES SPECS VOISINES
 *
 * +140 puis +147 jours (20 puis 21 semaines) — à l'écart des décalages déjà
 * pris par les fichiers voisins (7, 14, 21, 35, 49, 63, 70, 77, 84, 91, 92,
 * 98, 99, 105, 126).
 *
 * ## LE COURRIEL EST DOUBLÉ, AU NIVEAU DU SERVEUR
 *
 * Même double que `avertissements-1.spec.ts` — `tests/e2e/setup/double-courriel.cjs`.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTION_ID = uuidv7();

let societeId = "";
let agenceDucosId = "";
let technicienId = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

function courrielsCaptures(): unknown[] {
  if (!existsSync(FICHIER_COURRIELS_CAPTURES)) {
    return [];
  }
  return readFileSync(FICHIER_COURRIELS_CAPTURES, "utf8")
    .split("\n")
    .filter((ligne) => ligne.trim().length > 0)
    .map((ligne) => JSON.parse(ligne) as unknown);
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  technicienId = reperes.technicienDucos;

  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    agenceDucosId = agence.id;

    await client.client.create({
      data: {
        id: CLIENT_ID,
        societe_id: societeId,
        raison_sociale: "PGG14A — client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: societeId,
        client_id: CLIENT_ID,
        agence_id: agenceDucosId,
        libelle: "PGG14A — site",
      },
    });
    // À PLANIFIER, sans date ni technicien (PARCOURS-1) — « Planifier » pose
    // les quatre valeurs ensemble, par l'écran, plus bas.
    await client.intervention.create({
      data: {
        id: INTERVENTION_ID,
        societe_id: societeId,
        agence_id: agenceDucosId,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: null,
        type: "curatif",
        priorite: "p3",
        statut: "a_planifier",
        date_planifiee: null,
        creneau_debut: null,
        creneau_fin: null,
        duree_estimee_min: null,
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        description: "PGG14A — intervention forgée par l'épreuve",
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_ID,
    );
    await client.intervention.deleteMany({ where: { id: INTERVENTION_ID } });
    await client.site.deleteMany({ where: { id: SITE_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

test("Transmettre fait passer une Planifiée en Affectée, previent le technicien, et un deplacement puis une remise en file suivent la matrice QG-4/QG-5", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  const jourInitial = jourSuivant(reperes.lundi, 140);
  const jourDeplace = jourSuivant(reperes.lundi, 147);

  await ouvrirUneSession(page);
  await page.goto(`/interventions/${INTERVENTION_ID}`);

  // ── PLANIFIER — les quatre valeurs ensemble (PARCOURS-1) ──────────────────
  const formPlanifier = page.locator("form", {
    has: page.getByRole("heading", {
      name: fr["intervention.action.planifier"],
    }),
  });
  await ouvrirSaisieManuelle(formPlanifier);
  await formPlanifier
    .locator('input[name="date_planifiee"]')
    .fill(cleJour(jourInitial));
  await formPlanifier.locator('input[name="heure_debut"]').fill("09:00");
  await formPlanifier.locator('input[name="duree_min"]').fill("60");
  await formPlanifier
    .locator('select[name="technicien_id"]')
    .selectOption(technicienId);
  await formPlanifier
    .getByRole("button", { name: fr["intervention.action.planifier"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.planifiee"]),
  ).toBeVisible();

  // ── TRANSMETTRE — Planifiée → Affectée, et C'EST ELLE qui prévient le
  // technicien pour la première fois (D141, QG-5) ───────────────────────────
  const avant = courrielsCaptures().length;
  const formTransmettre = page.locator("form#action-transmettre");
  await expect(formTransmettre).toBeVisible();
  await formTransmettre
    .getByRole("button", { name: fr["intervention.action.transmettre"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.affectee"]),
  ).toBeVisible();
  await expect(
    page.locator(
      '[data-avertissement="intervention.avertissement.courriel_technicien_parti"]',
    ),
  ).toBeVisible();
  expect(courrielsCaptures().length).toBe(avant + 1);

  // ── DÉPLACER UNE AFFECTÉE — reste Affectée, prévient AUSSITÔT (QG-5) ──────
  const deplacerDetails = page.locator("details", {
    has: page.locator("summary", {
      hasText: fr["intervention.action.deplacer"],
    }),
  });
  await deplacerDetails.locator("summary").first().click();
  const formDeplacer = deplacerDetails.locator("form");
  await ouvrirSaisieManuelle(formDeplacer);
  await formDeplacer
    .locator('input[name="date_planifiee"]')
    .fill(cleJour(jourDeplace));
  await formDeplacer.locator('input[name="heure_debut"]').fill("10:00");
  await formDeplacer.locator('input[name="duree_min"]').fill("60");
  await formDeplacer
    .getByRole("button", { name: fr["intervention.action.deplacer"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.affectee"]),
  ).toBeVisible();
  await expect(
    page.locator(
      '[data-avertissement="intervention.avertissement.courriel_technicien_parti"]',
    ),
  ).toBeVisible();
  expect(courrielsCaptures().length).toBe(avant + 2);

  // ── REMETTRE DANS LA FILE — tout vider la rend « À planifier » (QG-4) ─────
  const deplacerDetailsApres = page.locator("details", {
    has: page.locator("summary", {
      hasText: fr["intervention.action.deplacer"],
    }),
  });
  await deplacerDetailsApres.locator("summary").first().click();
  const formDeplacerApres = deplacerDetailsApres.locator("form");
  await ouvrirSaisieManuelle(formDeplacerApres);
  await formDeplacerApres.locator('input[name="date_planifiee"]').fill("");
  await formDeplacerApres.locator('input[name="heure_debut"]').fill("");
  await formDeplacerApres.locator('input[name="duree_min"]').fill("");
  await formDeplacerApres
    .getByRole("button", { name: fr["intervention.action.deplacer"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.a_planifier"]),
  ).toBeVisible();
});
