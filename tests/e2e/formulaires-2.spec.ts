import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { urlAdministration } from "./setup/base";
import {
  choisirResultatParTexte,
  valeurChamp,
} from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * 56-FORMULAIRES-2 — UNE CRÉATION D'INTERVENTION REFUSÉE REVIENT AU
 * FORMULAIRE, AVEC CE QUI AVAIT ÉTÉ SAISI.
 *
 * ## Le constat
 *
 * `POST /api/interventions/creer` redirigeait TOUT refus — schéma, lieu,
 * panne manquante — vers `/planning?motif=…` : l'utilisateur quittait
 * l'écran et perdait tout ce qu'il avait saisi. `versLeFormulaire`
 * (`app/api/interventions/creer/formulaire.ts`) revient désormais au
 * formulaire, chaque champ soumis reporté par l'URL.
 *
 * ## Ce que les tests unitaires ne peuvent pas prouver
 *
 * `tests/unit/interventions/creer-retour-formulaire.test.ts` éprouve la
 * construction de l'URL, pure. Il ne prouve pas qu'un ÉCRAN réel relit ces
 * paramètres et réaffiche réellement chaque champ — c'est ce que ce fichier
 * joue, à travers le navigateur.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `FRM2-`
 *
 * Un client, un site, une machine — créés en `beforeAll`, supprimés en
 * `afterAll`, aucune ligne ajoutée au semis (`prisma/seed.ts`). Même
 * discipline que `tests/e2e/fiche-360-1.spec.ts`. Le décompte final ne porte
 * QUE sur les interventions dont la référence client commence par `FRM2-` :
 * ce fichier tourne sous `fullyParallel`, aux côtés de scénarios qui créent
 * leurs propres interventions ailleurs.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_FRM2 = uuidv7();
const SITE_FRM2 = uuidv7();
const MACHINE_FRM2 = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const client = admin();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societe.id, code: "DUCOS" },
      select: { id: true },
    });
    const modele = await client.modeleMateriel.findFirstOrThrow({
      where: { societe_id: societe.id },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_FRM2,
        societe_id: societe.id,
        raison_sociale: fr["formulaires2.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_FRM2,
        societe_id: societe.id,
        client_id: CLIENT_FRM2,
        agence_id: agence.id,
        libelle: fr["formulaires2.e2e.site"],
      },
    });
    await client.machine.create({
      data: {
        id: MACHINE_FRM2,
        societe_id: societe.id,
        modele_id: modele.id,
        client_id: CLIENT_FRM2,
        site_id: SITE_FRM2,
        numero_serie: fr["formulaires2.e2e.numero_serie"],
        qr_token: engendrerJetonQr(),
      },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.intervention.deleteMany({
      where: { client_id: CLIENT_FRM2 },
    });
    await client.machine.deleteMany({ where: { id: MACHINE_FRM2 } });
    await client.site.deleteMany({ where: { id: SITE_FRM2 } });
    await client.client.deleteMany({ where: { id: CLIENT_FRM2 } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/56-FORMULAIRES-2/captures",
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

test("un refus de saisie revient au formulaire, avec ce qui avait été saisi", async ({
  page,
}) => {
  await page.goto("/interventions/nouvelle");

  await choisirResultatParTexte(
    page,
    "site",
    fr["formulaires2.e2e.site"],
    fr["formulaires2.e2e.site"],
  );

  const selectMachine = page.locator('select[name="machine_ids"]');
  await expect(
    selectMachine.locator(`option[value="${MACHINE_FRM2}"]`),
  ).toBeAttached();
  await selectMachine.selectOption(MACHINE_FRM2);

  await page.locator('select[name="type"]').selectOption("curatif");
  await page.locator('select[name="priorite"]').selectOption("p1");
  await page
    .locator('input[name="reference_client"]')
    .fill(fr["formulaires2.e2e.reference_client"]);

  // LA PANNE RESTE VIDE, exprès — c'est le refus qu'on éprouve. `required`
  // est retiré pour atteindre le refus SERVEUR, pas seulement celui du
  // navigateur (même geste que `parcours-creer-puis-planifier.spec.ts`).
  await page
    .locator('form[action="/api/interventions/creer"]')
    .evaluate((form) => {
      form.querySelector('[name="description"]')?.removeAttribute("required");
    });

  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");

  // ── LE REFUS REVIENT AU FORMULAIRE, PAS AU PLANNING ─────────────────────
  await expect(page).toHaveURL(/\/interventions\/nouvelle\?/);
  await expect(page.getByRole("status")).toContainText(
    fr["intervention.refus.panne_manquante"],
  );

  // ── CHAQUE CHAMP REMPLI A GARDÉ SA VALEUR ───────────────────────────────
  await expect(valeurChamp(page, "site")).toHaveValue(
    `${CLIENT_FRM2}:${SITE_FRM2}`,
  );
  await expect(
    page.locator('[data-selecteur="site"] input[type="text"]'),
  ).toHaveValue(
    `${fr["formulaires2.e2e.client"]} — ${fr["formulaires2.e2e.site"]}`,
  );
  await expect(page.locator('select[name="machine_ids"]')).toHaveValue(
    MACHINE_FRM2,
  );
  await expect(page.locator('select[name="type"]')).toHaveValue("curatif");
  await expect(page.locator('select[name="priorite"]')).toHaveValue("p1");
  await expect(page.locator('input[name="reference_client"]')).toHaveValue(
    fr["formulaires2.e2e.reference_client"],
  );

  await capturer(page, "formulaire-apres-refus");

  // ── ON AJOUTE LA PANNE, ET ÇA PASSE ──────────────────────────────────────
  await page
    .locator('textarea[name="description"]')
    .fill(fr["formulaires2.e2e.panne"]);
  await page
    .getByRole("button", { name: fr["intervention.action.creer"] })
    .click();
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveURL(/\/interventions\/[0-9a-f-]+$/);

  // TÉMOIN — la première soumission (refusée) n'a RIEN créé : seule la
  // seconde, complète, a écrit une ligne. Ne compte que « FRM2- » : ce
  // fichier tourne sous `fullyParallel`, à côté de scénarios qui créent
  // leurs propres interventions ailleurs (§9, piège des épreuves qui
  // comptent large).
  const client = admin();
  try {
    const total = await client.intervention.count({
      where: { reference_client: { startsWith: "FRM2-" } },
    });
    expect(total).toBe(1);
  } finally {
    await client.$disconnect();
  }
});
