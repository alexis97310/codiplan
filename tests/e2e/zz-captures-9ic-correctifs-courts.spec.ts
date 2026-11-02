import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { instantAMinutes, jourSuivant } from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";
import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MARDI,
  MOT_DE_PASSE_EPREUVE,
  cleDeJour,
  jourDeLaScene,
} from "./setup/scene";
import { reperesDeLaScene } from "./setup/reperes";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9IC-CORRECTIFS-COURTS — AVANT/APRÈS.
 *
 * Rien n'est écrit sans `CAPTURES_9IC=<dossier>` (même recette que
 * `captures-9i5-ecrans-incomplets.spec.ts`). Lancé une fois sur le code
 * d'AVANT ce lot (`origin/main`, dans un worktree jetable), une fois
 * APRÈS, sur ce dépôt.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9IC ?? "";
const LARGEURS = [1280, 375] as const;

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  await page.setViewportSize({ width: largeur, height: 900 });
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({ path: join(DOSSIER, `${nom}-${largeur}.png`) });
}

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function connecterTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

test("Équipe (point 2 — lectures de compte par paquets de 5)", async ({
  page,
}) => {
  await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
  await page.goto("/parametres/equipe");
  for (const largeur of LARGEURS) {
    await capturer(page, "equipe", largeur);
  }
});

test("Planning — le bandeau du haut face à la colonne figée, défilé (point 4b)", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();
  const jour = jourDeLaScene(reperes, MARDI);
  await page.setViewportSize({ width: 1280, height: 420 });
  await ouvrirUneSession(page);
  await page.goto(`/planning?vue=jour&jour=${cleDeJour(jour)}`);

  // DÉFILE jusqu'à ce que le HAUT de la ligne figée coïncide avec le HAUT du
  // bandeau — le chevauchement maximal, le plus net pour une capture (la
  // mesure de l'épreuve e2e vise plutôt le CENTRE des deux, voir
  // `planning-bandeau-au-dessus-colonne-figee.spec.ts`).
  await page.evaluate((titrePlanning) => {
    const bandeau = [...document.querySelectorAll("header")].find(
      (entete) => entete.getBoundingClientRect().height > 0,
    );
    // LA FRISE DU JOUR SPÉCIFIQUEMENT (`aria-label` posé par `page.tsx`),
    // jamais le premier `tbody th[scope="row"]` du document — un AUTRE
    // tableau (« Interventions non affectées ») porte la même forme et
    // vient AVANT elle dans le DOM.
    const cible = document.querySelector(
      `table[aria-label="${titrePlanning}"] tbody th[scope="row"]`,
    );
    if (bandeau === undefined || cible === null) return;
    window.scrollBy(
      0,
      cible.getBoundingClientRect().top - bandeau.getBoundingClientRect().top,
    );
  }, fr["planning.titre"]);
  // JAMAIS `capturer` ICI — `setViewportSize` y réinitialise le défilement
  // qu'on vient de poser (mesuré : la capture rendait le haut de la page,
  // pas le point de chevauchement).
  if (DOSSIER !== "") {
    mkdirSync(DOSSIER, { recursive: true });
    await page.screenshot({
      path: join(DOSSIER, "planning-bandeau-colonne-figee-1280.png"),
    });
  }

  // 375 px — le bandeau du bureau n'existe pas sous 901 px (BandeauMobile le
  // remplace) : pas de défilement dédié, juste l'écran tel qu'il est.
  await page.setViewportSize({ width: 375, height: 900 });
  await capturer(page, "planning-bandeau-colonne-figee", 375);
});

const CLIENT_CAPTURE_SIGNATURE = uuidv7();
const SITE_CAPTURE_SIGNATURE = uuidv7();
const INTERVENTION_CAPTURE_SIGNATURE = uuidv7();

