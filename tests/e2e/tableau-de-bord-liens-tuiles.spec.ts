import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import {
  cleJour,
  jourDe,
  maintenant,
  type JourLocal,
} from "@/lib/calendar/fuseau";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { COMPTE_RM_EPREUVE, MOT_DE_PASSE_EPREUVE } from "./setup/scene";
import { ouvrirUneSession } from "./setup/session";

/**
 * 98-TABLEAU-2 — CHAQUE TUILE DU TABLEAU DE BORD MÈNE À LA LISTE QU'ELLE
 * COMPTE.
 *
 * **RÉORIENTÉ (9EG-TP-UX6-TABLEAU-DE-BORD-1, D185)** — le tableau de bord est
 * reconstruit selon le rôle et la maquette du 28/09 : chaque tuile EST
 * désormais un `<Link>` cliquable sur toute sa surface (`Kpi`, D140), jamais
 * accompagnée d'un second lien texte sous elle. Les épreuves qui visaient ce
 * second lien (13 px, ≥ 32 px) sont retirées : la zone cliquable de la tuile
 * elle-même est déjà gardée par `tests/unit/ui/composants-base.test.tsx` et
 * `tests/e2e/tuiles-cliquables.spec.ts`. Ce fichier garde seulement la
 * navigation RÉELLE de deux tuiles — chacune compte EXACTEMENT ce que son
 * lien ouvre (IN-47).
 */

test.describe.configure({ mode: "serial" });

const SOCIETE_CODE = "CODIMA-NC";
const FENETRE = { width: 1280, height: 900 };

/** `CAPTURES_TABLEAU_2=<dossier>` écrit l'écran, pour `docs/propositions/`. */
const DOSSIER_CAPTURES = process.env.CAPTURES_TABLEAU_2 ?? "";

async function capturer(page: Page, nom: string): Promise<void> {
  if (DOSSIER_CAPTURES === "") return;
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-1280.png`),
    fullPage: true,
  });
}

let aujourdHui: JourLocal;
let cleAujourdHui: string;

test.beforeAll(async () => {
  const client = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: SOCIETE_CODE },
      select: { fuseau_horaire: true },
    });
    aujourdHui = jourDe(maintenant(societe.fuseau_horaire).local);
    cleAujourdHui = cleJour(aujourdHui);
  } finally {
    await client.$disconnect();
  }
});

test.beforeEach(async ({ page }) => {
  await page.setViewportSize(FENETRE);
});

/**
 * CONNEXION RM — même geste que `connecter` de `droits-rm-rs.spec.ts` : ni
 * RM ni RS n'est un rôle sensible, paramétré par le courriel plutôt que figé
 * sur `adv`. « Suspendues » (D185) n'existe que sur la composition
 * responsable matériel/responsable SAV, jamais sur celle de l'ADV
 * (`ouvrirUneSession`) — d'où une connexion dédiée pour cette seule tuile.
 */
async function connecterRM(page: Page): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(COMPTE_RM_EPREUVE);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await expect(page).toHaveURL(/\/planning/);
}

/** Le premier nombre isolé sur sa propre ligne, dans un texte rendu multi-lignes. */
function premierNombreIsole(texte: string): number | null {
  const correspondance = /\n(\d+)\n/.exec(`\n${texte}\n`);
  return correspondance === null ? null : Number(correspondance[1]);
}

/** Le lien de LA TUILE elle-même — son premier enfant direct (même recette que `tuiles-cliquables.spec.ts`). */
function lienDeLaTuile(tuile: ReturnType<Page["locator"]>) {
  return tuile.locator("> a").first();
}

test("« Aujourd'hui » ouvre la vue jour du planning, au jour même", async ({
  page,
}) => {
  await ouvrirUneSession(page);
  await page.goto("/tableau-de-bord");
  const tuile = page.locator('[data-bloc="kpi-aujourdhui"]');
  await expect(tuile).toBeVisible();
  const lien = lienDeLaTuile(tuile);
  await expect(lien).toHaveAttribute(
    "href",
    `/planning?vue=jour&jour=${cleAujourdHui}`,
  );
  await capturer(page, "tableau-de-bord");

  await lien.click();
  await page.waitForURL(`/planning?vue=jour&jour=${cleAujourdHui}`);
  // La page RENDUE, pas seulement l'URL atteinte (I5, une 404 changerait
  // aussi l'URL) : la vue jour du planning porte ce marqueur.
  await expect(page.locator('[data-maquette-bloc="vue-jour"]')).toBeVisible();
});

test("« Suspendues » compte EXACTEMENT ce que l'onglet « Bloquées » du registre montre, et y mène", async ({
  page,
}) => {
  await connecterRM(page);
  await page.goto("/tableau-de-bord");
  const tuile = page.locator('[data-bloc="kpi-suspendues"]');
  await expect(tuile).toBeVisible();

  const lien = lienDeLaTuile(tuile);
  await expect(lien).toHaveAttribute("href", "/interventions?vue=bloquees");

  // LA VALEUR DE LA TUILE, LUE DANS LE RENDU — jamais un nombre absolu
  // (fullyParallel) : elle est comparée, deux lignes plus bas, à l'onglet
  // qu'elle nomme, lu dans le MÊME passage.
  const valeurTuile = premierNombreIsole(await tuile.innerText());
  expect(valeurTuile).not.toBeNull();

  await lien.click();
  await page.waitForURL("/interventions?vue=bloquees");
  // LE COMPTEUR DE L'ONGLET EST LU SUR `[data-compte]` (TP-UX3-1-REGISTRE-1),
  // jamais parsé depuis un texte rendu « Libellé (N) ».
  const ongletActif = page.locator(
    'nav[data-nav="onglets-registre"] a[aria-current="page"]',
  );
  await expect(ongletActif).toContainText(fr["interventions.vue.bloquees"]);
  const compteOnglet = await ongletActif
    .locator("[data-compte]")
    .getAttribute("data-compte");
  expect(compteOnglet).not.toBeNull();

  expect(valeurTuile).toBe(Number(compteOnglet));
});
