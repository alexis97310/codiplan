import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { EVENEMENT_FILE_MODIFIEE } from "@/lib/terrain/file-saisies";
import { libellePastilleReseau } from "@/components/terrain/pastille-reseau";

import { reperesDeLaScene } from "./setup/reperes";
import { COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";

/**
 * 9L42-TERRAIN-ENTETE-PROFIL-PASTILLE — audit du 10/11/2026 (m8, m10b, m13 ;
 * maquettes 01-journee et 07-profil).
 *
 * Aucune scène propre : ces trois épreuves ne créent ni ne lisent la moindre
 * intervention — seulement la pastille réseau (lecture `navigator.onLine` et
 * de la file IndexedDB, locale au NAVIGATEUR, jamais partagée entre fichiers
 * sous `fullyParallel`) et des écrans déjà peuplés par le semis commun.
 * `reperesDeLaScene` n'est lue qu'EN LECTURE — aucun risque de collision.
 */

const FENETRE_TELEPHONE = { width: 375, height: 900 };

async function ouvrirLaSessionDuTerrain(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

async function scrollWidth(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

test("à 375 px, « Ma journée » et « Profil » tiennent sur une ligne, pastille « En ligne », et les deux gestes de compte sont rangés dans Profil", async ({
  page,
}) => {
  await page.setViewportSize(FENETRE_TELEPHONE);
  await ouvrirLaSessionDuTerrain(page);

  // « MA JOURNÉE » — la pastille « En ligne », rien de plus, et
  // « Installer l'application » n'y vit plus (audit m10b).
  await expect(
    page.getByText(fr["terrain.reseau.en_ligne"], { exact: true }),
  ).toBeVisible();
  expect(await scrollWidth(page)).toBeLessThanOrEqual(FENETRE_TELEPHONE.width);
  await expect(page.getByText(fr["pwa.installer.autre"])).toHaveCount(0);

  // « PROFIL » — même pastille, et les deux gestes de compte, rangés ici
  // (audit m10b) : `main` isole le bouton du CORPS de Profil de celui du
  // bandeau du chrome, posé par `components/navigation/barre.tsx` (D95 —
  // la déconnexion y reste, voir la passation de ce lot).
  await page.getByRole("link", { name: fr["terrain.barre.profil"] }).click();
  await expect(page).toHaveURL(/\/terrain\/profil$/);
  await expect(
    page.getByText(fr["terrain.reseau.en_ligne"], { exact: true }),
  ).toBeVisible();
  expect(await scrollWidth(page)).toBeLessThanOrEqual(FENETRE_TELEPHONE.width);
  await expect(page.getByText(fr["pwa.installer.autre"])).toBeVisible();
  await expect(
    page.locator("main").getByRole("button", { name: fr["nav.deconnexion"] }),
  ).toBeVisible();
});

test("hors réseau, la pastille de « Ma journée » passe à « Hors ligne »", async ({
  page,
  context,
}) => {
  await page.setViewportSize(FENETRE_TELEPHONE);
  await ouvrirLaSessionDuTerrain(page);
  await expect(
    page.getByText(fr["terrain.reseau.en_ligne"], { exact: true }),
  ).toBeVisible();

  await context.setOffline(true);
  await expect(
    page.getByText(fr["terrain.reseau.hors_ligne"], { exact: true }),
  ).toBeVisible();
});

test("une file non vide s'affiche dans la pastille de Profil, même en ligne, sans faire déborder la page à 375 px", async ({
  page,
}) => {
  const reperes = await reperesDeLaScene();

  await page.setViewportSize(FENETRE_TELEPHONE);
  await ouvrirLaSessionDuTerrain(page);
  await page.goto("/terrain/profil");
  await expect(
    page.getByText(fr["terrain.reseau.en_ligne"], { exact: true }),
  ).toBeVisible();

  // UNE SAISIE DÉPOSÉE DIRECTEMENT DANS LA FILE (même technique que
  // `antidaterLeDemarrage` d'autres épreuves hors réseau) — même source
  // que « Envoyer » (`compterEnAttente`), aucune seconde lecture du fait.
  await page.evaluate(
    ({ utilisateurId, societeId, evenement }) => {
      return new Promise<void>((resolve, reject) => {
        const requete = indexedDB.open("codiplan-terrain");
        requete.onerror = () => reject(requete.error);
        requete.onsuccess = () => {
          const base = requete.result;
          const transaction = base.transaction("file", "readwrite");
          transaction.objectStore("file").put({
            id: "01999999-0000-7000-8000-000000000001",
            interventionId: "01999999-0000-7000-8000-000000000002",
            utilisateurId,
            societeId,
            instantAppareil: new Date().toISOString(),
            geste: { type: "rapport", commentaire: "9L42 — épreuve" },
            motifRefus: null,
          });
          transaction.oncomplete = () => {
            base.close();
            window.dispatchEvent(new Event(evenement));
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
      });
    },
    {
      utilisateurId: reperes.technicienDucos,
      societeId: reperes.societeId,
      evenement: EVENEMENT_FILE_MODIFIEE,
    },
  );

  await expect(
    page.getByText(libellePastilleReseau(true, 1), { exact: true }),
  ).toBeVisible();
  expect(await scrollWidth(page)).toBeLessThanOrEqual(FENETRE_TELEPHONE.width);
});
