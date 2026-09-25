import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import {
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
  SCENE,
} from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * LE RAPPORT DE TERRAIN, DE BOUT EN BOUT (ticket 17-BON-2).
 *
 * ## Ce que ce fichier mesure, et que les scénarios d'isolation ne peuvent pas
 *
 * `tests/isolation/rapport-terrain.test.ts` éprouve que le DÉPÔT cloisonne
 * correctement les cinq blocs. Il ne peut pas prouver qu'un TECHNICIEN peut
 * réellement les saisir depuis l'écran, ni qu'un rôle interne les retrouve
 * ensuite sur le bon — c'est le geste complet que ce fichier joue, sur
 * `SCENE.rapportTravaillee`.
 *
 * ## SÉRIEL, ET POURQUOI
 *
 * Les trois premiers scénarios écrivent, dans l'ordre, sur la MÊME
 * intervention ; le dernier la relit sous un autre compte. Les paralléliser
 * ferait courir le risque qu'une lecture arrive entre deux écritures d'un
 * autre test.
 */
test.describe.configure({ mode: "serial" });

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/arrivee/);
}

/**
 * Le contenu saisi par l'épreuve — du texte AFFICHÉ, donc dans le
 * dictionnaire comme `equipe.e2e.nom` et `habilitations.e2e.libelle` : le
 * gardien de L0-11 exige que même une valeur de scénario jamais vue par un
 * utilisateur réel passe par `lib/i18n/fr.ts`
 * (`tests/unit/i18n/sans-chaine-visible-en-dur.test.ts`).
 */
const COMMENTAIRE_EPREUVE = fr["terrain.e2e.commentaire"];
const SUITE_EPREUVE = fr["terrain.e2e.suite_a_donner"];

/** Un PNG minimal (1×1, transparent), écrit dans un fichier temporaire. */
function fichierPhotoDEpreuve(): string {
  const dossier = mkdtempSync(join(tmpdir(), "codiplan-bon-2-"));
  const chemin = join(dossier, "photo-epreuve.png");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  writeFileSync(chemin, png);
  return chemin;
}

test("le commentaire et la suite à donner s'enregistrent et se relisent", async ({
  page,
}) => {
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${SCENE.rapportTravaillee}`);

  await page
    .getByLabel(fr["terrain.rapport.commentaire_libelle"])
    .fill(COMMENTAIRE_EPREUVE);
  await page
    .getByLabel(fr["terrain.rapport.suite_libelle"])
    .fill(SUITE_EPREUVE);
  await page
    .getByRole("button", { name: fr["terrain.rapport.enregistrer"] })
    .click();

  await expect(page).toHaveURL(
    new RegExp(`/terrain/${SCENE.rapportTravaillee}$`),
  );
  await expect(
    page.getByLabel(fr["terrain.rapport.commentaire_libelle"]),
  ).toHaveValue(COMMENTAIRE_EPREUVE);
  await expect(
    page.getByLabel(fr["terrain.rapport.suite_libelle"]),
  ).toHaveValue(SUITE_EPREUVE);
});

test("une prestation absente du catalogue se nomme, jamais un bloc muet", async ({
  page,
}) => {
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${SCENE.rapportTravaillee}`);
  await expect(page.getByText(fr["terrain.prestations.aucune"])).toBeVisible();
});

