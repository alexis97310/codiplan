import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { chromium, test, type Browser, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";
import { engendrerJetonQr } from "@/lib/machines/qr";

import { BASE_URL } from "../../playwright.config";
import { ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9G10-SCANNER-QR-APPLI — serveur de PRODUCTION (Playwright
 * lance lui-même `pnpm run build && pnpm exec next start`, jamais `next dev`).
 *
 * Rien n'est écrit sans `CAPTURES_9G10` (même garde que les captures voisines,
 * ex. `captures-9edz-demandes-connexion.spec.ts`) : `pnpm test:e2e` ordinaire
 * n'écrit jamais ces fichiers.
 *
 * Les DEUX états de caméra (« active », « refusée ») exigent un appareil
 * FACTICE au lancement du navigateur (`--use-fake-device-for-media-stream`) :
 * sans lui, l'environnement de cette prise n'a AUCUNE caméra, et
 * `getUserMedia` échoue par « absente » (`NotFoundError`) avant même de poser
 * la question d'une autorisation — un faux « refusée » qui ne prouverait rien
 * de l'écran réellement écrit. La fixture `page` du projet `chromium` de
 * `playwright.config.ts` ne porte pas cet appareil : les deux captures de
 * caméra lancent donc leur PROPRE navigateur. Seule la capture « active »
 * accorde aussi la permission (et `--use-fake-ui-for-media-stream`, pour
 * s'affranchir de toute invite) ; « refusée » garde l'appareil mais ne
 * l'accorde jamais, et Chromium sans tête refuse alors sans invite
 * (`NotAllowedError`) — exactement le chemin d'un technicien qui dit non.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9G10 ?? "";

function cheminCapture(nom: string, largeur: number): string {
  return join(DOSSIER, `${nom}-${largeur}.png`);
}

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: cheminCapture(nom, 1280), fullPage: false });
  await page.setViewportSize({ width: 375, height: 800 });
  await page.screenshot({ path: cheminCapture(nom, 375), fullPage: false });
}

/**
 * `[role="status"]`/`[role="alert"]` ne suffit pas à repérer l'état `active` :
 * une région `aria-live` globale, vide, porte le même rôle en permanence
 * (mesuré — elle ne devient jamais « hidden »). La vidéo, elle, ne porte une
 * image (`videoWidth > 0`) qu'une fois le flux réellement ouvert.
 */
async function attendreCameraActive(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const video = document.querySelector("video");
    return video !== null && video.videoWidth > 0;
  });
}

async function attendreOverlay(page: Page, texte: string): Promise<void> {
  await page.getByText(texte).waitFor({ state: "visible" });
}

async function naviguerVersLeScanner(
  navigateur: Browser,
  options: { readonly accorderPermission: boolean },
): Promise<Page> {
  const contexte = await navigateur.newContext({ baseURL: BASE_URL });
  if (options.accorderPermission) {
    await contexte.grantPermissions(["camera"], { origin: BASE_URL });
  }
  const page = await contexte.newPage();
  await ouvrirUneSession(page);
  await page.goto("/parc/scanner");
  return page;
}

test("bandeau de /parc — le bouton « Scanner un QR code »", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/parc");
  await capturer(page, "bandeau-parc");
});

test("/parc/scanner — jeton inconnu, « QR non reconnu »", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/parc/scanner");
  await page.locator("#scanner-qr-saisie-manuelle").fill(engendrerJetonQr());
  await page
    .getByRole("button", { name: fr["machine.scanner.saisie_bouton"] })
    .click();
  await capturer(page, "qr-non-reconnu");
});

test("/parc/scanner — autorisation refusée", async () => {
  if (DOSSIER === "") return;
  const navigateur = await chromium.launch({
    args: ["--use-fake-device-for-media-stream"],
  });
  try {
    const page = await naviguerVersLeScanner(navigateur, {
      accorderPermission: false,
    });
    await attendreOverlay(page, fr["machine.scanner.refusee"]);
    await capturer(page, "autorisation-refusee");
  } finally {
    await navigateur.close();
  }
});

test("/parc/scanner — lecteur ouvert, caméra factice active", async () => {
  if (DOSSIER === "") return;
  const navigateur = await chromium.launch({
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  try {
    const page = await naviguerVersLeScanner(navigateur, {
      accorderPermission: true,
    });
    await attendreCameraActive(page);
    await capturer(page, "lecteur-ouvert");
  } finally {
    await navigateur.close();
  }
});
