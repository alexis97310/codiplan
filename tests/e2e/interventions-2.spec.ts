import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { choisirResultatParTexte } from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * 50-INTERVENTIONS-2 (24/09/2026) — LA FICHE RÉORGANISÉE : DONNÉES RÉELLES,
 * HISTORIQUE DES PAUSES, NOTE INTERNE.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `INT2-`
 *
 * Créée en `beforeAll`, supprimée en `afterAll` — AUCUNE ligne n'est ajoutée
 * au semis, même geste que `tests/e2e/avertissements-1.spec.ts`. Le
 * technicien, lui, est une identité DU SEMIS (`guerin@codima.test`, Ducos) :
 * il faut un compte dont on connaisse le mot de passe pour se connecter côté
 * terrain.
 *
 * ## L'INTERVENTION CLÔTURÉE EST POSÉE DIRECTEMENT
 *
 * Ce fichier n'éprouve pas le CHEMIN vers la clôture — `tests/e2e/*cloture*`
 * (et les épreuves d'isolation/unitaires du même nom) le font déjà. Il
 * éprouve ce que le panneau Actions montre UNE FOIS qu'on y est. Le
 * déclencheur `intervention_cycle_de_vie` ne surveille que l'`UPDATE` (voir
 * `20260909200000_intervention_l2_planning`) : une `INSERT` directe ne le
 * déclenche pas — même geste qu'AVERTISSEMENTS-1 pour sa fixture `planifiee`.
 *
 * ## SÉRIEL — les scénarios s'enchaînent sur la même intervention « pauses »
 */
test.describe.configure({ mode: "serial" });

const CLIENT_INT2 = uuidv7();
const SITE_INT2 = uuidv7();
const INTERVENTION_CLOTUREE = uuidv7();

let societeId = "";
let agenceDucosId = "";
let technicienId = "";
let interventionPausesId = "";

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
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
        id: CLIENT_INT2,
        societe_id: societeId,
        raison_sociale: fr["interventions2.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_INT2,
        societe_id: societeId,
        client_id: CLIENT_INT2,
        agence_id: agenceDucosId,
        libelle: fr["interventions2.e2e.site"],
      },
    });

    // `temps_mesure_min` reste NUL : le déclencheur
    // `intervention_temps_mesure_est_celui_du_compteur` s'applique aussi à
    // l'INSERT (il lit `segment_travail`, jamais `intervention`) et refuserait
    // toute valeur qui ne soit pas la somme des segments — zéro ici, puisque
    // ce scénario n'en pose aucun.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "temps_valide_min", "cloturee_le", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'cloturee', 60, now(), now())`,
      INTERVENTION_CLOTUREE,
      societeId,
      CLIENT_INT2,
      SITE_INT2,
      agenceDucosId,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    // CASCADE efface les pauses filles avec leur intervention.
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_INT2,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_INT2 } });
    await client.client.deleteMany({ where: { id: CLIENT_INT2 } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/50-INTERVENTIONS-2/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  for (const largeur of [375, 1280]) {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.screenshot({
      path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
      fullPage: true,
    });
  }
}

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("créer l'intervention de l'épreuve — fiche à planifier", async ({
  page,
}) => {
  await page.goto("/interventions/nouvelle");
  await choisirResultatParTexte(
    page,
    "site",
    fr["interventions2.e2e.site"],
    fr["interventions2.e2e.site"],
  );
  await page
    .locator('textarea[name="description"]')
    .fill(fr["interventions2.e2e.panne"]);
  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+$/);
  interventionPausesId = new URL(page.url()).pathname.split("/").pop() ?? "";

  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.a_planifier"]),
  ).toBeVisible();
  await capturer(page, "fiche-a-planifier");
});

