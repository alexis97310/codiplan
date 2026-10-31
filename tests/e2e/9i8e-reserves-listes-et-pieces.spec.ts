import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { uuidv7 } from "@/lib/db/uuid";

import { urlAdministration } from "./setup/base";
import {
  assertListeVisibleEtCliquable,
  valeurChamp,
} from "./setup/selecteur-recherche";
import { ouvrirUneSession } from "./setup/session";

/**
 * 9I8E-RESERVES-LISTES-ET-PIECES, points 1 à 3 — réserves de revue de
 * 9I7E/9I7E1 (solde 610) sur `components/ui/selecteur-recherche.tsx`.
 *
 * Scène minimale, PAS celle de 9I7E : ces trois points n'éprouvent que le
 * panneau de `SelecteurRecherche` lui-même, jamais une fiche créée de bout
 * en bout — deux clients actifs suffisent pour que le champ `client_id`
 * (`/parc/nouvelle`, `/sites/nouveau`) rende au moins deux résultats, exigés
 * par `assertListeVisibleEtCliquable`.
 */

test.describe.configure({ mode: "serial" });

const PREFIXE = "9I8E-";

const CLIENTS = [uuidv7(), uuidv7()] as const;

function libelleClient(rang: number): string {
  return `${PREFIXE}Client ${rang}`;
}

let clientAcces: PrismaClient;

test.beforeAll(async () => {
  clientAcces = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });

  const societe = await clientAcces.societe.findFirstOrThrow({
    where: { code: "CODIMA-NC" },
    select: { id: true },
  });

  await clientAcces.client.createMany({
    data: CLIENTS.map((id, rang) => ({
      id,
      societe_id: societe.id,
      raison_sociale: libelleClient(rang + 1),
      actif: true,
    })),
  });
});

test.afterAll(async () => {
  try {
    await clientAcces.client.deleteMany({
      where: { id: { in: [...CLIENTS] } },
    });
  } finally {
    await clientAcces.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

/**
 * CLIQUE LE CHAMP `nom`, PUIS RÉDUIT LA FENÊTRE À SA HAUTEUR MESURÉE PLUS
 * UNE MARGE (point 1) — la géométrie du panneau (`position: fixed`) ne
 * dépend que des coordonnées DANS LA FENÊTRE, jamais de ce qui entoure le
 * champ dans le DOM : borner la fenêtre juste sous le champ reproduit de
 * façon déterministe un « formulaire défilé » où il ne reste presque plus
 * de place SOUS lui, quelle que soit sa profondeur réelle dans le
 * formulaire.
 *
 * MESURÉ APRÈS LE CLIC, JAMAIS AVANT : `locator.click()` fait défiler la
 * page si besoin avant de cliquer (actionabilité Playwright) — mesurer
 * avant laissait passer une épreuve dont la position supposée ne tenait
 * plus une fois le champ réellement cliqué.
 *
 * `margeBasPx` (180 par défaut) laisse assez de place pour que la barre
 * d'action fixe du formulaire (`action-primaire.tsx`, `bottom-16`, visible
 * sous 901 px) ne recouvre pas le champ lui-même — une marge trop courte
 * (90 px, mesuré) place le bas de la fenêtre en PLEIN sur cette barre, et
 * `champEstVisible` ferme alors la liste avant même qu'elle s'ouvre : ce
 * N'EST PAS un défaut du composant, la barre masque RÉELLEMENT le champ à
 * cette hauteur-là.
 */
async function placerChampPresDuBas(
  page: Page,
  nom: string,
  margeBasPx = 180,
): Promise<void> {
  const champ = page.locator(`[data-selecteur="${nom}"] input[type="text"]`);
  await champ.click();
  const boite = await champ.boundingBox();
  if (boite === null) {
    throw new Error(`champ ${nom} introuvable`);
  }
  const fenetre = page.viewportSize();
  if (fenetre === null) {
    throw new Error("fenêtre introuvable");
  }
  await page.setViewportSize({
    width: fenetre.width,
    height: Math.round(boite.y + boite.height + margeBasPx),
  });
}

/**
 * POUSSE LE CHAMP `nom` SOUS LE BANDEAU STICKY (point 2) — vise un point
 * proche du haut de la fenêtre, où un bandeau `position: sticky` recouvre
 * nécessairement le contenu défilé derrière lui, sans que ce fichier ait
 * besoin de connaître sa hauteur exacte (`champEstVisible`, dans le
 * composant, ne la connaît pas davantage).
 */
async function placerChampSousLeBandeau(
  page: Page,
  nom: string,
): Promise<void> {
  await page.evaluate((nomDuChamp) => {
    const champ = document.querySelector(
      `[data-selecteur="${nomDuChamp}"] input[type="text"]`,
    );
    if (champ === null) {
      throw new Error(`champ ${nomDuChamp} introuvable`);
    }
    const rect = champ.getBoundingClientRect();
    const cible = window.scrollY + rect.top - 10;
    window.scrollTo(0, Math.max(0, cible));
  }, nom);
}

test("point 1 — un champ près du bas d'un formulaire défilé ouvre sa liste vers le haut, dans la fenêtre (375 px tactile)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/parc/nouvelle");

  await placerChampPresDuBas(page, "client_id");
  await assertListeVisibleEtCliquable(page, "client_id", PREFIXE);
});

test("point 2 — défiler le champ sous le bandeau ferme la liste, qui ne recouvre jamais le bandeau (1280 px)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/parc/nouvelle");

  const champ = page.locator('[data-selecteur="client_id"] input[type="text"]');
  const motif = `q=${encodeURIComponent(PREFIXE)}`;
  await champ.click();
  await Promise.all([
    page.waitForResponse((reponse) => reponse.url().includes(motif)),
    champ.fill(PREFIXE),
  ]);
  await expect(
    page.locator('#client_id-resultats li[role="option"]').first(),
  ).toBeVisible();

  await placerChampSousLeBandeau(page, "client_id");

  await expect(page.locator("#client_id-resultats")).toBeHidden();
});

