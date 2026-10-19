import { expect, test, type Page } from "@playwright/test";

import { fr } from "@/lib/i18n";

import { reperesDeLaScene } from "../setup/reperes";
import {
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
  ouvrirLeCompteDeLEpreuve,
} from "../setup/scene";

/**
 * LA CONSULTATION SANS RÉSEAU, DE BOUT EN BOUT (9F4H1-HORS-RESEAU-
 * CONSULTATION) — décisions n° 105 et 106 d'Alexis, 14/10/2026.
 *
 * ## CE QUE CE SCÉNARIO NE PEUT PAS MESURER, ET POURQUOI C'EST ÉCRIT
 *
 * **MESURÉ** : `context.setOffline(true)` ne bloque PAS le `fetch()` qu'un
 * service worker exécute lui-même à l'intérieur d'un `respondWith` — ni
 * `context.setOffline`, ni `context.route` ne sont jamais invoqués pour cette
 * requête (`appele` reste à 0 dans l'instrumentation qui l'a mesuré). C'est une
 * limite de Playwright/Chromium pour les requêtes interceptées par un service
 * worker, pas un défaut de `public/sw.js`. Une NAVIGATION vers `/terrain` hors
 * réseau (repli vers la coquille, `estRepliTerrain`) n'est donc PAS éprouvable
 * ici par ce chemin ; elle reste vue par lecture (`public/sw.js`) et par les
 * épreuves existantes de `socle-pwa.spec.ts`, dont le même constat vaut déjà
 * pour `/sante`.
 *
 * **CE QUE CE FICHIER MESURE RÉELLEMENT**, sans dépendre de ce blocage :
 * l'instantané se pose dans IndexedDB ; la page PUBLIQUE
 * `/terrain-hors-reseau` (atteinte par une navigation directe, pas par le
 * repli) affiche la journée, en lecture seule, puis une fiche à partir de
 * CETTE copie — depuis 9F4H4B-OUVERTURE-A-FROID (D120, précision D216), une
 * fiche de TRAVAIL, jamais plus une lecture : la JOURNÉE seule reste
 * lecture seule ; le bandeau réagit à `navigator.onLine`, que
 * `context.setOffline` bascule réellement (propriété du DOM, pas une requête
 * réseau) ; l'effacement à la déconnexion et à l'arrivée sur `/connexion`
 * vide la copie ; un second technicien n'hérite jamais de celle du premier.
 */
test.describe.configure({ mode: "serial" });

async function connecter(page: Page, email: string): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(email);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/terrain$/);
}

/** La copie IndexedDB existe-t-elle déjà sur ce navigateur ? */
async function copiePosee(page: Page): Promise<boolean> {
  return page.evaluate(
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
  );
}

async function attendreLaCopie(page: Page): Promise<void> {
  await expect.poll(() => copiePosee(page), { timeout: 10_000 }).toBe(true);
}

/** Le premier lien d'intervention affiché sur « Ma journée » (exclut la
 * navigation de segment, qui ne pointe jamais vers un UUID). */
async function premiereFiche(page: Page): Promise<string> {
  const href = await page.evaluate(() => {
    const correspond = /^\/terrain\/[0-9a-f-]{36}$/;
    for (const lien of document.querySelectorAll("a")) {
      const cible = lien.getAttribute("href");
      if (cible !== null && correspond.test(cible)) {
        return cible;
      }
    }
    return null;
  });
  expect(href, "aucune fiche affichée sur /terrain").not.toBeNull();
  return href as string;
}

