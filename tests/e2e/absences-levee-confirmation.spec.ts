import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { Role } from "@/lib/auth/roles";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import { ouvrirUneSession } from "./setup/session";

/**
 * 99D-ABSENCES-1 — LEVER UN BLOCAGE DEMANDE UNE CONFIRMATION.
 *
 * ## Ce que les épreuves unitaires ne peuvent pas prouver
 *
 * Rien n'éprouvait jusqu'ici que la page rende le formulaire « Lever » avec
 * un dialogue de confirmation AVANT la soumission — `BoutonAvecConfirmation`
 * (`components/ui/bouton-confirmation.tsx`, extrait de `BoutonAnnuler`, le
 * bouton d'annulation de la fiche d'intervention, lot 84) n'a encore aucun
 * appelant e2e sur cet écran.
 *
 * ## SA PROPRE SCÈNE, PRÉFIXÉE `ABSLEV-` — jamais `tests/e2e/setup/scene.ts`
 *
 * Un technicien FORGÉ et un blocage posé DIRECTEMENT en base (jamais par le
 * formulaire de pose, hors sujet ici) — un seul jour, à quarante-cinq jours
 * d'aujourd'hui : à l'intérieur de la fenêtre affichée par `/absences`
 * (−30 / +90 jours), donc visible dans le TABLEAU, mais hors de la semaine
 * par défaut du calendrier (le calendrier ne s'en trouve donc pas alourdi).
 *
 * **Le blocage n'existe qu'à l'intérieur de CETTE épreuve** — créé au début,
 * supprimé à la fin (par la levée elle-même, ou par `afterAll` si l'épreuve
 * échoue avant) — pour ne pas allonger `/absences` pendant qu'un fichier
 * voisin (`ecrans-largeur-utile.spec.ts`) mesure que cet écran reste COURT.
 * `CI=1 pnpm verify:full` exécute la suite avec un seul worker
 * (`playwright.config.ts`) : aucune autre épreuve ne peut donc s'exécuter
 * PENDANT celle-ci.
 */

test.describe.configure({ mode: "serial" });

const SOCIETE_CODE = "CODIMA-NC";

let utilisateurAbsLev = "";
let utilisateurSocieteAbsLev = "";
let absenceAbsLev = "";

/** Une date à N jours d'aujourd'hui, au format `AAAA-MM-JJ` (UTC). */
function dansNJours(n: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

const JOUR_DU_BLOCAGE = dansNJours(45);
// Le nom sert à la scène (donnée forgée) — JAMAIS à une requête d'écran :
// aucune autre épreuve ne pose de blocage dans la fenêtre de `/absences`
// (−30 / +90 jours) pendant celle-ci (un seul worker sous `CI=1`), le bouton
// « Lever » y est donc SEUL et se trouve sans lire aucun nom (L0-11).
const NOM_PERSONNE = "Technicien ABSLEV- (épreuve 99D-ABSENCES-1)";

async function nouveauClientAdministration(): Promise<PrismaClient> {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

async function effacerLaScene(): Promise<void> {
  if (utilisateurAbsLev === "") {
    return;
  }
  const client = await nouveauClientAdministration();
  try {
    await client.absence.deleteMany({
      where: { utilisateur_id: utilisateurAbsLev },
    });
    await client.utilisateurSociete.deleteMany({
      where: { id: utilisateurSocieteAbsLev },
    });
    await client.utilisateur.deleteMany({ where: { id: utilisateurAbsLev } });
  } finally {
    await client.$disconnect();
  }
}

async function ecrireLaScene(): Promise<void> {
  utilisateurAbsLev = uuidv7();
  utilisateurSocieteAbsLev = uuidv7();
  absenceAbsLev = uuidv7();

  const client = await nouveauClientAdministration();
  try {
    const societe = await client.societe.findFirstOrThrow({
      where: { code: SOCIETE_CODE },
      select: { id: true },
    });

    await client.utilisateur.create({
      data: {
        id: utilisateurAbsLev,
        nom: NOM_PERSONNE,
        email: "abslev-technicien@codiplan.test",
      },
    });
    await client.utilisateurSociete.create({
      data: {
        id: utilisateurSocieteAbsLev,
        utilisateur_id: utilisateurAbsLev,
        societe_id: societe.id,
        role: Role.technicien,
      },
    });
    await client.absence.create({
      data: {
        id: absenceAbsLev,
        societe_id: societe.id,
        utilisateur_id: utilisateurAbsLev,
        du: new Date(`${JOUR_DU_BLOCAGE}T00:00:00.000Z`),
        au: new Date(`${JOUR_DU_BLOCAGE}T00:00:00.000Z`),
      },
    });
  } finally {
    await client.$disconnect();
  }
}

test.beforeAll(ecrireLaScene);
test.afterAll(effacerLaScene);

test.beforeEach(async ({ page }) => {
  await ouvrirUneSession(page);
});

const DOSSIER_CAPTURES = join(
  process.cwd(),
  "docs/propositions/99D-ABSENCES-1/captures",
);

async function capturer(page: Page, nom: string): Promise<void> {
  mkdirSync(DOSSIER_CAPTURES, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 1200 });
  await page.screenshot({
    path: join(DOSSIER_CAPTURES, `${nom}-1280.png`),
    fullPage: true,
  });
}

test("lever un blocage demande une confirmation, et annuler la laisse en place", async ({
  page,
}) => {
  await page.goto("/absences");

  const boutonLever = page.getByRole("button", { name: fr["absences.lever"] });
  await expect(boutonLever).toHaveCount(1);
  await capturer(page, "avant-lever");
  await boutonLever.click();

  // LE DIALOGUE — dit ce que la levée NE fait pas.
  const dialogue = page.locator("dialog");
  await expect(dialogue).toBeVisible();
  await expect(dialogue).toContainText(fr["absences.levee_confirmation_avant"]);
  await expect(dialogue).toContainText(fr["absences.levee_confirmation_apres"]);
  await capturer(page, "confirmation-ouverte");

  // REVENIR — le dialogue se ferme, la ligne reste, le bouton aussi.
  await dialogue
    .getByRole("button", { name: fr["absences.levee_revenir"] })
    .click();
  await expect(dialogue).toBeHidden();
  await expect(
    page.getByRole("button", { name: fr["absences.lever"] }),
  ).toHaveCount(1);

  const client = await nouveauClientAdministration();
  try {
    const compte = await client.absence.count({
      where: { id: absenceAbsLev },
    });
    expect(compte).toBe(1);
  } finally {
    await client.$disconnect();
  }
});

test("confirmer la levée fait disparaître la ligne, et le blocage n'est plus en base", async ({
  page,
}) => {
  await page.goto("/absences");

  await page.getByRole("button", { name: fr["absences.lever"] }).click();

  const dialogue = page.locator("dialog");
  await expect(dialogue).toBeVisible();
  await dialogue
    .getByRole("button", { name: fr["absences.levee_confirmer"] })
    .click();
  await page.waitForLoadState("networkidle");

  await expect(
    page.getByRole("button", { name: fr["absences.lever"] }),
  ).toHaveCount(0);

  const client = await nouveauClientAdministration();
  try {
    const compte = await client.absence.count({
      where: { id: absenceAbsLev },
    });
    expect(compte).toBe(0);
  } finally {
    await client.$disconnect();
  }
});
