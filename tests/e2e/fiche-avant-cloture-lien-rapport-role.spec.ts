import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_RM_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9H1B-MIGRATION-SUR-BASE-REMPLIE, point 4 — LE LIEN « VALIDER LE RAPPORT »
 * DU BLOC « AVANT DE CLÔTURER » N'APPARAÎT QU'AU RÔLE QUI PEUT VALIDER.
 *
 * Revue du pilote (83bc0908) : `AvantDeCloturer` (onglet Résumé) affichait ce
 * lien à TOUT rôle qui visite la fiche dès que le rapport n'était pas
 * validé — y compris l'ADV et le technicien, qui n'ont pas `valider_rapport`
 * (maquette `CAN.valider`, « jamais l'ADV ») et que le bouton d'action
 * juste au-dessus (`peutValiderCeRapport`) leur refusait déjà. Le composant
 * reçoit maintenant la même capacité et ne montre le lien QUE si elle est
 * vraie — ce fichier le mesure depuis DEUX rôles sur la MÊME ligne.
 *
 * SA PROPRE SCÈNE, préfixée `9H1BROLE-` — une `terminee` au rapport NON
 * validé (l'état que « Avant de clôturer » doit juger), créée en
 * `beforeAll`, supprimée en `afterAll`.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9H1BROLE = uuidv7();
const SITE_9H1BROLE = uuidv7();
const INTERVENTION_9H1BROLE = uuidv7();

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
        id: CLIENT_9H1BROLE,
        societe_id: reperes.societeId,
        raison_sociale: "9H1BROLE client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9H1BROLE,
        societe_id: reperes.societeId,
        client_id: CLIENT_9H1BROLE,
        agence_id: agence.id,
        libelle: "9H1BROLE site",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9H1BROLE,
        societe_id: reperes.societeId,
        client_id: CLIENT_9H1BROLE,
        site_id: SITE_9H1BROLE,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "terminee",
        date_planifiee: new Date("2026-10-20T00:00:00Z"),
        duree_estimee_min: 60,
        commentaire_technicien: fr["terrain.e2e.commentaire"],
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
      CLIENT_9H1BROLE,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9H1BROLE } });
    await client.client.deleteMany({ where: { id: CLIENT_9H1BROLE } });
  } finally {
    await client.$disconnect();
  }
});

test("l'ADV ne voit PAS le lien « Valider le rapport »", async ({ page }) => {
  await ouvrirUneSession(page);

  await page.goto(`/interventions/${INTERVENTION_9H1BROLE}?onglet=resume`);
  const ligneRapportValide = page
    .locator("li")
    .filter({ hasText: fr["intervention.avant_cloture.rapport_valide"] });
  await expect(ligneRapportValide).toBeVisible();
  await expect(
    ligneRapportValide.getByRole("link", {
      name: fr["intervention.avant_cloture.lien_rapport"],
    }),
  ).toHaveCount(0);
});

test("le RM, qui porte valider_rapport, voit le lien sur la MÊME ligne", async ({
  page,
}) => {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_RM_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/planning/);

  await page.goto(`/interventions/${INTERVENTION_9H1BROLE}?onglet=resume`);
  const ligneRapportValide = page
    .locator("li")
    .filter({ hasText: fr["intervention.avant_cloture.rapport_valide"] });
  await expect(ligneRapportValide).toBeVisible();
  await expect(
    ligneRapportValide.getByRole("link", {
      name: fr["intervention.avant_cloture.lien_rapport"],
    }),
  ).toBeVisible();
});