test("suspendre (pièce X), reprendre, suspendre (pièce Y) — les DEUX pauses restent lisibles", async ({
  page,
}) => {
  await page.goto(`/interventions/${interventionPausesId}`);

  // ── PREMIÈRE PAUSE — pièce X ──────────────────────────────────────────
  const formSuspendre1 = page.locator("form", {
    has: page.getByRole("heading", {
      name: fr["intervention.action.suspendre"],
    }),
  });
  await formSuspendre1
    .locator('input[name="motif"]')
    .fill("INT2 — attente de la pièce X");
  await formSuspendre1.locator('input[name="piece_attendue_ref"]').fill("X-1");
  await formSuspendre1
    .locator('input[name="date_dispo_prevue"]')
    .fill("2026-10-15");
  await formSuspendre1
    .getByRole("button", { name: fr["intervention.action.suspendre"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.suspendue"]),
  ).toBeVisible();

  // ── REPRISE ────────────────────────────────────────────────────────────
  await page
    .getByRole("button", { name: fr["intervention.action.reprendre"] })
    .click();
  await page.waitForLoadState("networkidle");

  // ── SECONDE PAUSE — pièce Y ────────────────────────────────────────────
  const formSuspendre2 = page.locator("form", {
    has: page.getByRole("heading", {
      name: fr["intervention.action.suspendre"],
    }),
  });
  await formSuspendre2
    .locator('input[name="motif"]')
    .fill("INT2 — attente de la pièce Y");
  await formSuspendre2.locator('input[name="piece_attendue_ref"]').fill("Y-1");
  await formSuspendre2
    .locator('input[name="date_dispo_prevue"]')
    .fill("2026-10-20");
  await formSuspendre2
    .getByRole("button", { name: fr["intervention.action.suspendre"] })
    .click();
  await page.waitForLoadState("networkidle");

  // LES DEUX PAUSES SONT LISIBLES — SAV-09, ce que les quatre colonnes
  // réécrites de `intervention` ne pouvaient pas montrer.
  await expect(page.getByText("X-1")).toBeVisible();
  await expect(page.getByText("Y-1")).toBeVisible();
  await capturer(page, "fiche-en-pause-deux-pauses");
});

test("l'intervention CLÔTURÉE ne propose ni suspendre ni planifier", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_CLOTUREE}`);
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.cloturee"]),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: fr["intervention.action.suspendre"] }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: fr["intervention.action.planifier"] }),
  ).toHaveCount(0);
  await capturer(page, "fiche-cloturee");
});

test("la note interne saisie n'apparaît PAS sur la fiche terrain du technicien", async ({
  page,
}) => {
  await page.goto(`/interventions/${interventionPausesId}`);
  // Le `<h2>` du titre est un FRÈRE du `<form>`, pas son parent (voir
  // `NoteInterne`, `app/(back-office)/interventions/[id]/page.tsx`) : le
  // sélecteur cible l'attribut `action`, distinctif, plutôt qu'un ancêtre
  // que le formulaire n'a pas.
  const formNote = page.locator(
    `form[action="/api/interventions/${interventionPausesId}/note-interne"]`,
  );
  await formNote
    .locator('textarea[name="note_interne"]')
    .fill("INT2 — note interne, jamais côté terrain.");
  await formNote
    .getByRole("button", { name: fr["intervention.note_interne.enregistrer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(formNote.locator('textarea[name="note_interne"]')).toHaveValue(
    "INT2 — note interne, jamais côté terrain.",
  );

  // AFFECTATION DIRECTE — ce scénario n'éprouve pas la voie d'affectation
  // (couverte ailleurs), seulement l'ABSENCE de la note côté terrain.
  const admin1 = admin();
  try {
    await admin1.intervention.update({
      where: { id: interventionPausesId },
      data: { technicien_id: technicienId },
    });
  } finally {
    await admin1.$disconnect();
  }

  // SE DÉCONNECTER D'ABORD — la session ADV de ce test reste active sinon,
  // et `/connexion` redirige un compte déjà connecté vers `/arrivee`
  // (`app/(sans-session)/connexion/page.tsx`) plutôt que de proposer le
  // formulaire.
  await page.getByRole("button", { name: fr["nav.deconnexion"] }).click();
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/arrivee/);

  await page.goto(`/terrain/${interventionPausesId}`);
  await expect(
    page.getByText("INT2 — note interne, jamais côté terrain."),
  ).toHaveCount(0);
  await expect(
    page.getByText(fr["intervention.note_interne.titre"]),
  ).toHaveCount(0);
});
