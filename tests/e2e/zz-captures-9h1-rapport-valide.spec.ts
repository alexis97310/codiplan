import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_RM_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { reperesDeLaScene } from "./setup/reperes";

/**
 * CAPTURES AVANT/APRÈS DU TICKET 9H1-RAPPORT-VALIDE-AVANT-CLOTURE — jouées
 * DEUX FOIS (même discipline que `zz-captures-9g1-correctifs.spec.ts`) :
 * APRÈS sur ce commit, AVANT sur un `git worktree` planté sur le commit
 * parent (avant le point 1). Les deux checkouts partagent ce fichier et sa
 * scène ; AUCUNE colonne neuve (`rapport_valide_par`/`rapport_valide_le`)
 * n'y est écrite, pour que le MÊME scénario tourne, migré ou pas, sur les
 * deux côtés — c'est justement l'écart entre les deux captures qui prouve
 * le ticket : AVANT, aucun bloc « Avant de clôturer » n'existe ; APRÈS, il
 * existe et montre le rapport NON validé (aucun geste de validation n'est
 * joué ici), avec le lien vers l'onglet Rapport.
 *
 * SA PROPRE SCÈNE, PRÉFIXÉE `9H1-` — un client, un site, une intervention
 * `terminee` avec un temps mesuré réel (un segment fermé), créée en
 * `beforeAll`, supprimée en `afterAll`, aucune ligne ajoutée au semis (même
 * discipline que `tests/e2e/fiche-cloturer.spec.ts`).
 */
test.describe.configure({ mode: "serial" });

const CLIENT_9H1 = uuidv7();
const SITE_9H1 = uuidv7();
const INTERVENTION_9H1 = uuidv7();

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
        id: CLIENT_9H1,
        societe_id: reperes.societeId,
        raison_sociale: "9H1 client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9H1,
        societe_id: reperes.societeId,
        client_id: CLIENT_9H1,
        agence_id: agence.id,
        libelle: "9H1 site",
      },
    });
    await client.intervention.create({
      data: {
        id: INTERVENTION_9H1,
        societe_id: reperes.societeId,
        client_id: CLIENT_9H1,
        site_id: SITE_9H1,
        agence_id: agence.id,
        technicien_id: reperes.technicienDucos,
        type: "curatif",
        statut: "terminee",
        date_planifiee: new Date("2026-10-20T00:00:00Z"),
        duree_estimee_min: 60,
      },
    });
    // LE SEGMENT D'ABORD, LA SOMME ENSUITE — même ordre que
    // `fiche-cloturer.spec.ts` (le déclencheur du compteur vérifie la somme).
    await client.$executeRawUnsafe(
      `INSERT INTO "segment_travail" ("id","societe_id","intervention_id","utilisateur_id","debut","fin","modifie_le")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, $3::uuid, now() - interval '90 minutes', now(), now())`,
      reperes.societeId,
      INTERVENTION_9H1,
      reperes.technicienDucos,
    );
    await client.intervention.update({
      where: { id: INTERVENTION_9H1 },
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
      INTERVENTION_9H1,
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9H1,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9H1 } });
    await client.client.deleteMany({ where: { id: CLIENT_9H1 } });
  } finally {
    await client.$disconnect();
  }
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9H1-RAPPORT-VALIDE-AVANT-CLOTURE/captures",
);

/** EN VIEWPORT, sans `fullPage` : ce qui est visible sans défiler. */
async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 1000 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
  });
}

for (const largeur of [1280, 375] as const) {
  test(`fiche intervention terminée, onglet Résumé, à ${largeur}px`, async ({
    page,
  }) => {
    await page.goto("/connexion");
    await page.getByLabel(fr["connexion.email"]).fill(COMPTE_RM_EPREUVE);
    await page
      .getByLabel(fr["connexion.mot_de_passe"])
      .fill(MOT_DE_PASSE_EPREUVE);
    await page.getByRole("button", { name: fr["connexion.valider"] }).click();
    await expect(page).toHaveURL(/\/planning/);

    await page.goto(`/interventions/${INTERVENTION_9H1}`);
    await expect(
      page.getByRole("heading", { level: 1 }).getByText(fr["statut.terminee"]),
    ).toBeVisible();

    await capturer(page, "fiche-resume-terminee", largeur);
  });
}
