import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_EPREUVE } from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * 9I8-AFFICHAGE-DES-MONTANTS, POINT 5 — LE RÉGLAGE DÉSACTIVÉ MASQUE TOUT, À
 * TOUT RÔLE, SUR LA FICHE ET SUR LE BON.
 *
 * ## La société de la scène est PARTAGÉE par tout le run e2e
 *
 * `societe.afficher_montants` n'a pas de fixture à soi, exactement comme
 * `societe.logo_*` (`tests/e2e/9ez-logo-societe.spec.ts`, dont ce fichier
 * reprend le patron) : ce fichier tourne en SÉRIE, le DÉSACTIVE le plus tard
 * possible, et le RÉTABLIT dans un `afterAll` — `CI=1 pnpm verify:full`
 * l'exécute de toute façon à `workers: 1` (aucune autre épreuve ne tourne en
 * même temps).
 *
 * ## SA PROPRE INTERVENTION, PAS `SCENE.obstacle`
 *
 * `SCENE.obstacle` traverse son cycle de vie au fil des AUTRES fichiers
 * (planifiée → … → clôturée) : mesuré, elle n'est `cloturee` qu'une fois la
 * suite complète jouée dans l'ordre, jamais quand ce fichier tourne seul ou
 * en tête. Même recette que `tests/e2e/9i8-affichage-des-montants.spec.ts` :
 * une intervention insérée DÉJÀ `cloturee`, avec un taux VALIDE à sa date
 * (`date_effet` 2020-01-01 du semis, `tests/e2e/setup/scene.ts`) — pour que
 * le total existe, et que le réglage soit la SEULE chose qui le masque.
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9I8D = uuidv7();
const SITE_9I8D = uuidv7();
const INTERVENTION_9I8D = uuidv7();

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
        id: CLIENT_9I8D,
        societe_id: reperes.societeId,
        raison_sociale: fr["9i8.e2e.client"],
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9I8D,
        societe_id: reperes.societeId,
        client_id: CLIENT_9I8D,
        agence_id: agence.id,
        libelle: fr["9i8.e2e.lieu"],
      },
    });

    await client.$executeRawUnsafe(
      `INSERT INTO "intervention"
         ("id", "societe_id", "client_id", "site_id", "agence_id", "type",
          "statut", "date_planifiee", "duree_estimee_min", "technicien_id",
          "temps_valide_min", "temps_valide_par", "temps_valide_le",
          "cloturee_le", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif',
               'cloturee', '2026-11-24T00:00:00Z', 60, $6::uuid,
               90, $6::uuid, now(), now(), 'XPF', now())`,
      INTERVENTION_9I8D,
      reperes.societeId,
      CLIENT_9I8D,
      SITE_9I8D,
      agence.id,
      reperes.technicienDucos,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    await client.societe.update({
      where: { id: reperes.societeId },
      data: { afficher_montants: true },
    });
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9I8D,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9I8D } });
    await client.client.deleteMany({ where: { id: CLIENT_9I8D } });
  } finally {
    await client.$disconnect();
  }
});

test("désactivé, l'ADV qui a le droit ne voit plus rien — ni sur la fiche, ni sur le bon", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    await client.societe.update({
      where: { id: reperes.societeId },
      data: { afficher_montants: false },
    });
  } finally {
    await client.$disconnect();
  }

  await ouvrirLaSessionSensible(page, COMPTE_EPREUVE);

  await page.goto(`/interventions/${INTERVENTION_9I8D}?onglet=valorisation`);
  await expect(
    page.getByRole("heading", { name: fr["intervention.cloture.facture"] }),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.valorisation.desactive_par_societe"]),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.cloture.total"], { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText(fr["intervention.valorisation.sans_droit"]),
  ).toHaveCount(0);

  await page.goto(`/interventions/${INTERVENTION_9I8D}/bon?version=interne`);
  await expect(
    page.getByText(fr["intervention.valorisation.desactive_par_societe"]),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.cloture.total"], { exact: true }),
  ).toHaveCount(0);
});

test("réactivé, le même ADV retrouve le total — aucune donnée perdue, seul l'affichage a varié", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  const client = admin();
  try {
    await client.societe.update({
      where: { id: reperes.societeId },
      data: { afficher_montants: true },
    });
  } finally {
    await client.$disconnect();
  }

  await ouvrirLaSessionSensible(page, COMPTE_EPREUVE);
  await page.goto(`/interventions/${INTERVENTION_9I8D}?onglet=valorisation`);
  await expect(
    page.getByText(fr["intervention.cloture.total"], { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.valorisation.desactive_par_societe"]),
  ).toHaveCount(0);

  await page.goto(`/interventions/${INTERVENTION_9I8D}/bon?version=interne`);
  await expect(
    page.getByText(fr["intervention.cloture.total"], { exact: true }),
  ).toBeVisible();
});
