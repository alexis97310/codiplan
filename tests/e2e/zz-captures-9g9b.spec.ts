import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { PrismaClient } from "@prisma/client";
import { expect, test, type Page } from "@playwright/test";

import { creerAuth } from "@/lib/auth/config";
import { Role } from "@/lib/auth/roles";
import { avecContexteRls } from "@/lib/db/rls";
import { uuidv7 } from "@/lib/db/uuid";
import { fr } from "@/lib/i18n";

import { urlAdministration } from "./setup/base";
import {
  COMPTE_ADMIN_SOCIETE_EPREUVE,
  COMPTE_TECHNICIEN_EPREUVE,
  MOT_DE_PASSE_EPREUVE,
} from "./setup/scene";
import { ouvrirLaSessionSensible, ouvrirUneSession } from "./setup/session";

/**
 * LES CAPTURES DE 9G9B-ENTETES-TEXTES-ACCES — AVANT/APRÈS, même recette que
 * `zz-captures-9g9a.spec.ts` : rien n'est écrit sans `CAPTURES_9G9B` (le
 * dossier), `CAPTURES_9G9B_PHASE` choisit entre `avant` et `apres` (par
 * défaut `apres`). Sept écrans, deux largeurs — connexion, enrôlement,
 * Planning (en-tête), fiche intervention (en-tête), Paramètres › Société
 * (champ fichier), fiche terrain, coquille hors réseau.
 *
 * AVANT se joue sur un `git worktree` planté sur le premier commit de ce
 * lot — même recette que la note de `captures-avant-apres-e2e`.
 *
 * L'ENRÔLEMENT a SA PROPRE IDENTITÉ JETABLE, forgée en `beforeAll`, effacée
 * en `afterAll`, aucune ligne au semis (I9) — même patron que
 * `captures-9cw-tp-s6-second-facteur.spec.ts` : les comptes partagés du
 * semis sont déjà activés par `tests/e2e/setup/global.ts`, et ne retombent
 * plus jamais sur `/enrolement`.
 */
test.describe.configure({ mode: "serial" });

const DOSSIER = process.env.CAPTURES_9G9B ?? "";
const PHASE = process.env.CAPTURES_9G9B_PHASE === "avant" ? "avant" : "apres";

async function capturer(
  page: Page,
  nom: string,
  largeur: number,
): Promise<void> {
  if (DOSSIER === "") return;
  await page.setViewportSize({ width: largeur, height: 900 });
  mkdirSync(DOSSIER, { recursive: true });
  await page.screenshot({
    path: join(DOSSIER, `${PHASE}-${nom}-${largeur}.png`),
    fullPage: true,
  });
}

function admin(): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: urlAdministration() } },
  });
}

function urlApplicative(): string {
  const url = new URL(urlAdministration());
  url.username = "codiplan_app";
  url.password = "";
  return url.toString();
}

const identitesCreees: string[] = [];

/** Ouvre une identité `direction` jetable, jamais enrôlée, par le chemin administratif. */
async function nouveauCompte(etiquette: string): Promise<string> {
  const proprietaire = admin();
  let societeId = "";
  try {
    const societe = await proprietaire.societe.findFirstOrThrow({
      where: { code: "CODIMA-NC" },
      select: { id: true },
    });
    societeId = societe.id;
  } finally {
    await proprietaire.$disconnect();
  }

  const email = `9g9b.${etiquette}@codima.test`;
  const applicatif = new PrismaClient({
    datasources: { db: { url: urlApplicative() } },
  });
  try {
    const authAdmin = creerAuth(applicatif, {
      societeId,
      role: Role.admin_societe,
    });
    const cree = await authAdmin.api.signUpEmail({
      body: {
        email,
        password: MOT_DE_PASSE_EPREUVE,
        name: `9G9B ${etiquette}`,
      },
    });
    identitesCreees.push(cree.user.id);
    await avecContexteRls(
      applicatif,
      { societeId, role: Role.admin_societe },
      (tx) =>
        tx.$executeRawUnsafe(
          `INSERT INTO "utilisateur_societe" ("id","utilisateur_id","societe_id","role")
             VALUES ($1::uuid, $2::uuid, $3::uuid, $4::"Role")`,
          uuidv7(),
          cree.user.id,
          societeId,
          Role.direction,
        ),
    );
  } finally {
    await applicatif.$disconnect();
  }
  return email;
}

test.afterAll(async () => {
  if (identitesCreees.length === 0) return;
  const client = admin();
  try {
    await client.journalAcces.deleteMany({
      where: { utilisateur_id: { in: identitesCreees } },
    });
    await client.utilisateurSociete.deleteMany({
      where: { utilisateur_id: { in: identitesCreees } },
    });
    await client.utilisateur.deleteMany({
      where: { id: { in: identitesCreees } },
    });
  } finally {
    await client.$disconnect();
  }
});

