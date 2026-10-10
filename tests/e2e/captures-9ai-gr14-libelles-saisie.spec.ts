import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirSaisieManuelle } from "./setup/saisie-manuelle";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9AI-GR14-LIBELLES-SAISIE (27/09/2026) — même recette que
 * `captures-9ah-gr14-prestations-sites.spec.ts` : rien n'est écrit sans la
 * variable d'environnement qui nomme le dossier, pour que `pnpm test:e2e`
 * ordinaire n'écrive jamais de fichier.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `ERGO14L-` — un client, un site, et DEUX
 * interventions : l'une `a_planifier` (bloc « Planifier »), l'autre
 * `terminee` avec un temps mesuré (bloc « Clôturer », jamais replié pour ce
 * statut — voir `blocCloturerReplie`). `/parametres/prestations` et
 * `/sites/nouveau` n'ont besoin d'aucune donnée forgée : leur formulaire de
 * création s'affiche sans dépendre du catalogue ni d'un client choisi.
 *
 * AVANT/APRÈS se prend en rejouant ce même fichier deux fois — une fois sur
 * le code d'avant le lot, une fois sur le code livré — jamais en comparant
 * deux fichiers distincts.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9AI ?? "";

const CLIENT_ERGO14L = uuidv7();
const SITE_ERGO14L = uuidv7();
const INTERVENTION_PLANIFIER_ERGO14L = uuidv7();
const INTERVENTION_CLOTURER_ERGO14L = uuidv7();

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
        id: CLIENT_ERGO14L,
        societe_id: reperes.societeId,
        raison_sociale: "Client ERGO14L",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_ERGO14L,
        societe_id: reperes.societeId,
        client_id: CLIENT_ERGO14L,
        agence_id: agence.id,
        libelle: "Site ERGO14L",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_PLANIFIER_ERGO14L,
        societe_id: reperes.societeId,
        client_id: CLIENT_ERGO14L,
        site_id: SITE_ERGO14L,
        agence_id: agence.id,
        type: "curatif",
        statut: "a_planifier",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_CLOTURER_ERGO14L,
        societe_id: reperes.societeId,
        client_id: CLIENT_ERGO14L,
        site_id: SITE_ERGO14L,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "terminee",
        date_planifiee: new Date("2026-09-27T00:00:00Z"),
        duree_estimee_min: 60,
      },
    });
    // LE SEGMENT D'ABORD, LA SOMME ENSUITE — le déclencheur
    // `intervention_temps_mesure_est_celui_du_compteur` vérifie que
    // `temps_mesure_min` est la somme des segments FERMÉS déjà présents
    // (même ordre que `tests/e2e/fiche-cloturer.spec.ts`).
    await client.$executeRawUnsafe(
      `INSERT INTO "segment_travail" ("id","societe_id","intervention_id","utilisateur_id","debut","fin","modifie_le")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, now() - interval '90 minutes', now(), now())`,
      reperes.societeId,
      INTERVENTION_CLOTURER_ERGO14L,
      reperes.technicienDucos,
    );
    await client.intervention.update({
      where: { id: INTERVENTION_CLOTURER_ERGO14L },
      data: { temps_mesure_min: 90 },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
      INTERVENTION_CLOTURER_ERGO14L,
    );
    await client.intervention.deleteMany({
      where: { client_id: CLIENT_ERGO14L },
    });
    await client.site.deleteMany({ where: { client_id: CLIENT_ERGO14L } });
    await client.client.deleteMany({ where: { id: CLIENT_ERGO14L } });
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

    test(`capture — bloc Planifier à ${largeur}px`, async ({ page }) => {
      await page.goto(`/interventions/${INTERVENTION_PLANIFIER_ERGO14L}`);
      // « Saisir à la main » — repli ajouté par PG-B3-TROUVER-CRENEAU-FICHE
      // devant « Trouver un créneau ».
      await ouvrirSaisieManuelle(page);
      await expect(
        page.getByLabel(fr["intervention.deplacement.duree"]),
      ).toBeVisible();
      await capturer(page, "bloc-planifier", largeur);
    });

    test(`capture — bloc Clôturer à ${largeur}px`, async ({ page }) => {
      await page.goto(`/interventions/${INTERVENTION_CLOTURER_ERGO14L}`);
      await expect(
        page.locator('input[name="temps_valide_min"]'),
      ).toBeVisible();
      await capturer(page, "bloc-cloturer", largeur);
    });

    test(`capture — formulaire des prestations à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto("/parametres/prestations");
      await expect(
        page.getByRole("heading", { name: fr["prestations.titre"] }),
      ).toBeVisible();
      await capturer(page, "formulaire-prestations", largeur);
    });

    test(`capture — formulaire du site (fiche) à ${largeur}px`, async ({
      page,
    }) => {
      // ADAPTÉ (D191, 9EF-TP-UX4-2-FICHES-1) — le formulaire vit désormais
      // derrière `?edition=site`.
      await page.goto(`/sites/${SITE_ERGO14L}?edition=site`);
      await expect(page.getByLabel(fr["site.temps_trajet_min"])).toBeVisible();
      await capturer(page, "formulaire-site-fiche", largeur);
    });

    test(`capture — formulaire du site (nouveau) à ${largeur}px`, async ({
      page,
    }) => {
      await page.goto("/sites/nouveau");
      await expect(page.getByText(fr["site.temps_trajet_min"])).toBeVisible();
      await capturer(page, "formulaire-site-nouveau", largeur);
    });
  });
}
