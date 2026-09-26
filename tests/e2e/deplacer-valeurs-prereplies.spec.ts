import { PrismaClient } from "@prisma/client";
import { expect, test } from "@playwright/test";

import { heureDuCreneau } from "@/app/(back-office)/interventions/presentation";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * 99S-GR4-DEPLACER (26/09/2026, constat G3 de l'audit) — « DÉPLACER » PORTE
 * DÉJÀ LA DATE, L'HEURE ET LA DURÉE DE L'INTERVENTION.
 *
 * ## Le défaut mesuré
 *
 * Seul le technicien était pré-rempli dans le formulaire « Déplacer » — date,
 * heure et durée étaient trois champs VIDES à réécrire pour décaler une
 * intervention déjà planifiée, alors que les trois valeurs existent déjà sur
 * la ligne (`ligne.date_planifiee`, `heureDuCreneau`, `duree_estimee_min`).
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `ERGO4-`
 *
 * Un client, un site, DEUX interventions `planifiee` — créés en `beforeAll`,
 * supprimés en `afterAll`, aucune ligne ajoutée au semis (même discipline que
 * `tests/e2e/fiche-actions.spec.ts`).
 */

test.describe.configure({ mode: "serial" });

const CLIENT_ERGO4 = uuidv7();
const SITE_ERGO4 = uuidv7();
const INTERVENTION_AVEC_HEURE = uuidv7();
const INTERVENTION_SANS_HEURE = uuidv7();

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
/** L'heure attendue, MESURÉE par la même fonction que l'écran (`heureDuCreneau`)
 * — jamais une chaîne écrite en dur (L0-11). */
let heureAttendue: string;
/** `date_planifiee` rendu au format `AAAA-MM-JJ` d'un `<input type="date">`. */
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
        id: CLIENT_ERGO4,
        societe_id: reperes.societeId,
        raison_sociale: "ERGO4",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ERGO4,
        societe_id: reperes.societeId,
        client_id: CLIENT_ERGO4,
        agence_id: agence.id,
        libelle: "ERGO4",
      },
    });

    jour = dansSixSemaines();
    dateAttendue = jour.toISOString().slice(0, 10);
    // `creneau_debut` est un `TIMESTAMP(3)` SANS fuseau — Prisma le lit comme
    // un INSTANT UTC (L0-08). 09:00 à Nouméa (UTC+11, sans heure d'été) est
    // donc 22:00 UTC la VEILLE du jour civil.
    creneauDebut = new Date(jour.getTime() + (9 - 11) * 3_600_000);
    const heure = heureDuCreneau({ creneau_debut: creneauDebut }, fuseau);
    if (heure === null) {
      throw new Error("le créneau posé devrait produire une heure lisible");
    }
    heureAttendue = heure;

    // AVEC HEURE — date, créneau et durée tous posés.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "type", "priorite", "statut", "date_planifiee", "creneau_debut",
         "duree_estimee_min", "mode_valorisation", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'p3',
               'planifiee', $6::date, $7::timestamp, 90,
               'temps_passe', 'XPF', now())`,
      INTERVENTION_AVEC_HEURE,
      reperes.societeId,
      agence.id,
      CLIENT_ERGO4,
      SITE_ERGO4,
      jour,
      creneauDebut,
    );

    // SANS HEURE — datée, mais aucun créneau (une journée sans heure).
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "type", "priorite", "statut", "date_planifiee",
         "duree_estimee_min", "mode_valorisation", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'p3',
               'planifiee', $6::date, 90, 'temps_passe', 'XPF', now())`,
      INTERVENTION_SANS_HEURE,
      reperes.societeId,
      agence.id,
      CLIENT_ERGO4,
      SITE_ERGO4,
      jour,
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
      CLIENT_ERGO4,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_ERGO4 } });
    await client.client.deleteMany({ where: { id: CLIENT_ERGO4 } });
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

test("« Déplacer » porte déjà la date, l'heure et la durée d'une intervention planifiée", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_AVEC_HEURE}`);
  await expect(page.locator('input[name="date_planifiee"]')).toHaveValue(
    dateAttendue,
  );
  await expect(page.locator('input[name="heure_debut"]')).toHaveValue(
    heureAttendue,
  );
  await expect(page.locator('input[name="duree_min"]')).toHaveValue("90");
});

test("« Déplacer » laisse l'heure vide quand l'intervention n'en a pas", async ({
  page,
}) => {
  await page.goto(`/interventions/${INTERVENTION_SANS_HEURE}`);
  await expect(page.locator('input[name="date_planifiee"]')).toHaveValue(
    dateAttendue,
  );
  await expect(page.locator('input[name="heure_debut"]')).toHaveValue("");
  await expect(page.locator('input[name="duree_min"]')).toHaveValue("90");
});
