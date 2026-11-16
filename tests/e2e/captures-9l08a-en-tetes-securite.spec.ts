import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { type ContexteSession } from "@/lib/auth/contexte";
import { inviterClientAuPortail } from "@/lib/auth/lien-d-acces";
import { choisirLePremierMotDePasse } from "@/lib/auth/premier-acces";
import { Role } from "@/lib/auth/roles";
import { fr } from "@/lib/i18n";

import { urlAdministration, urlApplicative } from "./setup/base";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";

/**
 * CAPTURES APRÈS DE 9L08A-EN-TETES-SECURITE — AUCUN écran ne change
 * visuellement (les en-têtes de sécurité ne se voient pas à l'écran) : ces
 * captures prouvent l'ABSENCE de régression sur une page de chaque famille
 * touchée par `next.config.ts` (bureau, terrain hors réseau, portail), pas
 * un changement. Une seule passe, pas d'« avant ».
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9L08A ?? "";
const EMAIL_PORTAIL = "9l08a-en-tetes-securite@codima.test";
const MOT_DE_PASSE_PORTAIL = "epreuve-9l08a-en-tetes-securite";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `apres-${nom}-${largeur}.png`),
    fullPage: true,
  });
}

/** Même lecture que `tests/e2e/setup/scene.ts` : l'URL est relative, et la
 * bibliothèque met le jeton tantôt en paramètre, tantôt en segment de chemin. */
function jetonDeLUrl(url: string): string | null {
  const analysee = new URL(url, "http://harnais.invalid");
  const enParametre = analysee.searchParams.get("token");
  if (enParametre !== null && enParametre.length > 0) {
    return enParametre;
  }
  const segments = analysee.pathname.split("/").filter((s) => s.length > 0);
  return segments.length === 0 ? null : (segments.at(-1) ?? null);
}

async function preparerLeComptePortail(): Promise<void> {
  const admin = new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
  try {
    const utilisateur = await admin.utilisateur.findFirstOrThrow({
      where: { email: COMPTE_ADMIN_SOCIETE_EPREUVE },
      select: { id: true },
    });
    const utilisateurSociete =
      await admin.utilisateurSociete.findFirstOrThrow({
        where: { utilisateur_id: utilisateur.id },
        select: { societe_id: true },
      });
    const societeId = utilisateurSociete.societe_id;
    const client = await admin.client.findFirstOrThrow({
      where: { societe_id: societeId },
      select: { id: true },
    });

    const contexteAdmin: ContexteSession = {
      utilisateurId: utilisateur.id,
      societeId,
      role: Role.admin_societe,
      secondFacteurValide: true,
      adresseIp: null,
      clientId: null,
    };

    const applicatif = new PrismaClient({
      datasources: { db: { url: urlApplicative() } },
    });
    try {
      const invitation = await inviterClientAuPortail(
        contexteAdmin,
        client.id,
        EMAIL_PORTAIL,
        applicatif,
      );
      if (!invitation.accepte) {
        throw new Error(
          `L'invitation du compte portail de l'épreuve a été refusée : ${invitation.motif}.`,
        );
      }
      if (!invitation.enAttente) {
        if (invitation.url === null) {
          throw new Error(
            "L'invitation n'a rendu aucun jeton : la scène ne peut pas ouvrir " +
              "le compte portail de l'épreuve.",
          );
        }
        const jeton = jetonDeLUrl(invitation.url);
        if (jeton === null) {
          throw new Error(
            "Le jeton n'a pas pu être extrait de l'URL d'invitation.",
          );
        }
        const issue = await choisirLePremierMotDePasse({
          jeton,
          motDePasse: MOT_DE_PASSE_PORTAIL,
          confirmation: MOT_DE_PASSE_PORTAIL,
        });
        if (issue.issue !== "abouti") {
          throw new Error(
            `Le premier accès du compte portail de l'épreuve a été refusé : ${issue.issue}.`,
          );
        }
      }
    } finally {
      await applicatif.$disconnect();
    }
  } finally {
    await admin.$disconnect();
  }
}

async function connecter(page: Page, email: string, motDePasse: string): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(email);
  await page.getByLabel(fr["connexion.mot_de_passe"]).fill(motDePasse);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
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

test.beforeAll(async () => {
  await preparerLeComptePortail();
});

for (const largeur of [1280, 375] as const) {
  test.describe(`à ${largeur}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: largeur, height: 1200 });
    });

    test(`capture — une page du bureau, à ${largeur}px`, async ({ page }) => {
      await connecter(page, COMPTE_EPREUVE, MOT_DE_PASSE_EPREUVE);
      await expect(page).toHaveURL(/\/planning/);
      await capturer(page, "bureau-planning", largeur);
    });

    test(`capture — la coquille terrain hors réseau, à ${largeur}px`, async ({
      page,
      context,
    }) => {
      await connecter(page, COMPTE_TECHNICIEN_EPREUVE, MOT_DE_PASSE_EPREUVE);
      await expect(page).toHaveURL(/\/terrain$/);
      await expect.poll(() => copiePosee(page), { timeout: 10_000 }).toBe(
        true,
      );

      await context.setOffline(true);
      await page.goto("/terrain-hors-reseau");
      await expect(
        page.getByRole("heading", { name: fr["terrain.hors_reseau.titre"] }),
      ).toBeVisible();
      await capturer(page, "terrain-hors-reseau", largeur);
      await context.setOffline(false);
    });

    test(`capture — l'accueil du portail, à ${largeur}px`, async ({
      page,
    }) => {
      await connecter(page, EMAIL_PORTAIL, MOT_DE_PASSE_PORTAIL);
      await page.waitForURL(/\/(arrivee|portail)/);
      await page.goto("/portail");
      await expect(page).toHaveURL(/\/portail/);
      await capturer(page, "portail-accueil", largeur);
    });
  });
}