test("journée et fiche se consultent sans réseau depuis la copie, le bandeau réagit au réseau, la déconnexion efface, un autre technicien ne voit jamais la copie du premier", async ({
  page,
  context,
}) => {
  const reperes = await reperesDeLaScene();
  await ouvrirLeCompteDeLEpreuve(reperes.societeId, "perrin@codima.test");

  // ── 1. TECHNICIEN 1, EN LIGNE : L'INSTANTANÉ EST PRIS ──────────────────
  await connecter(page, COMPTE_TECHNICIEN_EPREUVE);
  await expect(
    page.getByRole("heading", { name: fr["terrain.titre"] }),
  ).toBeVisible();
  await attendreLaCopie(page);
  const ficheHref = await premiereFiche(page);
  const ficheId = ficheHref.split("/").pop() as string;

  // ── 2. LE BANDEAU RÉAGIT À `navigator.onLine` SUR LA PAGE EN LIGNE ─────
  await expect(
    page.getByText(fr["terrain.bandeau.prefixe"], { exact: false }),
  ).toHaveCount(0);
  await context.setOffline(true);
  await expect(
    page.getByText(fr["terrain.bandeau.prefixe"], { exact: false }),
  ).toBeVisible();
  await context.setOffline(false);
  await expect(
    page.getByText(fr["terrain.bandeau.prefixe"], { exact: false }),
  ).toHaveCount(0);

  // ── 3. LA COQUILLE PUBLIQUE AFFICHE LA JOURNÉE DEPUIS LA COPIE ─────────
  await context.setOffline(true);
  await page.goto("/terrain-hors-reseau");
  await expect(
    page.getByRole("heading", { name: fr["terrain.hors_reseau.titre"] }),
  ).toBeVisible();
  await expect(page.locator(`a[href*="${ficheId}"]`)).toBeVisible();

  // ── 4. LA FICHE, DEVENUE UNE FICHE DE TRAVAIL, PAR LIEN DIRECT (D120,
  //    précision D216 sous 9F4H4BA-REPRISE-9F4H4B : la garantie « lecture
  //    seule » de 9F4H1 est remplacée par la fiche de travail du point 2 de
  //    9F4H4B — compteur, rapport, prestations, photos, signature,
  //    Terminer, sous l'identité de l'instantané, jamais une session) ─────
  await page.goto(`/terrain-hors-reseau?id=${ficheId}`);
  await expect(
    page.getByRole("heading", { name: fr["terrain.hors_reseau.titre"] }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: fr["terrain.rapport.titre"] }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: fr["terrain.terminer.titre"] }),
  ).toBeVisible();
  // AUCUN montant — jamais la forme que `formatMoney` produit (chiffres
  // groupés par milliers, espace insécable, devise) dans le texte de la fiche.
  const texteFiche = await page.locator("main").innerText();
  expect(texteFiche).not.toMatch(/\d[\d ]*(?:,\d+)? (?:XPF|€)/u);
  // AUCUNE action qui exigerait une session : jamais de bouton « Envoyer »
  // depuis la coquille (aucune session ici, le message ci-dessous le dit).
  await expect(
    page.getByRole("button", { name: fr["terrain.file.envoyer"] }),
  ).toHaveCount(0);
  // Les boutons présents sont EXACTEMENT les gestes de la fiche de travail
  // pour CETTE intervention : le compteur et « Terminer » sont refusés par
  // le serveur (donc affichés en message, sans bouton — intervention pas
  // encore en cours), les prestations sont indisponibles hors réseau (donc
  // sans case à cocher) ; restent la photo (et son sélecteur de fichier
  // natif) et les trois issues de signature — cinq boutons, quatre nommés
  // ci-dessous et le cinquième vérifié par structure juste après, car le
  // libellé du sélecteur de fichier natif n'est pas sous le contrôle de
  // l'application (hors du dictionnaire, L0-11).
  await expect(page.getByRole("button")).toHaveCount(5);
  await expect(
    page.getByRole("button", { name: fr["terrain.photos.ajouter"] }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: fr["terrain.signature.option_signee"] }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: fr["terrain.signature.option_absent"] }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: fr["terrain.signature.option_refus"] }),
  ).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(1);
  await expect(
    page.getByText(fr["terrain.hors_reseau.saisies_gardees"]),
  ).toBeVisible();
  await context.setOffline(false);

  // ── 5. DÉCONNEXION EN LIGNE, PUIS HORS RÉSEAU : AUCUNE COPIE ───────────
  await page.goto("/terrain/profil");
  await page
    .locator("main")
    .getByRole("button", { name: fr["nav.deconnexion"] })
    .click();
  await expect(page).toHaveURL(/\/connexion/);

  await context.setOffline(true);
  await page.goto("/terrain-hors-reseau");
  await expect(
    page.getByText(fr["terrain.hors_reseau.aucune_copie"]),
  ).toBeVisible();
  await context.setOffline(false);

  // ── 6. UN SECOND TECHNICIEN NE VOIT JAMAIS LA COPIE DU PREMIER ─────────
  await connecter(page, "perrin@codima.test");
  await attendreLaCopie(page);
  await context.setOffline(true);
  await page.goto("/terrain-hors-reseau");
  await expect(
    page.getByRole("heading", { name: fr["terrain.hors_reseau.titre"] }),
  ).toBeVisible();
  await expect(
    page.getByText(fr["terrain.hors_reseau.aucune_copie"]),
  ).toHaveCount(0);
  // AUCUNE trace de la fiche du premier technicien.
  await expect(page.locator(`a[href*="${ficheId}"]`)).toHaveCount(0);
  await context.setOffline(false);
});
