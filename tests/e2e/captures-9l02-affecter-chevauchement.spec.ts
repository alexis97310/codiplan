import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { instantAMinutes, jourSuivant } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { dialogueOuvert } from "./setup/saisie-manuelle";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9L02-AFFECTER-CHEVAUCHEMENT (décision d'Alexis du
 * 10/11/2026) — même recette que `captures-9az-aa6-refus-creation.spec.ts` :
 * rien n'est écrit sans la variable d'environnement qui nomme le dossier.
 *
 * ## La scène
 *
 * Deux interventions de Ducos, sur le MÊME créneau, VINGT-SIX SEMAINES PLUS
 * LOIN qu'aucun autre scénario — pour qu'aucun dépôt parallèle ne tombe sur
 * la case qu'elles occupent (fullyParallel) : l'une déjà POSÉE sur
 * `technicienDucos`, l'autre SANS technicien — celle qu'on affecte. Choisir
 * le MÊME technicien sur le formulaire « Changer de technicien » doit
 * refuser le chevauchement, montrer le motif DANS le dialogue, et garder le
 * choix sélectionné.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9L02 ?? "";

const PREFIXE = "9L02CAP-";
const VENDREDI = 4;
const SEMAINES_DE_DECALAGE = 26;
const DEBUT_MINUTES = 14 * 60;
const DUREE_MIN = 60;

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

let voisineId = "";
let aAffecterId = "";
let technicienDucos = "";

async function nettoyer(client: PrismaClient): Promise<void> {
  await client.intervention.deleteMany({
    where: { id: { in: [voisineId, aAffecterId].filter((id) => id !== "") } },
  });
}

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  technicienDucos = reperes.technicienDucos;
  const jourVise = jourSuivant(
    reperes.lundi,
    7 * SEMAINES_DE_DECALAGE + VENDREDI,
  );
  const date = new Date(
    Date.UTC(jourVise.annee, jourVise.mois - 1, jourVise.jour),
  );
  // `instantAMinutes`, ET NON UNE ARITHMÉTIQUE UTC NUE : les minutes sont
  // LOCALES, dans le fuseau de la société (UTC+11 à Nouméa) — un simple
  // `date.getTime() + minutes * 60_000` viserait l'heure UTC, pas l'heure
  // locale, et manquerait le créneau d'ouverture comme le chevauchement visé.
  const debut = instantAMinutes(jourVise, DEBUT_MINUTES, reperes.fuseau);
  const fin = new Date(debut.getTime() + DUREE_MIN * 60_000);

  const client = admin();
  try {
    const ducos = await client.agence.findFirstOrThrow({
      where: { societe_id: reperes.societeId, code: "DUCOS" },
      select: { id: true },
    });
    const site = await client.site.findFirstOrThrow({
      where: {
        societe_id: reperes.societeId,
        agence_id: ducos.id,
        client: { actif: true },
        libelle: "Atelier principal",
      },
      select: { id: true, client_id: true },
    });

    voisineId = randomUUID();
    aAffecterId = randomUUID();
    await nettoyer(client);
    // LA VOISINE — déjà posée sur `technicienDucos`, SUR CE CRÉNEAU.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "type", "priorite", "statut", "date_planifiee", "creneau_debut",
         "creneau_fin", "technicien_id", "duree_estimee_min",
         "mode_valorisation", "devise_code", "description", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'p3',
               'planifiee', $6::date, $7, $8, $9::uuid, $10,
               'temps_passe', 'XPF', $11, now())`,
      voisineId,
      reperes.societeId,
      ducos.id,
      site.client_id,
      site.id,
      date,
      debut,
      fin,
      technicienDucos,
      DUREE_MIN,
      `${PREFIXE}voisine`,
    );
    // CELLE QU'ON AFFECTE — MÊME CRÉNEAU, SANS technicien.
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "type", "priorite", "statut", "date_planifiee", "creneau_debut",
         "creneau_fin", "duree_estimee_min",
         "mode_valorisation", "devise_code", "description", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'p3',
               'planifiee', $6::date, $7, $8, $9,
               'temps_passe', 'XPF', $10, now())`,
      aAffecterId,
      reperes.societeId,
      ducos.id,
      site.client_id,
      site.id,
      date,
      debut,
      fin,
      DUREE_MIN,
      `${PREFIXE}a-affecter`,
    );
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await nettoyer(client);
  } finally {
    await client.$disconnect();
  }
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

for (const largeur of [1280, 390] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirUneSession(page);
    });

    test(`capture — le chevauchement se refuse DANS le dialogue, sans perdre le choix, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto(`/interventions/${aAffecterId}`);
      await page
        .getByRole("button", { name: fr["ui.menu_plus.titre"] })
        .click();
      await page
        .getByRole("menuitem", {
          name: fr["intervention.action.changer_technicien"],
        })
        .click();
      const dialogue = dialogueOuvert(page);
      await dialogue
        .locator('select[name="technicien_id"]')
        .selectOption(technicienDucos);
      await dialogue
        .getByRole("button", {
          name: fr["intervention.action.changer_technicien"],
        })
        .click();
      await page.waitForLoadState("networkidle");

      await expect(page).toHaveURL(
        new RegExp(`/interventions/${aAffecterId}\\?`),
      );
      const dialogueRouvert = dialogueOuvert(page);
      await expect(dialogueRouvert).toBeVisible();
      await expect(
        dialogueRouvert.getByText(fr["intervention.refus.chevauchement"]),
      ).toBeVisible();
      // LA SAISIE N'EST PAS PERDUE — le technicien refusé reste sélectionné.
      await expect(
        dialogueRouvert.locator('select[name="technicien_id"]'),
      ).toHaveValue(technicienDucos);

      await capturer(page, "refus-chevauchement-dans-le-dialogue", largeur);
    });
  });
}