test("une photo se dépose et s'affiche", async ({ page }) => {
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${SCENE.rapportTravaillee}`);

  await page
    .locator('input[type="file"]')
    .setInputFiles(fichierPhotoDEpreuve());
  await page
    .getByRole("button", { name: fr["terrain.photos.ajouter"] })
    .click();

  await expect(page).toHaveURL(
    new RegExp(`/terrain/${SCENE.rapportTravaillee}$`),
  );
  await expect(page.getByText(fr["terrain.photos.aucune"])).toHaveCount(0);
  await expect(page.locator("img[alt='photo-epreuve.png']")).toBeVisible();
});

test("une signature se trace et s'enregistre", async ({ page }) => {
  await ouvrirLaSessionDuTerrain(page);
  await page.goto(`/terrain/${SCENE.rapportTravaillee}`);

  // LE NOM DU SIGNATAIRE — obligatoire depuis 76-BON-4 (SAV-10). La qualité
  // reste facultative, et ce scénario ne l'éprouve pas : c'est le rôle de
  // `tests/e2e/bon-4.spec.ts`.
  await page
    .getByLabel(fr["terrain.signature.nom_libelle"])
    .fill(fr["terrain.e2e.signataire_nom"]);

  // Les événements sont DISPATCHÉS DIRECTEMENT dans la page plutôt que
  // simulés au niveau du système : un tracé de canevas n'a besoin que des
  // événements pointer eux-mêmes, et la simulation matérielle de Playwright
  // s'est révélée peu fiable ici sur des coordonnées calculées côté test.
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
    envoyer("pointerdown", 20, 20);
    envoyer("pointermove", 100, 80);
    envoyer("pointermove", 200, 30);
    envoyer("pointerup", 200, 30);
  });

  await page
    .getByRole("button", { name: fr["terrain.signature.enregistrer"] })
    .click();

  await expect(page).toHaveURL(
    new RegExp(`/terrain/${SCENE.rapportTravaillee}$`),
  );
  await expect(
    page.getByText(fr["terrain.signature.deja_signee"]),
  ).toBeVisible();
});

test("le bon d'intervention porte les quatre blocs saisis, et nomme ce qui reste absent", async ({
  page,
}) => {
  // LE BON N'EXISTE QUE POUR UN TRAVAIL FAIT (AFFICHAGE-MATERIEL-1,
  // 23/09/2026) — `rapportTravaillee` ET `rapportVierge` naissent `planifiee`
  // (`scene.ts`), et rien avant ce test ne les fait avancer : ce sont des
  // saisies terrain, pas des transitions de statut. Ce test est le DERNIER de
  // ce fichier SÉRIEL sur ces deux interventions (voir la note de tête) ; les
  // faire passer à `terminee` ici est le geste réaliste qui les précéderait
  // dans l'exploitation. `rapportVierge` reste « jamais touchée » au sens qui
  // compte pour ce test — aucun commentaire, aucune suite, aucune photo,
  // aucune signature — seul son STATUT change, pour que son bon reste
  // atteignable et que ce test puisse encore prouver qu'il ne montre rien.
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    await admin.$executeRawUnsafe(
      `UPDATE "intervention" SET "statut" = 'terminee'::"StatutIntervention" WHERE "id" = ANY($1::uuid[])`,
      [SCENE.rapportTravaillee, SCENE.rapportVierge],
    );
  } finally {
    await admin.$disconnect();
  }

  await ouvrirUneSession(page);

  await page.goto(`/interventions/${SCENE.rapportTravaillee}/bon`);
  await expect(page.getByText(COMMENTAIRE_EPREUVE)).toBeVisible();
  await expect(page.getByText(SUITE_EPREUVE)).toBeVisible();
  await expect(
    page.getByText(fr["intervention.bon.aucune_prestation"]),
  ).toBeVisible();
  await expect(page.locator("img[alt='photo-epreuve.png']")).toBeVisible();
  await expect(
    page.getByText(fr["intervention.bon.aucune_signature"]),
  ).toHaveCount(0);

  // `rapportVierge` — MÊME intervention, jamais touchée par ce fichier : les
  // cinq absences sont nommées, aucun bloc n'est muet.
  await page.goto(`/interventions/${SCENE.rapportVierge}/bon`);
  await expect(
    page.getByText(fr["intervention.bon.aucune_prestation"]),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.bon.aucun_commentaire"]),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.bon.aucune_suite"]),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.bon.aucune_photo"]),
  ).toBeVisible();
  await expect(
    page.getByText(fr["intervention.bon.aucune_signature"]),
  ).toBeVisible();
});
