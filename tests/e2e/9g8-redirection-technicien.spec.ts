import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible } from "./setup/session";

/**
 * D221 (décision d'Alexis du 21/10/2026, 9G8-TERRAIN-CONFIRMATIONS-ET-ACCES)
 * — LE BACK-OFFICE EST FERMÉ AU TECHNICIEN, PAR UN GARDE SERVEUR.
 *
 * Mesuré en ligne : connecté en technicien, `/interventions/<id>` (fiche
 * BUREAU, sans montant mais la fiche quand même) et son bon s'ouvraient —
 * `app/(back-office)/layout.tsx` ne gardait aucun rôle. Les trois scénarios
 * que le ticket nomme explicitement : une fiche AFFECTÉE renvoie à sa fiche
 * terrain, une route sans rapport avec une intervention renvoie à `/terrain`,
 * et un rôle de bureau (ADV) n'est pas concerné.
 */
function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

test.describe.configure({ mode: "serial" });

const CLIENT_ID = uuidv7();
const SITE_ID = uuidv7();
const INTERVENTION_AFFECTEE = uuidv7();
const INTERVENTION_AUTRE_TECHNICIEN = uuidv7();
const RAISON_SOCIALE_CLIENT = "zz9G8 Client";

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
        id: CLIENT_ID,
        societe_id: reperes.societeId,
        raison_sociale: RAISON_SOCIALE_CLIENT,
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ID,
        societe_id: reperes.societeId,
        client_id: CLIENT_ID,
        agence_id: agence.id,
        libelle: "zz9G8 Site",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_AFFECTEE,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienDucos,
        statut: "affectee",
        type: "curatif",
        priorite: "p3",
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        duree_estimee_min: 30,
        date_planifiee: new Date(),
      },
    });
    // AFFECTÉE À UN AUTRE TECHNICIEN (reperes.technicienKone, `perrin@codima.
    // test`) — jamais ouverte en session : ce compte vient du semis de
    // DÉMONSTRATION (I9), pas du harnais e2e, et son mot de passe n'est pas
    // `MOT_DE_PASSE_EPREUVE`. Seul son identifiant sert ici, comme clé
    // étrangère ; la session testée reste celle, déjà provisionnée pour le
    // harnais, de `COMPTE_TECHNICIEN_EPREUVE`.
    await client.intervention.create({
      data: {
        id: INTERVENTION_AUTRE_TECHNICIEN,
        societe_id: reperes.societeId,
        agence_id: agence.id,
        client_id: CLIENT_ID,
        site_id: SITE_ID,
        technicien_id: reperes.technicienKone,
        statut: "affectee",
        type: "curatif",
        priorite: "p3",
        mode_valorisation: "temps_passe",
        devise_code: "XPF",
        duree_estimee_min: 30,
        date_planifiee: new Date(),
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
      where: {
        id: { in: [INTERVENTION_AFFECTEE, INTERVENTION_AUTRE_TECHNICIEN] },
      },
    });
    await client.site.deleteMany({ where: { client_id: CLIENT_ID } });
    await client.client.deleteMany({ where: { id: CLIENT_ID } });
  } finally {
    await client.$disconnect();
  }
});

test("un technicien qui ouvre la fiche d'une intervention qui lui est affectée est renvoyé à sa fiche terrain", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/interventions/${INTERVENTION_AFFECTEE}`);
  await expect(page).toHaveURL(`/terrain/${INTERVENTION_AFFECTEE}`);
  // La fiche terrain affiche le CLIENT en titre (TR-24) — jamais « Ma
  // journée », qui est le titre de la LISTE, pas celui d'une fiche.
  await expect(
    page.getByRole("heading", { name: RAISON_SOCIALE_CLIENT }),
  ).toBeVisible();
});

test("un technicien qui ouvre le bon de la même intervention est renvoyé à sa fiche terrain, pas au bon", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/interventions/${INTERVENTION_AFFECTEE}/bon`);
  await expect(page).toHaveURL(`/terrain/${INTERVENTION_AFFECTEE}`);
});

test("un technicien qui ouvre /planning est renvoyé à sa journée", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto("/planning");
  await expect(page).toHaveURL(/\/terrain$/);
});

test("un technicien non affecté à l'intervention est renvoyé à sa journée, pas à la fiche", async ({
  page,
}) => {
  // `COMPTE_TECHNICIEN_EPREUVE` (reperes.technicienDucos) ouvre ici
  // `INTERVENTION_AUTRE_TECHNICIEN`, affectée à `reperes.technicienKone` —
  // jamais à lui.
  await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
  await page.goto(`/interventions/${INTERVENTION_AUTRE_TECHNICIEN}`);
  await expect(page).toHaveURL(/\/terrain$/);
});

test("ADV — inchangé : la fiche et le planning restent ouverts, comme avant D221", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto(`/interventions/${INTERVENTION_AFFECTEE}`);
  await expect(page).toHaveURL(`/interventions/${INTERVENTION_AFFECTEE}`);

  await page.goto("/planning");
  await expect(page).toHaveURL(/\/planning/);
});
