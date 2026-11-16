import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * 9L08B-SAISIE-APRES-DEMARRER (D262, décision d'Alexis du 16/11/2026) —
 * l'épreuve de bout en bout due par ce ticket et restée à faire (passation,
 * point 4 et 7) : la bande d'aide et les commandes inactives sur une fiche
 * `affectee`, la saisie qui redevient possible après « Démarrer », et la
 * MÊME garde vue depuis la coquille hors réseau (`/terrain-hors-reseau`) —
 * qui lit le même `statut` que la session, sans jamais le réécrire.
 *
 * Deux interventions jetables, sa propre scène, préfixée `9L08B-` — même
 * discipline que les autres scènes de ce répertoire.
 */
test.describe.configure({ mode: "serial" });

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

const CLIENT_9L08B = uuidv7();
const SITE_9L08B = uuidv7();
const INTERVENTION_EN_LIGNE = uuidv7();
const INTERVENTION_HORS_RESEAU = uuidv7();

let societeId: string;
let technicienId: string;

test.beforeAll(async () => {
  const reperes = await reperesDeLaScene();
  societeId = reperes.societeId;
  technicienId = reperes.technicienDucos;
  const client = admin();
  try {
    const agence = await client.agence.findFirstOrThrow({
      where: { societe_id: societeId, code: "DUCOS" },
      select: { id: true },
    });
    await client.client.create({
      data: {
        id: CLIENT_9L08B,
        societe_id: societeId,
        raison_sociale: "9L08B client",
        actif: true,
      },
    });
    await client.site.create({
      data: {
        id: SITE_9L08B,
        societe_id: societeId,
        client_id: CLIENT_9L08B,
        agence_id: agence.id,
        libelle: "9L08B site",
      },
    });
    const commun = {
      societe_id: societeId,
      agence_id: agence.id,
      client_id: CLIENT_9L08B,
      site_id: SITE_9L08B,
      technicien_id: technicienId,
      type: "curatif" as const,
      priorite: "p3" as const,
      duree_estimee_min: 60,
      mode_valorisation: "temps_passe" as const,
      devise_code: "XPF",
      description: "9L08B — intervention forgée par l'épreuve",
      statut: "affectee" as const,
      date_planifiee: null,
    };
    await client.intervention.create({
      data: { id: INTERVENTION_EN_LIGNE, ...commun },
    });
    await client.intervention.create({
      data: { id: INTERVENTION_HORS_RESEAU, ...commun },
    });
  } finally {
    await client.$disconnect();
  }
});

test.afterAll(async () => {
  const client = admin();
  try {
    await client.$executeRawUnsafe(
      `DELETE FROM "segment_travail" WHERE "intervention_id" = ANY($1::uuid[])`,
      [INTERVENTION_EN_LIGNE, INTERVENTION_HORS_RESEAU],
    );
    await client.$executeRawUnsafe(
      `DELETE FROM "intervention" WHERE "client_id" = $1::uuid`,
      CLIENT_9L08B,
    );
    await client.site.deleteMany({ where: { client_id: CLIENT_9L08B } });
    await client.client.deleteMany({ where: { id: CLIENT_9L08B } });
  } finally {
    await client.$disconnect();
  }
});

async function connecterLeTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

/** Même idiome que `9f4h6b-file-ancien-format.spec.ts` / `9f4h1-consultation.spec.ts`. */
async function attendreLaCopiePosee(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Promise<boolean>((resolve) => {
              const requete = indexedDB.open("codiplan-terrain");
              requete.onerror = () => resolve(false);
              requete.onsuccess = () => {
                const base = requete.result;
                if (!base.objectStoreNames.contains("instantane")) {
                  base.close();
                  resolve(false);
                  return;
                }
                const lecture = base
                  .transaction("instantane", "readonly")
                  .objectStore("instantane")
                  .get("actuel");
                lecture.onsuccess = () => {
                  base.close();
                  resolve(lecture.result !== undefined);
                };
                lecture.onerror = () => {
                  base.close();
                  resolve(false);
                };
              };
            }),
        ),
      { timeout: 10_000 },
    )
    .toBe(true);
}

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/9L08B-SAISIE-APRES-DEMARRER/captures",
);

/** EN VIEWPORT, sans `fullPage` : ce qui est visible sans défiler. */
async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: largeur, height: 900 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-${largeur}.png`),
  });
}

test("fiche affectée : bande d'aide et commandes inactives, « Démarrer » rend la saisie possible", async ({
  page,
}) => {
  await connecterLeTechnicien(page);
  await page.goto(`/terrain/${INTERVENTION_EN_LIGNE}`);
  await expect(
    page.getByRole("heading", { name: fr["terrain.compteur"] }),
  ).toBeVisible();

  const bande = page
    .getByRole("status")
    .filter({ hasText: fr["intervention.refus.non_demarree"] });
  await expect(bande).toBeVisible();

  const commentaire = page.getByLabel(
    fr["terrain.rapport.commentaire_libelle"],
  );
  await expect(commentaire).toBeDisabled();

  await capturer(page, "9l08b-affectee-inactive", 375);

  await page
    .getByRole("button", { name: fr["terrain.compteur.demarrer"] })
    .click();

  await expect(bande).toHaveCount(0);
  await expect(commentaire).toBeEnabled();

  await capturer(page, "9l08b-demarree-active", 375);

  const verif = admin();
  try {
    const intervention = await verif.intervention.findUniqueOrThrow({
      where: { id: INTERVENTION_EN_LIGNE },
      select: { statut: true },
    });
    expect(intervention.statut).toBe("en_cours");
  } finally {
    await verif.$disconnect();
  }
});

test("hors réseau, sur une fiche affectée : la même garde, lue depuis la coquille sans session", async ({
  page,
  context,
}) => {
  await connecterLeTechnicien(page);
  await attendreLaCopiePosee(page);

  await context.setOffline(true);
  await page.goto(`/terrain-hors-reseau?id=${INTERVENTION_HORS_RESEAU}`);
  await expect(
    page.getByRole("heading", { name: fr["terrain.rapport.titre"] }),
  ).toBeVisible();

  // LA COQUILLE SANS SESSION NE PORTE PAS LA BANDE D'AIDE (celle-ci vit dans
  // `app/(mobile)/terrain/[id]/page.tsx`, jamais dans `consultation-hors-
  // reseau.tsx`) — seul le `statut` transmis à `ChecklistTerrain` et à
  // `RapportTerrainAutomatique` y désactive les commandes, même garde que
  // la fiche en ligne, lue différemment.
  await expect(
    page.getByLabel(fr["terrain.rapport.commentaire_libelle"]),
  ).toBeDisabled();

  await capturer(page, "9l08b-hors-reseau-affectee-inactive", 375);

  await context.setOffline(false);
});
