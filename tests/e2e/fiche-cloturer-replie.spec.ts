import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 99T-G9-CLOTURER-REPLIE (26/09/2026, audit d'ergonomie constat G9, décision
 * d'Alexis) — LE REFUS DU BLOC CLÔTURER SE REPLIE, HORS INTERVENTION
 * `terminee`.
 *
 * **Retouché par D160 (9DF-TP-CY2-MATRICE-D8, 04/10/2026) :** la fiche
 * `a_planifier` refusait pour « temps non mesuré » ; elle refuse désormais
 * pour « pas terminée » — `peutCloturer` (D8 à la lettre) juge le statut
 * AVANT le temps mesuré.
 *
 * **BASCULE (9ES-TP-UX4-3-FICHE-GESTES-1, décision n° 63 d'Alexis,
 * 08/10/2026, D194) :** le bloc « Clôturer » de la carte Actions a disparu —
 * « Clôturer » est désormais un bouton d'en-tête qui ouvre un dialogue, et
 * n'existe QUE sur une `terminee` (D194 : « un refus de STATUT n'affiche
 * plus rien à la place de l'action — le bouton est simplement ABSENT »). Le
 * PRINCIPE que ce fichier éprouve devient : sur une `a_planifier`, le bouton
 * n'existe nulle part et la route refuse toujours ; sur une `terminee` sans
 * temps mesuré, le dialogue est fermé par défaut, le bouton l'ouvre, et la
 * raison du refus (`intervention.refus.temps_manquant`) se lit DANS le
 * dialogue, en ton oxyde, à côté du bouton désactivé — jamais un bloc replié
 * séparé.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `G9-`
 *
 * Un client, un site, deux interventions — l'une `a_planifier`, l'autre
 * `terminee`, ni l'une ni l'autre n'ayant de temps mesuré — créées en
 * `beforeAll`, supprimées en `afterAll`, aucune ligne ajoutée au semis (même
 * discipline que `tests/e2e/fiche-actions.spec.ts`). L'`INSERT` direct ne
 * déclenche pas `intervention_cycle_de_vie` (il ne surveille que l'`UPDATE`).
 */
test.describe.configure({ mode: "serial" });

const CLIENT_G9 = uuidv7();
const SITE_G9 = uuidv7();
const INTERVENTION_G9_A_PLANIFIER = uuidv7();
const INTERVENTION_G9_TERMINEE = uuidv7();

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });

    await client.client.create({
      data: {
        id: CLIENT_G9,
        societe_id: reperes.societeId,
        raison_sociale: fr["bloccloturereplie.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_G9,
        societe_id: reperes.societeId,
        client_id: CLIENT_G9,
        agence_id: agence.id,
        libelle: fr["bloccloturereplie.e2e.site"],
      },
    });

    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'a_planifier', now())`,
      INTERVENTION_G9_A_PLANIFIER,
      reperes.societeId,
      CLIENT_G9,
      SITE_G9,
      agence.id,
    );
    // RAPPORT VALIDÉ POSÉ ICI (RG-INT-03, D135, 9H1) : ce fichier éprouve le
    // refus « temps manquant » — `peutCloturer` le juge APRÈS le rapport
    // validé — jamais celui de RG-INT-03, qui masquerait sinon la raison que
    // ce scénario isole.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "rapport_valide_par", "rapport_valide_le", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'terminee', $6::uuid, now(), now())`,
      INTERVENTION_G9_TERMINEE,
      reperes.societeId,
      CLIENT_G9,
      SITE_G9,
      agence.id,
      reperes.technicienDucos,
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
      CLIENT_G9,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_G9 } });
    await client.client.deleteMany({ where: { id: CLIENT_G9 } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/99T-G9-CLOTURER-REPLIE/captures",
);

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1000 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
    fullPage: true,
  });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  await ouvrirUneSession(page);
});

test("fiche « à planifier » : le bouton « Clôturer » n'existe nulle part, et la route refuse toujours", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_G9_A_PLANIFIER}`);
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.a_planifier"]),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: fr["intervention.action.cloturer"] }),
  ).toHaveCount(0);

  await capturer(page, "cloturer-a-planifier-absent", 1280);
  await capturer(page, "cloturer-a-planifier-absent", 375);

  // D160 (9DF-TP-CY2-MATRICE-D8) : `peutCloturer` refuse désormais une
  // fiche hors `terminee` AVANT même de regarder le temps mesuré — la clé
  // reste `pas_terminee`. La preuve ne s'affaiblit pas en perdant son bloc
  // replié : elle se déplace vers la route, qui refuse toujours ce geste.
  const reponse = await page.request.post(
    `/api/interventions/${INTERVENTION_G9_A_PLANIFIER}/cloturer`,
    {
      form: { temps_valide_min: "30" },
      maxRedirects: 0,
      failOnStatusCode: false,
    },
  );
  expect(reponse.status()).toBe(303);
  expect(reponse.headers()["location"]).toContain("pas_terminee");
});

test("fiche « terminée » sans temps mesuré : le dialogue est fermé, le bouton l'ouvre, la raison se lit dedans en ton oxyde", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_G9_TERMINEE}`);
  await expect(
    page.getByRole("heading", { level: 1 }).getByText(fr["statut.terminee"]),
  ).toBeVisible();

  const bouton = page.getByRole("button", {
    name: fr["intervention.action.cloturer"],
  });
  await expect(bouton).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(0);

  await capturer(page, "cloturer-terminee-ferme", 1280);
  await capturer(page, "cloturer-terminee-ferme", 375);

  await bouton.click();
  const dialogue = page.locator("dialog[open]");
  await expect(dialogue).toBeVisible();

  const raison = dialogue.getByText(fr["intervention.refus.temps_manquant"]);
  await expect(raison).toBeVisible();
  await expect(raison).toHaveClass(/text-app-rouge-encre/);

  await expect(
    dialogue.getByRole("button", {
      name: fr["intervention.action.cloturer"],
    }),
  ).toBeDisabled();

  await capturer(page, "cloturer-terminee-ouvert", 1280);
});
