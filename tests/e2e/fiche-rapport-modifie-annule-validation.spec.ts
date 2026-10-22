import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import {
  COMPTE_RM_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { reperesDeLaScene } from "./setup/reperes";

/**
 * 9H1-RAPPORT-VALIDE-AVANT-CLOTURE, point ouvert n° 4 de la passation — UN
 * RAPPORT MODIFIÉ ANNULE SA VALIDATION (RG-INT-03, D135), de bout en bout.
 *
 * `enregistrerRapportTexte` (`lib/interventions/depot-rapport-terrain.ts:
 * 165-178`) efface `rapport_valide_par`/`rapport_valide_le` à chaque
 * enregistrement — mesuré en unitaire et en isolation, jamais depuis les
 * DEUX écrans réels : le bureau qui valide, puis le terrain qui réécrit le
 * rapport sous le pied de cette validation. Ce fichier joue les deux,
 * dans l'ordre, sur la MÊME ligne.
 *
 * SA PROPRE SCÈNE, préfixée `9H1ANN-` — une intervention `terminee`, un
 * rapport déjà écrit ET DÉJÀ VALIDÉ posé au semis (pour que le scénario
 * commence sur l'état qu'il doit défaire, jamais sur celui qu'il produirait
 * lui-même), créée en `beforeAll`, supprimée en `afterAll`.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9H1ANN = uuidv7();
const SITE_9H1ANN = uuidv7();
const INTERVENTION_9H1ANN = uuidv7();
const COMMENTAIRE_INITIAL = "9H1ANN — rapport déjà validé";
const COMMENTAIRE_REECRIT = "9H1ANN — rapport réécrit depuis le terrain";

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
        id: CLIENT_9H1ANN,
        societe_id: reperes.societeId,
        raison_sociale: "9H1ANN client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9H1ANN,
        societe_id: reperes.societeId,
        client_id: CLIENT_9H1ANN,
        agence_id: agence.id,
        libelle: "9H1ANN site",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9H1ANN,
        societe_id: reperes.societeId,
        client_id: CLIENT_9H1ANN,
        site_id: SITE_9H1ANN,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "terminee",
        date_planifiee: new Date("2026-10-20T00:00:00Z"),
        duree_estimee_min: 60,
        commentaire_technicien: COMMENTAIRE_INITIAL,
        // DÉJÀ VALIDÉ AU SEMIS — l'état que ce scénario doit défaire, posé
        // par construction plutôt que rejoué par un geste qui n'est pas son
        // objet (même discipline que `fiche-cloturer.spec.ts`).
        rapport_valide_par: reperes.technicienDucos,
        rapport_valide_le: new Date(),
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
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9H1ANN,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9H1ANN } });
    await client.client.deleteMany({ where: { id: CLIENT_9H1ANN } });
  } finally {
    await client.$disconnect();
  }
});

test("le bureau voit le rapport validé, le terrain le réécrit, la validation a disparu", async ({
  page,
  browser,
}) => {
  // LE BUREAU D'ABORD — RM, seul rôle interne à porter `valider_rapport`
  // avec `cloturer_intervention` (jamais l'ADV, voir la passation du
  // ticket) : le rapport est validé — ni bouton « Valider le rapport », ni
  // ligne rouge dans « Avant de clôturer ».
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_RM_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/planning/);

  await page.goto(`/interventions/${INTERVENTION_9H1ANN}?onglet=rapport`);
  await expect(
    page.getByText(COMMENTAIRE_INITIAL, { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: fr["intervention.action.valider_rapport"],
    }),
  ).toHaveCount(0);
  await page.goto(`/interventions/${INTERVENTION_9H1ANN}?onglet=resume`);
  const ligneRapportValide = page
    .locator("li")
    .filter({ hasText: fr["intervention.avant_cloture.rapport_valide"] });
  await expect(ligneRapportValide).toBeVisible();
  await expect(
    ligneRapportValide.getByRole("link", {
      name: fr["intervention.avant_cloture.lien_rapport"],
    }),
  ).toHaveCount(0);

  // LE TERRAIN RÉÉCRIT LE RAPPORT — UN SECOND CONTEXTE, jamais la session
  // bureau déjà ouverte sur `page` (même discipline que
  // `9ez-logo-societe.spec.ts`).
  const contexteTerrain = await browser.newContext();
  const pageTerrain = await contexteTerrain.newPage();
  try {
    await pageTerrain.goto("/connexion");
    await pageTerrain
      .getByLabel(fr["connexion.email"])
      .fill(COMPTE_TECHNICIEN_EPREUVE);
    await pageTerrain
      .getByLabel(fr["connexion.mot_de_passe"])
      .fill(MOT_DE_PASSE_EPREUVE);
    await pageTerrain
      .getByRole("button", { name: fr["connexion.valider"] })
      .click();
    await expect(pageTerrain).toHaveURL(/\/terrain$/);

    await pageTerrain.goto(`/terrain/${INTERVENTION_9H1ANN}`);
    await pageTerrain
      .getByLabel(fr["terrain.rapport.commentaire_libelle"])
      .fill(COMMENTAIRE_REECRIT);
    await pageTerrain
      .getByLabel(fr["terrain.rapport.commentaire_libelle"])
      .blur();
    await expect(
      pageTerrain.getByText(fr["terrain.rapport.enregistre"]),
    ).toBeVisible();
  } finally {
    await contexteTerrain.close();
  }

  // LE BUREAU RELIT — LA VALIDATION A DISPARU : le bouton « Valider le
  // rapport » est revenu, « Avant de clôturer » montre de nouveau le rapport
  // NON validé, avec son lien vers l'onglet Rapport.
  await page.goto(`/interventions/${INTERVENTION_9H1ANN}?onglet=rapport`);
  await expect(
    page.getByText(COMMENTAIRE_REECRIT, { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: fr["intervention.action.valider_rapport"],
    }),
  ).toBeVisible();
  await page.goto(`/interventions/${INTERVENTION_9H1ANN}?onglet=resume`);
  await expect(
    ligneRapportValide.getByRole("link", {
      name: fr["intervention.avant_cloture.lien_rapport"],
    }),
  ).toBeVisible();
});
