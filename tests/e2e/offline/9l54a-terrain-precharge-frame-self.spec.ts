import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import {
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "../setup/scene";

/**
 * 9L54A-TERRAIN-PRECHARGE-FRAME-SELF — RÉGRESSION SILENCIEUSE DU HORS RÉSEAU
 * (I4), trouvée par 9L54.
 *
 * `components/terrain/copie-locale.tsx` (`PrechargementCoquille`, ticket
 * 9F4H4B) charge `/terrain-hors-reseau` dans un `<iframe>` caché de MÊME
 * ORIGINE, à chaque montage de `/terrain`, pour préchauffer le cache du
 * service worker hors ligne — c'est le SEUL moment où le script compilé de
 * cette coquille est jamais récupéré, si personne ne l'a ouverte directement.
 *
 * `next.config.ts` (9L08-EN-TETES-SECURITE, commit `559ed3743`) posait
 * `frame-ancestors 'none'` / `X-Frame-Options: DENY` sur TOUTES les réponses
 * — y compris `/terrain-hors-reseau`, encadrée par SA PROPRE origine. Mesuré
 * par 9L54 (reproduit isolément, hors suite) :
 *
 * ```
 * [response] 200 http://127.0.0.1:3100/terrain-hors-reseau
 * [console] error Refused to frame '…' because an ancestor violates the
 * following Content Security Policy directive: "frame-ancestors 'none'".
 * [frame navigated] chrome-error://chromewebdata/
 * ```
 *
 * Ce fichier rejoue cette mesure : AVANT ce lot (sur `origin/main`), l'iframe
 * cachée atterrit sur `chrome-error://chromewebdata/` et la console porte
 * l'erreur CSP — ROUGE. Après le lot (`frame-ancestors 'self'`), l'iframe
 * charge réellement `/terrain-hors-reseau` — VERT.
 */
test.describe.configure({ mode: "serial" });

async function connecterTechnicien(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_TECHNICIEN_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

test("le préchargement caché de /terrain-hors-reseau depuis /terrain n'atterrit jamais sur l'écran d'erreur du navigateur, et la console ne porte aucune violation « frame-ancestors »", async ({
  page,
}) => {
  const framesBloquees: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame.url().startsWith("chrome-error:")) {
      framesBloquees.push(frame.url());
    }
  });

  const violationsFrameAncestors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /refused to frame/i.test(message.text()) &&
      /frame-ancestors/i.test(message.text())
    ) {
      violationsFrameAncestors.push(message.text());
    }
  });

  // La connexion navigue vers /terrain, qui monte `CopieLocaleTerrain` — et
  // donc `PrechargementCoquille`, qui pose l'iframe cachée au premier rendu.
  await connecterTechnicien(page);

  // Laisse le temps à l'iframe cachée de charger (ou d'échouer) : elle se
  // retire elle-même au premier événement `load` (`cadre.remove()`), réussi
  // ou bloqué.
  await page.waitForLoadState("networkidle");

  expect(framesBloquees).toEqual([]);
  expect(violationsFrameAncestors).toEqual([]);
});
