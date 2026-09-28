import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirSaisieManuelle } from "./setup/saisie-manuelle";
import { ouvrirUneSession } from "./setup/session";
import { urlAdministration } from "./setup/base";

/**
 * LES CAPTURES DE PG-A3a-MESSAGES-POSE (28/09/2026) — chemin 2 de l'audit du
 * 27/09 : le formulaire « Déplacer » de la fiche, heure VIDÉE et durée
 * PRÉ-REMPLIE, affichait « Une intervention dure au moins un créneau. Tirez
 * la poignée sous le début du bloc, jamais au-dessus. » à qui n'avait RIEN
 * tiré. Même recette que `captures-pg-a2-ordre-techniciens.spec.ts` : AVANT
 * se rejoue sur le code d'avant ce ticket, APRÈS sur le code livré.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `PGA3A-` — un client, un site, une intervention
 * `planifiee` avec heure ET durée, créés en `beforeAll`, supprimés en
 * `afterAll` (même discipline que 99S-GR4-DEPLACER).
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PG_A3A ?? "";

const CLIENT_PGA3A = uuidv7();
const SITE_PGA3A = uuidv7();
const INTERVENTION_PGA3A = uuidv7();

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
        id: CLIENT_PGA3A,
        societe_id: reperes.societeId,
        raison_sociale: "PGA3A",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PGA3A,
        societe_id: reperes.societeId,
        client_id: CLIENT_PGA3A,
        agence_id: agence.id,
        libelle: "PGA3A",
      },
    });
    const jour = dansSixSemaines();
    // `creneau_debut` est un `TIMESTAMP(3)` SANS fuseau — Prisma le lit comme
    // un INSTANT UTC (L0-08). 08:00 à Nouméa (UTC+11) est 21:00 UTC la VEILLE.
    const creneauDebut = new Date(jour.getTime() + (8 - 11) * 3_600_000);
    const creneauFin = new Date(creneauDebut.getTime() + 90 * 60_000);
    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "type", "priorite", "statut", "date_planifiee", "creneau_debut", "creneau_fin",
         "duree_estimee_min", "mode_valorisation", "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'p3',
               'planifiee', $6::date, $7::timestamp, $8::timestamp, 90,
               'temps_passe', 'XPF', now())`,
      INTERVENTION_PGA3A,
      reperes.societeId,
      agence.id,
      CLIENT_PGA3A,
      SITE_PGA3A,
      jour,
      creneauDebut,
      creneauFin,
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
      CLIENT_PGA3A,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_PGA3A } });
    await client.client.deleteMany({ where: { id: CLIENT_PGA3A } });
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

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirUneSession(page);
    });

    test(`capture — « Déplacer », heure vidée et durée pré-remplie, à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto(`/interventions/${INTERVENTION_PGA3A}`);
      // « Déplacer » N'EST PAS l'action principale une fois planifiée
      // (93-FICHE-ACTIONS) — replié dans un `<details>`, il faut d'abord
      // ouvrir son `<summary>` avant d'atteindre ses champs.
      const deplacerDetails = page.locator("details", {
        has: page.locator("summary", {
          hasText: fr["intervention.action.deplacer"],
        }),
      });
      await deplacerDetails.locator("summary").first().click();
      const form = deplacerDetails.locator("form");
      // « Saisir à la main » — repli ajouté par PG-B3-TROUVER-CRENEAU-FICHE
      // devant « Trouver un créneau ».
      await ouvrirSaisieManuelle(form);
      const heure = form.locator('input[name="heure_debut"]');
      await expect(heure).not.toHaveValue("");
      await heure.fill("");
      await form
        .getByRole("button", { name: fr["intervention.action.deplacer"] })
        .click();
      await expect(page.getByRole("status")).toBeVisible();
      await capturer(page, "bandeau-heure-obligatoire", largeur);
    });
  });
}