test.describe("Signature (point 4a — épaisseur du trait sur les pixels du PNG)", () => {
  test.beforeAll(async () => {
    const reperes = await reperesDeLaScene();
    const jour = jourSuivant(reperes.lundi, 46 * 7);
    const client = admin();
    try {
      const agence = await client.agence.findFirstOrThrow({
        where: { societe_id: reperes.societeId, code: "DUCOS" },
        select: { id: true },
      });
      await client.client.create({
        data: {
          id: CLIENT_CAPTURE_SIGNATURE,
          societe_id: reperes.societeId,
          raison_sociale: "9IC-client-capture-signature",
          actif: true,
        },
      });
      await client.site.create({
        data: {
          id: SITE_CAPTURE_SIGNATURE,
          societe_id: reperes.societeId,
          client_id: CLIENT_CAPTURE_SIGNATURE,
          agence_id: agence.id,
          libelle: "9IC-site-capture-signature",
        },
      });
      await client.intervention.create({
        data: {
          id: INTERVENTION_CAPTURE_SIGNATURE,
          societe_id: reperes.societeId,
          agence_id: agence.id,
          client_id: CLIENT_CAPTURE_SIGNATURE,
          site_id: SITE_CAPTURE_SIGNATURE,
          technicien_id: reperes.technicienDucos,
          type: "preventif_contrat",
          priorite: "p3",
          statut: "affectee",
          date_planifiee: new Date(
            Date.UTC(jour.annee, jour.mois - 1, jour.jour),
          ),
          creneau_debut: instantAMinutes(jour, 8 * 60, reperes.fuseau),
          creneau_fin: instantAMinutes(jour, 9 * 60, reperes.fuseau),
          duree_estimee_min: 60,
          mode_valorisation: "temps_passe",
          devise_code: "XPF",
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
        `DELETE FROM "segment_travail" WHERE "intervention_id" = $1::uuid`,
        INTERVENTION_CAPTURE_SIGNATURE,
      );
      await client.intervention.deleteMany({
        where: { id: INTERVENTION_CAPTURE_SIGNATURE },
      });
      await client.site.deleteMany({ where: { id: SITE_CAPTURE_SIGNATURE } });
      await client.client.deleteMany({
        where: { id: CLIENT_CAPTURE_SIGNATURE },
      });
    } finally {
      await client.$disconnect();
    }
  });

  test("le trait signé", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await connecterTechnicien(page);
    await page.goto(`/terrain/${INTERVENTION_CAPTURE_SIGNATURE}`);
    await page
      .getByRole("button", { name: fr["terrain.signature.option_signee"] })
      .click();
    await page
      .getByLabel(fr["terrain.signature.nom_libelle"])
      .fill(fr["terrain.e2e.signataire_nom"]);
    await page.locator("canvas").evaluate((element) => {
      const rectangle = element.getBoundingClientRect();
      const envoyer = (type: string, x: number, y: number): void => {
        element.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            clientX: rectangle.left + x,
            clientY: rectangle.top + y,
            pointerId: 1,
          }),
        );
      };
      envoyer("pointerdown", 20, 40);
      envoyer("pointermove", 140, 40);
      envoyer("pointerup", 140, 40);
    });
    await capturer(page, "signature-trait", 375);

    await page.setViewportSize({ width: 1280, height: 900 });
    await capturer(page, "signature-trait", 1280);
  });
});

test.describe("Les cinq écrans de 9I5 (point 5 — textes reformulés)", () => {
  test("Ma journée", async ({ page }) => {
    await connecterTechnicien(page);
    for (const largeur of LARGEURS) {
      await capturer(page, "9i5-ma-journee", largeur);
    }
  });

  test("Tableau de bord", async ({ page }) => {
    await ouvrirUneSession(page);
    await page.goto("/tableau-de-bord");
    for (const largeur of LARGEURS) {
      await capturer(page, "9i5-tableau-de-bord", largeur);
    }
  });

  test("VGP", async ({ page }) => {
    await ouvrirUneSession(page);
    await page.goto("/vgp");
    for (const largeur of LARGEURS) {
      await capturer(page, "9i5-vgp", largeur);
    }
  });

  test("Données à compléter", async ({ page }) => {
    await ouvrirUneSession(page);
    await page.goto("/parametres/donnees");
    for (const largeur of LARGEURS) {
      await capturer(page, "9i5-donnees-a-completer", largeur);
    }
  });

  test("Fiche machine", async ({ page }) => {
    await ouvrirUneSession(page);
    await page.goto("/parc");
    const ficheComplete = page
      .getByRole("link", { name: fr["parc.fiche_complete"] })
      .first();
    await expect(ficheComplete).toBeVisible();
    await ficheComplete.click();
    await expect(page.locator('[data-bloc="machine-page"]')).toBeVisible();
    for (const largeur of LARGEURS) {
      await capturer(page, "9i5-fiche-machine", largeur);
    }
  });
});