async function seConnecter(page: Page, email: string): Promise<void> {
  await page.goto("/connexion");
  await page.getByLabel(fr["connexion.email"]).fill(email);
  await page
    .getByLabel(fr["connexion.mot_de_passe"])
    .fill(MOT_DE_PASSE_EPREUVE);
  await page.getByRole("button", { name: fr["connexion.valider"] }).click();
  await page.waitForLoadState("networkidle");
}

for (const largeur of [1280, 375] as const) {
  test(`connexion — ${PHASE} — ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto("/connexion");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "connexion", largeur);
  });

  test(`enrôlement — ${PHASE} — ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    const email = await nouveauCompte(`${PHASE}-${largeur}`);
    await seConnecter(page, email);
    await expect(page).toHaveURL(/\/enrolement$/);
    await capturer(page, "enrolement", largeur);
  });

  test(`planning — ${PHASE} — ${largeur}px`, async ({ page }) => {
    await ouvrirUneSession(page);
    await page.setViewportSize({ width: largeur, height: 900 });
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "planning", largeur);
  });

  test(`fiche intervention — ${PHASE} — ${largeur}px`, async ({ page }) => {
    await ouvrirUneSession(page);
    await page.goto("/interventions");
    await expect(page.locator("main")).toBeVisible();
    // LA PREMIÈRE LIGNE DU REGISTRE, jamais un identifiant fixe — même
    // principe que `zz-captures-9g9a.spec.ts`. Un UUID, jamais un lien de
    // filtre (`/interventions/nouvelle`, `/interventions/a-facturer`…), qui
    // partage le même préfixe.
    const hrefs = await page
      .locator('a[href^="/interventions/"]')
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("href")),
      );
    const hrefFiche = hrefs.find((href) =>
      /^\/interventions\/[0-9a-f-]{36}(\?.*)?$/.test(href ?? ""),
    );
    expect(hrefFiche, "aucune fiche d'intervention trouvée").toBeDefined();
    await page.goto(hrefFiche as string);
    await expect(page.locator("main")).toBeVisible();
    await page.setViewportSize({ width: largeur, height: 900 });
    await capturer(page, "fiche-intervention", largeur);
  });

  test(`paramètres société — ${PHASE} — ${largeur}px`, async ({ page }) => {
    await ouvrirLaSessionSensible(page, COMPTE_ADMIN_SOCIETE_EPREUVE);
    await page.goto("/parametres/societe");
    await expect(page.locator("main")).toBeVisible();
    await page.setViewportSize({ width: largeur, height: 900 });
    await capturer(page, "parametres-societe", largeur);
  });

  test(`fiche terrain — ${PHASE} — ${largeur}px`, async ({ page }) => {
    await ouvrirLaSessionSensible(page, COMPTE_TECHNICIEN_EPREUVE);
    await page.goto("/terrain");
    await expect(page.locator("main")).toBeVisible();
    // Un UUID, jamais « Profil » de la barre basse (`/terrain/profil`), qui
    // partage le même préfixe.
    const hrefs = await page
      .locator('a[href^="/terrain/"]')
      .evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("href")),
      );
    const hrefFiche = hrefs.find((href) =>
      /^\/terrain\/[0-9a-f-]{36}(\?.*)?$/.test(href ?? ""),
    );
    expect(hrefFiche, "aucune fiche terrain trouvée").toBeDefined();
    await page.goto(hrefFiche as string);
    await expect(page.locator("main")).toBeVisible();
    await page.setViewportSize({ width: largeur, height: 900 });
    await capturer(page, "fiche-terrain", largeur);
  });

  test(`coquille hors réseau — ${PHASE} — ${largeur}px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto("/terrain-hors-reseau");
    await capturer(page, "coquille-hors-reseau", largeur);
  });

  // LOT INTROUVABLE (9G9BA-REPRISE-9G9B) — le fil d'Ariane posé par le point
  // 5 sur cette branche (`imports/[id]/page.tsx`, `lot === null`) EST le
  // chemin de retour visible ; aucun second lien nu ne manque.
  test(`lot introuvable — ${PHASE} — ${largeur}px`, async ({ page }) => {
    await ouvrirUneSession(page);
    await page.setViewportSize({ width: largeur, height: 900 });
    await page.goto("/imports/00000000-0000-0000-0000-000000000000");
    await expect(page.locator("main")).toBeVisible();
    await capturer(page, "lot-introuvable", largeur);
  });
}
