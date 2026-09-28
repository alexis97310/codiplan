import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE PG-A3b-HEURE-OBLIGATOIRE (28/09/2026) — décision QG-4
 * d'Alexis du 27/09/2026. Même recette que
 * `captures-pg-a3a-messages-pose.spec.ts` : AVANT se rejoue sur le code
 * d'avant ce ticket (`git worktree`), APRÈS sur le code livré.
 *
 * **N'utilise QUE des clés `fr[...]` déjà présentes AVANT ce ticket** — le
 * libellé sans parenthèse et la note « vider pour la file » ne se vérifient
 * pas ici par le texte (`fr["intervention.deplacement.vider_pour_la_file"]`
 * casserait le typecheck du build sur l'ancien code, voir
 * `captures-avant-apres-e2e`) : ce spec CAPTURE, il n'AFFIRME pas le texte.
 * Le comportement, lui, est éprouvé par `pg-a3b-heure-obligatoire.spec.ts`.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `PGA3B-` — une intervention `a_planifier` (bloc
 * « Planifier »), une intervention `planifiee` avec heure et durée (bloc
 * « Déplacer »), créées en `beforeAll`, supprimées en `afterAll`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_PGA3B ?? "";
const ETIQUETTE = process.env.CAPTURES_PGA3B_ETIQUETTE ?? "capture";

const CLIENT_PGA3B = uuidv7();
const SITE_PGA3B = uuidv7();
const INTERVENTION_A_PLANIFIER = uuidv7();
const INTERVENTION_PLANIFIEE = uuidv7();

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
        id: CLIENT_PGA3B,
        societe_id: reperes.societeId,
        raison_sociale: "PGA3B",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_PGA3B,
        societe_id: reperes.societeId,
        client_id: CLIENT_PGA3B,
        agence_id: agence.id,
        libelle: "PGA3B",
      },
    });

    const jour = dansSixSemaines();
    const creneauDebut = new Date(jour.getTime() + (9 - 11) * 3_600_000);

    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "type", "priorite", "statut", "description", "mode_valorisation",
         "devise_code", "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'p3',
               'a_planifier', 'PGA3B-scenario', 'temps_passe', 'XPF', now())`,
      INTERVENTION_A_PLANIFIER,
      reperes.societeId,
      agence.id,
      CLIENT_PGA3B,
      SITE_PGA3B,
    );

    await client.$executeRawUnsafe(
      `INSERT INTO "intervention" ("id", "societe_id", "agence_id", "client_id", "site_id",
         "type", "priorite", "statut", "date_planifiee", "creneau_debut",
         "duree_estimee_min", "description", "mode_valorisation", "devise_code",
         "modifie_le")
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, 'curatif', 'p3',
               'planifiee', $6::date, $7::timestamp, 90, 'PGA3B-scenario',
               'temps_passe', 'XPF', now())`,
      INTERVENTION_PLANIFIEE,
      reperes.societeId,
      agence.id,
      CLIENT_PGA3B,
      SITE_PGA3B,
      jour,
      creneauDebut,
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
      CLIENT_PGA3B,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_PGA3B } });
    await client.client.deleteMany({ where: { id: CLIENT_PGA3B } });
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
    path: join(DOSSIER, `${nom}-${ETIQUETTE}-${largeur}.png`),
    fullPage: true,
  });
}

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
      await ouvrirUneSession(page);
    });

    test(`capture — bloc « Planifier », à ${largeur}px`, async ({ page }) => {
      await page.goto(`/interventions/${INTERVENTION_A_PLANIFIER}`);
      await expect(
        page.getByRole("button", { name: fr["intervention.action.planifier"] }),
      ).toBeVisible();
      await capturer(page, "planifier", largeur);
    });

    test(`capture — bloc « Déplacer », à ${largeur}px`, async ({ page }) => {
      await page.goto(`/interventions/${INTERVENTION_PLANIFIEE}`);
      const deplacerDetails = page.locator("details", {
        has: page.locator("summary", {
          hasText: fr["intervention.action.deplacer"],
        }),
      });
      await deplacerDetails.locator("summary").click();
      await expect(deplacerDetails.locator("form")).toBeVisible();
      await capturer(page, "deplacer", largeur);
    });
  });
}