test("point 3 — « choix requis » reste visible et atteignable, liste ouverte (1280 px)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/sites/nouveau");

  const champ = page.locator('[data-selecteur="client_id"] input[type="text"]');
  const motif = `q=${encodeURIComponent(PREFIXE)}`;
  await champ.click();
  await Promise.all([
    page.waitForResponse((reponse) => reponse.url().includes(motif)),
    champ.fill(PREFIXE),
  ]);

  // `requestSubmit` plutôt qu'un clic sur le bouton (55-FORMULAIRES-1) :
  // cliquer dessus défocaliserait le champ, ce qui fermerait le panneau par
  // le `onBlur` existant — un comportement du composant que ce point ne
  // touche pas, et que cette épreuve n'a pas à affronter. Le FORMULAIRE DU
  // CHAMP, jamais `document.querySelector("form")` seul — la barre de
  // navigation porte elle aussi un formulaire (déconnexion).
  await page.evaluate(() => {
    document
      .querySelector('[data-selecteur="client_id"] input[type="text"]')
      ?.closest("form")
      ?.requestSubmit();
  });

  const erreur = page.locator('[data-selecteur="client_id"] [role="alert"]');
  await expect(erreur).toBeVisible();
  const liste = page.locator("#client_id-resultats");
  await expect(liste).toBeVisible();

  const boite = await erreur.boundingBox();
  expect(boite).not.toBeNull();
  if (boite === null) {
    throw new Error("inatteignable — l'assertion ci-dessus a déjà échoué");
  }
  const recouverte = await page.evaluate(
    ({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return element === null || element.closest('[role="alert"]') === null;
    },
    { x: boite.x + boite.width / 2, y: boite.y + boite.height / 2 },
  );
  expect(recouverte).toBe(false);

  // Le choix reste possible normalement après ce refus, sur le MÊME texte
  // déjà filtré — un second résultat suffit, choisi directement (refaire
  // `fill` du même texte ne redéclencherait aucune requête, la valeur étant
  // inchangée).
  const second = page.locator('#client_id-resultats li[role="option"]').nth(1);
  await expect(second).toBeVisible();
  await second.click();
  await expect(valeurChamp(page, "client_id")).not.toHaveValue("");
});
